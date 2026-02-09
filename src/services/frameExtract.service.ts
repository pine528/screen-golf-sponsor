import { PrismaClient, VodStatus } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// 로컬 저장 경로
const VOD_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'vod');
const FRAME_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'frames');

// 디렉토리 생성
if (!fs.existsSync(FRAME_UPLOAD_DIR)) {
  fs.mkdirSync(FRAME_UPLOAD_DIR, { recursive: true });
}

// Cloudinary 설정 여부 확인
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

interface FrameExtractionConfig {
  fps: number;       // 프레임 추출 속도 (예: 2fps)
  quality: number;   // 썸네일 품질 (1-31, 낮을수록 고품질)
  maxWidth: number;  // 최대 썸네일 너비
}

const DEFAULT_CONFIG: FrameExtractionConfig = {
  fps: 2,        // 초당 2프레임 (노출 검출에 적합)
  quality: 5,    // 고품질
  maxWidth: 1280, // 1280px 너비로 리사이즈
};

class FrameExtractService {
  /**
   * VOD에서 프레임 추출
   */
  async extractFrames(
    vodId: string,
    config: Partial<FrameExtractionConfig> = {}
  ): Promise<{ frameCount: number; processingTime: number }> {
    const startTime = Date.now();
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // VOD 조회
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    if (vod.status !== VodStatus.COMPLETED) {
      throw new BadRequestError('VOD 처리가 완료되지 않았습니다.');
    }

    // 기존 프레임 삭제
    await prisma.vodFrame.deleteMany({
      where: { vodAssetId: vodId },
    });

    // VOD 상태를 PROCESSING으로 변경
    await prisma.vodAsset.update({
      where: { id: vodId },
      data: { status: VodStatus.PROCESSING },
    });

    try {
      // 임시 디렉토리 생성
      const tempDir = path.join(os.tmpdir(), `frames_${vodId}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Cloudinary에서 VOD URL 가져오기 (또는 로컬 파일 경로)
      const videoUrl = await this.getVideoUrl(vod.storageKey);

      // FFmpeg로 프레임 추출
      const outputPattern = path.join(tempDir, 'frame_%05d.jpg');
      const ffmpegCmd = this.buildFFmpegCommand(videoUrl, outputPattern, mergedConfig);

      await execAsync(ffmpegCmd, { timeout: 1800000 }); // 30분 타임아웃

      // 추출된 프레임 파일 목록
      const frameFiles = fs.readdirSync(tempDir)
        .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
        .sort();

      // 각 프레임을 저장하고 DB에 저장
      const framesToCreate = [];
      const vodFrameDir = path.join(FRAME_UPLOAD_DIR, vodId);

      // VOD별 프레임 디렉토리 생성 (로컬 스토리지인 경우)
      if (!isCloudinaryConfigured() && !fs.existsSync(vodFrameDir)) {
        fs.mkdirSync(vodFrameDir, { recursive: true });
      }

      for (let i = 0; i < frameFiles.length; i++) {
        const filePath = path.join(tempDir, frameFiles[i]);
        const buffer = fs.readFileSync(filePath);

        // 타임스탬프 계산 (프레임 번호 / fps)
        const frameNumber = i + 1;
        const timestamp = frameNumber / mergedConfig.fps;

        let thumbnailKey: string;

        if (isCloudinaryConfigured()) {
          // Cloudinary 업로드
          const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
            filename: `frame_${vodId}_${frameNumber.toString().padStart(5, '0')}`,
            resource_type: 'image',
          });
          thumbnailKey = uploadResult.public_id;
        } else {
          // 로컬 스토리지에 저장
          const fileName = `frame_${frameNumber.toString().padStart(5, '0')}.jpg`;
          const localPath = path.join(vodFrameDir, fileName);
          fs.writeFileSync(localPath, buffer);
          thumbnailKey = `frames/${vodId}/${fileName}`;
        }

        framesToCreate.push({
          vodAssetId: vodId,
          frameNumber,
          timestamp,
          thumbnailKey,
        });

        // 메모리 관리를 위해 임시 파일 삭제
        fs.unlinkSync(filePath);
      }

      // 일괄 DB 저장
      await prisma.vodFrame.createMany({
        data: framesToCreate,
      });

      // VOD 상태 및 fps 업데이트
      await prisma.vodAsset.update({
        where: { id: vodId },
        data: {
          status: VodStatus.COMPLETED,
          fps: mergedConfig.fps,
        },
      });

      // 임시 디렉토리 삭제
      fs.rmdirSync(tempDir, { recursive: true });

      const processingTime = Date.now() - startTime;

      return {
        frameCount: framesToCreate.length,
        processingTime,
      };
    } catch (error) {
      // 에러 시 상태 롤백
      await prisma.vodAsset.update({
        where: { id: vodId },
        data: {
          status: VodStatus.COMPLETED, // 원래 상태로 복구
          errorMessage: error instanceof Error ? error.message : 'Frame extraction failed',
        },
      });
      throw error;
    }
  }

  /**
   * 단일 프레임 추출 (특정 타임스탬프)
   */
  async extractSingleFrame(
    vodId: string,
    timestamp: number
  ): Promise<{ frameId: string; thumbnailUrl: string }> {
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    // 임시 파일 경로
    const tempPath = path.join(os.tmpdir(), `single_frame_${vodId}_${timestamp}.jpg`);

    try {
      const videoUrl = await this.getVideoUrl(vod.storageKey);

      // FFmpeg로 단일 프레임 추출
      const ffmpegCmd = `ffmpeg -ss ${timestamp} -i "${videoUrl}" -vframes 1 -q:v 2 "${tempPath}" -y`;
      await execAsync(ffmpegCmd, { timeout: 60000 });

      const buffer = fs.readFileSync(tempPath);
      let thumbnailKey: string;
      let thumbnailUrl: string;

      if (isCloudinaryConfigured()) {
        // Cloudinary 업로드
        const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
          filename: `single_frame_${vodId}_${Math.round(timestamp * 1000)}`,
          resource_type: 'image',
        });
        thumbnailKey = uploadResult.public_id;
        thumbnailUrl = uploadResult.secure_url;
      } else {
        // 로컬 스토리지에 저장
        const vodFrameDir = path.join(FRAME_UPLOAD_DIR, vodId);
        if (!fs.existsSync(vodFrameDir)) {
          fs.mkdirSync(vodFrameDir, { recursive: true });
        }
        const fileName = `single_${Math.round(timestamp * 1000)}.jpg`;
        const localPath = path.join(vodFrameDir, fileName);
        fs.writeFileSync(localPath, buffer);
        thumbnailKey = `frames/${vodId}/${fileName}`;
        thumbnailUrl = `/uploads/frames/${vodId}/${fileName}`;
      }

      // DB 저장
      const frame = await prisma.vodFrame.create({
        data: {
          vodAssetId: vodId,
          frameNumber: -1, // 단일 추출은 -1로 표시
          timestamp,
          thumbnailKey,
        },
      });

      // 임시 파일 삭제
      fs.unlinkSync(tempPath);

      return {
        frameId: frame.id,
        thumbnailUrl,
      };
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * 프레임 목록 조회
   */
  async listFrames(vodId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.vodFrame.findMany({
        where: { vodAssetId: vodId },
        orderBy: { timestamp: 'asc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { detections: true },
          },
        },
      }),
      prisma.vodFrame.count({ where: { vodAssetId: vodId } }),
    ]);

    // 썸네일 URL 추가
    const itemsWithUrl = items.map((item) => ({
      ...item,
      thumbnailUrl: this.getThumbnailUrl(item.thumbnailKey),
    }));

    return {
      items: itemsWithUrl,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 썸네일 URL 생성
   */
  getThumbnailUrl(thumbnailKey: string): string {
    if (thumbnailKey.startsWith('frames/')) {
      // 로컬 파일
      return `/uploads/${thumbnailKey}`;
    }
    // Cloudinary URL
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/image/upload/${thumbnailKey}`;
  }

  /**
   * 프레임 상세 조회
   */
  async getFrameById(frameId: string) {
    const frame = await prisma.vodFrame.findUnique({
      where: { id: frameId },
      include: {
        vodAsset: {
          select: { id: true, campaignId: true },
        },
        detections: {
          include: {
            brand: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!frame) {
      throw new NotFoundError('프레임을 찾을 수 없습니다.');
    }

    return frame;
  }

  /**
   * 프레임 삭제
   */
  async deleteFrame(frameId: string): Promise<void> {
    const frame = await prisma.vodFrame.findUnique({
      where: { id: frameId },
    });

    if (!frame) {
      throw new NotFoundError('프레임을 찾을 수 없습니다.');
    }

    // 파일 삭제
    if (frame.thumbnailKey) {
      if (frame.thumbnailKey.startsWith('frames/')) {
        // 로컬 파일 삭제
        const localPath = path.join(process.cwd(), 'uploads', frame.thumbnailKey);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } else if (isCloudinaryConfigured()) {
        // Cloudinary에서 삭제
        await cloudinaryService.deleteFile(frame.thumbnailKey);
      }
    }

    // DB에서 삭제
    await prisma.vodFrame.delete({
      where: { id: frameId },
    });
  }

  /**
   * FFmpeg 명령어 생성
   */
  private buildFFmpegCommand(
    inputPath: string,
    outputPattern: string,
    config: FrameExtractionConfig
  ): string {
    // -vf: 비디오 필터 (fps, scale)
    // -q:v: JPEG 품질 (1-31)
    const filters = [
      `fps=${config.fps}`,
      `scale=${config.maxWidth}:-1`,
    ];

    return `ffmpeg -i "${inputPath}" -vf "${filters.join(',')}" -q:v ${config.quality} "${outputPattern}" -y`;
  }

  /**
   * 비디오 URL/경로 가져오기
   */
  private async getVideoUrl(storageKey: string): Promise<string> {
    // 로컬 파일인 경우 (vod/ 로 시작)
    if (storageKey.startsWith('vod/')) {
      const localPath = path.join(process.cwd(), 'uploads', storageKey);
      if (fs.existsSync(localPath)) {
        return localPath;
      }
      throw new NotFoundError(`비디오 파일을 찾을 수 없습니다: ${localPath}`);
    }

    // Cloudinary URL 생성
    if (isCloudinaryConfigured()) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      return `https://res.cloudinary.com/${cloudName}/video/upload/${storageKey}`;
    }

    throw new BadRequestError('비디오 저장소가 설정되지 않았습니다.');
  }

  /**
   * 프레임 추출 상태 조회
   */
  async getExtractionStatus(vodId: string) {
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
      select: {
        id: true,
        status: true,
        fps: true,
        duration: true,
        _count: {
          select: { frames: true },
        },
      },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    const expectedFrames = Math.ceil((vod.duration || 0) * (vod.fps || 2));

    return {
      vodId: vod.id,
      status: vod.status,
      extractedFrames: vod._count.frames,
      expectedFrames,
      progress: expectedFrames > 0
        ? Math.min(100, Math.round((vod._count.frames / expectedFrames) * 100))
        : 0,
    };
  }
}

export const frameExtractService = new FrameExtractService();

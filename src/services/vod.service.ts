import { PrismaClient, VodStatus } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { localStorageService } from './localStorage.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// 스토리지 서비스 선택 헬퍼
const getStorageService = () => {
  if (cloudinaryService.isConfigured()) {
    return cloudinaryService;
  }
  console.log('[VOD] Cloudinary not configured, using local storage');
  return localStorageService;
};

// VOD 로컬 저장 경로
const VOD_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'vod');

// 디렉토리 생성
if (!fs.existsSync(VOD_UPLOAD_DIR)) {
  fs.mkdirSync(VOD_UPLOAD_DIR, { recursive: true });
}

// Cloudinary 설정 여부 확인
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

interface VodUploadResult {
  id: string;
  storageKey: string;
  fileUrl: string;
  duration: number;
  resolution: string | null;
}

interface VodListParams {
  campaignId?: string;
  eventId?: string;
  status?: VodStatus;
  page?: number;
  limit?: number;
}

class VodService {
  /**
   * VOD 파일 직접 업로드
   */
  async uploadVod(
    file: Express.Multer.File,
    campaignId: string,
    eventId?: string
  ): Promise<VodUploadResult> {
    // 캠페인 존재 확인
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundError('캠페인을 찾을 수 없습니다.');
    }

    // 스토리지에 업로드 (Cloudinary 또는 Local)
    const storage = getStorageService();
    const uploadResult = await storage.uploadBuffer(file.buffer, 'vod' as any, {
      resource_type: 'auto',
      filename: `vod_${Date.now()}`,
    });

    // 영상 메타데이터 추출 (duration 등)
    const metadata = await this.extractVideoMetadata(file.buffer);

    // DB에 저장
    const vodAsset = await prisma.vodAsset.create({
      data: {
        campaignId,
        eventId,
        source: 'UPLOAD',
        storageKey: uploadResult.public_id,
        fileName: file.originalname,
        duration: metadata.duration,
        fps: metadata.fps || 30,
        resolution: metadata.resolution,
        fileSizeBytes: BigInt(file.size),
        status: VodStatus.PENDING,
      },
    });

    return {
      id: vodAsset.id,
      storageKey: uploadResult.public_id,
      fileUrl: uploadResult.secure_url,
      duration: metadata.duration,
      resolution: metadata.resolution,
    };
  }

  /**
   * YouTube URL에서 VOD 인제스트
   * yt-dlp 필요: npm install -g yt-dlp 또는 시스템에 설치
   */
  async ingestFromYoutube(
    youtubeUrl: string,
    campaignId: string,
    eventId?: string
  ): Promise<{ id: string; status: VodStatus }> {
    // URL 유효성 검사
    if (!this.isValidYoutubeUrl(youtubeUrl)) {
      throw new BadRequestError('유효한 YouTube URL이 아닙니다.');
    }

    // 캠페인 존재 확인
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundError('캠페인을 찾을 수 없습니다.');
    }

    // 먼저 PENDING 상태로 DB에 저장
    const vodAsset = await prisma.vodAsset.create({
      data: {
        campaignId,
        eventId,
        source: 'YOUTUBE',
        sourceUrl: youtubeUrl,
        storageKey: '', // 다운로드 후 업데이트
        duration: 0, // 다운로드 후 업데이트
        status: VodStatus.PENDING,
      },
    });

    // 백그라운드에서 다운로드 시작 (비동기)
    this.processYoutubeDownload(vodAsset.id, youtubeUrl).catch(async (error) => {
      console.error(`YouTube 다운로드 실패 (${vodAsset.id}):`, error);
      // 에러 메시지 상세 저장
      let errorMsg = error.message || 'Unknown error';
      if (error.stderr) {
        errorMsg += ` | stderr: ${error.stderr.slice(0, 500)}`;
      }
      await prisma.vodAsset.update({
        where: { id: vodAsset.id },
        data: {
          status: VodStatus.FAILED,
          errorMessage: errorMsg.slice(0, 1000), // 1000자 제한
        },
      });
    });

    return {
      id: vodAsset.id,
      status: VodStatus.PENDING,
    };
  }

  /**
   * YouTube 다운로드 처리 (백그라운드)
   */
  private async processYoutubeDownload(vodId: string, youtubeUrl: string): Promise<void> {
    // 상태를 PROCESSING으로 변경
    await prisma.vodAsset.update({
      where: { id: vodId },
      data: { status: VodStatus.PROCESSING },
    });

    const tempDir = os.tmpdir();
    const tempOutputPath = path.join(tempDir, `vod_${vodId}.mp4`);

    try {
      console.log(`[VOD] YouTube 다운로드 시작: ${youtubeUrl}`);
      console.log(`[VOD] 임시 경로: ${tempOutputPath}`);

      // Windows 경로 처리
      const escapedPath = tempOutputPath.replace(/\\/g, '/');

      // yt-dlp로 다운로드 (Windows 호환)
      const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${escapedPath}" "${youtubeUrl}"`;
      console.log(`[VOD] 실행 명령어: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 1800000,  // 30분 타임아웃
        maxBuffer: 1024 * 1024 * 50, // 50MB 버퍼
      });

      if (stderr) {
        console.log(`[VOD] yt-dlp stderr: ${stderr}`);
      }
      if (stdout) {
        console.log(`[VOD] yt-dlp stdout: ${stdout.slice(-500)}`);
      }

      console.log(`[VOD] 다운로드 완료: ${tempOutputPath}`);

      const fileStats = fs.statSync(tempOutputPath);
      let storageKey: string;
      let fileUrl: string;

      // Cloudinary 또는 로컬 스토리지 사용
      if (isCloudinaryConfigured()) {
        console.log('[VOD] Cloudinary에 업로드 중...');
        const videoBuffer = fs.readFileSync(tempOutputPath);
        const uploadResult = await cloudinaryService.uploadBuffer(videoBuffer, 'assets' as any, {
          resource_type: 'auto',
          filename: `vod_yt_${vodId}`,
        });
        storageKey = uploadResult.public_id;
        fileUrl = uploadResult.secure_url;
        // 임시 파일 삭제
        fs.unlinkSync(tempOutputPath);
      } else {
        console.log('[VOD] 로컬 스토리지에 저장 중...');
        // 로컬 스토리지에 저장 (다른 드라이브 간 이동을 위해 copy + unlink 사용)
        const fileName = `${uuidv4()}.mp4`;
        const localPath = path.join(VOD_UPLOAD_DIR, fileName);
        fs.copyFileSync(tempOutputPath, localPath);
        fs.unlinkSync(tempOutputPath);
        storageKey = `vod/${fileName}`;
        fileUrl = `/uploads/vod/${fileName}`;
        console.log(`[VOD] 파일 저장 완료: ${localPath}`);
      }

      // 메타데이터 추출
      const metadata = await this.extractVideoMetadataFromFile(
        isCloudinaryConfigured() ? tempOutputPath : path.join(VOD_UPLOAD_DIR, storageKey.replace('vod/', ''))
      );

      // DB 업데이트
      await prisma.vodAsset.update({
        where: { id: vodId },
        data: {
          storageKey,
          fileName: path.basename(storageKey),
          duration: metadata.duration,
          fps: metadata.fps || 30,
          resolution: metadata.resolution,
          fileSizeBytes: BigInt(fileStats.size),
          status: VodStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      console.log(`[VOD] 처리 완료: ${vodId}`);
    } catch (error: any) {
      console.error(`[VOD] 처리 실패: ${vodId}`);
      console.error(`[VOD] 에러 메시지: ${error.message}`);
      console.error(`[VOD] 에러 코드: ${error.code}`);
      if (error.stderr) {
        console.error(`[VOD] stderr: ${error.stderr}`);
      }
      if (error.stdout) {
        console.error(`[VOD] stdout: ${error.stdout}`);
      }
      // 임시 파일 정리
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      throw error;
    }
  }

  /**
   * VOD 상태 조회
   */
  async getVodStatus(vodId: string) {
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        processedAt: true,
        duration: true,
        resolution: true,
      },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    return vod;
  }

  /**
   * VOD 상세 조회
   */
  async getVodById(vodId: string) {
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
      include: {
        campaign: {
          select: { id: true, name: true, brandId: true },
        },
        event: {
          select: { id: true, name: true },
        },
        _count: {
          select: { frames: true, roiExposures: true },
        },
      },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    return vod;
  }

  /**
   * VOD 목록 조회
   */
  async listVods(params: VodListParams) {
    const { campaignId, eventId, status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.vodAsset.findMany({
        where,
        include: {
          campaign: {
            select: { id: true, name: true },
          },
          event: {
            select: { id: true, name: true },
          },
          _count: {
            select: { frames: true, roiExposures: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.vodAsset.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * VOD 삭제
   */
  async deleteVod(vodId: string): Promise<void> {
    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    // 스토리지에서 파일 삭제 (Cloudinary 또는 Local)
    if (vod.storageKey) {
      const storage = getStorageService();
      await storage.deleteFile(vod.storageKey);
    }

    // DB에서 삭제 (cascade로 frames, exposures도 삭제됨)
    await prisma.vodAsset.delete({
      where: { id: vodId },
    });
  }

  /**
   * VOD 상태 업데이트
   */
  async updateVodStatus(vodId: string, status: VodStatus, errorMessage?: string) {
    return prisma.vodAsset.update({
      where: { id: vodId },
      data: {
        status,
        errorMessage,
        ...(status === VodStatus.COMPLETED && { processedAt: new Date() }),
      },
    });
  }

  /**
   * YouTube URL 유효성 검사
   */
  private isValidYoutubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  }

  /**
   * 비디오 메타데이터 추출 (Buffer)
   */
  private async extractVideoMetadata(buffer: Buffer): Promise<{
    duration: number;
    fps: number | null;
    resolution: string | null;
  }> {
    const tempPath = path.join(os.tmpdir(), `meta_${Date.now()}.mp4`);
    fs.writeFileSync(tempPath, buffer);
    const result = await this.extractVideoMetadataFromFile(tempPath);
    fs.unlinkSync(tempPath);
    return result;
  }

  /**
   * 비디오 메타데이터 추출 (파일 경로)
   */
  private async extractVideoMetadataFromFile(filePath: string): Promise<{
    duration: number;
    fps: number | null;
    resolution: string | null;
  }> {
    try {
      // FFprobe로 메타데이터 추출 시도
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        { timeout: 30000 }
      );
      const data = JSON.parse(stdout);

      // 비디오 스트림 찾기
      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');

      // FPS 계산 (r_frame_rate: "30/1" 형태)
      let fps = 30;
      if (videoStream?.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2) {
          fps = Math.round(parseInt(parts[0]) / parseInt(parts[1]));
        }
      }

      return {
        duration: Math.round(parseFloat(data.format?.duration || '0')),
        fps,
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
      };
    } catch (error) {
      console.warn('[VOD] FFprobe 메타데이터 추출 실패, 기본값 사용:', error);
      // FFprobe 없으면 기본값 반환
      return {
        duration: 0,
        fps: 30,
        resolution: null,
      };
    }
  }
}

export const vodService = new VodService();

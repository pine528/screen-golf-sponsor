import { PrismaClient, VodStatus } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

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

    // Cloudinary에 업로드 (video 타입)
    const uploadResult = await cloudinaryService.uploadBuffer(file.buffer, 'assets' as any, {
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
      await prisma.vodAsset.update({
        where: { id: vodAsset.id },
        data: {
          status: VodStatus.FAILED,
          errorMessage: error.message,
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
    const outputPath = path.join(tempDir, `vod_${vodId}.mp4`);

    try {
      // yt-dlp로 다운로드
      // 참고: yt-dlp가 시스템에 설치되어 있어야 함
      const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${outputPath}" "${youtubeUrl}"`;
      await execAsync(command, { timeout: 600000 }); // 10분 타임아웃

      // 파일 읽기
      const videoBuffer = fs.readFileSync(outputPath);
      const fileStats = fs.statSync(outputPath);

      // Cloudinary에 업로드
      const uploadResult = await cloudinaryService.uploadBuffer(videoBuffer, 'assets' as any, {
        resource_type: 'auto',
        filename: `vod_yt_${vodId}`,
      });

      // 메타데이터 추출
      const metadata = await this.extractVideoMetadata(videoBuffer);

      // DB 업데이트
      await prisma.vodAsset.update({
        where: { id: vodId },
        data: {
          storageKey: uploadResult.public_id,
          duration: metadata.duration,
          fps: metadata.fps || 30,
          resolution: metadata.resolution,
          fileSizeBytes: BigInt(fileStats.size),
          status: VodStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      // 임시 파일 삭제
      fs.unlinkSync(outputPath);
    } catch (error) {
      // 임시 파일 정리
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
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

    // Cloudinary에서 파일 삭제
    if (vod.storageKey) {
      await cloudinaryService.deleteFile(vod.storageKey);
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
   * 비디오 메타데이터 추출 (FFprobe 사용)
   */
  private async extractVideoMetadata(buffer: Buffer): Promise<{
    duration: number;
    fps: number | null;
    resolution: string | null;
  }> {
    // 기본값 반환 (FFprobe 없이 실행 시)
    // TODO: FFprobe 연동 시 실제 메타데이터 추출
    return {
      duration: 0,
      fps: 30,
      resolution: null,
    };

    // FFprobe 연동 예시:
    // const tempPath = path.join(os.tmpdir(), `meta_${Date.now()}.mp4`);
    // fs.writeFileSync(tempPath, buffer);
    // const { stdout } = await execAsync(
    //   `ffprobe -v quiet -print_format json -show_format -show_streams "${tempPath}"`
    // );
    // fs.unlinkSync(tempPath);
    // const data = JSON.parse(stdout);
    // return {
    //   duration: Math.round(parseFloat(data.format.duration)),
    //   fps: eval(data.streams[0].r_frame_rate) || 30,
    //   resolution: `${data.streams[0].width}x${data.streams[0].height}`,
    // };
  }
}

export const vodService = new VodService();

import { PrismaClient, EvidenceType } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

class RoiEvidenceService {
  /**
   * 노출 구간의 대표 스크린샷 생성
   */
  async generateScreenshot(exposureId: string): Promise<{
    evidenceId: string;
    fileUrl: string;
  }> {
    const exposure = await prisma.roiExposure.findUnique({
      where: { id: exposureId },
      include: {
        vodAsset: true,
      },
    });

    if (!exposure) {
      throw new NotFoundError('노출을 찾을 수 없습니다.');
    }

    // 노출 구간 중간 타임스탬프 계산
    const midTimestamp = (exposure.startTs + exposure.endTs) / 2;

    // 해당 타임스탬프에서 프레임 추출
    const tempPath = path.join(os.tmpdir(), `screenshot_${exposureId}.jpg`);

    try {
      const videoUrl = this.getVideoUrl(exposure.vodAsset.storageKey);

      // FFmpeg로 스크린샷 추출
      const ffmpegCmd = `ffmpeg -ss ${midTimestamp} -i "${videoUrl}" -vframes 1 -q:v 2 "${tempPath}" -y`;
      await execAsync(ffmpegCmd, { timeout: 60000 });

      // Cloudinary 업로드
      const buffer = fs.readFileSync(tempPath);
      const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
        filename: `evidence_screenshot_${exposureId}`,
        resource_type: 'image',
      });

      // DB 저장
      const evidence = await prisma.roiEvidenceItem.create({
        data: {
          exposureId,
          type: EvidenceType.SCREENSHOT,
          fileKey: uploadResult.public_id,
          fileUrl: uploadResult.secure_url,
          fileSizeBytes: BigInt(buffer.length),
        },
      });

      // 임시 파일 삭제
      fs.unlinkSync(tempPath);

      return {
        evidenceId: evidence.id,
        fileUrl: uploadResult.secure_url,
      };
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * 노출 구간의 하이라이트 클립 생성
   */
  async generateClip(
    exposureId: string,
    options: {
      paddingBefore?: number;  // 앞쪽 여유 (초)
      paddingAfter?: number;   // 뒤쪽 여유 (초)
      maxDuration?: number;    // 최대 길이 (초)
    } = {}
  ): Promise<{
    evidenceId: string;
    fileUrl: string;
    duration: number;
  }> {
    const { paddingBefore = 1, paddingAfter = 1, maxDuration = 30 } = options;

    const exposure = await prisma.roiExposure.findUnique({
      where: { id: exposureId },
      include: {
        vodAsset: true,
      },
    });

    if (!exposure) {
      throw new NotFoundError('노출을 찾을 수 없습니다.');
    }

    // 클립 시작/종료 시간 계산
    const clipStart = Math.max(0, exposure.startTs - paddingBefore);
    let clipEnd = exposure.endTs + paddingAfter;
    let clipDuration = clipEnd - clipStart;

    // 최대 길이 제한
    if (clipDuration > maxDuration) {
      clipDuration = maxDuration;
      clipEnd = clipStart + clipDuration;
    }

    const tempPath = path.join(os.tmpdir(), `clip_${exposureId}.mp4`);

    try {
      const videoUrl = this.getVideoUrl(exposure.vodAsset.storageKey);

      // FFmpeg로 클립 추출
      const ffmpegCmd = `ffmpeg -ss ${clipStart} -i "${videoUrl}" -t ${clipDuration} -c:v libx264 -c:a aac -y "${tempPath}"`;
      await execAsync(ffmpegCmd, { timeout: 300000 }); // 5분 타임아웃

      // Cloudinary 업로드
      const buffer = fs.readFileSync(tempPath);
      const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
        filename: `evidence_clip_${exposureId}`,
        resource_type: 'auto',
      });

      // DB 저장
      const evidence = await prisma.roiEvidenceItem.create({
        data: {
          exposureId,
          type: EvidenceType.CLIP,
          fileKey: uploadResult.public_id,
          fileUrl: uploadResult.secure_url,
          startTs: clipStart,
          endTs: clipEnd,
          fileSizeBytes: BigInt(buffer.length),
        },
      });

      // 임시 파일 삭제
      fs.unlinkSync(tempPath);

      return {
        evidenceId: evidence.id,
        fileUrl: uploadResult.secure_url,
        duration: clipDuration,
      };
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * 캠페인의 모든 유효 노출에 대해 증빙 자동 생성
   */
  async generateAllEvidence(
    campaignId: string,
    options: {
      includeClips?: boolean;
      skipExisting?: boolean;
    } = {}
  ): Promise<{
    screenshotsCreated: number;
    clipsCreated: number;
    errors: number;
  }> {
    const { includeClips = false, skipExisting = true } = options;

    // 유효 노출 목록
    const exposures = await prisma.roiExposure.findMany({
      where: {
        campaignId,
        isValid: true,
        reviewStatus: 'APPROVED',
      },
      include: {
        evidenceItems: skipExisting,
      },
    });

    let screenshotsCreated = 0;
    let clipsCreated = 0;
    let errors = 0;

    for (const exposure of exposures) {
      // 기존 증빙이 있으면 스킵
      if (skipExisting && exposure.evidenceItems && exposure.evidenceItems.length > 0) {
        continue;
      }

      try {
        // 스크린샷 생성
        await this.generateScreenshot(exposure.id);
        screenshotsCreated++;

        // 클립 생성 (옵션)
        if (includeClips) {
          await this.generateClip(exposure.id);
          clipsCreated++;
        }
      } catch (error) {
        console.error(`증빙 생성 실패 (${exposure.id}):`, error);
        errors++;
      }
    }

    return {
      screenshotsCreated,
      clipsCreated,
      errors,
    };
  }

  /**
   * Proof Pack (ZIP) 생성
   */
  async createProofPack(campaignId: string): Promise<{
    fileUrl: string;
    fileKey: string;
    totalFiles: number;
  }> {
    // 캠페인 및 증빙 조회
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: {
          select: { name: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('캠페인을 찾을 수 없습니다.');
    }

    const evidenceItems = await prisma.roiEvidenceItem.findMany({
      where: {
        exposure: {
          campaignId,
          isValid: true,
        },
      },
      include: {
        exposure: {
          select: {
            slotType: true,
            startTs: true,
            endTs: true,
          },
        },
      },
    });

    if (evidenceItems.length === 0) {
      throw new BadRequestError('다운로드할 증빙 자료가 없습니다.');
    }

    // 임시 ZIP 파일 경로
    const tempZipPath = path.join(os.tmpdir(), `proof_pack_${campaignId}.zip`);
    const output = fs.createWriteStream(tempZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise(async (resolve, reject) => {
      output.on('close', async () => {
        try {
          // ZIP 파일 업로드
          const buffer = fs.readFileSync(tempZipPath);
          const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
            filename: `proof_pack_${campaignId}_${Date.now()}`,
            resource_type: 'raw',
          });

          // 임시 파일 삭제
          fs.unlinkSync(tempZipPath);

          resolve({
            fileUrl: uploadResult.secure_url,
            fileKey: uploadResult.public_id,
            totalFiles: evidenceItems.length,
          });
        } catch (error) {
          reject(error);
        }
      });

      archive.on('error', (err: Error) => reject(err));
      archive.pipe(output);

      // 파일 다운로드 및 ZIP에 추가
      let fileIndex = 1;
      for (const item of evidenceItems) {
        try {
          if (item.fileUrl) {
            const response = await fetch(item.fileUrl);
            const buffer = Buffer.from(await response.arrayBuffer());

            const ext = item.type === 'CLIP' ? 'mp4' : 'jpg';
            const slot = item.exposure.slotType || 'unknown';
            const filename = `${fileIndex.toString().padStart(3, '0')}_${slot}_${item.type.toLowerCase()}.${ext}`;

            archive.append(buffer, { name: filename });
            fileIndex++;
          }
        } catch (error) {
          console.error(`파일 다운로드 실패:`, error);
        }
      }

      archive.finalize();
    });
  }

  /**
   * 증빙 목록 조회
   */
  async listEvidence(params: {
    exposureId?: string;
    campaignId?: string;
    type?: EvidenceType;
    page?: number;
    limit?: number;
  }) {
    const { exposureId, campaignId, type, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (exposureId) where.exposureId = exposureId;
    if (type) where.type = type;
    if (campaignId) {
      where.exposure = { campaignId };
    }

    const [items, total] = await Promise.all([
      prisma.roiEvidenceItem.findMany({
        where,
        include: {
          exposure: {
            select: {
              id: true,
              slotType: true,
              startTs: true,
              endTs: true,
              brandId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.roiEvidenceItem.count({ where }),
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
   * 증빙 상세 조회
   */
  async getEvidenceById(evidenceId: string) {
    const evidence = await prisma.roiEvidenceItem.findUnique({
      where: { id: evidenceId },
      include: {
        exposure: {
          include: {
            vodAsset: {
              select: { id: true, fileName: true },
            },
            brand: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!evidence) {
      throw new NotFoundError('증빙 자료를 찾을 수 없습니다.');
    }

    return evidence;
  }

  /**
   * 증빙 삭제
   */
  async deleteEvidence(evidenceId: string): Promise<void> {
    const evidence = await prisma.roiEvidenceItem.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundError('증빙 자료를 찾을 수 없습니다.');
    }

    // Cloudinary에서 삭제
    if (evidence.fileKey) {
      await cloudinaryService.deleteFile(evidence.fileKey);
    }

    // DB에서 삭제
    await prisma.roiEvidenceItem.delete({
      where: { id: evidenceId },
    });
  }

  /**
   * 비디오 URL 가져오기
   */
  private getVideoUrl(storageKey: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/video/upload/${storageKey}`;
  }
}

export const roiEvidenceService = new RoiEvidenceService();

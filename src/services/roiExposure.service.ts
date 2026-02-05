import { PrismaClient, ReviewStatus } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

// 노출 병합 설정
interface MergeConfig {
  maxGapSeconds: number;     // 최대 허용 갭 (초)
  minConfidence: number;     // 최소 신뢰도
  minAreaRatio: number;      // 최소 면적 비율
  minDuration: number;       // 최소 노출 시간 (초)
}

const DEFAULT_MERGE_CONFIG: MergeConfig = {
  maxGapSeconds: 1.0,        // 1초 이내 갭은 동일 노출로 병합
  minConfidence: 0.6,        // 60% 이상 신뢰도
  minAreaRatio: 0.001,       // 화면의 0.1% 이상
  minDuration: 0.5,          // 0.5초 이상 노출
};

// 유효 노출 판정 기준
interface ValidityConfig {
  minAreaRatio: number;      // 최소 면적 비율
  minDuration: number;       // 최소 노출 시간 (초)
  minConfidence: number;     // 최소 평균 신뢰도
  maxBlurScore?: number;     // 최대 블러 점수 (낮을수록 선명)
  maxOcclusionScore?: number; // 최대 가림 점수
}

const DEFAULT_VALIDITY_CONFIG: ValidityConfig = {
  minAreaRatio: 0.002,       // 화면의 0.2% 이상
  minDuration: 1.0,          // 1초 이상
  minConfidence: 0.7,        // 70% 이상 평균 신뢰도
};

class RoiExposureService {
  /**
   * VOD의 검출 결과를 노출 구간으로 병합
   */
  async mergeDetections(
    vodId: string,
    config: Partial<MergeConfig> = {}
  ): Promise<{ exposureCount: number; totalDuration: number }> {
    const mergedConfig = { ...DEFAULT_MERGE_CONFIG, ...config };

    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
      include: {
        campaign: true,
      },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    // 기존 노출 구간 삭제
    await prisma.roiExposure.deleteMany({
      where: { vodAssetId: vodId },
    });

    // 검출 결과 조회 (타임스탬프 순)
    const detections = await prisma.logoDetection.findMany({
      where: {
        frame: { vodAssetId: vodId },
        confidence: { gte: mergedConfig.minConfidence },
        areaRatio: { gte: mergedConfig.minAreaRatio },
      },
      include: {
        frame: true,
      },
      orderBy: {
        frame: { timestamp: 'asc' },
      },
    });

    if (detections.length === 0) {
      return { exposureCount: 0, totalDuration: 0 };
    }

    // 브랜드별, 슬롯별로 그룹화하여 병합
    const groupedDetections = this.groupDetections(detections);
    const exposuresToCreate: any[] = [];

    for (const [groupKey, group] of Object.entries(groupedDetections)) {
      const [brandId, slotType] = groupKey.split('::');
      const mergedExposures = this.mergeGroup(group, mergedConfig);

      for (const exposure of mergedExposures) {
        exposuresToCreate.push({
          vodAssetId: vodId,
          campaignId: vod.campaignId,
          brandId,
          slotType: slotType === 'null' ? null : slotType,
          startTs: exposure.startTs,
          endTs: exposure.endTs,
          duration: exposure.duration,
          frameCount: exposure.frameCount,
          avgConfidence: exposure.avgConfidence,
          avgAreaRatio: exposure.avgAreaRatio,
          maxAreaRatio: exposure.maxAreaRatio,
          isValid: false, // 유효성은 별도 판정
          reviewStatus: ReviewStatus.PENDING,
        });
      }
    }

    // 일괄 저장
    await prisma.roiExposure.createMany({
      data: exposuresToCreate,
    });

    const totalDuration = exposuresToCreate.reduce((sum, e) => sum + e.duration, 0);

    return {
      exposureCount: exposuresToCreate.length,
      totalDuration,
    };
  }

  /**
   * 노출 유효성 판정
   */
  async validateExposures(
    vodId: string,
    config: Partial<ValidityConfig> = {}
  ): Promise<{ validCount: number; invalidCount: number }> {
    const mergedConfig = { ...DEFAULT_VALIDITY_CONFIG, ...config };

    const exposures = await prisma.roiExposure.findMany({
      where: { vodAssetId: vodId },
    });

    let validCount = 0;
    let invalidCount = 0;

    for (const exposure of exposures) {
      const { isValid, reason } = this.checkValidity(exposure, mergedConfig);

      await prisma.roiExposure.update({
        where: { id: exposure.id },
        data: {
          isValid,
          invalidReason: isValid ? null : reason,
        },
      });

      if (isValid) validCount++;
      else invalidCount++;
    }

    return { validCount, invalidCount };
  }

  /**
   * 검출 결과 그룹화 (브랜드+슬롯 기준)
   */
  private groupDetections(detections: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    for (const detection of detections) {
      const key = `${detection.brandId}::${detection.slotType || 'null'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(detection);
    }

    return groups;
  }

  /**
   * 그룹 내 검출을 노출 구간으로 병합
   */
  private mergeGroup(
    detections: any[],
    config: MergeConfig
  ): Array<{
    startTs: number;
    endTs: number;
    duration: number;
    frameCount: number;
    avgConfidence: number;
    avgAreaRatio: number;
    maxAreaRatio: number;
  }> {
    if (detections.length === 0) return [];

    const exposures: any[] = [];
    let currentExposure: any = null;

    for (const detection of detections) {
      const timestamp = detection.frame.timestamp;

      if (!currentExposure) {
        // 첫 검출로 새 노출 시작
        currentExposure = {
          startTs: timestamp,
          endTs: timestamp,
          detections: [detection],
        };
      } else {
        const gap = timestamp - currentExposure.endTs;

        if (gap <= config.maxGapSeconds) {
          // 갭이 허용 범위 내이면 현재 노출에 추가
          currentExposure.endTs = timestamp;
          currentExposure.detections.push(detection);
        } else {
          // 갭이 크면 현재 노출 종료하고 새 노출 시작
          exposures.push(this.finalizeExposure(currentExposure, config));
          currentExposure = {
            startTs: timestamp,
            endTs: timestamp,
            detections: [detection],
          };
        }
      }
    }

    // 마지막 노출 추가
    if (currentExposure) {
      exposures.push(this.finalizeExposure(currentExposure, config));
    }

    // 최소 시간 필터링
    return exposures.filter(e => e.duration >= config.minDuration);
  }

  /**
   * 노출 구간 최종화 (통계 계산)
   */
  private finalizeExposure(rawExposure: any, config: MergeConfig) {
    const detections = rawExposure.detections;
    const frameInterval = 1 / 2; // 2fps 기준

    return {
      startTs: rawExposure.startTs,
      endTs: rawExposure.endTs + frameInterval, // 마지막 프레임 duration 추가
      duration: rawExposure.endTs - rawExposure.startTs + frameInterval,
      frameCount: detections.length,
      avgConfidence: detections.reduce((s: number, d: any) => s + d.confidence, 0) / detections.length,
      avgAreaRatio: detections.reduce((s: number, d: any) => s + d.areaRatio, 0) / detections.length,
      maxAreaRatio: Math.max(...detections.map((d: any) => d.areaRatio)),
    };
  }

  /**
   * 유효성 판정
   */
  private checkValidity(
    exposure: any,
    config: ValidityConfig
  ): { isValid: boolean; reason: string | null } {
    if (exposure.duration < config.minDuration) {
      return { isValid: false, reason: `노출 시간 부족 (${exposure.duration.toFixed(1)}초 < ${config.minDuration}초)` };
    }

    if (exposure.avgAreaRatio < config.minAreaRatio) {
      return { isValid: false, reason: `면적 비율 부족 (${(exposure.avgAreaRatio * 100).toFixed(2)}% < ${(config.minAreaRatio * 100).toFixed(2)}%)` };
    }

    if (exposure.avgConfidence < config.minConfidence) {
      return { isValid: false, reason: `신뢰도 부족 (${(exposure.avgConfidence * 100).toFixed(1)}% < ${(config.minConfidence * 100).toFixed(1)}%)` };
    }

    return { isValid: true, reason: null };
  }

  /**
   * 노출 검수 처리
   */
  async reviewExposure(
    exposureId: string,
    decision: {
      status: 'APPROVED' | 'REJECTED' | 'MODIFIED';
      isValid?: boolean;
      slotType?: string;
      notes?: string;
    },
    reviewerId: string
  ) {
    const exposure = await prisma.roiExposure.findUnique({
      where: { id: exposureId },
    });

    if (!exposure) {
      throw new NotFoundError('노출을 찾을 수 없습니다.');
    }

    return prisma.roiExposure.update({
      where: { id: exposureId },
      data: {
        reviewStatus: decision.status as ReviewStatus,
        isValid: decision.isValid ?? exposure.isValid,
        slotType: decision.slotType ?? exposure.slotType,
        reviewNotes: decision.notes,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * 노출 목록 조회
   */
  async listExposures(params: {
    campaignId?: string;
    vodId?: string;
    brandId?: string;
    reviewStatus?: ReviewStatus;
    isValid?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { campaignId, vodId, brandId, reviewStatus, isValid, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (vodId) where.vodAssetId = vodId;
    if (brandId) where.brandId = brandId;
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (isValid !== undefined) where.isValid = isValid;

    const [items, total] = await Promise.all([
      prisma.roiExposure.findMany({
        where,
        include: {
          vodAsset: {
            select: { id: true, fileName: true, sourceUrl: true },
          },
          brand: {
            select: { id: true, name: true },
          },
          _count: {
            select: { evidenceItems: true },
          },
        },
        orderBy: { startTs: 'asc' },
        skip,
        take: limit,
      }),
      prisma.roiExposure.count({ where }),
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
   * 노출 상세 조회
   */
  async getExposureById(exposureId: string) {
    const exposure = await prisma.roiExposure.findUnique({
      where: { id: exposureId },
      include: {
        vodAsset: true,
        brand: {
          select: { id: true, name: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
        evidenceItems: true,
      },
    });

    if (!exposure) {
      throw new NotFoundError('노출을 찾을 수 없습니다.');
    }

    return exposure;
  }

  /**
   * 캠페인 노출 통계 조회
   */
  async getCampaignExposureStats(campaignId: string) {
    const exposures = await prisma.roiExposure.findMany({
      where: { campaignId },
      include: {
        brand: {
          select: { name: true },
        },
      },
    });

    const validExposures = exposures.filter(e => e.isValid);

    // 슬롯별 통계
    const slotStats: Record<string, { count: number; duration: number }> = {};
    for (const e of validExposures) {
      const slot = e.slotType || 'UNKNOWN';
      if (!slotStats[slot]) {
        slotStats[slot] = { count: 0, duration: 0 };
      }
      slotStats[slot].count++;
      slotStats[slot].duration += e.duration;
    }

    return {
      totalExposures: exposures.length,
      validExposures: validExposures.length,
      invalidExposures: exposures.length - validExposures.length,
      totalDuration: validExposures.reduce((sum, e) => sum + e.duration, 0),
      avgConfidence: validExposures.length > 0
        ? validExposures.reduce((sum, e) => sum + e.avgConfidence, 0) / validExposures.length
        : 0,
      slotStats,
      reviewStatus: {
        pending: exposures.filter(e => e.reviewStatus === 'PENDING').length,
        approved: exposures.filter(e => e.reviewStatus === 'APPROVED').length,
        rejected: exposures.filter(e => e.reviewStatus === 'REJECTED').length,
      },
    };
  }

  /**
   * 검수 대기 노출 목록 (Admin용)
   */
  async getPendingReviews(page: number = 1, limit: number = 20) {
    return this.listExposures({
      reviewStatus: ReviewStatus.PENDING,
      page,
      limit,
    });
  }

  /**
   * 노출 삭제
   */
  async deleteExposure(exposureId: string): Promise<void> {
    const exposure = await prisma.roiExposure.findUnique({
      where: { id: exposureId },
    });

    if (!exposure) {
      throw new NotFoundError('노출을 찾을 수 없습니다.');
    }

    await prisma.roiExposure.delete({
      where: { id: exposureId },
    });
  }
}

export const roiExposureService = new RoiExposureService();

import { prisma as basePrisma } from '../models/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Cast prisma to any for new models (will be typed after prisma generate)
const prisma = basePrisma as any;

type ExposureType =
  | 'BROADCAST'
  | 'EVENT_LIVE'
  | 'SOCIAL_MEDIA'
  | 'PHOTO_PRESS'
  | 'OTHER';

type BodyPart =
  | 'SHIRT_CHEST_LEFT'
  | 'SHIRT_CHEST_RIGHT'
  | 'SHIRT_SLEEVE_LEFT'
  | 'SHIRT_SLEEVE_RIGHT'
  | 'CAP_SIDE_LEFT'
  | 'CAP_BACK'
  | 'PANTS_BELT'
  | 'SHIRT_BACK';

export const exposureService = {
  /**
   * 노출 기록 생성
   */
  async createExposureRecord(data: {
    contractId: string;
    exposureType: ExposureType;
    impressions: number;
    viewDurationSec?: number;
    reachCount?: number;
    sourceUrl?: string;
    description?: string;
    recordedAt: Date;
    recordedBy?: string;
  }) {
    // 미디어밸류 요율 조회
    const rate = await this.getCurrentRate(data.exposureType);

    // 미디어밸류 계산
    let mediaValue: number | null = null;
    if (rate) {
      mediaValue = Math.round(data.impressions * Number(rate.ratePerImpression));
    }

    return prisma.exposureRecord.create({
      data: {
        contractId: data.contractId,
        exposureType: data.exposureType,
        impressions: data.impressions,
        viewDurationSec: data.viewDurationSec,
        reachCount: data.reachCount,
        ratePerImpression: rate?.ratePerImpression,
        mediaValue: mediaValue ? new Decimal(mediaValue) : null,
        sourceUrl: data.sourceUrl,
        description: data.description,
        recordedAt: data.recordedAt,
        recordedBy: data.recordedBy,
      },
      include: {
        contract: {
          select: {
            id: true,
            brand: { select: { id: true, name: true } },
            athlete: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  /**
   * 현재 적용 요율 조회
   */
  async getCurrentRate(exposureType: ExposureType, bodyPart?: BodyPart) {
    const now = new Date();

    return prisma.mediaValueRate.findFirst({
      where: {
        exposureType,
        bodyPart: bodyPart || null,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  },

  /**
   * 계약별 노출 기록 조회
   */
  async getContractExposures(contractId: string) {
    const exposures = await prisma.exposureRecord.findMany({
      where: { contractId },
      orderBy: { recordedAt: 'desc' },
    });

    // 집계
    const summary = {
      totalImpressions: exposures.reduce((sum: number, e: any) => sum + e.impressions, 0),
      totalMediaValue: exposures.reduce(
        (sum: number, e: any) => sum + (e.mediaValue ? Number(e.mediaValue) : 0),
        0
      ),
      byType: {} as Record<ExposureType, { count: number; impressions: number; mediaValue: number }>,
    };

    exposures.forEach((e: any) => {
      if (!summary.byType[e.exposureType as ExposureType]) {
        summary.byType[e.exposureType as ExposureType] = {
          count: 0,
          impressions: 0,
          mediaValue: 0,
        };
      }
      summary.byType[e.exposureType as ExposureType].count++;
      summary.byType[e.exposureType as ExposureType].impressions += e.impressions;
      summary.byType[e.exposureType as ExposureType].mediaValue += e.mediaValue
        ? Number(e.mediaValue)
        : 0;
    });

    return { exposures, summary };
  },

  /**
   * 브랜드별 노출 리포트
   */
  async getBrandExposureReport(brandId: string, options?: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      contract: { brandId },
    };

    if (options?.startDate || options?.endDate) {
      where.recordedAt = {};
      if (options.startDate) where.recordedAt.gte = options.startDate;
      if (options.endDate) where.recordedAt.lte = options.endDate;
    }

    const exposures = await prisma.exposureRecord.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            priceFinal: true,
            athlete: { select: { id: true, name: true } },
            auction: {
              select: {
                slotInstance: {
                  select: {
                    event: { select: { name: true, dateStart: true } },
                    slotTemplate: { select: { name: true, bodyPart: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });

    // 집계
    const totalImpressions = exposures.reduce((sum: number, e: any) => sum + e.impressions, 0);
    const totalMediaValue = exposures.reduce(
      (sum: number, e: any) => sum + (e.mediaValue ? Number(e.mediaValue) : 0),
      0
    );

    // 계약별 집계
    const byContract: Record<string, any> = {};
    exposures.forEach((e: any) => {
      if (!byContract[e.contractId]) {
        byContract[e.contractId] = {
          contract: e.contract,
          impressions: 0,
          mediaValue: 0,
          recordCount: 0,
        };
      }
      byContract[e.contractId].impressions += e.impressions;
      byContract[e.contractId].mediaValue += e.mediaValue ? Number(e.mediaValue) : 0;
      byContract[e.contractId].recordCount++;
    });

    // 타입별 집계
    const byType: Record<ExposureType, { impressions: number; mediaValue: number; count: number }> = {} as any;
    exposures.forEach((e: any) => {
      if (!byType[e.exposureType as ExposureType]) {
        byType[e.exposureType as ExposureType] = { impressions: 0, mediaValue: 0, count: 0 };
      }
      byType[e.exposureType as ExposureType].impressions += e.impressions;
      byType[e.exposureType as ExposureType].mediaValue += e.mediaValue ? Number(e.mediaValue) : 0;
      byType[e.exposureType as ExposureType].count++;
    });

    // 총 투자 대비 ROI 계산
    const totalInvestment = Object.values(byContract).reduce(
      (sum, c: any) => sum + (c.contract.priceFinal || 0),
      0
    );
    const roi = totalInvestment > 0
      ? Math.round(((totalMediaValue - totalInvestment) / totalInvestment) * 100)
      : 0;

    return {
      summary: {
        totalImpressions,
        totalMediaValue,
        totalInvestment,
        roi,
        contractCount: Object.keys(byContract).length,
        recordCount: exposures.length,
      },
      byContract: Object.values(byContract),
      byType,
      exposures,
    };
  },

  /**
   * Admin: 전체 노출 기록 목록
   */
  async getExposureRecords(filters?: {
    contractId?: string;
    brandId?: string;
    athleteId?: string;
    exposureType?: ExposureType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.contractId) {
      where.contractId = filters.contractId;
    }

    if (filters?.brandId || filters?.athleteId) {
      where.contract = {};
      if (filters.brandId) where.contract.brandId = filters.brandId;
      if (filters.athleteId) where.contract.athleteId = filters.athleteId;
    }

    if (filters?.exposureType) {
      where.exposureType = filters.exposureType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.recordedAt = {};
      if (filters.startDate) where.recordedAt.gte = filters.startDate;
      if (filters.endDate) where.recordedAt.lte = filters.endDate;
    }

    return prisma.exposureRecord.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            priceFinal: true,
            brand: { select: { id: true, name: true } },
            athlete: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
  },

  /**
   * Admin: 미디어밸류 리포트
   */
  async getMediaValueReport(options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.recordedAt = {};
      if (options.startDate) where.recordedAt.gte = options.startDate;
      if (options.endDate) where.recordedAt.lte = options.endDate;
    }

    const exposures = await prisma.exposureRecord.findMany({
      where,
      include: {
        contract: {
          select: {
            priceFinal: true,
            brandId: true,
            brand: { select: { name: true } },
          },
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // 총계
    const totalImpressions = exposures.reduce((sum: number, e: any) => sum + e.impressions, 0);
    const totalMediaValue = exposures.reduce(
      (sum: number, e: any) => sum + (e.mediaValue ? Number(e.mediaValue) : 0),
      0
    );

    // 브랜드별 집계
    const byBrand: Record<string, { name: string; impressions: number; mediaValue: number; investment: number }> = {};
    exposures.forEach((e: any) => {
      const brandId = e.contract.brandId;
      if (!byBrand[brandId]) {
        byBrand[brandId] = {
          name: e.contract.brand.name,
          impressions: 0,
          mediaValue: 0,
          investment: 0,
        };
      }
      byBrand[brandId].impressions += e.impressions;
      byBrand[brandId].mediaValue += e.mediaValue ? Number(e.mediaValue) : 0;
    });

    // 타입별 집계
    const byType: Record<ExposureType, { impressions: number; mediaValue: number }> = {} as any;
    exposures.forEach((e: any) => {
      if (!byType[e.exposureType as ExposureType]) {
        byType[e.exposureType as ExposureType] = { impressions: 0, mediaValue: 0 };
      }
      byType[e.exposureType as ExposureType].impressions += e.impressions;
      byType[e.exposureType as ExposureType].mediaValue += e.mediaValue ? Number(e.mediaValue) : 0;
    });

    return {
      summary: {
        totalImpressions,
        totalMediaValue,
        recordCount: exposures.length,
      },
      byBrand: Object.entries(byBrand).map(([id, data]) => ({ brandId: id, ...data })),
      byType,
    };
  },

  /**
   * 미디어밸류 요율 관리 - 생성
   */
  async createRate(data: {
    exposureType: ExposureType;
    bodyPart?: BodyPart;
    ratePerImpression: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
    description?: string;
  }) {
    return prisma.mediaValueRate.create({
      data: {
        exposureType: data.exposureType,
        bodyPart: data.bodyPart,
        ratePerImpression: new Decimal(data.ratePerImpression),
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        description: data.description,
      },
    });
  },

  /**
   * 미디어밸류 요율 목록
   */
  async getRates() {
    return prisma.mediaValueRate.findMany({
      orderBy: [{ exposureType: 'asc' }, { effectiveFrom: 'desc' }],
    });
  },

  /**
   * 노출 기록 삭제
   */
  async deleteExposureRecord(id: string) {
    return prisma.exposureRecord.delete({
      where: { id },
    });
  },
};

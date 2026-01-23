import { Prisma, FeePolicyType, FeePolicy } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

/**
 * 수수료 계산 결과 인터페이스
 */
export interface OpenFeeResult {
  fee: Prisma.Decimal;
  breakdown: {
    seedPoints: Prisma.Decimal;
    rate: Prisma.Decimal;
    rawFee: Prisma.Decimal;
    min: Prisma.Decimal;
    max: Prisma.Decimal;
    applied: 'raw' | 'min' | 'max';
  };
}

export interface EntryDeductionResult {
  deduction: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  creatorReward: Prisma.Decimal;
  netToPool: Prisma.Decimal;
  breakdown: {
    entryFee: Prisma.Decimal;
    rate: Prisma.Decimal;
    rawDeduction: Prisma.Decimal;
    min: Prisma.Decimal;
    max: Prisma.Decimal;
    platformSharePercent: Prisma.Decimal;
    creatorSharePercent: Prisma.Decimal;
    applied: 'raw' | 'min' | 'max';
  };
}

export interface SettlementFeeResult {
  fee: Prisma.Decimal;
  netPayout: Prisma.Decimal;
  breakdown: {
    grossPool: Prisma.Decimal;
    rate: Prisma.Decimal;
    rawFee: Prisma.Decimal;
    min: Prisma.Decimal;
    max: Prisma.Decimal;
    applied: 'raw' | 'min' | 'max';
  };
}

/**
 * 기본 수수료 정책값
 */
const DEFAULT_POLICIES = {
  [FeePolicyType.FAN_VOTE_OPEN]: {
    ratePercent: new Prisma.Decimal('0.02'),      // 2%
    minAmount: new Prisma.Decimal('1000'),         // 최소 1,000P
    maxAmount: new Prisma.Decimal('50000'),        // 최대 50,000P
  },
  [FeePolicyType.FAN_VOTE_ENTRY]: {
    ratePercent: new Prisma.Decimal('0.10'),       // 10%
    minAmount: new Prisma.Decimal('10'),           // 최소 10P
    maxAmount: new Prisma.Decimal('500'),          // 최대 500P
    platformSharePercent: new Prisma.Decimal('0.70'),  // 플랫폼 70%
    creatorSharePercent: new Prisma.Decimal('0.30'),   // 개설자 30%
  },
  [FeePolicyType.FAN_VOTE_SETTLE]: {
    ratePercent: new Prisma.Decimal('0.02'),       // 2%
    minAmount: new Prisma.Decimal('0'),            // 최소 없음
    maxAmount: new Prisma.Decimal('100000'),       // 최대 100,000P
  },
};

export class FeePolicyService {
  /**
   * 현재 활성화된 정책 조회
   * @param type 정책 유형
   * @returns 활성 정책 또는 null (기본값 사용)
   */
  async getActivePolicy(type: FeePolicyType): Promise<FeePolicy | null> {
    const now = new Date();

    const policy = await prisma.feePolicy.findFirst({
      where: {
        type,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return policy;
  }

  /**
   * clamp 유틸리티 - 값을 min과 max 사이로 제한
   */
  private clamp(value: Prisma.Decimal, min: Prisma.Decimal, max: Prisma.Decimal): {
    result: Prisma.Decimal;
    applied: 'raw' | 'min' | 'max';
  } {
    if (value.lessThan(min)) {
      return { result: min, applied: 'min' };
    }
    if (value.greaterThan(max)) {
      return { result: max, applied: 'max' };
    }
    return { result: value, applied: 'raw' };
  }

  /**
   * 개설 수수료 계산
   * Open Fee = clamp(Seed × 2%, min=1000, max=50000)
   *
   * @param seedPoints Seed (상금포인트)
   * @returns 개설 수수료 및 상세 breakdown
   */
  async calculateOpenFee(seedPoints: Prisma.Decimal | number): Promise<OpenFeeResult> {
    const seed = new Prisma.Decimal(seedPoints.toString());
    const policy = await this.getActivePolicy(FeePolicyType.FAN_VOTE_OPEN);

    const rate = policy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].ratePercent;
    const min = policy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].minAmount;
    const max = policy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].maxAmount;

    const rawFee = seed.times(rate);
    const { result: fee, applied } = this.clamp(rawFee, min, max);

    return {
      fee,
      breakdown: {
        seedPoints: seed,
        rate,
        rawFee,
        min,
        max,
        applied,
      },
    };
  }

  /**
   * 참여 수수료 계산
   * Entry Deduction = clamp(Entry × 10%, min=10, max=500)
   * Platform Fee = floor(Deduction × 70%)
   * Creator Reward = Deduction - Platform Fee (나머지 30%)
   * Net to Pool = Entry - Deduction (90%)
   *
   * @param entryFee 참여비
   * @returns 수수료 분해 및 상세 breakdown
   */
  async calculateEntryDeduction(entryFee: Prisma.Decimal | number): Promise<EntryDeductionResult> {
    const entry = new Prisma.Decimal(entryFee.toString());
    const policy = await this.getActivePolicy(FeePolicyType.FAN_VOTE_ENTRY);

    const rate = policy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].ratePercent;
    const min = policy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].minAmount;
    const max = policy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].maxAmount;
    const platformSharePercent = policy?.platformSharePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].platformSharePercent;
    const creatorSharePercent = policy?.creatorSharePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].creatorSharePercent;

    const rawDeduction = entry.times(rate);
    const { result: deduction, applied } = this.clamp(rawDeduction, min, max);

    // 플랫폼 몫: floor(deduction × 70%)
    const platformFee = deduction.times(platformSharePercent).floor();
    // 개설자 몫: deduction - platformFee (나머지, 반올림 오차 개설자에게)
    const creatorReward = deduction.minus(platformFee);
    // 상금풀 적립: entry - deduction
    const netToPool = entry.minus(deduction);

    return {
      deduction,
      platformFee,
      creatorReward,
      netToPool,
      breakdown: {
        entryFee: entry,
        rate,
        rawDeduction,
        min,
        max,
        platformSharePercent,
        creatorSharePercent,
        applied,
      },
    };
  }

  /**
   * 정산 수수료 계산
   * Settlement Fee = clamp(Pool × 2%, min=0, max=100000)
   * Net Payout = Pool - Settlement Fee
   *
   * @param grossPool 총 상금풀 (Seed + 참여자 기여)
   * @returns 정산 수수료 및 상세 breakdown
   */
  async calculateSettlementFee(grossPool: Prisma.Decimal | number): Promise<SettlementFeeResult> {
    const pool = new Prisma.Decimal(grossPool.toString());
    const policy = await this.getActivePolicy(FeePolicyType.FAN_VOTE_SETTLE);

    const rate = policy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].ratePercent;
    const min = policy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].minAmount;
    const max = policy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].maxAmount;

    const rawFee = pool.times(rate).floor();
    const { result: fee, applied } = this.clamp(rawFee, min, max);
    const netPayout = pool.minus(fee);

    return {
      fee,
      netPayout,
      breakdown: {
        grossPool: pool,
        rate,
        rawFee,
        min,
        max,
        applied,
      },
    };
  }

  /**
   * 수수료 시뮬레이션 (미리보기)
   *
   * @param seedPoints Seed (상금포인트)
   * @param entryFee 참여비
   * @param participantCount 예상 참여자 수
   */
  async simulateFees(
    seedPoints: number,
    entryFee: number,
    participantCount: number
  ) {
    const seed = new Prisma.Decimal(seedPoints);
    const entry = new Prisma.Decimal(entryFee);

    // 1. 개설 수수료
    const openFeeResult = await this.calculateOpenFee(seed);

    // 2. 참여 수수료 (1인당)
    const entryResult = await this.calculateEntryDeduction(entry);

    // 3. 전체 참여자 기준 집계
    const totalEntryFees = entry.times(participantCount);
    const totalEntryDeductions = entryResult.deduction.times(participantCount);
    const totalPlatformFees = entryResult.platformFee.times(participantCount);
    const totalCreatorRewards = entryResult.creatorReward.times(participantCount);
    const netPoolFromEntries = entryResult.netToPool.times(participantCount);

    // 4. 총 상금풀
    const grossPool = seed.plus(netPoolFromEntries);

    // 5. 정산 수수료
    const settleFeeResult = await this.calculateSettlementFee(grossPool);

    // 6. 플랫폼 총 수익
    const totalPlatformRevenue = openFeeResult.fee
      .plus(totalPlatformFees)
      .plus(settleFeeResult.fee);

    return {
      // 입력값
      input: {
        seedPoints: seed.toNumber(),
        entryFee: entry.toNumber(),
        participantCount,
      },
      // 개설 수수료
      openFee: {
        fee: openFeeResult.fee.toNumber(),
        breakdown: openFeeResult.breakdown,
      },
      // 참여 수수료 (1인당)
      entryDeduction: {
        perPerson: {
          deduction: entryResult.deduction.toNumber(),
          platformFee: entryResult.platformFee.toNumber(),
          creatorReward: entryResult.creatorReward.toNumber(),
          netToPool: entryResult.netToPool.toNumber(),
        },
        total: {
          totalEntryFees: totalEntryFees.toNumber(),
          totalEntryDeductions: totalEntryDeductions.toNumber(),
          totalPlatformFees: totalPlatformFees.toNumber(),
          totalCreatorRewards: totalCreatorRewards.toNumber(),
          netPoolFromEntries: netPoolFromEntries.toNumber(),
        },
      },
      // 상금풀
      pool: {
        seed: seed.toNumber(),
        fromEntries: netPoolFromEntries.toNumber(),
        grossPool: grossPool.toNumber(),
      },
      // 정산 수수료
      settlementFee: {
        fee: settleFeeResult.fee.toNumber(),
        netPayout: settleFeeResult.netPayout.toNumber(),
        breakdown: settleFeeResult.breakdown,
      },
      // 최종 요약
      summary: {
        winnerPayout: settleFeeResult.netPayout.toNumber(),
        totalPlatformRevenue: totalPlatformRevenue.toNumber(),
        totalCreatorReward: totalCreatorRewards.toNumber(),
        creatorRequired: seed.plus(openFeeResult.fee).toNumber(),
      },
    };
  }

  // ===============================================
  // Admin CRUD Operations
  // ===============================================

  /**
   * 정책 생성
   */
  async createPolicy(data: {
    type: FeePolicyType;
    ratePercent: number;
    minAmount: number;
    maxAmount: number;
    platformSharePercent?: number;
    creatorSharePercent?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
    description?: string;
  }): Promise<FeePolicy> {
    // Entry 타입인 경우 배분율 필수
    if (data.type === FeePolicyType.FAN_VOTE_ENTRY) {
      if (data.platformSharePercent === undefined || data.creatorSharePercent === undefined) {
        throw new BadRequestError('Entry 수수료 정책에는 플랫폼/개설자 배분율이 필수입니다');
      }

      const total = data.platformSharePercent + data.creatorSharePercent;
      if (Math.abs(total - 1) > 0.0001) {
        throw new BadRequestError('플랫폼 + 개설자 배분율의 합이 1(100%)이어야 합니다');
      }
    }

    // 수수료율 검증
    if (data.ratePercent < 0 || data.ratePercent > 1) {
      throw new BadRequestError('수수료율은 0~1 (0%~100%) 사이여야 합니다');
    }

    // 최소/최대 검증
    if (data.minAmount > data.maxAmount) {
      throw new BadRequestError('최소 금액이 최대 금액보다 클 수 없습니다');
    }

    return prisma.feePolicy.create({
      data: {
        type: data.type,
        ratePercent: data.ratePercent,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        platformSharePercent: data.platformSharePercent,
        creatorSharePercent: data.creatorSharePercent,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        description: data.description,
        isActive: true,
      },
    });
  }

  /**
   * 정책 수정
   */
  async updatePolicy(
    id: string,
    data: Partial<{
      ratePercent: number;
      minAmount: number;
      maxAmount: number;
      platformSharePercent: number;
      creatorSharePercent: number;
      effectiveTo: Date | null;
      description: string;
      isActive: boolean;
    }>
  ): Promise<FeePolicy> {
    const existing = await prisma.feePolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('정책을 찾을 수 없습니다');
    }

    // Entry 타입 배분율 검증
    if (existing.type === FeePolicyType.FAN_VOTE_ENTRY) {
      const platformShare = data.platformSharePercent ?? Number(existing.platformSharePercent);
      const creatorShare = data.creatorSharePercent ?? Number(existing.creatorSharePercent);

      if (platformShare !== undefined && creatorShare !== undefined) {
        const total = platformShare + creatorShare;
        if (Math.abs(total - 1) > 0.0001) {
          throw new BadRequestError('플랫폼 + 개설자 배분율의 합이 1(100%)이어야 합니다');
        }
      }
    }

    // 수수료율 검증
    if (data.ratePercent !== undefined && (data.ratePercent < 0 || data.ratePercent > 1)) {
      throw new BadRequestError('수수료율은 0~1 (0%~100%) 사이여야 합니다');
    }

    // 최소/최대 검증
    const minAmount = data.minAmount ?? Number(existing.minAmount);
    const maxAmount = data.maxAmount ?? Number(existing.maxAmount);
    if (minAmount > maxAmount) {
      throw new BadRequestError('최소 금액이 최대 금액보다 클 수 없습니다');
    }

    return prisma.feePolicy.update({
      where: { id },
      data,
    });
  }

  /**
   * 정책 비활성화
   */
  async deactivatePolicy(id: string): Promise<FeePolicy> {
    const existing = await prisma.feePolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('정책을 찾을 수 없습니다');
    }

    return prisma.feePolicy.update({
      where: { id },
      data: {
        isActive: false,
        effectiveTo: new Date(),
      },
    });
  }

  /**
   * 정책 목록 조회
   */
  async listPolicies(options?: {
    type?: FeePolicyType;
    activeOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ policies: FeePolicy[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.FeePolicyWhereInput = {
      ...(options?.type && { type: options.type }),
      ...(options?.activeOnly && { isActive: true }),
    };

    const [policies, total] = await Promise.all([
      prisma.feePolicy.findMany({
        where,
        orderBy: [
          { type: 'asc' },
          { effectiveFrom: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      prisma.feePolicy.count({ where }),
    ]);

    return { policies, total };
  }

  /**
   * 정책 상세 조회
   */
  async getPolicy(id: string): Promise<FeePolicy | null> {
    return prisma.feePolicy.findUnique({
      where: { id },
    });
  }

  /**
   * 현재 활성 정책 요약 조회 (공개 API용)
   */
  async getActivePolicySummary() {
    const [openPolicy, entryPolicy, settlePolicy] = await Promise.all([
      this.getActivePolicy(FeePolicyType.FAN_VOTE_OPEN),
      this.getActivePolicy(FeePolicyType.FAN_VOTE_ENTRY),
      this.getActivePolicy(FeePolicyType.FAN_VOTE_SETTLE),
    ]);

    return {
      openFee: {
        ratePercent: Number(openPolicy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].ratePercent) * 100,
        minAmount: Number(openPolicy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].minAmount),
        maxAmount: Number(openPolicy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_OPEN].maxAmount),
        description: 'Seed(상금포인트)의 2% (최소 1,000P ~ 최대 50,000P)',
      },
      entryFee: {
        ratePercent: Number(entryPolicy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].ratePercent) * 100,
        minAmount: Number(entryPolicy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].minAmount),
        maxAmount: Number(entryPolicy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].maxAmount),
        platformSharePercent: Number(entryPolicy?.platformSharePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].platformSharePercent) * 100,
        creatorSharePercent: Number(entryPolicy?.creatorSharePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_ENTRY].creatorSharePercent) * 100,
        description: '참여비의 10% 공제 (최소 10P ~ 최대 500P), 플랫폼 70% / 개설자 30%',
      },
      settlementFee: {
        ratePercent: Number(settlePolicy?.ratePercent ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].ratePercent) * 100,
        minAmount: Number(settlePolicy?.minAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].minAmount),
        maxAmount: Number(settlePolicy?.maxAmount ?? DEFAULT_POLICIES[FeePolicyType.FAN_VOTE_SETTLE].maxAmount),
        description: '총 상금풀의 2% (최대 100,000P)',
      },
    };
  }
}

export const feePolicyService = new FeePolicyService();

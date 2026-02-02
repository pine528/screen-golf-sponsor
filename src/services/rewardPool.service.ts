import { Prisma, PointTxReason } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { pointService } from './point.service';

// 상수 정의
const POOL_ID = 'main-reward-pool'; // 단일 리워드풀 ID
const BASE_MICRO_REWARD_EP = 15; // 기본 마이크로 리워드 (15 EP)
const MIN_MULTIPLIER = 0.2; // 최소 배수
const MAX_MULTIPLIER = 1.0; // 최대 배수

export interface RewardPoolStatus {
  id: string;
  balanceEp: bigint;
  reservedEp: bigint;
  availableTodayEp: bigint;
  multiplierM: number;
  availableEp: bigint; // balanceEp - reservedEp
  effectiveMicroReward: number; // BASE_MICRO_REWARD * multiplierM
  updatedAt: Date;
}

export interface EscrowReserveResult {
  success: boolean;
  reservedAmount: bigint;
}

class RewardPoolService {
  /**
   * 리워드풀 상태 조회
   */
  async getStatus(): Promise<RewardPoolStatus> {
    const pool = await prisma.rewardPool.findUnique({
      where: { id: POOL_ID },
    });

    if (!pool) {
      throw new NotFoundError('리워드풀이 존재하지 않습니다');
    }

    const multiplierM = Number(pool.multiplierM);
    const availableEp = pool.balanceEp - pool.reservedEp;
    const effectiveMicroReward = Math.round(BASE_MICRO_REWARD_EP * multiplierM);

    return {
      id: pool.id,
      balanceEp: pool.balanceEp,
      reservedEp: pool.reservedEp,
      availableTodayEp: pool.availableTodayEp,
      multiplierM,
      availableEp,
      effectiveMicroReward,
      updatedAt: pool.updatedAt,
    };
  }

  /**
   * 풀 조회 또는 생성 (트랜잭션 내부용)
   */
  async getOrCreatePoolWithTx(tx: Prisma.TransactionClient) {
    let pool = await tx.rewardPool.findUnique({
      where: { id: POOL_ID },
    });

    if (!pool) {
      pool = await tx.rewardPool.create({
        data: {
          id: POOL_ID,
          balanceEp: 0n,
          reservedEp: 0n,
          availableTodayEp: 0n,
          multiplierM: new Prisma.Decimal(1.0),
        },
      });
    }

    return pool;
  }

  /**
   * 일일 배수 M 재계산 (크론잡에서 호출)
   * - 풀 잔액이 적으면 배수 감소, 많으면 배수 증가
   * - 범위: 0.2 ~ 1.0
   */
  async recalculateMultiplier(): Promise<number> {
    const pool = await prisma.rewardPool.findUnique({
      where: { id: POOL_ID },
    });

    if (!pool) {
      throw new NotFoundError('리워드풀이 존재하지 않습니다');
    }

    const availableEp = Number(pool.balanceEp - pool.reservedEp);

    // 배수 계산 로직:
    // - 10,000,000 EP 이상: 배수 1.0 (최대)
    // - 1,000,000 EP 이하: 배수 0.2 (최소)
    // - 중간: 선형 보간
    const LOW_THRESHOLD = 1_000_000;
    const HIGH_THRESHOLD = 10_000_000;

    let newMultiplier: number;
    if (availableEp >= HIGH_THRESHOLD) {
      newMultiplier = MAX_MULTIPLIER;
    } else if (availableEp <= LOW_THRESHOLD) {
      newMultiplier = MIN_MULTIPLIER;
    } else {
      // 선형 보간
      const ratio = (availableEp - LOW_THRESHOLD) / (HIGH_THRESHOLD - LOW_THRESHOLD);
      newMultiplier = MIN_MULTIPLIER + ratio * (MAX_MULTIPLIER - MIN_MULTIPLIER);
    }

    // 소수점 둘째자리까지
    newMultiplier = Math.round(newMultiplier * 100) / 100;

    await prisma.rewardPool.update({
      where: { id: POOL_ID },
      data: {
        multiplierM: new Prisma.Decimal(newMultiplier),
      },
    });

    return newMultiplier;
  }

  /**
   * 에스크로 예약 (투표 생성 시)
   * - 풀에서 예산만큼 차감하고 reservedEp에 추가
   */
  async reserveEscrow(budgetEp: bigint): Promise<EscrowReserveResult> {
    return prisma.$transaction(async (tx) => {
      const pool = await this.getOrCreatePoolWithTx(tx);

      const availableEp = pool.balanceEp - pool.reservedEp;
      if (availableEp < budgetEp) {
        throw new BadRequestError(`리워드풀 잔액 부족: 필요 ${budgetEp} EP, 가용 ${availableEp} EP`);
      }

      await tx.rewardPool.update({
        where: { id: POOL_ID },
        data: {
          reservedEp: { increment: budgetEp },
        },
      });

      return { success: true, reservedAmount: budgetEp };
    });
  }

  /**
   * 에스크로 예약 (트랜잭션 내부용)
   */
  async reserveEscrowWithTx(
    tx: Prisma.TransactionClient,
    budgetEp: bigint
  ): Promise<EscrowReserveResult> {
    const pool = await this.getOrCreatePoolWithTx(tx);

    const availableEp = pool.balanceEp - pool.reservedEp;
    if (availableEp < budgetEp) {
      throw new BadRequestError(`리워드풀 잔액 부족: 필요 ${budgetEp} EP, 가용 ${availableEp} EP`);
    }

    await tx.rewardPool.update({
      where: { id: POOL_ID },
      data: {
        reservedEp: { increment: budgetEp },
      },
    });

    return { success: true, reservedAmount: budgetEp };
  }

  /**
   * 에스크로 해제 (정산/취소 시)
   * - reservedEp에서 차감
   * - returnToPool만큼 balanceEp에 반환 (잔여분)
   */
  async releaseEscrow(escrowEp: bigint, returnToPool: bigint): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await this.releaseEscrowWithTx(tx, escrowEp, returnToPool);
    });
  }

  /**
   * 에스크로 해제 (트랜잭션 내부용)
   */
  async releaseEscrowWithTx(
    tx: Prisma.TransactionClient,
    escrowEp: bigint,
    returnToPool: bigint
  ): Promise<void> {
    const pool = await tx.rewardPool.findUnique({
      where: { id: POOL_ID },
    });

    if (!pool) {
      throw new NotFoundError('리워드풀이 존재하지 않습니다');
    }

    // 예약액이 해제량보다 작으면 안됨
    if (pool.reservedEp < escrowEp) {
      throw new BadRequestError(`에스크로 해제 오류: 예약액 ${pool.reservedEp} < 해제액 ${escrowEp}`);
    }

    await tx.rewardPool.update({
      where: { id: POOL_ID },
      data: {
        reservedEp: { decrement: escrowEp },
        balanceEp: { increment: returnToPool }, // 잔여분 반환
      },
    });
  }

  /**
   * 마이크로 보상 지급 (참여 시)
   * - 현재 배수 M을 적용한 보상 계산
   * - availableTodayEp 차감
   */
  async payMicroReward(
    userId: string,
    voteId: string
  ): Promise<{ rewardPaid: number }> {
    return prisma.$transaction(async (tx) => {
      return this.payMicroRewardWithTx(tx, userId, voteId);
    });
  }

  /**
   * 마이크로 보상 지급 (트랜잭션 내부용)
   */
  async payMicroRewardWithTx(
    tx: Prisma.TransactionClient,
    userId: string,
    voteId: string
  ): Promise<{ rewardPaid: number }> {
    const pool = await this.getOrCreatePoolWithTx(tx);
    const multiplierM = Number(pool.multiplierM);
    const microReward = Math.round(BASE_MICRO_REWARD_EP * multiplierM);

    // 오늘 가용액 확인
    if (pool.availableTodayEp < BigInt(microReward)) {
      // 가용액 부족 시 보상 없이 진행 (참여는 허용)
      return { rewardPaid: 0 };
    }

    // 풀에서 차감
    await tx.rewardPool.update({
      where: { id: POOL_ID },
      data: {
        availableTodayEp: { decrement: BigInt(microReward) },
        balanceEp: { decrement: BigInt(microReward) },
      },
    });

    // 포인트 지급 (refType: VOTE_V2, refId: ${voteId}_micro_${userId})
    await pointService.adjustPointsWithTx(
      tx,
      userId,
      microReward,
      'VOTE_MICRO_REWARD' as PointTxReason,
      'VOTE_V2',
      `${voteId}_micro_${userId}`,
      `투표 참여 마이크로 보상: ${microReward} EP`
    );

    return { rewardPaid: microReward };
  }

  /**
   * 풀 충전 (스폰서 수익에서)
   */
  async deposit(amountEp: bigint, source: string): Promise<void> {
    if (amountEp <= 0n) {
      throw new BadRequestError('충전 금액은 0보다 커야 합니다');
    }

    await prisma.$transaction(async (tx) => {
      const pool = await this.getOrCreatePoolWithTx(tx);

      await tx.rewardPool.update({
        where: { id: POOL_ID },
        data: {
          balanceEp: { increment: amountEp },
        },
      });

      // 풀 입금 기록 (PointLedgerTx에 기록하지 않고 별도 로깅)
      console.log(`[RewardPool] Deposited ${amountEp} EP from ${source}`);
    });
  }

  /**
   * 일일 가용액 리셋 (크론잡에서 호출)
   * - 매일 자정 풀 잔액의 일정 비율을 오늘 가용액으로 설정
   */
  async resetDailyAvailable(dailyPercentage: number = 5): Promise<bigint> {
    const pool = await prisma.rewardPool.findUnique({
      where: { id: POOL_ID },
    });

    if (!pool) {
      throw new NotFoundError('리워드풀이 존재하지 않습니다');
    }

    const availableBalance = pool.balanceEp - pool.reservedEp;
    // 가용 잔액의 dailyPercentage% (기본 5%)를 오늘 가용액으로
    const todayAvailable = (availableBalance * BigInt(dailyPercentage)) / 100n;

    await prisma.rewardPool.update({
      where: { id: POOL_ID },
      data: {
        availableTodayEp: todayAvailable,
      },
    });

    return todayAvailable;
  }

  /**
   * 관리자: 풀 충전
   */
  async adminDeposit(amountEp: number, adminId: string, reason?: string): Promise<void> {
    if (amountEp <= 0) {
      throw new BadRequestError('충전 금액은 0보다 커야 합니다');
    }

    await this.deposit(BigInt(amountEp), `admin:${adminId}:${reason || 'manual deposit'}`);
  }

  /**
   * 정산 시 정답자에게 보상 지급 (트랜잭션 내부용)
   */
  async payFinalRewardWithTx(
    tx: Prisma.TransactionClient,
    userId: string,
    voteId: string,
    amount: bigint
  ): Promise<void> {
    if (amount <= 0n) {
      return;
    }

    await pointService.adjustPointsWithTx(
      tx,
      userId,
      Number(amount),
      'VOTE_FINAL_REWARD' as PointTxReason,
      'VOTE_V2',
      `${voteId}_final_${userId}`,
      `투표 정답 보상: ${amount} EP`
    );
  }
}

export const rewardPoolService = new RewardPoolService();

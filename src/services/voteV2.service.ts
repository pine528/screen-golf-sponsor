import { Prisma, VoteV2Status, PointTxReason } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors';
import { rewardPoolService } from './rewardPool.service';
import { pointService } from './point.service';

// 템플릿 코드 정의
export const VOTE_TEMPLATES = {
  'T1-YesNo': { base: 20000, difficulty: 1.0, name: 'Yes/No 투표' },
  'T2-MC': { base: 40000, difficulty: 1.2, name: '객관식 투표' },
  'T3-TopN': { base: 80000, difficulty: 1.5, name: 'Top N 예측' },
  'T4-Exact': { base: 120000, difficulty: 1.8, name: '정확한 값 예측' },
} as const;

export type TemplateCode = keyof typeof VOTE_TEMPLATES;

// 최대 1인당 보상 상한
const MAX_PER_WINNER_EP = 50000n;

// 사용자 투표 생성 제한
export const USER_VOTE_LIMITS = {
  MIN_SEED_EP: 10000,        // 최소 시드머니: 10,000 EP
  MAX_SEED_EP: 500000,       // 최대 시드머니: 500,000 EP
  MAX_DAILY_CREATES: 5,      // 하루 최대 생성 수
};

export interface CreateVoteV2Dto {
  templateCode: TemplateCode;
  title: string;
  description?: string;
  options: any[]; // 선택지 배열
  closeAt: Date;
  target?: {
    tournamentId?: string;
    matchId?: string;
    playerId?: string;
  };
  outcomeSource?: string;
  maxPerWinnerEp?: number;
}

// 사용자 투표 생성 DTO (본인 포인트 사용)
export interface CreateUserVoteDto {
  templateCode: TemplateCode;
  title: string;
  description?: string;
  options: any[];    // 선택지 배열
  closeAt: Date;
  seedAmountEp: number;  // 시드머니 (본인 포인트에서 차감)
  target?: {
    tournamentId?: string;
    matchId?: string;
    playerId?: string;
  };
}

export interface ParticipateVoteV2Dto {
  answer: any; // 선택한 답변 (템플릿에 따라 다름)
}

export interface SettleVoteV2Dto {
  correctAnswer: any; // 정답 (템플릿에 따라 다름)
}

export interface SettleResult {
  winnersCount: number;
  perWinnerEp: bigint;
  totalPaidEp: bigint;
  remainderEp: bigint;
  alreadySettled: boolean;
}

class VoteV2Service {
  /**
   * 투표 목록 조회
   */
  async list(options: {
    status?: VoteV2Status;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.VoteV2WhereInput = {
      ...(options.status && { status: options.status }),
    };

    const [votes, total] = await Promise.all([
      prisma.voteV2.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { participations: true },
          },
        },
      }),
      prisma.voteV2.count({ where }),
    ]);

    // 선택지별 실제 득표수 집계 (목록 카드의 비율 표시용 — 집계값만 내려주고 임의 수치는 만들지 않는다)
    const voteIds = votes.map((v) => v.id);
    const tallyByVote = new Map<string, Record<string, number>>();
    if (voteIds.length > 0) {
      const parts = await prisma.voteParticipationV2.findMany({
        where: { voteId: { in: voteIds } },
        select: { voteId: true, answer: true },
      });
      for (const p of parts) {
        const a = p.answer as any;
        const picked = a?.optionId ?? a?.choice ?? a?.value;
        if (picked === undefined || picked === null) continue;
        const t = tallyByVote.get(p.voteId) || {};
        const key = String(picked);
        t[key] = (t[key] || 0) + 1;
        tallyByVote.set(p.voteId, t);
      }
    }

    return {
      votes: votes.map((v) => ({ ...v, optionTally: tallyByVote.get(v.id) || {} })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 투표 상세 조회
   */
  async getById(id: string, userId?: string) {
    const vote = await prisma.voteV2.findUnique({
      where: { id },
      include: {
        participations: userId
          ? {
              where: { userId },
              take: 1,
            }
          : false,
        _count: {
          select: { participations: true },
        },
      },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 사용자의 참여 정보 추가
    const userParticipation = userId && vote.participations?.[0] || null;

    return {
      ...vote,
      participationCount: vote._count.participations,
      userParticipation,
    };
  }

  /**
   * 투표 생성 (에스크로 예약 포함)
   */
  async create(data: CreateVoteV2Dto, createdBy: string) {
    // 템플릿 유효성 검사
    if (!VOTE_TEMPLATES[data.templateCode]) {
      throw new BadRequestError(`유효하지 않은 템플릿 코드: ${data.templateCode}`);
    }

    // 마감일 유효성 검사
    const closeAt = new Date(data.closeAt);
    if (closeAt <= new Date()) {
      throw new BadRequestError('마감일은 현재 시간 이후여야 합니다');
    }

    // 예산 계산
    const budget = this.calculateBudget(data.templateCode, closeAt);

    // 트랜잭션: 에스크로 예약 + 투표 생성
    const vote = await prisma.$transaction(async (tx) => {
      // 1. 리워드풀에서 에스크로 예약
      await rewardPoolService.reserveEscrowWithTx(tx, budget);

      // 2. 투표 생성
      const newVote = await tx.voteV2.create({
        data: {
          templateCode: data.templateCode,
          title: data.title,
          description: data.description,
          options: data.options || [],
          status: 'OPEN',
          rewardBudgetEp: budget,
          escrowEp: budget,
          maxPerWinnerEp: data.maxPerWinnerEp ? BigInt(data.maxPerWinnerEp) : MAX_PER_WINNER_EP,
          target: data.target || {},
          outcomeSource: data.outcomeSource || 'official_api',
          closeAt,
          createdBy,
        },
      });

      return newVote;
    });

    return vote;
  }

  /**
   * 사용자 투표 생성 (본인 포인트 사용)
   * - 본인 포인트에서 시드머니 차감
   * - 무료 참여 + 1/n 균등 분배 동일
   */
  async createUserVote(data: CreateUserVoteDto, createdBy: string) {
    // 템플릿 유효성 검사
    if (!VOTE_TEMPLATES[data.templateCode]) {
      throw new BadRequestError(`유효하지 않은 템플릿 코드: ${data.templateCode}`);
    }

    // 시드머니 범위 확인
    if (data.seedAmountEp < USER_VOTE_LIMITS.MIN_SEED_EP) {
      throw new BadRequestError(`시드머니는 최소 ${USER_VOTE_LIMITS.MIN_SEED_EP.toLocaleString()} EP 이상이어야 합니다`);
    }
    if (data.seedAmountEp > USER_VOTE_LIMITS.MAX_SEED_EP) {
      throw new BadRequestError(`시드머니는 최대 ${USER_VOTE_LIMITS.MAX_SEED_EP.toLocaleString()} EP까지 가능합니다`);
    }

    // 마감일 유효성 검사
    const closeAt = new Date(data.closeAt);
    if (closeAt <= new Date()) {
      throw new BadRequestError('마감일은 현재 시간 이후여야 합니다');
    }

    // 최소 1시간 이후 마감
    const minCloseAt = new Date(Date.now() + 60 * 60 * 1000);
    if (closeAt < minCloseAt) {
      throw new BadRequestError('마감일은 최소 1시간 이후여야 합니다');
    }

    // 일일 생성 제한 확인
    await this.checkDailyCreateLimit(createdBy);

    const seedAmount = BigInt(data.seedAmountEp);

    // 트랜잭션: 포인트 차감 + 투표 생성
    const vote = await prisma.$transaction(async (tx) => {
      // 1. 본인 포인트 차감
      await pointService.adjustPointsWithTx(
        tx,
        createdBy,
        -data.seedAmountEp,
        'VOTE_CREATE_SEED' as PointTxReason,
        'VOTE_V2_USER',
        `seed_${Date.now()}_${createdBy}`,
        `투표 생성 시드머니: ${data.seedAmountEp.toLocaleString()} EP`
      );

      // 2. 투표 생성 (fundingSource = USER_POINTS)
      const newVote = await tx.voteV2.create({
        data: {
          templateCode: data.templateCode,
          title: data.title,
          description: data.description,
          options: data.options || [],
          status: 'OPEN',
          fundingSource: 'USER_POINTS',
          rewardBudgetEp: seedAmount,
          escrowEp: seedAmount,
          maxPerWinnerEp: MAX_PER_WINNER_EP,
          target: data.target || {},
          outcomeSource: 'creator',
          closeAt,
          createdBy,
        },
      });

      return newVote;
    });

    return vote;
  }

  /**
   * 일일 투표 생성 제한 확인
   */
  private async checkDailyCreateLimit(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await prisma.voteV2.count({
      where: {
        createdBy: userId,
        fundingSource: 'USER_POINTS',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todayCount >= USER_VOTE_LIMITS.MAX_DAILY_CREATES) {
      throw new BadRequestError(
        `하루 최대 ${USER_VOTE_LIMITS.MAX_DAILY_CREATES}개까지 투표를 생성할 수 있습니다. 내일 다시 시도해주세요.`
      );
    }
  }

  /**
   * 내가 생성한 투표 목록 조회
   */
  async getMyCreatedVotes(
    userId: string,
    options: {
      status?: VoteV2Status;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.VoteV2WhereInput = {
      createdBy: userId,
      fundingSource: 'USER_POINTS',
      ...(options.status && { status: options.status }),
    };

    const [votes, total] = await Promise.all([
      prisma.voteV2.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { participations: true },
          },
        },
      }),
      prisma.voteV2.count({ where }),
    ]);

    return {
      votes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 사용자 투표 취소 (생성자만, 참여자 없을 때만 가능)
   * - 시드머니 전액 환불
   */
  async cancelUserVote(voteId: string, userId: string): Promise<void> {
    const vote = await prisma.voteV2.findUnique({
      where: { id: voteId },
      include: {
        _count: {
          select: { participations: true },
        },
      },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 생성자 확인
    if (vote.createdBy !== userId) {
      throw new ForbiddenError('본인이 생성한 투표만 취소할 수 있습니다');
    }

    // 사용자 생성 투표 확인
    if (vote.fundingSource !== 'USER_POINTS') {
      throw new BadRequestError('사용자 생성 투표만 취소할 수 있습니다');
    }

    // 상태 확인
    if (vote.status !== 'OPEN') {
      throw new BadRequestError(`투표 상태가 ${vote.status}입니다. OPEN 상태에서만 취소할 수 있습니다.`);
    }

    // 참여자 확인
    if (vote._count.participations > 0) {
      throw new BadRequestError('참여자가 있는 투표는 취소할 수 없습니다. 마감 후 정산해주세요.');
    }

    await prisma.$transaction(async (tx) => {
      // 시드머니 환불
      await pointService.adjustPointsWithTx(
        tx,
        userId,
        Number(vote.escrowEp),
        'VOTE_CREATE_SEED_REFUND' as PointTxReason,
        'VOTE_V2_USER',
        `refund_${voteId}`,
        `투표 취소 시드머니 환불: ${vote.escrowEp.toString()} EP`
      );

      // 상태 업데이트
      await tx.voteV2.update({
        where: { id: voteId },
        data: {
          status: 'CANCELED',
          escrowEp: 0n,
        },
      });
    });
  }

  /**
   * 사용자 투표 정산 (생성자 또는 관리자)
   */
  async settleUserVote(voteId: string, userId: string, data: SettleVoteV2Dto, isAdmin: boolean = false): Promise<SettleResult> {
    const vote = await prisma.voteV2.findUnique({
      where: { id: voteId },
      include: {
        participations: true,
      },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 권한 확인 (생성자 또는 관리자)
    if (!isAdmin && vote.createdBy !== userId) {
      throw new ForbiddenError('본인이 생성한 투표만 정산할 수 있습니다');
    }

    // 이미 정산됨
    if (vote.status === 'SETTLED') {
      return {
        winnersCount: 0,
        perWinnerEp: 0n,
        totalPaidEp: 0n,
        remainderEp: 0n,
        alreadySettled: true,
      };
    }

    // 상태 확인
    if (vote.status !== 'OPEN' && vote.status !== 'CLOSED') {
      throw new BadRequestError(`투표 상태가 ${vote.status}입니다. 정산할 수 없습니다.`);
    }

    // 사용자 생성 투표는 마감 후에만 정산 가능
    if (vote.fundingSource === 'USER_POINTS' && vote.status === 'OPEN' && new Date() < vote.closeAt) {
      throw new BadRequestError('마감 시간이 지난 후에만 정산할 수 있습니다');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. 정답자 판정
      const winners = vote.participations.filter((p) =>
        this.judgeAnswer(vote.templateCode, p.answer, data.correctAnswer)
      );
      const losers = vote.participations.filter(
        (p) => !this.judgeAnswer(vote.templateCode, p.answer, data.correctAnswer)
      );

      // 2. 1/n 계산 (상한 적용)
      let perWinnerEp = 0n;
      let totalPaidEp = 0n;
      let remainderEp = vote.escrowEp;

      if (winners.length > 0) {
        const rawPerWinner = vote.escrowEp / BigInt(winners.length);
        perWinnerEp = rawPerWinner > vote.maxPerWinnerEp ? vote.maxPerWinnerEp : rawPerWinner;
        totalPaidEp = perWinnerEp * BigInt(winners.length);
        remainderEp = vote.escrowEp - totalPaidEp;
      }

      // 3. 정답자 지급
      for (const winner of winners) {
        if (winner.finalRewardPaidEp > 0n) continue;

        await tx.voteParticipationV2.update({
          where: { voteId_userId: { voteId, userId: winner.userId } },
          data: {
            isCorrect: true,
            finalRewardPaidEp: perWinnerEp,
          },
        });

        // 포인트 지급 (직접 지급, 리워드풀 거치지 않음)
        await pointService.adjustPointsWithTx(
          tx,
          winner.userId,
          Number(perWinnerEp),
          'VOTE_FINAL_REWARD' as PointTxReason,
          'VOTE_V2_USER',
          `${voteId}_final_${winner.userId}`,
          `투표 정답 보상: ${perWinnerEp.toString()} EP`
        );
      }

      // 4. 오답자 표시
      for (const loser of losers) {
        await tx.voteParticipationV2.update({
          where: { voteId_userId: { voteId, userId: loser.userId } },
          data: {
            isCorrect: false,
            finalRewardPaidEp: 0n,
          },
        });
      }

      // 5. 잔여분 생성자에게 반환 (사용자 생성 투표의 경우)
      if (vote.fundingSource === 'USER_POINTS' && remainderEp > 0n && vote.createdBy) {
        await pointService.adjustPointsWithTx(
          tx,
          vote.createdBy,
          Number(remainderEp),
          'VOTE_CREATE_SEED_REFUND' as PointTxReason,
          'VOTE_V2_USER',
          `${voteId}_remainder`,
          `투표 정산 잔여분 반환: ${remainderEp.toString()} EP`
        );
      }

      // 6. 투표 상태 업데이트
      await tx.voteV2.update({
        where: { id: voteId },
        data: {
          status: 'SETTLED',
          correctAnswer: data.correctAnswer,
          escrowEp: 0n,
          settleAt: new Date(),
        },
      });

      return {
        winnersCount: winners.length,
        perWinnerEp,
        totalPaidEp,
        remainderEp,
        alreadySettled: false,
      };
    });

    return result;
  }

  /**
   * 투표 참여 (무료 + 마이크로 보상)
   */
  async participate(voteId: string, userId: string, data: ParticipateVoteV2Dto) {
    const vote = await prisma.voteV2.findUnique({
      where: { id: voteId },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 상태 확인
    if (vote.status !== 'OPEN') {
      throw new BadRequestError(`이 투표는 ${vote.status} 상태입니다. 참여할 수 없습니다.`);
    }

    // 마감 시간 확인
    if (new Date() > vote.closeAt) {
      throw new BadRequestError('투표가 마감되었습니다');
    }

    // 본인 생성 투표에 참여 불가
    if (vote.createdBy === userId) {
      throw new BadRequestError('본인이 생성한 투표에는 참여할 수 없습니다');
    }

    // 트랜잭션: 참여 기록 + 마이크로 보상 지급
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 중복 참여 확인 (PK로 자동 체크되지만 명시적으로)
        const existing = await tx.voteParticipationV2.findUnique({
          where: {
            voteId_userId: { voteId, userId },
          },
        });

        if (existing) {
          throw new ConflictError('이미 이 투표에 참여하셨습니다');
        }

        // 2. 마이크로 보상 지급 (리워드풀 투표만)
        let rewardPaid = 0;
        if (vote.fundingSource === 'REWARD_POOL') {
          const result = await rewardPoolService.payMicroRewardWithTx(tx, userId, voteId);
          rewardPaid = result.rewardPaid;
        }

        // 3. 참여 기록 생성
        const participation = await tx.voteParticipationV2.create({
          data: {
            voteId,
            userId,
            answer: data.answer,
            microRewardPaidEp: BigInt(rewardPaid),
          },
        });

        return { participation, microRewardPaid: rewardPaid };
      });

      return result;
    } catch (error: any) {
      // P2002: Unique constraint violation (이미 참여함)
      if (error.code === 'P2002') {
        throw new ConflictError('이미 이 투표에 참여하셨습니다');
      }
      throw error;
    }
  }

  /**
   * 투표 정산 (1/n 균등 분배)
   */
  async settle(voteId: string, data: SettleVoteV2Dto): Promise<SettleResult> {
    const vote = await prisma.voteV2.findUnique({
      where: { id: voteId },
      include: {
        participations: true,
      },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 이미 정산됨
    if (vote.status === 'SETTLED') {
      return {
        winnersCount: 0,
        perWinnerEp: 0n,
        totalPaidEp: 0n,
        remainderEp: 0n,
        alreadySettled: true,
      };
    }

    // 상태 확인 (OPEN 또는 CLOSED만 정산 가능)
    if (vote.status !== 'OPEN' && vote.status !== 'CLOSED') {
      throw new BadRequestError(`투표 상태가 ${vote.status}입니다. 정산할 수 없습니다.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. 정답자 판정
      const winners = vote.participations.filter((p) =>
        this.judgeAnswer(vote.templateCode, p.answer, data.correctAnswer)
      );
      const losers = vote.participations.filter(
        (p) => !this.judgeAnswer(vote.templateCode, p.answer, data.correctAnswer)
      );

      // 2. 1/n 계산 (상한 50,000 적용)
      let perWinnerEp = 0n;
      let totalPaidEp = 0n;
      let remainderEp = vote.escrowEp;

      if (winners.length > 0) {
        // floor(escrowEp / n) but capped at maxPerWinnerEp
        const rawPerWinner = vote.escrowEp / BigInt(winners.length);
        perWinnerEp = rawPerWinner > vote.maxPerWinnerEp ? vote.maxPerWinnerEp : rawPerWinner;
        totalPaidEp = perWinnerEp * BigInt(winners.length);
        remainderEp = vote.escrowEp - totalPaidEp;
      }

      // 3. 정답자 지급 (멱등성: finalRewardPaidEp = 0인 경우만)
      for (const winner of winners) {
        // 이미 지급된 경우 스킵
        if (winner.finalRewardPaidEp > 0n) {
          continue;
        }

        await tx.voteParticipationV2.update({
          where: { voteId_userId: { voteId, userId: winner.userId } },
          data: {
            isCorrect: true,
            finalRewardPaidEp: perWinnerEp,
          },
        });

        // 포인트 지급
        await rewardPoolService.payFinalRewardWithTx(tx, winner.userId, voteId, perWinnerEp);
      }

      // 4. 오답자 표시
      for (const loser of losers) {
        await tx.voteParticipationV2.update({
          where: { voteId_userId: { voteId, userId: loser.userId } },
          data: {
            isCorrect: false,
            finalRewardPaidEp: 0n,
          },
        });
      }

      // 5. 잔여분 풀 반환 (에스크로 전체 해제)
      await rewardPoolService.releaseEscrowWithTx(tx, vote.escrowEp, remainderEp);

      // 6. 투표 상태 업데이트
      await tx.voteV2.update({
        where: { id: voteId },
        data: {
          status: 'SETTLED',
          correctAnswer: data.correctAnswer,
          escrowEp: 0n,
          settleAt: new Date(),
        },
      });

      return {
        winnersCount: winners.length,
        perWinnerEp,
        totalPaidEp,
        remainderEp,
        alreadySettled: false,
      };
    });

    return result;
  }

  /**
   * 투표 취소 (에스크로 전액 반환)
   */
  async cancel(voteId: string): Promise<void> {
    const vote = await prisma.voteV2.findUnique({
      where: { id: voteId },
    });

    if (!vote) {
      throw new NotFoundError('투표를 찾을 수 없습니다');
    }

    // 이미 취소/정산됨
    if (vote.status === 'CANCELED' || vote.status === 'SETTLED') {
      throw new BadRequestError(`투표가 이미 ${vote.status} 상태입니다`);
    }

    await prisma.$transaction(async (tx) => {
      // 에스크로 전액 풀로 반환
      await rewardPoolService.releaseEscrowWithTx(tx, vote.escrowEp, vote.escrowEp);

      // 상태 업데이트
      await tx.voteV2.update({
        where: { id: voteId },
        data: {
          status: 'CANCELED',
          escrowEp: 0n,
        },
      });
    });
  }

  /**
   * 투표 마감 (OPEN → CLOSED)
   * 크론잡이나 수동으로 호출하여 마감 시간이 지난 투표를 CLOSED로 변경
   */
  async closeExpiredVotes(): Promise<number> {
    const result = await prisma.voteV2.updateMany({
      where: {
        status: 'OPEN',
        closeAt: { lte: new Date() },
      },
      data: {
        status: 'CLOSED',
      },
    });

    return result.count;
  }

  /**
   * 내 참여 목록 조회
   */
  async getMyParticipations(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [participations, total] = await Promise.all([
      prisma.voteParticipationV2.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          vote: {
            select: {
              id: true,
              templateCode: true,
              title: true,
              status: true,
              closeAt: true,
              correctAnswer: true,
            },
          },
        },
      }),
      prisma.voteParticipationV2.count({ where: { userId } }),
    ]);

    return {
      participations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 예산 계산 (템플릿 기반)
   */
  private calculateBudget(templateCode: TemplateCode, closeAt: Date): bigint {
    const template = VOTE_TEMPLATES[templateCode];
    const durationHours = (closeAt.getTime() - Date.now()) / (1000 * 60 * 60);

    // 기간에 따른 팩터
    let durationFactor = 1.0;
    if (durationHours <= 24) {
      durationFactor = 1.0;
    } else if (durationHours <= 72) {
      durationFactor = 1.2;
    } else {
      durationFactor = 1.4;
    }

    const budget = Math.round(template.base * template.difficulty * durationFactor);
    return BigInt(budget);
  }

  /**
   * 정답 판정 (템플릿에 따른 로직)
   */
  private judgeAnswer(templateCode: string, userAnswer: any, correctAnswer: any): boolean {
    try {
      switch (templateCode) {
        case 'T1-YesNo':
          // Yes/No: 단순 일치
          return userAnswer === correctAnswer ||
            String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase();

        case 'T2-MC':
          // 객관식: 선택한 옵션 ID 일치
          return userAnswer === correctAnswer ||
            String(userAnswer) === String(correctAnswer);

        case 'T3-TopN':
          // Top N: 배열 비교 (순서 고려)
          if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
            return false;
          }
          if (userAnswer.length !== correctAnswer.length) {
            return false;
          }
          return userAnswer.every((item, index) => item === correctAnswer[index]);

        case 'T4-Exact':
          // 정확한 값: 숫자/문자열 일치
          return userAnswer === correctAnswer ||
            Number(userAnswer) === Number(correctAnswer);

        default:
          // 기본: 단순 비교
          return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
      }
    } catch {
      return false;
    }
  }

  /**
   * 투표 통계 조회 (관리자용)
   */
  async getStats() {
    const [openCount, closedCount, settledCount, canceledCount, totalParticipations] =
      await Promise.all([
        prisma.voteV2.count({ where: { status: 'OPEN' } }),
        prisma.voteV2.count({ where: { status: 'CLOSED' } }),
        prisma.voteV2.count({ where: { status: 'SETTLED' } }),
        prisma.voteV2.count({ where: { status: 'CANCELED' } }),
        prisma.voteParticipationV2.count(),
      ]);

    return {
      votes: {
        open: openCount,
        closed: closedCount,
        settled: settledCount,
        canceled: canceledCount,
        total: openCount + closedCount + settledCount + canceledCount,
      },
      totalParticipations,
    };
  }
}

export const voteV2Service = new VoteV2Service();

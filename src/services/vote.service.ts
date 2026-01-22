import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { VoteEventStatus } from '@prisma/client';

export class VoteService {
  // ============================================
  // VoteEvent CRUD
  // ============================================

  async createVoteEvent(data: {
    eventId?: string;
    title: string;
    description?: string;
    questionType: 'PREDICTION' | 'QUIZ' | 'POLL';
    question: string;
    options: { id: string; label: string; athleteId?: string }[];
    pointsPerCorrect?: number;
    sponsorBrandId?: string;
    startAt: Date;
    endAt: Date;
  }) {
    return prisma.voteEvent.create({
      data: {
        eventId: data.eventId,
        title: data.title,
        description: data.description,
        questionType: data.questionType,
        question: data.question,
        options: data.options,
        pointsPerCorrect: data.pointsPerCorrect || 100,
        sponsorBrandId: data.sponsorBrandId,
        startAt: data.startAt,
        endAt: data.endAt,
        status: 'DRAFT',
      },
      include: {
        event: true,
        sponsorBrand: true,
      },
    });
  }

  async findVoteEventById(id: string) {
    const voteEvent = await prisma.voteEvent.findUnique({
      where: { id },
      include: {
        event: true,
        sponsorBrand: true,
        votes: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
        athletePoints: {
          include: {
            athlete: {
              select: { id: true, name: true, profileImageUrl: true },
            },
          },
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    return voteEvent;
  }

  async listVoteEvents(page: number = 1, limit: number = 20, filters?: {
    status?: VoteEventStatus;
    eventId?: string;
    questionType?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.eventId) where.eventId = filters.eventId;
    if (filters?.questionType) where.questionType = filters.questionType;

    const [voteEvents, total] = await Promise.all([
      prisma.voteEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: true,
          sponsorBrand: {
            select: { id: true, name: true },
          },
          _count: {
            select: { votes: true },
          },
        },
      }),
      prisma.voteEvent.count({ where }),
    ]);

    return { voteEvents, total };
  }

  async listActiveVoteEvents(page: number = 1, limit: number = 20) {
    // ACTIVE 상태인 투표만 조회 (날짜 필터링 제거 - 관리자가 상태로 직접 관리)
    const [voteEvents, total] = await Promise.all([
      prisma.voteEvent.findMany({
        where: {
          status: 'ACTIVE',
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { endAt: 'asc' },
        include: {
          event: true,
          sponsorBrand: {
            select: { id: true, name: true },
          },
          _count: {
            select: { votes: true },
          },
        },
      }),
      prisma.voteEvent.count({
        where: {
          status: 'ACTIVE',
        },
      }),
    ]);

    return { voteEvents, total };
  }

  async listEndedVoteEvents(page: number = 1, limit: number = 20) {
    const [voteEvents, total] = await Promise.all([
      prisma.voteEvent.findMany({
        where: {
          status: { in: ['CLOSED', 'SETTLED'] },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { endAt: 'desc' },
        include: {
          event: true,
          sponsorBrand: {
            select: { id: true, name: true },
          },
          _count: {
            select: { votes: true },
          },
        },
      }),
      prisma.voteEvent.count({
        where: {
          status: { in: ['CLOSED', 'SETTLED'] },
        },
      }),
    ]);

    return { voteEvents, total };
  }

  async updateVoteEvent(id: string, data: {
    title?: string;
    description?: string;
    question?: string;
    options?: { id: string; label: string; athleteId?: string }[];
    pointsPerCorrect?: number;
    startAt?: Date;
    endAt?: Date;
  }) {
    const voteEvent = await prisma.voteEvent.findUnique({ where: { id } });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    if (voteEvent.status !== 'DRAFT') {
      throw new ForbiddenError('Can only update draft vote events');
    }

    return prisma.voteEvent.update({
      where: { id },
      data,
      include: {
        event: true,
        sponsorBrand: true,
      },
    });
  }

  async activateVoteEvent(id: string) {
    const voteEvent = await prisma.voteEvent.findUnique({ where: { id } });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    if (voteEvent.status !== 'DRAFT') {
      throw new ForbiddenError('Can only activate draft vote events');
    }

    return prisma.voteEvent.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async closeVoteEvent(id: string) {
    const voteEvent = await prisma.voteEvent.findUnique({ where: { id } });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    if (voteEvent.status !== 'ACTIVE') {
      throw new ForbiddenError('Can only close active vote events');
    }

    return prisma.voteEvent.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  async settleVoteEvent(id: string, correctOptionId: string) {
    const voteEvent = await prisma.voteEvent.findUnique({
      where: { id },
      include: { votes: true },
    });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    if (voteEvent.status !== 'CLOSED') {
      throw new ForbiddenError('Can only settle closed vote events');
    }

    // 정답 옵션 검증
    const options = voteEvent.options as { id: string; label: string; athleteId?: string }[];
    const correctOption = options.find(o => o.id === correctOptionId);
    if (!correctOption) {
      throw new BadRequestError('Invalid correct option ID');
    }

    // 정답자에게 포인트 지급 및 선수 포인트 집계
    const athletePointsMap = new Map<string, number>();

    for (const vote of voteEvent.votes) {
      const isCorrect = vote.selectedOptionId === correctOptionId;
      const pointsEarned = isCorrect ? voteEvent.pointsPerCorrect : 0;

      // 투표 업데이트
      await prisma.vote.update({
        where: { id: vote.id },
        data: { isCorrect, pointsEarned },
      });

      // 정답인 경우 포인트 지급
      if (isCorrect) {
        const user = await prisma.user.update({
          where: { id: vote.userId },
          data: { pointBalance: { increment: pointsEarned } },
        });

        // 포인트 원장 기록
        await prisma.pointLedger.create({
          data: {
            userId: vote.userId,
            amount: pointsEarned,
            balance: user.pointBalance,
            type: 'VOTE_REWARD',
            description: `투표 이벤트 정답 보상: ${voteEvent.title}`,
            referenceId: voteEvent.id,
            referenceType: 'VOTE_EVENT',
          },
        });
      }

      // 선수 포인트 집계 (옵션에 athleteId가 있는 경우)
      const selectedOption = options.find(o => o.id === vote.selectedOptionId);
      if (selectedOption?.athleteId) {
        const current = athletePointsMap.get(selectedOption.athleteId) || 0;
        athletePointsMap.set(selectedOption.athleteId, current + 1);
      }
    }

    // 선수 포인트 저장
    for (const [athleteId, points] of athletePointsMap) {
      await prisma.athleteVotePoint.upsert({
        where: {
          voteEventId_athleteId: { voteEventId: id, athleteId },
        },
        create: {
          voteEventId: id,
          athleteId,
          points,
        },
        update: {
          points,
        },
      });
    }

    // 이벤트 상태 업데이트
    return prisma.voteEvent.update({
      where: { id },
      data: {
        status: 'SETTLED',
        correctOptionId,
      },
    });
  }

  async deleteVoteEvent(id: string) {
    const voteEvent = await prisma.voteEvent.findUnique({ where: { id } });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    // DRAFT 또는 SETTLED 상태만 삭제 가능
    if (voteEvent.status !== 'DRAFT' && voteEvent.status !== 'SETTLED') {
      throw new ForbiddenError('초안 또는 정산완료된 투표만 삭제할 수 있습니다');
    }

    // SETTLED인 경우 관련 데이터도 함께 삭제
    if (voteEvent.status === 'SETTLED') {
      return prisma.$transaction(async (tx) => {
        // 투표 기록 삭제
        await tx.vote.deleteMany({ where: { voteEventId: id } });
        // 이벤트 삭제
        return tx.voteEvent.delete({ where: { id } });
      });
    }

    return prisma.voteEvent.delete({ where: { id } });
  }

  // ============================================
  // Vote (투표)
  // ============================================

  async submitVote(userId: string, voteEventId: string, selectedOptionId: string) {
    const voteEvent = await prisma.voteEvent.findUnique({ where: { id: voteEventId } });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    if (voteEvent.status !== 'ACTIVE') {
      throw new ForbiddenError('Voting is not active for this event');
    }

    const now = new Date();
    if (now < voteEvent.startAt || now > voteEvent.endAt) {
      throw new ForbiddenError('Voting period is not active');
    }

    // 옵션 검증
    const options = voteEvent.options as { id: string; label: string }[];
    if (!options.find(o => o.id === selectedOptionId)) {
      throw new BadRequestError('Invalid option selected');
    }

    // 기존 투표 확인
    const existingVote = await prisma.vote.findUnique({
      where: {
        voteEventId_userId: { voteEventId, userId },
      },
    });

    if (existingVote) {
      throw new ForbiddenError('Already voted for this event');
    }

    return prisma.vote.create({
      data: {
        voteEventId,
        userId,
        selectedOptionId,
      },
      include: {
        voteEvent: true,
      },
    });
  }

  async getUserVotes(userId: string, page: number = 1, limit: number = 20) {
    const [votes, total] = await Promise.all([
      prisma.vote.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          voteEvent: {
            include: {
              event: true,
            },
          },
        },
      }),
      prisma.vote.count({ where: { userId } }),
    ]);

    return { votes, total };
  }

  // ============================================
  // Points (포인트)
  // ============================================

  async getUserPoints(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return { balance: user.pointBalance };
  }

  async getPointHistory(userId: string, page: number = 1, limit: number = 20) {
    const [ledgers, total] = await Promise.all([
      prisma.pointLedger.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pointLedger.count({ where: { userId } }),
    ]);

    return { ledgers, total };
  }

  async addPoints(userId: string, amount: number, type: string, description?: string, referenceId?: string, referenceType?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { pointBalance: { increment: amount } },
    });

    await prisma.pointLedger.create({
      data: {
        userId,
        amount,
        balance: user.pointBalance,
        type,
        description,
        referenceId,
        referenceType,
      },
    });

    return { balance: user.pointBalance };
  }

  async redeemPoints(userId: string, amount: number, description?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.pointBalance < amount) {
      throw new BadRequestError('Insufficient points');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { pointBalance: { decrement: amount } },
    });

    await prisma.pointLedger.create({
      data: {
        userId,
        amount: -amount,
        balance: updatedUser.pointBalance,
        type: 'REDEMPTION',
        description: description || '포인트 사용',
      },
    });

    return { balance: updatedUser.pointBalance };
  }

  // ============================================
  // 통계
  // ============================================

  async getVoteEventStats(voteEventId: string) {
    const voteEvent = await prisma.voteEvent.findUnique({
      where: { id: voteEventId },
      include: {
        votes: true,
        athletePoints: {
          include: {
            athlete: {
              select: { id: true, name: true, profileImageUrl: true },
            },
          },
        },
      },
    });

    if (!voteEvent) {
      throw new NotFoundError('VoteEvent not found');
    }

    const options = voteEvent.options as { id: string; label: string; athleteId?: string }[];
    const optionCounts = new Map<string, number>();

    for (const vote of voteEvent.votes) {
      const count = optionCounts.get(vote.selectedOptionId) || 0;
      optionCounts.set(vote.selectedOptionId, count + 1);
    }

    const optionStats = options.map(opt => ({
      optionId: opt.id,
      label: opt.label,
      athleteId: opt.athleteId,
      count: optionCounts.get(opt.id) || 0,
      percentage: voteEvent.votes.length > 0
        ? (optionCounts.get(opt.id) || 0) / voteEvent.votes.length * 100
        : 0,
    }));

    return {
      totalVotes: voteEvent.votes.length,
      optionStats,
      athletePoints: voteEvent.athletePoints,
      status: voteEvent.status,
      correctOptionId: voteEvent.correctOptionId,
    };
  }

  async getAthleteRanking(eventId?: string, limit: number = 10) {
    const where: any = {};
    if (eventId) {
      where.voteEvent = { eventId };
    }

    const athletePoints = await prisma.athleteVotePoint.groupBy({
      by: ['athleteId'],
      where,
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const athleteIds = athletePoints.map(ap => ap.athleteId);
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: athleteIds } },
      select: { id: true, name: true, profileImageUrl: true, tour: true },
    });

    const athleteMap = new Map(athletes.map(a => [a.id, a]));

    return athletePoints.map((ap, index) => ({
      rank: index + 1,
      athlete: athleteMap.get(ap.athleteId),
      totalPoints: ap._sum.points || 0,
    }));
  }
}

export const voteService = new VoteService();

import { Prisma } from '@prisma/client';
import basePrisma from '../models/prisma';
import { pointService } from './point.service';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

// prisma generate 전까지 타입 우회
const prisma = basePrisma as any;

type SeasonStatus = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'REWARDS_DISTRIBUTED';

interface RewardTier {
  rankFrom: number;
  rankTo: number;
  rewardPoints: number;
}

export class SeasonService {
  // ============================================
  // Public APIs
  // ============================================

  /**
   * 현재 활성 시즌 조회
   */
  async getCurrentSeason() {
    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    return season;
  }

  /**
   * 시즌 상세 조회
   */
  async getSeason(seasonId: string) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        badges: true,
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    return season;
  }

  /**
   * 시즌 목록 조회
   */
  async listSeasons(options: { page?: number; pageSize?: number; status?: SeasonStatus } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (options.status) {
      where.status = options.status;
    }

    const [seasons, total] = await Promise.all([
      prisma.season.findMany({
        where,
        include: {
          _count: {
            select: { participants: true },
          },
        },
        orderBy: { startsAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.season.count({ where }),
    ]);

    return {
      seasons,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 시즌 리더보드 조회
   */
  async getLeaderboard(
    seasonId: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    const [participants, total] = await Promise.all([
      prisma.seasonParticipant.findMany({
        where: { seasonId },
        orderBy: { totalPointsEarned: 'desc' },
        skip,
        take: pageSize,
        include: {
          badgeAwards: {
            include: {
              badge: true,
            },
          },
        },
      }),
      prisma.seasonParticipant.count({ where: { seasonId } }),
    ]);

    // 참가자 정보에 유저 닉네임 추가
    const enrichedParticipants = await Promise.all(
      participants.map(async (p: any, index: number) => {
        const fan = await prisma.fan.findUnique({
          where: { userId: p.userId },
          select: { nickname: true },
        });

        return {
          ...p,
          rank: skip + index + 1,
          nickname: fan?.nickname || '익명',
        };
      })
    );

    return {
      season: {
        id: season.id,
        name: season.name,
        status: season.status,
      },
      leaderboard: enrichedParticipants,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 내 시즌 참여 현황
   */
  async getMyParticipation(userId: string, seasonId?: string) {
    // seasonId가 없으면 현재 활성 시즌
    let targetSeasonId = seasonId;
    if (!targetSeasonId) {
      const currentSeason = await this.getCurrentSeason();
      if (!currentSeason) {
        return { hasActiveSeason: false, participation: null };
      }
      targetSeasonId = currentSeason.id;
    }

    const participant = await prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId: targetSeasonId,
          userId,
        },
      },
      include: {
        season: true,
        badgeAwards: {
          include: {
            badge: true,
          },
        },
      },
    });

    if (!participant) {
      return {
        hasActiveSeason: true,
        participation: null,
        seasonId: targetSeasonId,
      };
    }

    // 현재 랭킹 계산
    const rank = await prisma.seasonParticipant.count({
      where: {
        seasonId: targetSeasonId,
        totalPointsEarned: {
          gt: participant.totalPointsEarned,
        },
      },
    });

    return {
      hasActiveSeason: true,
      participation: {
        ...participant,
        currentRank: rank + 1,
      },
    };
  }

  /**
   * 내 뱃지 목록
   */
  async getMyBadges(userId: string) {
    const participants = await prisma.seasonParticipant.findMany({
      where: { userId },
      include: {
        badgeAwards: {
          include: {
            badge: {
              include: {
                season: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        season: {
          select: { id: true, name: true },
        },
      },
    });

    const badges = participants.flatMap((p: any) =>
      p.badgeAwards.map((award: any) => ({
        ...award.badge,
        awardedAt: award.awardedAt,
        seasonName: award.badge.season.name,
      }))
    );

    return badges;
  }

  // ============================================
  // Internal APIs (투표 참여 시 호출)
  // ============================================

  /**
   * 시즌 참여 기록 업데이트 (투표 참여 시)
   */
  async recordParticipation(
    userId: string,
    pointsEarned: number,
    isCorrect: boolean
  ) {
    const currentSeason = await this.getCurrentSeason();
    if (!currentSeason) {
      return null; // 활성 시즌 없음
    }

    // 참가자 조회 또는 생성
    const participant = await prisma.seasonParticipant.upsert({
      where: {
        seasonId_userId: {
          seasonId: currentSeason.id,
          userId,
        },
      },
      create: {
        seasonId: currentSeason.id,
        userId,
        voteParticipations: 1,
        correctPredictions: isCorrect ? 1 : 0,
        totalPointsEarned: pointsEarned,
      },
      update: {
        voteParticipations: { increment: 1 },
        correctPredictions: isCorrect ? { increment: 1 } : undefined,
        totalPointsEarned: { increment: pointsEarned },
      },
    });

    return participant;
  }

  // ============================================
  // Admin APIs
  // ============================================

  /**
   * 시즌 생성
   */
  async createSeason(data: {
    name: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    rewardTiers?: RewardTier[];
    participationBonus?: number;
  }) {
    if (data.startsAt >= data.endsAt) {
      throw new BadRequestError('종료 시간은 시작 시간보다 늦어야 합니다');
    }

    const season = await prisma.season.create({
      data: {
        name: data.name,
        description: data.description,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        rewardTiers: data.rewardTiers || [],
        participationBonus: data.participationBonus || 0,
        status: 'DRAFT',
      },
    });

    return season;
  }

  /**
   * 시즌 업데이트
   */
  async updateSeason(
    seasonId: string,
    data: {
      name?: string;
      description?: string;
      startsAt?: Date;
      endsAt?: Date;
      rewardTiers?: RewardTier[];
      participationBonus?: number;
      status?: SeasonStatus;
    }
  ) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    // 보상 배포 완료된 시즌은 수정 불가
    if (season.status === 'REWARDS_DISTRIBUTED') {
      throw new ConflictError('보상이 배포된 시즌은 수정할 수 없습니다');
    }

    const updatedSeason = await prisma.season.update({
      where: { id: seasonId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startsAt && { startsAt: data.startsAt }),
        ...(data.endsAt && { endsAt: data.endsAt }),
        ...(data.rewardTiers && { rewardTiers: data.rewardTiers }),
        ...(data.participationBonus !== undefined && {
          participationBonus: data.participationBonus,
        }),
        ...(data.status && { status: data.status }),
      },
    });

    return updatedSeason;
  }

  /**
   * 시즌 활성화
   */
  async activateSeason(seasonId: string) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    if (!['DRAFT', 'UPCOMING'].includes(season.status)) {
      throw new ConflictError('초안 또는 예정 상태의 시즌만 활성화할 수 있습니다');
    }

    // 다른 활성 시즌이 있는지 확인
    const existingActive = await prisma.season.findFirst({
      where: {
        status: 'ACTIVE',
        id: { not: seasonId },
      },
    });

    if (existingActive) {
      throw new ConflictError(
        `이미 활성화된 시즌이 있습니다: ${existingActive.name}`
      );
    }

    const updatedSeason = await prisma.season.update({
      where: { id: seasonId },
      data: { status: 'ACTIVE' },
    });

    return updatedSeason;
  }

  /**
   * 시즌 종료
   */
  async endSeason(seasonId: string) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    if (season.status !== 'ACTIVE') {
      throw new ConflictError('활성 상태의 시즌만 종료할 수 있습니다');
    }

    // 랭킹 업데이트
    await this.updateRankings(seasonId);

    const updatedSeason = await prisma.season.update({
      where: { id: seasonId },
      data: { status: 'ENDED' },
    });

    return updatedSeason;
  }

  /**
   * 랭킹 업데이트
   */
  async updateRankings(seasonId: string) {
    const participants = await prisma.seasonParticipant.findMany({
      where: { seasonId },
      orderBy: { totalPointsEarned: 'desc' },
    });

    // 순위 업데이트
    for (let i = 0; i < participants.length; i++) {
      await prisma.seasonParticipant.update({
        where: { id: participants[i].id },
        data: { currentRank: i + 1 },
      });
    }

    return { updatedCount: participants.length };
  }

  /**
   * 보상 배포
   */
  async distributeRewards(seasonId: string, adminId: string) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        participants: {
          orderBy: { totalPointsEarned: 'desc' },
        },
      },
    });

    if (!season) {
      throw new NotFoundError('시즌을 찾을 수 없습니다');
    }

    if (season.status !== 'ENDED') {
      throw new ConflictError('종료된 시즌만 보상을 배포할 수 있습니다');
    }

    const rewardTiers: RewardTier[] = season.rewardTiers as RewardTier[] || [];
    const participants = season.participants;
    let totalRewardsDistributed = new Prisma.Decimal(0);
    let rewardsCount = 0;

    await prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const rank = i + 1;

        // 해당 랭크의 보상 티어 찾기
        const tier = rewardTiers.find(
          (t) => rank >= t.rankFrom && rank <= t.rankTo
        );

        let rewardPoints = tier ? tier.rewardPoints : 0;

        // 참여 보너스 추가
        if (season.participationBonus > 0) {
          rewardPoints += season.participationBonus;
        }

        if (rewardPoints > 0) {
          // 참가자 보상 기록
          await tx.seasonParticipant.update({
            where: { id: participant.id },
            data: {
              rewardDistributedAt: new Date(),
              rewardPoints,
              currentRank: rank,
            },
          });

          // 포인트 지급
          await pointService.adjustPoints(
            participant.userId,
            rewardPoints,
            'VOTE_WIN_PAYOUT' as any, // 기존 reason 활용
            'SEASON_REWARD',
            seasonId,
            `시즌 보상: ${season.name} (${rank}위)`
          );

          totalRewardsDistributed = totalRewardsDistributed.plus(rewardPoints);
          rewardsCount++;
        }

        // 뱃지 부여
        await this.awardBadges(tx, participant.id, rank, seasonId);
      }

      // 시즌 상태 업데이트
      await tx.season.update({
        where: { id: seasonId },
        data: { status: 'REWARDS_DISTRIBUTED' },
      });
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'SEASON_REWARDS_DISTRIBUTE',
        entityType: 'SEASON',
        entityId: seasonId,
        newValue: {
          totalRewardsDistributed: totalRewardsDistributed.toString(),
          rewardsCount,
        },
      },
    });

    return {
      seasonId,
      totalRewardsDistributed,
      rewardsCount,
    };
  }

  /**
   * 뱃지 부여 (내부)
   */
  private async awardBadges(
    tx: any,
    participantId: string,
    rank: number,
    seasonId: string
  ) {
    const badgesToAward: string[] = [];

    if (rank === 1) badgesToAward.push('SEASON_GOLD');
    else if (rank === 2) badgesToAward.push('SEASON_SILVER');
    else if (rank === 3) badgesToAward.push('SEASON_BRONZE');
    else if (rank <= 10) badgesToAward.push('SEASON_TOP10');
    else if (rank <= 100) badgesToAward.push('SEASON_TOP100');

    // 참여 뱃지
    badgesToAward.push('PARTICIPATION');

    for (const badgeType of badgesToAward) {
      // 뱃지 조회 또는 생성
      let badge = await tx.seasonBadge.findUnique({
        where: {
          seasonId_badgeType: {
            seasonId,
            badgeType,
          },
        },
      });

      if (!badge) {
        badge = await tx.seasonBadge.create({
          data: {
            seasonId,
            badgeType,
            name: this.getBadgeName(badgeType),
            description: this.getBadgeDescription(badgeType),
          },
        });
      }

      // 뱃지 부여 (중복 방지)
      await tx.seasonBadgeAward.upsert({
        where: {
          participantId_badgeId: {
            participantId,
            badgeId: badge.id,
          },
        },
        create: {
          participantId,
          badgeId: badge.id,
        },
        update: {},
      });
    }
  }

  private getBadgeName(badgeType: string): string {
    const names: Record<string, string> = {
      SEASON_GOLD: '시즌 챔피언',
      SEASON_SILVER: '시즌 준우승',
      SEASON_BRONZE: '시즌 3위',
      SEASON_TOP10: 'TOP 10',
      SEASON_TOP100: 'TOP 100',
      PARTICIPATION: '시즌 참여자',
      VOTE_MASTER: '투표 마스터',
      SHOP_VIP: '샵 VIP',
      STREAK: '연속 참여',
    };
    return names[badgeType] || badgeType;
  }

  private getBadgeDescription(badgeType: string): string {
    const descriptions: Record<string, string> = {
      SEASON_GOLD: '시즌 1위를 달성했습니다',
      SEASON_SILVER: '시즌 2위를 달성했습니다',
      SEASON_BRONZE: '시즌 3위를 달성했습니다',
      SEASON_TOP10: '시즌 TOP 10에 진입했습니다',
      SEASON_TOP100: '시즌 TOP 100에 진입했습니다',
      PARTICIPATION: '시즌에 참여했습니다',
      VOTE_MASTER: '투표에 10회 이상 참여했습니다',
      SHOP_VIP: '포인트샵에서 5회 이상 구매했습니다',
      STREAK: '7일 연속 참여했습니다',
    };
    return descriptions[badgeType] || '';
  }

  /**
   * 자동 시즌 시작/종료 (크론용)
   */
  async autoUpdateSeasonStatus() {
    const now = new Date();

    // UPCOMING -> ACTIVE
    const upcomingSeasons = await prisma.season.findMany({
      where: {
        status: 'UPCOMING',
        startsAt: { lte: now },
      },
    });

    for (const season of upcomingSeasons) {
      // 다른 활성 시즌이 없으면 활성화
      const existingActive = await prisma.season.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!existingActive) {
        await prisma.season.update({
          where: { id: season.id },
          data: { status: 'ACTIVE' },
        });
      }
    }

    // ACTIVE -> ENDED (endsAt 지남)
    const expiredSeasons = await prisma.season.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lt: now },
      },
    });

    for (const season of expiredSeasons) {
      await this.updateRankings(season.id);
      await prisma.season.update({
        where: { id: season.id },
        data: { status: 'ENDED' },
      });
    }

    return {
      activated: upcomingSeasons.length,
      ended: expiredSeasons.length,
    };
  }
}

export const seasonService = new SeasonService();

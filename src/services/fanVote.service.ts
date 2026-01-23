import { Prisma, FanVoteStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import prisma from '../models/prisma';
import { pointService } from './point.service';
import { feePolicyService } from './feePolicy.service';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

// 플랫폼 포인트 지갑용 시스템 사용자 ID
const PLATFORM_USER_ID = 'PLATFORM_SYSTEM';

export class FanVoteService {
  /**
   * 활성화된 팬 투표 목록 조회
   */
  async listActive() {
    const now = new Date();

    const events = await prisma.fanVoteEvent.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { endsAt: 'asc' },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    return events;
  }

  /**
   * 종료된 팬 투표 목록 조회
   */
  async listEnded(limit: number = 20) {
    const events = await prisma.fanVoteEvent.findMany({
      where: {
        OR: [
          { status: 'CLOSED' },
          { status: 'SETTLED' },
          {
            status: 'ACTIVE',
            endsAt: { lt: new Date() },
          },
        ],
      },
      orderBy: { endsAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    return events;
  }

  /**
   * 팬 투표 상세 조회
   */
  async getEvent(eventId: string, userId?: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    // 사용자가 참여했는지 확인
    let myEntry = null;
    if (userId) {
      myEntry = await prisma.fanVoteEntry.findFirst({
        where: {
          eventId,
          userId,
        },
      });
    }

    // 옵션별 투표 수 집계
    const entries = await prisma.fanVoteEntry.groupBy({
      by: ['optionIndex'],
      where: { eventId },
      _count: { optionIndex: true },
    });

    const voteCounts = entries.reduce((acc, entry) => {
      acc[entry.optionIndex] = entry._count.optionIndex;
      return acc;
    }, {} as Record<number, number>);

    return {
      event,
      myEntry,
      voteCounts,
    };
  }

  /**
   * 팬 투표 참여
   * 멱등성 보장: 동일 사용자가 동일 이벤트에 중복 참여 불가
   *
   * 수수료 구조 (v1.0):
   * - 참여자: entryFee 전액 차감
   * - Entry Deduction: entryFee × 10% (min 10P, max 500P)
   * - Platform Fee: Deduction × 70% → PLATFORM_SYSTEM에 적립
   * - Creator Reward: Deduction × 30% → 개설자에게 즉시 지급
   * - Net to Pool: entryFee - Deduction → 상금풀 적립
   */
  async enterVote(
    userId: string,
    eventId: string,
    optionIndex: number,
    idempotencyKey?: string
  ) {
    // 1. 이벤트 조회
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    // 2. 이벤트 상태 및 시간 체크
    if (event.status !== 'ACTIVE') {
      throw new BadRequestError('투표가 활성화되지 않았습니다');
    }

    const now = new Date();
    if (now < event.startsAt) {
      throw new BadRequestError('아직 투표가 시작되지 않았습니다');
    }

    if (now > event.endsAt) {
      throw new BadRequestError('투표가 종료되었습니다');
    }

    // 3. 옵션 인덱스 유효성 검사
    const options = event.options as string[];
    if (optionIndex < 0 || optionIndex >= options.length) {
      throw new BadRequestError('유효하지 않은 옵션입니다');
    }

    // 4. 이미 참여했는지 확인
    const existingEntry = await prisma.fanVoteEntry.findFirst({
      where: {
        eventId,
        userId,
      },
    });

    if (existingEntry) {
      return {
        success: true,
        alreadyProcessed: true,
        entry: existingEntry,
      };
    }

    // 5. 수수료 계산 (entryFee > 0인 경우)
    let feeBreakdown = {
      grossEntry: event.entryFeePoints,
      entryDeduction: new Prisma.Decimal(0),
      platformFee: new Prisma.Decimal(0),
      creatorReward: new Prisma.Decimal(0),
      netToPool: event.entryFeePoints,
    };

    if (event.entryFeePoints.greaterThan(0)) {
      const feeResult = await feePolicyService.calculateEntryDeduction(event.entryFeePoints);
      feeBreakdown = {
        grossEntry: event.entryFeePoints,
        entryDeduction: feeResult.deduction,
        platformFee: feeResult.platformFee,
        creatorReward: feeResult.creatorReward,
        netToPool: feeResult.netToPool,
      };
    }

    // 6. 트랜잭션으로 참여 + 포인트 처리
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 6-1. 참여 기록 생성 (수수료 breakdown 포함)
        const entry = await tx.fanVoteEntry.create({
          data: {
            eventId,
            userId,
            optionIndex,
            paidPoints: event.entryFeePoints,
            // 수수료 breakdown 필드
            grossEntry: feeBreakdown.grossEntry,
            entryDeduction: feeBreakdown.entryDeduction,
            platformFee: feeBreakdown.platformFee,
            creatorReward: feeBreakdown.creatorReward,
            netToPool: feeBreakdown.netToPool,
          },
        });

        // 6-2. 참여자 포인트 차감 (entryFee 전액)
        if (event.entryFeePoints.greaterThan(0)) {
          const pointResult = await pointService.adjustPoints(
            userId,
            event.entryFeePoints.negated(),
            'VOTE_ENTRY_FEE',
            'FAN_VOTE',
            entry.id,
            `팬 투표 참여: ${event.title} (${event.entryFeePoints}P)`
          );

          // 포인트 차감 실패 시 롤백
          if (!pointResult.success && !pointResult.alreadyProcessed) {
            throw new BadRequestError('포인트 차감에 실패했습니다');
          }

          // 6-3. 플랫폼에 수수료 지급 (platformFee > 0인 경우)
          if (feeBreakdown.platformFee.greaterThan(0)) {
            await pointService.adjustPoints(
              PLATFORM_USER_ID,
              feeBreakdown.platformFee,
              'VOTE_ENTRY_PLATFORM',
              'FAN_VOTE',
              entry.id,
              `팬 투표 참여 수수료 (플랫폼): ${event.title} (${feeBreakdown.platformFee}P)`
            );
          }

          // 6-4. 개설자에게 리워드 지급 (creatorReward > 0인 경우)
          if (feeBreakdown.creatorReward.greaterThan(0)) {
            await pointService.adjustPoints(
              event.creatorUserId,
              feeBreakdown.creatorReward,
              'VOTE_ENTRY_CREATOR',
              'FAN_VOTE',
              entry.id,
              `팬 투표 참여 리워드 (개설자): ${event.title} (${feeBreakdown.creatorReward}P)`
            );
          }
        }

        return { entry };
      });

      return {
        success: true,
        alreadyProcessed: false,
        entry: result.entry,
      };
    } catch (error: any) {
      // P2002: Unique constraint violation (멱등성)
      if (error.code === 'P2002' && error.meta?.target?.includes('unique_fan_vote_entry')) {
        const entry = await prisma.fanVoteEntry.findFirst({
          where: {
            eventId,
            userId,
          },
        });

        return {
          success: true,
          alreadyProcessed: true,
          entry,
        };
      }

      throw error;
    }
  }

  /**
   * 내 참여 내역 조회
   */
  async getMyEntries(userId: string, options: { page?: number; pageSize?: number } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [entries, total] = await Promise.all([
      prisma.fanVoteEntry.findMany({
        where: { userId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              question: true,
              options: true,
              status: true,
              startsAt: true,
              endsAt: true,
              resultOptionIndex: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fanVoteEntry.count({ where: { userId } }),
    ]);

    return {
      entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 관리자: 팬 투표 생성
   */
  async createEvent(data: {
    creatorUserId: string;
    title: string;
    question: string;
    options: string[];
    entryFeePoints: number;
    winnersCount: number;
    startsAt: Date;
    endsAt: Date;
    creatorPrizePool?: number;       // 생성자 상금 (정산 시 차감)
    distributionPercent?: number;    // 환원 비율 (1-100%)
  }) {
    if (data.options.length < 2) {
      throw new BadRequestError('최소 2개 이상의 옵션이 필요합니다');
    }

    if (data.startsAt >= data.endsAt) {
      throw new BadRequestError('종료 시간은 시작 시간보다 늦어야 합니다');
    }

    if (data.winnersCount < 1) {
      throw new BadRequestError('당첨자 수는 1명 이상이어야 합니다');
    }

    // 상금 및 환원 비율 유효성 검사
    const creatorPrizePool = data.creatorPrizePool || 0;
    const distributionPercent = data.distributionPercent ?? 100;

    if (creatorPrizePool < 0) {
      throw new BadRequestError('상금은 0 이상이어야 합니다');
    }

    if (distributionPercent < 1 || distributionPercent > 100) {
      throw new BadRequestError('환원 비율은 1% 이상 100% 이하여야 합니다');
    }

    const event = await prisma.fanVoteEvent.create({
      data: {
        creatorUserId: data.creatorUserId,
        creatorRole: 'ADMIN',
        title: data.title,
        question: data.question,
        options: data.options,
        entryFeePoints: data.entryFeePoints,
        winnersCount: data.winnersCount,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: 'DRAFT',
        creatorPrizePool: creatorPrizePool,
        distributionPercent: distributionPercent,
      },
    });

    return event;
  }

  /**
   * 관리자: 팬 투표 활성화
   *
   * 수수료 구조 (v1.0):
   * - 개설 수수료: Seed × 2% (min 1,000P, max 50,000P)
   * - 활성화 시점에 개설 수수료 차감
   */
  async activateEvent(eventId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.status !== 'DRAFT') {
      throw new ConflictError('초안 상태의 이벤트만 활성화할 수 있습니다');
    }

    // 개설 수수료 계산
    const seedPoints = event.creatorPrizePool || new Prisma.Decimal(0);
    let openFee = new Prisma.Decimal(0);

    if (seedPoints.greaterThan(0)) {
      const openFeeResult = await feePolicyService.calculateOpenFee(seedPoints);
      openFee = openFeeResult.fee;

      // 개설자 잔액 확인 (Seed + 개설 수수료)
      const wallet = await prisma.pointWallet.findUnique({
        where: { userId: event.creatorUserId },
      });

      const requiredBalance = seedPoints.plus(openFee);
      const currentBalance = wallet?.balance || new Prisma.Decimal(0);

      if (currentBalance.lessThan(requiredBalance)) {
        throw new BadRequestError(
          `개설자 포인트가 부족합니다. 필요: ${requiredBalance}P (Seed ${seedPoints}P + 수수료 ${openFee}P), 현재: ${currentBalance}P`
        );
      }
    }

    // 트랜잭션으로 수수료 차감 + 상태 업데이트
    const updatedEvent = await prisma.$transaction(async (tx) => {
      // 개설 수수료 차감 (seedPoints > 0인 경우만)
      if (seedPoints.greaterThan(0) && openFee.greaterThan(0)) {
        // 개설자에서 수수료 차감
        const deductResult = await pointService.adjustPoints(
          event.creatorUserId,
          openFee.negated(),
          'VOTE_OPEN_FEE',
          'FAN_VOTE',
          eventId,
          `팬 투표 개설 수수료: ${event.title} (${openFee}P)`
        );

        if (!deductResult.success && !deductResult.alreadyProcessed) {
          throw new BadRequestError('개설 수수료 차감에 실패했습니다');
        }

        // 플랫폼에 수수료 적립
        await pointService.adjustPoints(
          PLATFORM_USER_ID,
          openFee,
          'VOTE_OPEN_FEE',
          'FAN_VOTE',
          eventId,
          `팬 투표 개설 수수료 수입: ${event.title} (${openFee}P)`
        );
      }

      // 이벤트 상태 업데이트
      const updated = await tx.fanVoteEvent.update({
        where: { id: eventId },
        data: {
          status: 'ACTIVE',
          // 개설 수수료 기록
          openFeeCharged: openFee.greaterThan(0) ? openFee : null,
          openFeeChargedAt: openFee.greaterThan(0) ? new Date() : null,
        },
      });

      return updated;
    });

    return updatedEvent;
  }

  /**
   * 관리자: 팬 투표 종료
   */
  async closeEvent(eventId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.status !== 'ACTIVE') {
      throw new ConflictError('활성 상태의 이벤트만 종료할 수 있습니다');
    }

    const updatedEvent = await prisma.fanVoteEvent.update({
      where: { id: eventId },
      data: { status: 'CLOSED' },
    });

    return updatedEvent;
  }

  /**
   * 관리자: 정산 완료된 팬 투표 삭제
   */
  async deleteSettledEvent(eventId: string, adminId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
      include: {
        settlement: true,
      },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.status !== 'SETTLED') {
      throw new ConflictError('정산 완료된 투표만 삭제할 수 있습니다');
    }

    // 트랜잭션으로 관련 데이터 삭제
    await prisma.$transaction(async (tx) => {
      // 1. 당첨자 기록 삭제
      await tx.fanVoteWinner.deleteMany({
        where: { eventId },
      });

      // 2. 정산 기록 삭제
      await tx.fanVoteSettlement.deleteMany({
        where: { eventId },
      });

      // 3. 참여 기록 삭제
      await tx.fanVoteEntry.deleteMany({
        where: { eventId },
      });

      // 4. 스폰서 참여 기록 삭제
      await tx.sponsorEngagement.deleteMany({
        where: { eventId },
      });

      // 5. 이벤트 삭제
      await tx.fanVoteEvent.delete({
        where: { id: eventId },
      });
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'FAN_VOTE_DELETE',
        entityType: 'FAN_VOTE_EVENT',
        entityId: eventId,
        oldValue: {
          title: event.title,
          status: event.status,
        },
      },
    });

    return { success: true };
  }

  // ============================================
  // Phase F4: Fan-created Votes
  // ============================================

  /**
   * 팬이 투표 생성 (DRAFT 상태)
   */
  async createByFan(
    userId: string,
    data: {
      title: string;
      question: string;
      options: string[];
      entryFeePoints: number;
      winnersCount: number;
      startsAt: Date;
      endsAt: Date;
      creatorPrizePool?: number;       // 생성자 상금 (정산 시 차감)
      distributionPercent?: number;    // 환원 비율 (1-100%)
    }
  ) {
    // 유효성 검사
    if (data.options.length < 2 || data.options.length > 6) {
      throw new BadRequestError('옵션은 2개 이상 6개 이하로 입력해주세요');
    }

    if (data.entryFeePoints < 0) {
      throw new BadRequestError('참가비는 0 이상이어야 합니다');
    }

    if (data.winnersCount < 1) {
      throw new BadRequestError('당첨자 수는 1명 이상이어야 합니다');
    }

    if (data.startsAt >= data.endsAt) {
      throw new BadRequestError('종료 시간은 시작 시간보다 늦어야 합니다');
    }

    // 상금 및 환원 비율 유효성 검사
    const creatorPrizePool = data.creatorPrizePool || 0;
    const distributionPercent = data.distributionPercent ?? 100;

    if (creatorPrizePool < 0) {
      throw new BadRequestError('상금은 0 이상이어야 합니다');
    }

    if (distributionPercent < 1 || distributionPercent > 100) {
      throw new BadRequestError('환원 비율은 1% 이상 100% 이하여야 합니다');
    }

    // 시스템 설정에서 생성비 조회 (없으면 0)
    const createFeeSetting = await prisma.systemSetting.findUnique({
      where: { key: 'FAN_VOTE_CREATE_FEE' },
    });
    const createFeePoints = createFeeSetting ? parseInt(createFeeSetting.value) : 0;

    // 트랜잭션으로 생성 + 생성비 차감
    const event = await prisma.$transaction(async (tx) => {
      // 이벤트 생성
      const newEvent = await tx.fanVoteEvent.create({
        data: {
          creatorUserId: userId,
          creatorRole: 'FAN',
          title: data.title,
          question: data.question,
          options: data.options,
          entryFeePoints: data.entryFeePoints,
          createFeePoints: createFeePoints,
          winnersCount: data.winnersCount,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: 'DRAFT',
          creatorPrizePool: creatorPrizePool,
          distributionPercent: distributionPercent,
        },
      });

      // 생성비 차감 (0보다 클 때만)
      if (createFeePoints > 0) {
        const pointResult = await pointService.adjustPoints(
          userId,
          -createFeePoints,
          'VOTE_CREATE_FEE',
          'FAN_VOTE_CREATE',
          newEvent.id,
          `팬 투표 생성: ${data.title} (${createFeePoints}P)`
        );

        if (!pointResult.success && !pointResult.alreadyProcessed) {
          throw new BadRequestError('포인트가 부족합니다');
        }
      }

      return newEvent;
    });

    return event;
  }

  /**
   * 팬이 투표 제출 (DRAFT -> SUBMITTED)
   */
  async submitFanVote(userId: string, eventId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.creatorUserId !== userId) {
      throw new BadRequestError('자신이 만든 투표만 제출할 수 있습니다');
    }

    if (event.status !== 'DRAFT') {
      throw new ConflictError('초안 상태의 투표만 제출할 수 있습니다');
    }

    const updatedEvent = await prisma.fanVoteEvent.update({
      where: { id: eventId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // 관리자에게 알림 전송
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'FAN_VOTE_SUBMITTED',
          title: '팬 투표 승인 요청',
          message: `"${event.title}" 투표가 승인 대기 중입니다`,
          data: { eventId: event.id },
        })),
      });
    }

    return updatedEvent;
  }

  /**
   * 내가 만든 투표 목록 조회
   */
  async getMyCreatedEvents(
    userId: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [events, total] = await Promise.all([
      prisma.fanVoteEvent.findMany({
        where: { creatorUserId: userId },
        include: {
          _count: {
            select: { entries: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fanVoteEvent.count({ where: { creatorUserId: userId } }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 투표 결과 조회
   */
  async getEventResult(eventId: string, userId?: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
      include: {
        settlement: true,
        winners: {
          include: {
            user: {
              select: {
                id: true,
                fan: {
                  select: {
                    nickname: true,  // Fan 닉네임만 선택
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    // 정산 전이면 대기 상태 반환
    if (event.status === 'CLOSED' && !event.settlement) {
      // event에서 winners 제거 후 반환
      const { winners, ...eventWithoutWinners } = event;
      return {
        event: eventWithoutWinners,
        status: 'PENDING_SETTLEMENT',
        message: '정산 대기 중입니다',
      };
    }

    // 정산 완료
    if (event.status === 'SETTLED' && event.settlement) {
      let myWin = null;
      if (userId) {
        const winner = event.winners.find((w) => w.userId === userId);
        if (winner) {
          myWin = {
            isWinner: true,
            payoutPoints: winner.payoutPoints,
          };
        } else {
          // 참여했지만 당첨되지 않음
          const myEntry = await prisma.fanVoteEntry.findFirst({
            where: { eventId, userId },
          });
          if (myEntry) {
            myWin = {
              isWinner: false,
              payoutPoints: 0,
            };
          }
        }
      }

      // 당첨자 목록에서 개인정보 제거 (닉네임만 노출)
      const winnersPublic = event.winners.map((w) => ({
        nickname: w.user?.fan?.nickname || '익명',
        payoutPoints: w.payoutPoints,
      }));

      // event에서 winners 제거
      const { winners, ...eventWithoutWinners } = event;

      return {
        event: eventWithoutWinners,
        status: 'SETTLED',
        settlement: {
          potTotal: event.settlement.potTotal,
          winnersCount: event.settlement.winnersCount,
          payoutEach: event.settlement.payoutEach,
          remainder: event.settlement.remainder,
        },
        resultOptionIndex: event.resultOptionIndex,
        winners: winnersPublic,  // 닉네임만 포함된 당첨자 목록
        myWin,
      };
    }

    // 아직 종료되지 않음 (winners 제거)
    const { winners, ...eventWithoutWinners } = event;
    return {
      event: eventWithoutWinners,
      status: event.status,
    };
  }

  // ============================================
  // Admin: Phase F4
  // ============================================

  /**
   * 승인 대기 중인 투표 목록 (SUBMITTED)
   */
  async listPendingApproval(options: { page?: number; pageSize?: number } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [events, total] = await Promise.all([
      prisma.fanVoteEvent.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          _count: {
            select: { entries: true },
          },
        },
        orderBy: { submittedAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.fanVoteEvent.count({ where: { status: 'SUBMITTED' } }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 관리자: 승인 및 활성화 (SUBMITTED/DRAFT -> ACTIVE)
   *
   * 수수료 구조 (v1.0):
   * - 개설 수수료: Seed × 2% (min 1,000P, max 50,000P)
   * - 개설자는 Seed + 개설 수수료 이상의 잔액이 필요
   * - 승인 시점에 개설 수수료만 차감 (Seed는 정산 시 차감)
   */
  async adminApproveAndActivate(eventId: string, adminId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.status !== 'SUBMITTED' && event.status !== 'DRAFT') {
      throw new ConflictError('제출됨 또는 초안 상태의 투표만 승인할 수 있습니다');
    }

    // 개설 수수료 계산
    const seedPoints = event.creatorPrizePool || new Prisma.Decimal(0);
    let openFee = new Prisma.Decimal(0);

    if (seedPoints.greaterThan(0)) {
      const openFeeResult = await feePolicyService.calculateOpenFee(seedPoints);
      openFee = openFeeResult.fee;

      // 개설자 잔액 확인 (Seed + 개설 수수료)
      const wallet = await prisma.pointWallet.findUnique({
        where: { userId: event.creatorUserId },
      });

      const requiredBalance = seedPoints.plus(openFee);
      const currentBalance = wallet?.balance || new Prisma.Decimal(0);

      if (currentBalance.lessThan(requiredBalance)) {
        throw new BadRequestError(
          `개설자 포인트가 부족합니다. 필요: ${requiredBalance}P (Seed ${seedPoints}P + 수수료 ${openFee}P), 현재: ${currentBalance}P`
        );
      }
    }

    // 트랜잭션으로 수수료 차감 + 상태 업데이트
    const updatedEvent = await prisma.$transaction(async (tx) => {
      // 개설 수수료 차감 (seedPoints > 0인 경우만)
      if (seedPoints.greaterThan(0) && openFee.greaterThan(0)) {
        // 개설자에서 수수료 차감 (adjustPointsWithTx 사용 - 같은 트랜잭션 내)
        await pointService.adjustPointsWithTx(
          tx,
          event.creatorUserId,
          openFee.negated(),
          'VOTE_OPEN_FEE',
          'FAN_VOTE',
          `${eventId}_creator`,
          `팬 투표 개설 수수료: ${event.title} (${openFee}P)`
        );

        // 플랫폼에 수수료 적립 (adjustPointsWithTx 사용 - 같은 트랜잭션 내)
        await pointService.adjustPointsWithTx(
          tx,
          PLATFORM_USER_ID,
          openFee,
          'VOTE_OPEN_FEE',
          'FAN_VOTE',
          `${eventId}_platform`,
          `팬 투표 개설 수수료 수입: ${event.title} (${openFee}P)`
        );
      }

      // 이벤트 상태 업데이트
      const updated = await tx.fanVoteEvent.update({
        where: { id: eventId },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          // 개설 수수료 기록
          openFeeCharged: openFee.greaterThan(0) ? openFee : null,
          openFeeChargedAt: openFee.greaterThan(0) ? new Date() : null,
        },
      });

      return updated;
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'FAN_VOTE_APPROVE',
        entityType: 'FAN_VOTE_EVENT',
        entityId: eventId,
        newValue: {
          status: 'ACTIVE',
          openFeeCharged: openFee.toString(),
          seedPoints: seedPoints.toString(),
        },
      },
    });

    // 생성자에게 알림
    const feeMessage = openFee.greaterThan(0)
      ? ` 개설 수수료 ${openFee}P가 차감되었습니다.`
      : '';
    await prisma.notification.create({
      data: {
        userId: event.creatorUserId,
        type: 'FAN_VOTE_APPROVED',
        title: '투표 승인 완료',
        message: `"${event.title}" 투표가 승인되어 활성화되었습니다.${feeMessage}`,
        data: { eventId: event.id, openFeeCharged: openFee.toString() },
      },
    });

    return updatedEvent;
  }

  /**
   * 관리자: 정산 실행
   * 멱등성: FanVoteSettlement.eventId unique constraint
   *
   * 수수료 구조 (v1.0):
   * - 총 상금풀 = Seed + sum(netToPool)
   * - 정산 수수료: 상금풀 × 2% (max 100,000P)
   * - 당첨자 지급: (상금풀 - 정산수수료) / 당첨자수
   * - 잔여금: 나머지 → 플랫폼 귀속
   */
  async adminSettle(
    eventId: string,
    adminId: string,
    resultOptionIndex: number
  ) {
    // 1. 이벤트 조회
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
      include: {
        settlement: true,
      },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    // 이미 정산됨 (멱등성)
    if (event.settlement) {
      return {
        success: true,
        alreadyProcessed: true,
        settlement: event.settlement,
      };
    }

    if (event.status !== 'CLOSED') {
      throw new ConflictError('종료된 투표만 정산할 수 있습니다');
    }

    // 옵션 인덱스 유효성
    const options = event.options as string[];
    if (resultOptionIndex < 0 || resultOptionIndex >= options.length) {
      throw new BadRequestError('유효하지 않은 결과 옵션입니다');
    }

    // 2. 참여 정보 집계 (v1.0 수수료 체계)
    const entryAggregation = await prisma.fanVoteEntry.aggregate({
      where: { eventId },
      _sum: {
        grossEntry: true,       // 참여비 총액
        entryDeduction: true,   // 참여 수수료 총액
        platformFee: true,      // 플랫폼 수수료 총액
        creatorReward: true,    // 개설자 리워드 총액
        netToPool: true,        // 상금풀 기여 총액
        paidPoints: true,       // 구 필드 (하위 호환)
      },
    });

    // 하위 호환: 새 필드가 없으면 구 방식으로 계산
    const totalEntryFees = entryAggregation._sum.grossEntry
      || entryAggregation._sum.paidPoints
      || new Prisma.Decimal(0);

    const totalEntryDeductions = entryAggregation._sum.entryDeduction
      || new Prisma.Decimal(0);

    const totalPlatformFeesFromEntry = entryAggregation._sum.platformFee
      || new Prisma.Decimal(0);

    const totalCreatorRewardsFromEntry = entryAggregation._sum.creatorReward
      || new Prisma.Decimal(0);

    // 상금풀 기여 (netToPool 또는 fallback으로 paidPoints 사용)
    const netPoolFromEntries = entryAggregation._sum.netToPool
      || entryAggregation._sum.paidPoints
      || new Prisma.Decimal(0);

    // Seed (생성자 상금)
    const seedPoints = event.creatorPrizePool || new Prisma.Decimal(0);

    // 총 상금풀 = Seed + 참여자 기여
    const grossPool = seedPoints.plus(netPoolFromEntries);

    // 3. 정산 수수료 계산 (2% of grossPool, max 100,000P)
    const settleFeeResult = await feePolicyService.calculateSettlementFee(grossPool);
    const settlementFee = settleFeeResult.fee;

    // 당첨자 지급 가능 총액
    const netPayoutPool = grossPool.minus(settlementFee);

    // 4. 정답 엔트리 조회
    const correctEntries = await prisma.fanVoteEntry.findMany({
      where: {
        eventId,
        optionIndex: resultOptionIndex,
      },
    });

    // 5. 당첨자 선정 (랜덤)
    const winnersCountTarget = event.winnersCount;
    const winnersCountActual = Math.min(winnersCountTarget, correctEntries.length);

    let selectedWinners: typeof correctEntries = [];
    if (winnersCountActual > 0) {
      // Fisher-Yates 셔플 (crypto.randomInt 사용)
      const shuffled = [...correctEntries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      selectedWinners = shuffled.slice(0, winnersCountActual);
    }

    // 6. 지급액 계산
    let payoutEach = new Prisma.Decimal(0);
    let winnerPayout = new Prisma.Decimal(0);
    let remainder = new Prisma.Decimal(0);

    if (winnersCountActual > 0) {
      payoutEach = netPayoutPool.dividedToIntegerBy(winnersCountActual);
      winnerPayout = payoutEach.times(winnersCountActual);
      remainder = netPayoutPool.minus(winnerPayout);
    } else {
      // 당첨자 0명: 전액 플랫폼에 귀속
      remainder = netPayoutPool;
    }

    // 플랫폼 총 수익 계산 (정산 시점 기준)
    // = 정산 수수료 + 잔여금
    // (참여 수수료는 이미 enterVote에서 처리됨)
    const settlementPlatformRevenue = settlementFee.plus(remainder);

    // 전체 플랫폼 수익 (기록용)
    // = 개설 수수료(이미 처리) + 참여 수수료(이미 처리) + 정산 수수료 + 잔여금
    const openFeeCharged = event.openFeeCharged || new Prisma.Decimal(0);
    const totalPlatformRevenue = openFeeCharged
      .plus(totalPlatformFeesFromEntry)
      .plus(settlementFee)
      .plus(remainder);

    // 7. 트랜잭션으로 정산 처리
    try {
      const settlement = await prisma.$transaction(async (tx) => {
        // 7-1. 정산 기록 생성 (v1.0 상세 필드 포함)
        const newSettlement = await tx.fanVoteSettlement.create({
          data: {
            eventId,
            potTotal: grossPool,            // 구 필드 호환
            winnersCount: winnersCountActual,
            payoutEach,
            remainder,
            decidedByAdminId: adminId,
            // v1.0 상세 필드
            totalEntryFees,
            totalEntryDeductions,
            seedPoints,
            netPoolFromEntries,
            grossPool,
            settlementFee,
            winnerPayout,
            totalPlatformRevenue,
            totalCreatorReward: totalCreatorRewardsFromEntry,
          },
        });

        // 7-2. 당첨자 기록 및 포인트 지급
        for (const winner of selectedWinners) {
          await tx.fanVoteWinner.create({
            data: {
              eventId,
              userId: winner.userId,
              payoutPoints: payoutEach,
            },
          });

          // 포인트 지급
          if (payoutEach.greaterThan(0)) {
            await pointService.adjustPoints(
              winner.userId,
              payoutEach,
              'VOTE_WIN_PAYOUT',
              'FAN_VOTE',
              eventId,
              `팬 투표 당첨: ${event.title} (${payoutEach}P)`
            );
          }
        }

        // 7-3. 생성자 Seed 차감 (정산 시점에 차감)
        if (seedPoints.greaterThan(0)) {
          const deductResult = await pointService.adjustPoints(
            event.creatorUserId,
            seedPoints.negated(),
            'VOTE_CREATOR_PRIZE',
            'FAN_VOTE',
            eventId,
            `투표 상금 기여 (Seed): ${event.title} (${seedPoints}P)`
          );

          if (!deductResult.success && !deductResult.alreadyProcessed) {
            throw new BadRequestError('생성자 포인트가 부족하여 정산할 수 없습니다');
          }
        }

        // 7-4. 정산 수수료 플랫폼 귀속
        if (settlementFee.greaterThan(0)) {
          await pointService.adjustPoints(
            PLATFORM_USER_ID,
            settlementFee,
            'VOTE_SETTLEMENT_FEE',
            'FAN_VOTE',
            eventId,
            `팬 투표 정산 수수료: ${event.title} (${settlementFee}P)`
          );
        }

        // 7-5. 잔여금 플랫폼 귀속
        if (remainder.greaterThan(0)) {
          await pointService.adjustPoints(
            PLATFORM_USER_ID,
            remainder,
            'VOTE_POT_REMAINDER',
            'FAN_VOTE',
            eventId,
            `팬 투표 잔여금: ${event.title} (${remainder}P)`
          );
        }

        // 7-6. 이벤트 상태 업데이트
        await tx.fanVoteEvent.update({
          where: { id: eventId },
          data: {
            status: 'SETTLED',
            resultOptionIndex,
            settledAt: new Date(),
          },
        });

        return newSettlement;
      });

      // 8. 감사 로그
      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'FAN_VOTE_SETTLE',
          entityType: 'FAN_VOTE_EVENT',
          entityId: eventId,
          newValue: {
            resultOptionIndex,
            // 입력값
            totalEntryFees: totalEntryFees.toString(),
            seedPoints: seedPoints.toString(),
            // 수수료
            totalEntryDeductions: totalEntryDeductions.toString(),
            settlementFee: settlementFee.toString(),
            // 상금풀
            netPoolFromEntries: netPoolFromEntries.toString(),
            grossPool: grossPool.toString(),
            // 지급
            winnersCount: winnersCountActual,
            payoutEach: payoutEach.toString(),
            winnerPayout: winnerPayout.toString(),
            remainder: remainder.toString(),
            // 수익
            totalPlatformRevenue: totalPlatformRevenue.toString(),
            totalCreatorReward: totalCreatorRewardsFromEntry.toString(),
          },
        },
      });

      // 9. 알림: 생성자
      const creatorMessage = seedPoints.greaterThan(0)
        ? `"${event.title}" 투표 정산 완료. 당첨자 ${winnersCountActual}명, Seed ${seedPoints}P 차감됨, 리워드 ${totalCreatorRewardsFromEntry}P 지급됨`
        : `"${event.title}" 투표 정산이 완료되었습니다. 당첨자 ${winnersCountActual}명, 리워드 ${totalCreatorRewardsFromEntry}P 지급됨`;

      await prisma.notification.create({
        data: {
          userId: event.creatorUserId,
          type: 'FAN_VOTE_SETTLED',
          title: '투표 정산 완료',
          message: creatorMessage,
          data: {
            eventId,
            seedDeducted: seedPoints.toString(),
            creatorReward: totalCreatorRewardsFromEntry.toString(),
          },
        },
      });

      // 10. 알림: 당첨자들
      if (selectedWinners.length > 0) {
        await prisma.notification.createMany({
          data: selectedWinners.map((winner) => ({
            userId: winner.userId,
            type: 'FAN_VOTE_WIN',
            title: '🎉 투표 당첨!',
            message: `"${event.title}" 투표에 당첨되어 ${payoutEach}P를 받았습니다`,
            data: { eventId, payoutPoints: payoutEach.toString() },
          })),
        });
      }

      return {
        success: true,
        alreadyProcessed: false,
        settlement,
      };
    } catch (error: any) {
      // P2002: Unique constraint violation (이미 정산됨)
      if (error.code === 'P2002') {
        const existingSettlement = await prisma.fanVoteSettlement.findUnique({
          where: { eventId },
        });

        return {
          success: true,
          alreadyProcessed: true,
          settlement: existingSettlement,
        };
      }

      throw error;
    }
  }

  /**
   * 자동 종료: 종료 시간이 지난 ACTIVE 투표 CLOSED로 전환
   */
  async autoCloseExpiredEvents() {
    const now = new Date();

    const expiredEvents = await prisma.fanVoteEvent.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lt: now },
      },
    });

    const closedIds: string[] = [];

    for (const event of expiredEvents) {
      await prisma.fanVoteEvent.update({
        where: { id: event.id },
        data: { status: 'CLOSED' },
      });
      closedIds.push(event.id);
    }

    return { closedCount: closedIds.length, closedIds };
  }

  // ============================================
  // Phase G: 투표 스폰서십
  // ============================================

  // ============================================
  // Brand Vote Creation
  // ============================================

  /**
   * 브랜드가 투표 생성 (DRAFT 상태)
   */
  async createByBrand(
    userId: string,
    brandId: string,
    data: {
      title: string;
      question: string;
      options: string[];
      entryFeePoints: number;
      winnersCount: number;
      startsAt: Date;
      endsAt: Date;
      creatorPrizePool?: number;       // 생성자 상금 (정산 시 차감)
      distributionPercent?: number;    // 환원 비율 (1-100%)
      sponsorContribution?: number;
      sponsorBannerUrl?: string;
      sponsorLogoUrl?: string;
      sponsorMessage?: string;
      sponsorLinkUrl?: string;
    }
  ) {
    // 유효성 검사
    if (data.options.length < 2 || data.options.length > 6) {
      throw new BadRequestError('옵션은 2개 이상 6개 이하로 입력해주세요');
    }

    if (data.entryFeePoints < 0) {
      throw new BadRequestError('참가비는 0 이상이어야 합니다');
    }

    if (data.winnersCount < 1) {
      throw new BadRequestError('당첨자 수는 1명 이상이어야 합니다');
    }

    if (data.startsAt >= data.endsAt) {
      throw new BadRequestError('종료 시간은 시작 시간보다 늦어야 합니다');
    }

    // 상금 및 환원 비율 유효성 검사
    const creatorPrizePool = data.creatorPrizePool || 0;
    const distributionPercent = data.distributionPercent ?? 100;

    if (creatorPrizePool < 0) {
      throw new BadRequestError('상금은 0 이상이어야 합니다');
    }

    if (distributionPercent < 1 || distributionPercent > 100) {
      throw new BadRequestError('환원 비율은 1% 이상 100% 이하여야 합니다');
    }

    // 시스템 설정에서 브랜드 생성비 조회 (없으면 0)
    const createFeeSetting = await prisma.systemSetting.findUnique({
      where: { key: 'BRAND_VOTE_CREATE_FEE' },
    });
    const createFeePoints = createFeeSetting ? parseInt(createFeeSetting.value) : 0;

    // 총 차감액 = 생성비 + 스폰서 기여금 (생성자 상금은 정산 시 차감)
    const sponsorContribution = data.sponsorContribution || 0;
    const totalDeduction = createFeePoints + sponsorContribution;

    // 트랜잭션으로 생성 + 포인트 차감
    const event = await prisma.$transaction(async (tx) => {
      // 이벤트 생성
      const newEvent = await tx.fanVoteEvent.create({
        data: {
          creatorUserId: userId,
          creatorRole: 'BRAND',
          title: data.title,
          question: data.question,
          options: data.options,
          entryFeePoints: data.entryFeePoints,
          createFeePoints: createFeePoints,
          winnersCount: data.winnersCount,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: 'DRAFT',
          creatorPrizePool: creatorPrizePool,
          distributionPercent: distributionPercent,
          // 브랜드 스폰서 정보
          sponsorBrandId: brandId,
          sponsorContribution: sponsorContribution,
          sponsorBannerUrl: data.sponsorBannerUrl,
          sponsorLogoUrl: data.sponsorLogoUrl,
          sponsorMessage: data.sponsorMessage,
          sponsorLinkUrl: data.sponsorLinkUrl,
        },
      });

      // 포인트 차감 (생성비 + 스폰서 기여금)
      if (totalDeduction > 0) {
        const pointResult = await pointService.adjustPoints(
          userId,
          -totalDeduction,
          'VOTE_CREATE_FEE',
          'BRAND_VOTE_CREATE',
          newEvent.id,
          `브랜드 투표 생성: ${data.title} (생성비 ${createFeePoints}P + 기여금 ${sponsorContribution}P)`
        );

        if (!pointResult.success && !pointResult.alreadyProcessed) {
          throw new BadRequestError('포인트가 부족합니다');
        }
      }

      // SponsorEngagement 생성 (스폰서 기여금이 있는 경우)
      if (sponsorContribution > 0) {
        await tx.sponsorEngagement.create({
          data: {
            eventId: newEvent.id,
            bannerImpressions: 0,
            bannerClicks: 0,
            linkClicks: 0,
          },
        });
      }

      return newEvent;
    });

    return event;
  }

  // ============================================
  // Athlete Vote Creation
  // ============================================

  /**
   * 선수가 투표 생성 (DRAFT 상태)
   */
  async createByAthlete(
    userId: string,
    athleteId: string,
    data: {
      title: string;
      question: string;
      options: string[];
      entryFeePoints: number;
      winnersCount: number;
      startsAt: Date;
      endsAt: Date;
      creatorPrizePool?: number;       // 생성자 상금 (정산 시 차감)
      distributionPercent?: number;    // 환원 비율 (1-100%)
    }
  ) {
    // 유효성 검사
    if (data.options.length < 2 || data.options.length > 6) {
      throw new BadRequestError('옵션은 2개 이상 6개 이하로 입력해주세요');
    }

    if (data.entryFeePoints < 0) {
      throw new BadRequestError('참가비는 0 이상이어야 합니다');
    }

    if (data.winnersCount < 1) {
      throw new BadRequestError('당첨자 수는 1명 이상이어야 합니다');
    }

    if (data.startsAt >= data.endsAt) {
      throw new BadRequestError('종료 시간은 시작 시간보다 늦어야 합니다');
    }

    // 상금 및 환원 비율 유효성 검사
    const creatorPrizePool = data.creatorPrizePool || 0;
    const distributionPercent = data.distributionPercent ?? 100;

    if (creatorPrizePool < 0) {
      throw new BadRequestError('상금은 0 이상이어야 합니다');
    }

    if (distributionPercent < 1 || distributionPercent > 100) {
      throw new BadRequestError('환원 비율은 1% 이상 100% 이하여야 합니다');
    }

    // 시스템 설정에서 선수 생성비 조회 (없으면 0)
    const createFeeSetting = await prisma.systemSetting.findUnique({
      where: { key: 'ATHLETE_VOTE_CREATE_FEE' },
    });
    const createFeePoints = createFeeSetting ? parseInt(createFeeSetting.value) : 0;

    // 트랜잭션으로 생성 + 생성비 차감
    const event = await prisma.$transaction(async (tx) => {
      // 이벤트 생성
      const newEvent = await tx.fanVoteEvent.create({
        data: {
          creatorUserId: userId,
          creatorRole: 'ATHLETE',
          title: data.title,
          question: data.question,
          options: data.options,
          entryFeePoints: data.entryFeePoints,
          createFeePoints: createFeePoints,
          winnersCount: data.winnersCount,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: 'DRAFT',
          creatorPrizePool: creatorPrizePool,
          distributionPercent: distributionPercent,
        },
      });

      // 생성비 차감 (0보다 클 때만)
      if (createFeePoints > 0) {
        const pointResult = await pointService.adjustPoints(
          userId,
          -createFeePoints,
          'VOTE_CREATE_FEE',
          'ATHLETE_VOTE_CREATE',
          newEvent.id,
          `선수 투표 생성: ${data.title} (${createFeePoints}P)`
        );

        if (!pointResult.success && !pointResult.alreadyProcessed) {
          throw new BadRequestError('포인트가 부족합니다');
        }
      }

      return newEvent;
    });

    return event;
  }

  /**
   * 선수가 투표 제출 (DRAFT -> SUBMITTED)
   */
  async submitAthleteVote(userId: string, athleteId: string, eventId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.creatorUserId !== userId) {
      throw new BadRequestError('자신이 만든 투표만 제출할 수 있습니다');
    }

    if (event.status !== 'DRAFT') {
      throw new ConflictError('초안 상태의 투표만 제출할 수 있습니다');
    }

    const updatedEvent = await prisma.fanVoteEvent.update({
      where: { id: eventId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // 관리자에게 알림 전송
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'FAN_VOTE_SUBMITTED',
          title: '선수 투표 승인 요청',
          message: `"${event.title}" 선수 투표가 승인 대기 중입니다`,
          data: { eventId: event.id },
        })),
      });
    }

    return updatedEvent;
  }

  /**
   * 선수가 만든 투표 목록 조회
   */
  async getAthleteCreatedEvents(
    userId: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [events, total] = await Promise.all([
      prisma.fanVoteEvent.findMany({
        where: { creatorUserId: userId },
        include: {
          _count: {
            select: { entries: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fanVoteEvent.count({ where: { creatorUserId: userId } }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 브랜드가 투표 제출 (DRAFT -> SUBMITTED)
   */
  async submitBrandVote(userId: string, brandId: string, eventId: string) {
    const event = await prisma.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    if (event.creatorUserId !== userId) {
      throw new BadRequestError('자신이 만든 투표만 제출할 수 있습니다');
    }

    if (event.status !== 'DRAFT') {
      throw new ConflictError('초안 상태의 투표만 제출할 수 있습니다');
    }

    const updatedEvent = await prisma.fanVoteEvent.update({
      where: { id: eventId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // 관리자에게 알림 전송
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'FAN_VOTE_SUBMITTED',
          title: '브랜드 투표 승인 요청',
          message: `"${event.title}" 브랜드 투표가 승인 대기 중입니다`,
          data: { eventId: event.id },
        })),
      });
    }

    return updatedEvent;
  }

  /**
   * 브랜드가 만든 투표 목록 조회
   */
  async getBrandCreatedEvents(
    userId: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [events, total] = await Promise.all([
      prisma.fanVoteEvent.findMany({
        where: { creatorUserId: userId },
        include: {
          _count: {
            select: { entries: true },
          },
          sponsorEngagement: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fanVoteEvent.count({ where: { creatorUserId: userId } }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 브랜드가 투표 후원
   */
  async sponsorVote(
    brandId: string,
    eventId: string,
    data: {
      contributionAmount: number;
      bannerUrl?: string;
      logoUrl?: string;
      message?: string;
      linkUrl?: string;
    }
  ) {
    // prisma generate 전까지 타입 우회
    const db = prisma as any;

    const event = await db.fanVoteEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('투표 이벤트를 찾을 수 없습니다');
    }

    // 이미 종료된 투표는 후원 불가
    if (['CLOSED', 'SETTLED'].includes(event.status)) {
      throw new BadRequestError('종료된 투표는 후원할 수 없습니다');
    }

    // 이미 다른 브랜드가 후원 중인 경우
    if (event.sponsorBrandId && event.sponsorBrandId !== brandId) {
      throw new ConflictError('이미 다른 브랜드가 후원 중인 투표입니다');
    }

    // 브랜드 포인트 잔액 확인
    const brand = await db.brand.findUnique({
      where: { id: brandId },
      include: {
        user: {
          include: {
            pointWallet: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError('브랜드를 찾을 수 없습니다');
    }

    const currentBalance = brand.user?.pointWallet?.balance || new Prisma.Decimal(0);
    if (currentBalance.lessThan(data.contributionAmount)) {
      throw new BadRequestError('포인트가 부족합니다');
    }

    // 트랜잭션으로 후원 처리
    const result = await db.$transaction(async (tx: any) => {
      // 이벤트 업데이트
      const updatedEvent = await tx.fanVoteEvent.update({
        where: { id: eventId },
        data: {
          sponsorBrandId: brandId,
          sponsorContribution: data.contributionAmount,
          sponsorBannerUrl: data.bannerUrl,
          sponsorLogoUrl: data.logoUrl,
          sponsorMessage: data.message,
          sponsorLinkUrl: data.linkUrl,
        },
      });

      // 포인트 차감
      await pointService.adjustPoints(
        brand.userId,
        -data.contributionAmount,
        'VOTE_ENTRY_FEE' as any, // 기존 reason 활용
        'FAN_VOTE_SPONSOR',
        eventId,
        `투표 후원: ${event.title} (${data.contributionAmount}P)`
      );

      // SponsorEngagement 생성
      await tx.sponsorEngagement.upsert({
        where: { eventId },
        create: {
          eventId,
          bannerImpressions: 0,
          bannerClicks: 0,
          linkClicks: 0,
        },
        update: {},
      });

      return updatedEvent;
    });

    return result;
  }

  /**
   * 브랜드가 후원한 투표 목록
   */
  async getSponsoredVotes(brandId: string, options: { page?: number; pageSize?: number } = {}) {
    const db = prisma as any;
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [events, total] = await Promise.all([
      db.fanVoteEvent.findMany({
        where: { sponsorBrandId: brandId },
        include: {
          _count: {
            select: { entries: true },
          },
          sponsorEngagement: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.fanVoteEvent.count({ where: { sponsorBrandId: brandId } }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 스폰서 노출/클릭 추적
   */
  async trackEngagement(
    eventId: string,
    type: 'banner_impression' | 'banner_click' | 'link_click'
  ) {
    const db = prisma as any;

    const event = await db.fanVoteEvent.findUnique({
      where: { id: eventId },
      select: { sponsorBrandId: true },
    });

    if (!event?.sponsorBrandId) {
      // 스폰서가 없으면 무시
      return { success: false, reason: 'no_sponsor' };
    }

    const updateData: any = {};
    if (type === 'banner_impression') {
      updateData.bannerImpressions = { increment: 1 };
    } else if (type === 'banner_click') {
      updateData.bannerClicks = { increment: 1 };
    } else if (type === 'link_click') {
      updateData.linkClicks = { increment: 1 };
    }

    await db.sponsorEngagement.upsert({
      where: { eventId },
      create: {
        eventId,
        bannerImpressions: type === 'banner_impression' ? 1 : 0,
        bannerClicks: type === 'banner_click' ? 1 : 0,
        linkClicks: type === 'link_click' ? 1 : 0,
      },
      update: updateData,
    });

    return { success: true };
  }

  /**
   * 스폰서 노출 통계 조회 (브랜드용)
   */
  async getSponsorEngagementStats(brandId: string) {
    const db = prisma as any;

    const events = await db.fanVoteEvent.findMany({
      where: { sponsorBrandId: brandId },
      include: {
        sponsorEngagement: true,
        _count: {
          select: { entries: true },
        },
      },
    });

    const totals = events.reduce(
      (acc: any, event: any) => {
        const eng = event.sponsorEngagement;
        if (eng) {
          acc.totalBannerImpressions += eng.bannerImpressions;
          acc.totalBannerClicks += eng.bannerClicks;
          acc.totalLinkClicks += eng.linkClicks;
        }
        acc.totalContribution = acc.totalContribution.plus(
          event.sponsorContribution || new Prisma.Decimal(0)
        );
        acc.totalParticipants += event._count.entries;
        return acc;
      },
      {
        totalBannerImpressions: 0,
        totalBannerClicks: 0,
        totalLinkClicks: 0,
        totalContribution: new Prisma.Decimal(0),
        totalParticipants: 0,
      }
    );

    return {
      sponsoredEventsCount: events.length,
      ...totals,
      ctr: totals.totalBannerImpressions > 0
        ? (totals.totalBannerClicks / totals.totalBannerImpressions * 100).toFixed(2)
        : '0.00',
    };
  }
}

export const fanVoteService = new FanVoteService();

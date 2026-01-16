import { Prisma, FanVoteStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { pointService } from './point.service';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

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

    // 5. 트랜잭션으로 참여 + 포인트 차감
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 5-1. 참여 기록 생성
        const entry = await tx.fanVoteEntry.create({
          data: {
            eventId,
            userId,
            optionIndex,
            paidPoints: event.entryFeePoints,
          },
        });

        // 5-2. 포인트 차감 (entryFeePoints > 0인 경우만)
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

    const event = await prisma.fanVoteEvent.create({
      data: {
        creatorUserId: data.creatorUserId,
        title: data.title,
        question: data.question,
        options: data.options,
        entryFeePoints: data.entryFeePoints,
        winnersCount: data.winnersCount,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: 'DRAFT',
      },
    });

    return event;
  }

  /**
   * 관리자: 팬 투표 활성화
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

    const updatedEvent = await prisma.fanVoteEvent.update({
      where: { id: eventId },
      data: { status: 'ACTIVE' },
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
}

export const fanVoteService = new FanVoteService();

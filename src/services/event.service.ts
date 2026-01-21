import prisma from '../models/prisma';
import { NotFoundError } from '../utils/errors';
import { EventStatus } from '@prisma/client';

// 날짜 기반으로 이벤트 상태 계산
function computeEventStatus(event: { dateStart: Date; dateEnd: Date; status: EventStatus }): EventStatus {
  // CANCELLED는 수동 설정이므로 유지
  if (event.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  const now = new Date();
  const start = new Date(event.dateStart);
  const end = new Date(event.dateEnd);

  if (now < start) {
    return 'UPCOMING';
  } else if (now >= start && now <= end) {
    return 'LIVE';
  } else {
    return 'COMPLETED';
  }
}

export class EventService {
  async create(data: {
    tour: string;
    name: string;
    description?: string;
    dateStart: Date;
    dateEnd: Date;
    broadcastEpisode?: string;
    multiplier?: number;
    venue?: string;
  }) {
    return prisma.event.create({
      data: {
        ...data,
        multiplier: data.multiplier || 1.0,
      },
    });
  }

  async findById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        slotInstances: {
          include: {
            slotTemplate: true,
            athlete: true,
            auction: true,
          },
        },
        participations: {
          include: {
            athlete: true,
          },
        },
        _count: {
          select: {
            slotInstances: true,
            participations: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // 날짜 기반으로 상태 자동 계산
    return {
      ...event,
      status: computeEventStatus(event),
    };
  }

  async list(filters: {
    tour?: string;
    from?: Date;
    to?: Date;
    status?: EventStatus;
    page?: number;
    limit?: number;
  }) {
    const { tour, from, to, status, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (tour) where.tour = tour;
    if (status) where.status = status;
    if (from || to) {
      where.dateStart = {};
      if (from) where.dateStart.gte = from;
      if (to) where.dateStart.lte = to;
    }

    const [rawEvents, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateStart: 'asc' },
        select: {
          id: true,
          tour: true,
          name: true,
          description: true,
          dateStart: true,
          dateEnd: true,
          broadcastEpisode: true,
          multiplier: true,
          venue: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              slotInstances: true,
              participations: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    // 날짜 기반으로 상태 자동 계산
    const events = rawEvents.map(event => ({
      ...event,
      status: computeEventStatus(event),
    }));

    return { events, total };
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    dateStart: Date;
    dateEnd: Date;
    broadcastEpisode: string;
    multiplier: number;
    venue: string;
    status: EventStatus;
  }>) {
    return prisma.event.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Check if there are any active auctions
    const activeAuctions = await prisma.auction.count({
      where: {
        slotInstance: { eventId: id },
        status: { in: ['SCHEDULED', 'LIVE'] },
      },
    });

    if (activeAuctions > 0) {
      throw new Error('Cannot delete event with active auctions');
    }

    return prisma.event.delete({ where: { id } });
  }

  async addParticipant(eventId: string, athleteId: string) {
    return prisma.eventParticipation.create({
      data: {
        eventId,
        athleteId,
        confirmed: false,
      },
    });
  }

  async confirmParticipation(eventId: string, athleteId: string) {
    return prisma.eventParticipation.update({
      where: {
        eventId_athleteId: { eventId, athleteId },
      },
      data: { confirmed: true },
    });
  }

  async getUpcoming(limit: number = 10) {
    return prisma.event.findMany({
      where: {
        dateStart: { gte: new Date() },
        status: 'UPCOMING',
      },
      take: limit,
      orderBy: { dateStart: 'asc' },
      include: {
        _count: {
          select: {
            slotInstances: true,
          },
        },
      },
    });
  }
}

export const eventService = new EventService();

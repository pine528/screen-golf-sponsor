import { prisma } from '../models/prisma';
import { AgencyAthleteRequestStatus, KycStatus } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import { notificationService } from './notification.service';

interface SearchFilters {
  q?: string;
  tour?: string;
  page?: number;
  limit?: number;
}

interface SentRequestFilters {
  status?: AgencyAthleteRequestStatus;
  page?: number;
  limit?: number;
}

interface ReceivedRequestFilters {
  status?: AgencyAthleteRequestStatus | 'ALL';
  page?: number;
  limit?: number;
}

export class AgencyAthleteRequestService {
  /**
   * 연결 가능한 선수 검색 (agencyId가 없는 선수만)
   */
  async searchAvailableAthletes(agencyId: string, filters: SearchFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      agencyId: null, // 에이전시가 없는 선수만
      kycStatus: KycStatus.APPROVED, // KYC 승인된 선수만
    };

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { user: { email: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }

    if (filters.tour) {
      where.tour = filters.tour;
    }

    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          tour: true,
          profileImageUrl: true,
          kycStatus: true,
          user: {
            select: { email: true },
          },
          agencyRequests: {
            where: {
              agencyId,
              status: AgencyAthleteRequestStatus.PENDING,
            },
            select: { id: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.athlete.count({ where }),
    ]);

    return {
      athletes: athletes.map((a) => ({
        id: a.id,
        name: a.name,
        tour: a.tour,
        profileImageUrl: a.profileImageUrl,
        kycStatus: a.kycStatus,
        email: a.user.email,
        hasAgency: false,
        hasPendingRequest: a.agencyRequests.length > 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 연결 요청 생성
   */
  async createRequest(agencyId: string, agencyUserId: string, athleteId: string, message?: string) {
    // 1. 에이전시 조회 및 KYC 승인 확인
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: { user: true },
    });

    if (!agency) {
      throw new NotFoundError('에이전시를 찾을 수 없습니다');
    }

    if (agency.kycStatus !== KycStatus.APPROVED) {
      throw new ForbiddenError('에이전시 KYC가 승인되어야 연결 요청을 보낼 수 있습니다');
    }

    // 2. 선수 조회
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { user: true },
    });

    if (!athlete) {
      throw new NotFoundError('선수를 찾을 수 없습니다');
    }

    // 3. 선수가 이미 에이전시가 있는지 확인
    if (athlete.agencyId) {
      throw new ConflictError('해당 선수는 이미 에이전시에 소속되어 있습니다');
    }

    // 4. 중복 PENDING 요청 확인
    const existingRequest = await prisma.agencyAthleteRequest.findFirst({
      where: {
        agencyId,
        athleteId,
        status: AgencyAthleteRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictError('이미 해당 선수에게 연결 요청을 보냈습니다');
    }

    // 5. 요청 생성
    const request = await prisma.agencyAthleteRequest.create({
      data: {
        agencyId,
        athleteId,
        message,
        status: AgencyAthleteRequestStatus.PENDING,
      },
      include: {
        agency: { select: { id: true, name: true } },
        athlete: { select: { id: true, name: true } },
      },
    });

    // 6. 선수에게 알림 발송
    await notificationService.create({
      userId: athlete.userId,
      type: 'AGENCY_CONNECTION_REQUEST',
      title: '에이전시 연결 요청',
      message: `${agency.name} 에이전시에서 연결 요청을 보냈습니다.`,
      payload: {
        link: '/athlete/agency-requests',
        entityType: 'AGENCY_ATHLETE_REQUEST',
        entityId: request.id,
      },
    });

    // 7. AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: agencyUserId,
        action: 'AGENCY_CONNECTION_REQUEST_SENT',
        entityType: 'AgencyAthleteRequest',
        entityId: request.id,
        metadata: {
          agencyId,
          agencyName: agency.name,
          athleteId,
          athleteName: athlete.name,
          message,
        },
      },
    });

    return request;
  }

  /**
   * 에이전시가 보낸 요청 목록
   */
  async getSentRequests(agencyId: string, filters: SentRequestFilters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { agencyId };

    if (filters.status) {
      where.status = filters.status;
    }

    const [requests, total] = await Promise.all([
      prisma.agencyAthleteRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              tour: true,
              profileImageUrl: true,
              kycStatus: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agencyAthleteRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 요청 취소 (에이전시)
   */
  async cancelRequest(agencyId: string, requestId: string, agencyUserId: string) {
    const request = await prisma.agencyAthleteRequest.findUnique({
      where: { id: requestId },
      include: {
        agency: { select: { id: true, name: true, userId: true } },
        athlete: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!request) {
      throw new NotFoundError('요청을 찾을 수 없습니다');
    }

    if (request.agencyId !== agencyId) {
      throw new ForbiddenError('해당 요청에 대한 권한이 없습니다');
    }

    if (request.status !== AgencyAthleteRequestStatus.PENDING) {
      throw new BadRequestError('대기 중인 요청만 취소할 수 있습니다');
    }

    // 요청 상태 변경
    const updated = await prisma.agencyAthleteRequest.update({
      where: { id: requestId },
      data: {
        status: AgencyAthleteRequestStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    // 선수에게 알림 발송
    await notificationService.create({
      userId: request.athlete.userId,
      type: 'AGENCY_CONNECTION_CANCELLED',
      title: '에이전시 연결 요청 취소',
      message: `${request.agency.name} 에이전시가 연결 요청을 취소했습니다.`,
    });

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: agencyUserId,
        action: 'AGENCY_CONNECTION_REQUEST_CANCELLED',
        entityType: 'AgencyAthleteRequest',
        entityId: requestId,
        metadata: {
          agencyId,
          agencyName: request.agency.name,
          athleteId: request.athleteId,
          athleteName: request.athlete.name,
        },
      },
    });

    return updated;
  }

  /**
   * 선수가 받은 요청 목록
   */
  async getReceivedRequests(athleteId: string, filters: ReceivedRequestFilters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { athleteId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    const [requests, total] = await Promise.all([
      prisma.agencyAthleteRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              bizNo: true,
              contactEmail: true,
              kycStatus: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agencyAthleteRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 요청 승인 (선수)
   */
  async approveRequest(athleteId: string, requestId: string, athleteUserId: string) {
    const request = await prisma.agencyAthleteRequest.findUnique({
      where: { id: requestId },
      include: {
        agency: { select: { id: true, name: true, userId: true } },
        athlete: { select: { id: true, name: true, userId: true, agencyId: true } },
      },
    });

    if (!request) {
      throw new NotFoundError('요청을 찾을 수 없습니다');
    }

    if (request.athleteId !== athleteId) {
      throw new ForbiddenError('해당 요청에 대한 권한이 없습니다');
    }

    if (request.status !== AgencyAthleteRequestStatus.PENDING) {
      throw new BadRequestError('대기 중인 요청만 승인할 수 있습니다');
    }

    // 선수가 이미 다른 에이전시에 연결되어 있는지 재확인
    if (request.athlete.agencyId) {
      throw new ConflictError('이미 에이전시에 소속되어 있습니다');
    }

    // 트랜잭션으로 요청 승인 + 선수 연결
    console.log('[approveRequest] Starting transaction:', {
      requestId,
      athleteId,
      requestAgencyId: request.agencyId,
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. 요청 상태 변경
      const updatedRequest = await tx.agencyAthleteRequest.update({
        where: { id: requestId },
        data: {
          status: AgencyAthleteRequestStatus.APPROVED,
          respondedAt: new Date(),
        },
      });

      console.log('[approveRequest] Request status updated to APPROVED');

      // 2. 선수에게 에이전시 연결
      const updatedAthlete = await tx.athlete.update({
        where: { id: athleteId },
        data: {
          agencyId: request.agencyId,
          agencyAssignedAt: new Date(),
        },
      });

      console.log('[approveRequest] Athlete updated:', {
        athleteId: updatedAthlete.id,
        newAgencyId: updatedAthlete.agencyId,
      });

      // 3. 해당 선수의 다른 PENDING 요청들 자동 거부
      await tx.agencyAthleteRequest.updateMany({
        where: {
          athleteId,
          status: AgencyAthleteRequestStatus.PENDING,
          id: { not: requestId },
        },
        data: {
          status: AgencyAthleteRequestStatus.REJECTED,
          rejectedReason: '다른 에이전시 연결로 인해 자동 거부됨',
          respondedAt: new Date(),
        },
      });

      return updatedRequest;
    });

    // 에이전시에게 알림 발송
    await notificationService.create({
      userId: request.agency.userId,
      type: 'AGENCY_CONNECTION_APPROVED',
      title: '연결 요청 승인',
      message: `${request.athlete.name} 선수가 연결 요청을 승인했습니다.`,
      payload: {
        link: '/agency/athletes',
      },
    });

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: athleteUserId,
        action: 'AGENCY_CONNECTION_REQUEST_APPROVED',
        entityType: 'AgencyAthleteRequest',
        entityId: requestId,
        metadata: {
          agencyId: request.agencyId,
          agencyName: request.agency.name,
          athleteId,
          athleteName: request.athlete.name,
        },
      },
    });

    return result;
  }

  /**
   * 요청 거부 (선수)
   */
  async rejectRequest(athleteId: string, requestId: string, athleteUserId: string, reason?: string) {
    const request = await prisma.agencyAthleteRequest.findUnique({
      where: { id: requestId },
      include: {
        agency: { select: { id: true, name: true, userId: true } },
        athlete: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!request) {
      throw new NotFoundError('요청을 찾을 수 없습니다');
    }

    if (request.athleteId !== athleteId) {
      throw new ForbiddenError('해당 요청에 대한 권한이 없습니다');
    }

    if (request.status !== AgencyAthleteRequestStatus.PENDING) {
      throw new BadRequestError('대기 중인 요청만 거부할 수 있습니다');
    }

    // 요청 상태 변경
    const updated = await prisma.agencyAthleteRequest.update({
      where: { id: requestId },
      data: {
        status: AgencyAthleteRequestStatus.REJECTED,
        rejectedReason: reason,
        respondedAt: new Date(),
      },
    });

    // 에이전시에게 알림 발송
    const message = reason
      ? `${request.athlete.name} 선수가 연결 요청을 거부했습니다. 사유: ${reason}`
      : `${request.athlete.name} 선수가 연결 요청을 거부했습니다.`;

    await notificationService.create({
      userId: request.agency.userId,
      type: 'AGENCY_CONNECTION_REJECTED',
      title: '연결 요청 거부',
      message,
      payload: {
        link: '/agency/requests',
      },
    });

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: athleteUserId,
        action: 'AGENCY_CONNECTION_REQUEST_REJECTED',
        entityType: 'AgencyAthleteRequest',
        entityId: requestId,
        metadata: {
          agencyId: request.agencyId,
          agencyName: request.agency.name,
          athleteId,
          athleteName: request.athlete.name,
          reason,
        },
      },
    });

    return updated;
  }
}

export const agencyAthleteRequestService = new AgencyAthleteRequestService();

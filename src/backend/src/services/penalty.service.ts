/**
 * Penalty Service
 *
 * 페널티 관리 서비스
 * - 페널티 부여/조회/제거
 * - 참여 자격 검사 (페널티 합계 30점 이상 시 차단)
 * - 자동 만료 처리
 */

import prisma from '../models/prisma';
import { PenaltyType, PenaltyStatus, Penalty, Prisma } from '@prisma/client';

const PENALTY_THRESHOLD = 30; // 참여 제한 기준 포인트
const PENALTY_EXPIRY_DAYS = 90; // 기본 만료 일수

interface CreatePenaltyData {
  athleteId?: string;
  brandId?: string;
  userId: string;
  type: PenaltyType;
  points?: number;
  reason: string;
  refType?: string;
  refId?: string;
  expiresAt?: Date;
}

interface PenaltyFilters {
  athleteId?: string;
  brandId?: string;
  userId?: string;
  status?: PenaltyStatus;
  type?: PenaltyType;
  q?: string;
}

interface PenaltyStats {
  totalPenalties: number;
  activePenalties: number;
  expiredPenalties: number;
  removedPenalties: number;
  totalActivePoints: number;
}

class PenaltyService {
  /**
   * 페널티 목록 조회 (Admin)
   */
  async getPenalties(filters?: PenaltyFilters): Promise<Penalty[]> {
    const where: Prisma.PenaltyWhereInput = {};

    if (filters?.athleteId) {
      where.athleteId = filters.athleteId;
    }
    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.q) {
      where.OR = [
        { reason: { contains: filters.q, mode: 'insensitive' } },
        { refType: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return prisma.penalty.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 페널티 상세 조회
   */
  async getPenalty(id: string): Promise<Penalty | null> {
    return prisma.penalty.findUnique({
      where: { id },
    });
  }

  /**
   * 페널티 부여
   */
  async createPenalty(adminId: string, data: CreatePenaltyData): Promise<Penalty> {
    const expiresAt = data.expiresAt || new Date(Date.now() + PENALTY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    return prisma.penalty.create({
      data: {
        athleteId: data.athleteId,
        brandId: data.brandId,
        userId: data.userId,
        type: data.type,
        points: data.points || 10,
        reason: data.reason,
        refType: data.refType,
        refId: data.refId,
        expiresAt,
        createdBy: adminId,
      },
    });
  }

  /**
   * 페널티 제거 (관리자)
   */
  async removePenalty(id: string, adminId: string, removeReason: string): Promise<Penalty> {
    const penalty = await prisma.penalty.findUnique({ where: { id } });
    if (!penalty) {
      throw new Error('Penalty not found');
    }

    if (penalty.status !== 'ACTIVE') {
      throw new Error('Only active penalties can be removed');
    }

    return prisma.penalty.update({
      where: { id },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        removedBy: adminId,
        removeReason,
      },
    });
  }

  /**
   * 만료된 페널티 자동 처리 (크론에서 호출)
   */
  async expireOldPenalties(): Promise<number> {
    const result = await prisma.penalty.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return result.count;
  }

  /**
   * 참여 자격 검사 (입찰/즉시구매 전 호출)
   * - 브랜드: brandId로 검사
   * - 선수: athleteId로 검사
   */
  async checkParticipationEligibility(
    userId: string,
    type: 'BRAND' | 'ATHLETE',
    entityId: string
  ): Promise<{ eligible: boolean; totalPoints: number; message?: string }> {
    const where: Prisma.PenaltyWhereInput = {
      status: 'ACTIVE',
    };

    if (type === 'BRAND') {
      where.brandId = entityId;
    } else {
      where.athleteId = entityId;
    }

    const penalties = await prisma.penalty.findMany({
      where,
      select: { points: true },
    });

    const totalPoints = penalties.reduce((sum, p) => sum + p.points, 0);

    if (totalPoints >= PENALTY_THRESHOLD) {
      return {
        eligible: false,
        totalPoints,
        message: `페널티 점수(${totalPoints}점)가 기준(${PENALTY_THRESHOLD}점)을 초과하여 참여가 제한됩니다.`,
      };
    }

    return { eligible: true, totalPoints };
  }

  /**
   * 활성 페널티 점수 합계 조회
   */
  async getActivePenaltyPoints(
    type: 'BRAND' | 'ATHLETE' | 'USER',
    entityId: string
  ): Promise<number> {
    const where: Prisma.PenaltyWhereInput = {
      status: 'ACTIVE',
    };

    if (type === 'BRAND') {
      where.brandId = entityId;
    } else if (type === 'ATHLETE') {
      where.athleteId = entityId;
    } else {
      where.userId = entityId;
    }

    const penalties = await prisma.penalty.findMany({
      where,
      select: { points: true },
    });

    return penalties.reduce((sum, p) => sum + p.points, 0);
  }

  /**
   * 특정 엔티티의 페널티 목록 조회
   */
  async getEntityPenalties(
    type: 'BRAND' | 'ATHLETE' | 'USER',
    entityId: string,
    statusFilter?: PenaltyStatus
  ): Promise<Penalty[]> {
    const where: Prisma.PenaltyWhereInput = {};

    if (type === 'BRAND') {
      where.brandId = entityId;
    } else if (type === 'ATHLETE') {
      where.athleteId = entityId;
    } else {
      where.userId = entityId;
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    return prisma.penalty.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 페널티 통계 조회 (Admin)
   */
  async getPenaltyStats(): Promise<PenaltyStats> {
    const [total, active, expired, removed, activePoints] = await Promise.all([
      prisma.penalty.count(),
      prisma.penalty.count({ where: { status: 'ACTIVE' } }),
      prisma.penalty.count({ where: { status: 'EXPIRED' } }),
      prisma.penalty.count({ where: { status: 'REMOVED' } }),
      prisma.penalty.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { points: true },
      }),
    ]);

    return {
      totalPenalties: total,
      activePenalties: active,
      expiredPenalties: expired,
      removedPenalties: removed,
      totalActivePoints: activePoints._sum.points || 0,
    };
  }

  /**
   * 자동 페널티 부여 (시스템에서 호출)
   * - 에셋 마감 미준수
   * - 검수 실패
   * - 계약 위반
   */
  async autoCreatePenalty(
    type: PenaltyType,
    userId: string,
    entityType: 'BRAND' | 'ATHLETE',
    entityId: string,
    refType: string,
    refId: string,
    reason: string,
    points: number = 10
  ): Promise<Penalty> {
    const data: CreatePenaltyData = {
      userId,
      type,
      points,
      reason,
      refType,
      refId,
    };

    if (entityType === 'BRAND') {
      data.brandId = entityId;
    } else {
      data.athleteId = entityId;
    }

    // 시스템 자동 부여는 createdBy를 'SYSTEM'으로 설정
    return prisma.penalty.create({
      data: {
        ...data,
        expiresAt: new Date(Date.now() + PENALTY_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        createdBy: 'SYSTEM',
      },
    });
  }
}

export const penaltyService = new PenaltyService();

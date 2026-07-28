/**
 * Funnel Segment Service (Phase 3)
 *
 * - 고객 세그먼트 분석:
 *   - 신규 vs 재구매
 *   - 디바이스별 (mobile/desktop)
 *   - 유입경로별 (referrer)
 */

import prisma from '../models/prisma';
import { Prisma } from '@prisma/client';

function toNumber(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  if (typeof d.toNumber === 'function') return d.toNumber();
  return Number(d);
}

export class FunnelSegmentService {
  /**
   * 신규/재구매 세그먼트
   */
  async getNewVsReturning(params: { brandId?: string; campaignId?: string; from?: Date; to?: Date }) {
    const where: Prisma.FunnelOrderWhereInput = {};
    if (params.brandId) where.brandId = params.brandId;
    if (params.campaignId) where.campaignId = params.campaignId;
    if (params.from || params.to) {
      where.paidAt = {};
      if (params.from) where.paidAt.gte = params.from;
      if (params.to) where.paidAt.lte = params.to;
    }

    const grouped = await prisma.funnelOrder.groupBy({
      by: ['isNewCustomer'],
      where,
      _count: { _all: true },
      _sum: { netAmount: true, refundedAmount: true },
    });

    const result = { new: { count: 0, revenue: 0 }, returning: { count: 0, revenue: 0 } };
    grouped.forEach((g) => {
      const target = g.isNewCustomer ? result.new : result.returning;
      target.count = g._count._all;
      target.revenue = toNumber(g._sum.netAmount) - toNumber(g._sum.refundedAmount);
    });
    return result;
  }

  /**
   * 디바이스별 (FunnelEvent 기반)
   */
  async getByDevice(params: { brandId?: string; campaignId?: string; from?: Date; to?: Date }) {
    const where: Prisma.FunnelEventWhereInput = { eventName: 'PURCHASE', deviceType: { not: null } };
    if (params.brandId) where.brandId = params.brandId;
    if (params.campaignId) where.campaignId = params.campaignId;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }

    const grouped = await prisma.funnelEvent.groupBy({
      by: ['deviceType'],
      where,
      _count: { _all: true },
    });
    return grouped.map((g) => ({ device: g.deviceType || 'unknown', count: g._count._all }));
  }

  /**
   * 유입경로별 (referrer 기반)
   */
  async getByReferrer(params: { brandId?: string; campaignId?: string; from?: Date; to?: Date; limit?: number }) {
    const where: Prisma.FunnelEventWhereInput = { eventName: 'LANDING_VIEW', referrer: { not: null } };
    if (params.brandId) where.brandId = params.brandId;
    if (params.campaignId) where.campaignId = params.campaignId;

    const grouped = await prisma.funnelEvent.groupBy({
      by: ['referrer'],
      where,
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: params.limit ?? 10,
    });
    return grouped.map((g) => ({
      referrer: g.referrer || 'direct',
      visits: g._count._all,
    }));
  }
}

export const funnelSegmentService = new FunnelSegmentService();

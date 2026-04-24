/**
 * Funnel Report Service
 *
 * - 캠페인/브랜드/선수 단위 리포트 집계
 * - KPI: 유입(landing_view), 주문(purchase), 순매출(net_amount-refund), CVR, CAC, ROAS, AOV, CTR
 * - timeseries (일자별 추이)
 * - breakdown (선수/콘텐츠/코드별 분해)
 *
 * Refs:
 * - api_spec.docx > 7. 리포트 조회 API
 * - handoff.docx > 6-2. KPI 정의
 * - wireframe_spec.docx > BRD-01, BRD-02
 */

import prisma from '../models/prisma';
import { Prisma } from '@prisma/client';

export interface ReportParams {
  campaignId?: string;
  brandId?: string;
  athleteId?: string;
  from?: Date;
  to?: Date;
  groupBy?: 'day' | 'athlete' | 'content' | 'code';
  includeBreakdown?: boolean;
}

export interface FunnelSummary {
  impressions: number;
  linkClicks: number;
  landingViews: number;
  productViews: number;
  ctaClicks: number;
  addToCarts: number;
  beginCheckouts: number;
  promoApplies: number;
  purchases: number;
  refunds: number;
  netRevenue: number;
  grossRevenue: number;
  refundedAmount: number;
  newCustomers: number;
  // 파생 지표
  ctr: number;            // landing_view / link_click
  cvr: number;            // purchase / landing_view
  checkoutCompletion: number; // purchase / begin_checkout
  aov: number;            // net_revenue / purchase
  roas: number | null;    // net_revenue / spent (캠페인일 때)
  cac: number | null;     // spent / new_customer
}

function toNumber(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  if (typeof d.toNumber === 'function') return d.toNumber();
  return Number(d);
}

export class FunnelReportService {
  /**
   * 공통 where 조건
   */
  private buildEventWhere(p: ReportParams): Prisma.FunnelEventWhereInput {
    const where: Prisma.FunnelEventWhereInput = {};
    if (p.campaignId) where.campaignId = p.campaignId;
    if (p.brandId) where.brandId = p.brandId;
    if (p.athleteId) where.athleteId = p.athleteId;
    if (p.from || p.to) {
      where.occurredAt = {};
      if (p.from) where.occurredAt.gte = p.from;
      if (p.to) where.occurredAt.lte = p.to;
    }
    return where;
  }

  private buildOrderWhere(p: ReportParams): Prisma.FunnelOrderWhereInput {
    const where: Prisma.FunnelOrderWhereInput = {};
    if (p.campaignId) where.campaignId = p.campaignId;
    if (p.brandId) where.brandId = p.brandId;
    if (p.athleteId) where.athleteId = p.athleteId;
    if (p.from || p.to) {
      where.paidAt = {};
      if (p.from) where.paidAt.gte = p.from;
      if (p.to) where.paidAt.lte = p.to;
    }
    return where;
  }

  /**
   * 핵심 KPI 집계
   * CTR (handoff TABLE 8): 링크 클릭 수 ÷ 콘텐츠 노출 수
   *   → impression_logged 이벤트의 payload.impressions 합산을 분모로 사용
   */
  async getSummary(params: ReportParams, campaignSpent?: number): Promise<FunnelSummary> {
    const eventWhere = this.buildEventWhere(params);
    const orderWhere = this.buildOrderWhere(params);

    const [eventCounts, orderAgg, newCustomerAgg, impressionEvents] = await Promise.all([
      prisma.funnelEvent.groupBy({
        by: ['eventName'],
        where: eventWhere,
        _count: { _all: true },
      }),
      prisma.funnelOrder.aggregate({
        where: orderWhere,
        _sum: {
          grossAmount: true,
          netAmount: true,
          refundedAmount: true,
        },
        _count: { _all: true },
      }),
      prisma.funnelOrder.count({
        where: { ...orderWhere, isNewCustomer: true },
      }),
      // CTR 계산용: IMPRESSION_LOGGED 이벤트들의 payload.impressions 합산
      prisma.funnelEvent.findMany({
        where: { ...eventWhere, eventName: 'IMPRESSION_LOGGED' },
        select: { payload: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    eventCounts.forEach((g) => {
      counts[g.eventName] = g._count._all;
    });

    const purchases = orderAgg._count._all;
    const grossRevenue = toNumber(orderAgg._sum.grossAmount);
    const refundedAmount = toNumber(orderAgg._sum.refundedAmount);
    const netRevenueRaw = toNumber(orderAgg._sum.netAmount);
    const netRevenue = netRevenueRaw - refundedAmount;
    const linkClicks = counts.LINK_CLICK || 0;
    const landingViews = counts.LANDING_VIEW || 0;

    // 총 노출 수 = IMPRESSION_LOGGED 이벤트들의 payload.impressions 합 (handoff TABLE 8)
    const totalImpressions = impressionEvents.reduce((sum, e) => {
      const p = (e.payload as any) || {};
      return sum + Number(p.impressions || 1);
    }, 0);

    return {
      linkClicks,
      landingViews,
      productViews: counts.PRODUCT_VIEW || 0,
      ctaClicks: counts.CTA_CLICK || 0,
      addToCarts: counts.ADD_TO_CART || 0,
      beginCheckouts: counts.BEGIN_CHECKOUT || 0,
      promoApplies: counts.PROMO_APPLY || 0,
      purchases,
      refunds: counts.REFUND || 0,
      netRevenue,
      grossRevenue,
      refundedAmount,
      newCustomers: newCustomerAgg,
      impressions: totalImpressions,
      // handoff TABLE 8 정확한 정의:
      ctr: totalImpressions > 0 ? linkClicks / totalImpressions : 0,
      cvr: landingViews > 0 ? purchases / landingViews : 0,
      checkoutCompletion: counts.BEGIN_CHECKOUT > 0 ? purchases / counts.BEGIN_CHECKOUT : 0,
      aov: purchases > 0 ? netRevenue / purchases : 0,
      roas: campaignSpent && campaignSpent > 0 ? netRevenue / campaignSpent : null,
      cac: campaignSpent && newCustomerAgg > 0 ? campaignSpent / newCustomerAgg : null,
    };
  }

  /**
   * 일자별 추이 (timeseries)
   */
  async getTimeSeries(params: ReportParams) {
    const where = this.buildOrderWhere(params);
    const orders = await prisma.funnelOrder.findMany({
      where,
      select: { paidAt: true, netAmount: true, refundedAmount: true },
    });

    const eventWhere = this.buildEventWhere(params);
    const events = await prisma.funnelEvent.findMany({
      where: { ...eventWhere, eventName: { in: ['LANDING_VIEW', 'LINK_CLICK', 'PURCHASE'] } },
      select: { occurredAt: true, eventName: true },
    });

    // 일별 그룹
    const series: Record<string, { date: string; landingViews: number; clicks: number; purchases: number; netRevenue: number }> = {};

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    events.forEach((e) => {
      const k = dayKey(e.occurredAt);
      if (!series[k]) series[k] = { date: k, landingViews: 0, clicks: 0, purchases: 0, netRevenue: 0 };
      if (e.eventName === 'LANDING_VIEW') series[k].landingViews++;
      else if (e.eventName === 'LINK_CLICK') series[k].clicks++;
      else if (e.eventName === 'PURCHASE') series[k].purchases++;
    });

    orders.forEach((o) => {
      const k = dayKey(o.paidAt);
      if (!series[k]) series[k] = { date: k, landingViews: 0, clicks: 0, purchases: 0, netRevenue: 0 };
      series[k].netRevenue += toNumber(o.netAmount) - toNumber(o.refundedAmount);
    });

    return Object.values(series).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 선수/콘텐츠/코드별 분해
   */
  async getBreakdown(params: ReportParams, by: 'athlete' | 'content' | 'code' = 'athlete') {
    const orderWhere = this.buildOrderWhere(params);

    if (by === 'athlete') {
      const grouped = await prisma.funnelOrder.groupBy({
        by: ['athleteId'],
        where: orderWhere,
        _sum: { netAmount: true, refundedAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { netAmount: 'desc' } },
      });

      // 선수 정보 조회
      const athleteIds = grouped.map((g) => g.athleteId);
      const athletes = await prisma.athlete.findMany({
        where: { id: { in: athleteIds } },
        select: { id: true, name: true, profileImageUrl: true, tour: true },
      });
      const athMap = new Map(athletes.map((a) => [a.id, a]));

      return grouped.map((g) => ({
        id: g.athleteId,
        name: athMap.get(g.athleteId)?.name || 'Unknown',
        tour: athMap.get(g.athleteId)?.tour,
        profileImageUrl: athMap.get(g.athleteId)?.profileImageUrl,
        purchases: g._count._all,
        netRevenue: toNumber(g._sum.netAmount) - toNumber(g._sum.refundedAmount),
      }));
    }

    if (by === 'code') {
      const grouped = await prisma.funnelOrder.groupBy({
        by: ['promoCode'],
        where: { ...orderWhere, promoCode: { not: null } },
        _sum: { netAmount: true, refundedAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { netAmount: 'desc' } },
      });
      return grouped.map((g) => ({
        code: g.promoCode,
        purchases: g._count._all,
        netRevenue: toNumber(g._sum.netAmount) - toNumber(g._sum.refundedAmount),
      }));
    }

    // by === 'content' (FunnelEvent.contentId 기준)
    const eventWhere = this.buildEventWhere(params);
    const grouped = await prisma.funnelEvent.groupBy({
      by: ['contentId', 'eventName'],
      where: { ...eventWhere, contentId: { not: null } },
      _count: { _all: true },
    });

    const contentMap: Record<string, any> = {};
    grouped.forEach((g) => {
      const cid = g.contentId!;
      if (!contentMap[cid]) contentMap[cid] = { contentId: cid, clicks: 0, landingViews: 0, purchases: 0 };
      if (g.eventName === 'LINK_CLICK') contentMap[cid].clicks = g._count._all;
      else if (g.eventName === 'LANDING_VIEW') contentMap[cid].landingViews = g._count._all;
      else if (g.eventName === 'PURCHASE') contentMap[cid].purchases = g._count._all;
    });
    return Object.values(contentMap);
  }

  /**
   * 캠페인 리포트 (전체 합산)
   */
  async getCampaignReport(campaignId: string, params: Omit<ReportParams, 'campaignId'>) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, brandId: true, budget: true, spentAmount: true, dateStart: true, dateEnd: true, status: true, pricingModel: true },
    });

    const fullParams = { ...params, campaignId };
    const [summary, timeseries, byAthlete, byCode] = await Promise.all([
      this.getSummary(fullParams, campaign?.spentAmount),
      this.getTimeSeries(fullParams),
      this.getBreakdown(fullParams, 'athlete'),
      this.getBreakdown(fullParams, 'code'),
    ]);

    return {
      campaign,
      summary,
      timeseries,
      breakdown: {
        athletes: byAthlete,
        codes: byCode,
      },
    };
  }

  /**
   * 브랜드 리포트
   */
  async getBrandReport(brandId: string, params: Omit<ReportParams, 'brandId'>) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, category: true },
    });

    const fullParams = { ...params, brandId };
    const [summary, timeseries, byAthlete, byCode] = await Promise.all([
      this.getSummary(fullParams),
      this.getTimeSeries(fullParams),
      params.includeBreakdown !== false ? this.getBreakdown(fullParams, 'athlete') : [],
      params.includeBreakdown !== false ? this.getBreakdown(fullParams, 'code') : [],
    ]);

    // 브랜드 전체 캠페인 목록도 함께
    const campaigns = await prisma.campaign.findMany({
      where: { brandId },
      select: { id: true, name: true, status: true, budget: true, spentAmount: true, dateStart: true, dateEnd: true },
    });

    // rankings (api_spec TABLE 48): 선수/콘텐츠/코드 성과 순위
    const rankings = {
      athletes: (byAthlete as any[]).slice(0, 10).map((a, i) => ({ rank: i + 1, ...a })),
      codes: (byCode as any[]).slice(0, 10).map((c, i) => ({ rank: i + 1, ...c })),
    };

    return {
      brand,
      summary,
      timeseries,
      campaigns,
      rankings,
      breakdown: {
        athletes: byAthlete,
        codes: byCode,
      },
    };
  }

  /**
   * 선수 리포트 (본인 데이터만, 타 선수 비교 미노출)
   */
  async getAthleteReport(athleteId: string, params: Omit<ReportParams, 'athleteId'>) {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, name: true, tour: true, profileImageUrl: true },
    });

    const fullParams = { ...params, athleteId };
    const [summary, timeseries, byContent, links, codes] = await Promise.all([
      this.getSummary(fullParams),
      this.getTimeSeries(fullParams),
      this.getBreakdown(fullParams, 'content'),
      prisma.trackingLink.findMany({
        where: { athleteId },
        select: { id: true, shortCode: true, qrUrl: true, clickCount: true, contentId: true },
      }),
      prisma.promoCode.findMany({
        where: { athleteId },
        select: { id: true, code: true, status: true, usageCount: true, discountType: true, discountValue: true },
      }),
    ]);

    return {
      athlete,
      summary,
      timeseries,
      contents: byContent,
      assets: { links, codes },
    };
  }
}

export const funnelReportService = new FunnelReportService();

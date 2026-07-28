/**
 * Funnel Report Routes
 *
 * - GET /api/reports/campaign/:id
 * - GET /api/reports/brand/:id
 * - GET /api/reports/athlete/:id
 *
 * RBAC:
 * - BRAND: 자사 데이터만 (req.user.brandId 검증)
 * - ATHLETE: 본인만
 * - ADMIN: 전체
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { funnelReportService } from '../services/funnelReport.service';
import { funnelPredictService } from '../services/funnelPredict.service';
import { funnelSegmentService } from '../services/funnelSegment.service';
import { funnelAttributionService, AttributionModel } from '../services/funnelAttribution.service';
import { funnelOrderService } from '../services/funnelOrder.service';
import { toSnakeKeys } from '../utils/caseConvert';
import { AuthRequest } from '../types';
import prisma from '../models/prisma';
import { ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function ok(res: Response, data: any) {
  // ?format=snake → api_spec TABLE 45 호환 snake_case 변환 (외부 자사몰 호출용)
  // 기본은 camelCase (프론트 일관성)
  const wantSnake = (res.req.query.format === 'snake') || (res.req.headers['x-response-format'] === 'snake');
  const payload = wantSnake ? toSnakeKeys(data) : data;
  return res.json({ success: true, data: payload, error: null, request_id: (res.req as any).requestId });
}

function parseDateRange(req: AuthRequest) {
  const { from, to } = req.query;
  return {
    from: from ? new Date(from as string) : undefined,
    to: to ? new Date(to as string) : undefined,
  };
}

// ============================================
// GET /api/reports/campaign/:id
// ============================================
router.get(
  '/campaign/:id',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // RBAC: BRAND는 자사 캠페인만
      if (req.user!.role === 'BRAND') {
        const campaign = await prisma.campaign.findUnique({ where: { id }, select: { brandId: true } });
        if (!campaign) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== campaign.brandId) throw new ForbiddenError();
      }

      const dateRange = parseDateRange(req);
      const groupBy = req.query.group_by as any;
      const data = await funnelReportService.getCampaignReport(id, { ...dateRange, groupBy });
      ok(res, data);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id
// ============================================
router.get(
  '/brand/:id',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // RBAC: BRAND는 자기 자신만
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }

      const dateRange = parseDateRange(req);
      const includeBreakdown = req.query.include_breakdown !== 'false';
      const data = await funnelReportService.getBrandReport(id, { ...dateRange, includeBreakdown });
      ok(res, data);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/athlete/:id
// ============================================
router.get(
  '/athlete/:id',
  authorize('ATHLETE', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // RBAC: ATHLETE는 본인만
      if (req.user!.role === 'ATHLETE') {
        const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!athlete || athlete.id !== id) throw new ForbiddenError();
      }

      const dateRange = parseDateRange(req);
      const data = await funnelReportService.getAthleteReport(id, dateRange);
      ok(res, data);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/orders (BRD-03)
// ============================================
router.get(
  '/brand/:id/orders',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      // RBAC: BRAND는 자기만
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }

      const dateRange = parseDateRange(req);
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const status = req.query.status as any;

      const orders = await funnelOrderService.listByBrand(id, { ...dateRange, limit, offset, status });
      // 개인정보 보호: customerHash, items 일부만 노출
      const safeOrders = orders.map((o) => ({
        id: o.id,
        externalOrderId: o.externalOrderId,
        campaignId: o.campaignId,
        athleteId: o.athleteId,
        athlete: o.athlete,
        campaign: o.campaign,
        promoCode: o.promoCode,
        grossAmount: o.grossAmount,
        discountAmount: o.discountAmount,
        netAmount: o.netAmount,
        refundedAmount: o.refundedAmount,
        isNewCustomer: o.isNewCustomer,
        attributionStatus: o.attributionStatus,
        attributionReason: o.attributionReason,
        status: o.status,
        items: o.items,
        paidAt: o.paidAt,
        refundedAt: o.refundedAt,
        // customerHash는 노출 (식별 불가)
        customerHash: o.customerHash ? `${o.customerHash.slice(0, 8)}...` : null,
      }));
      ok(res, safeOrders);
    } catch (e) { next(e); }
  }
);

// GET /api/reports/brand/:id/orders/:orderId/events (BRD-03 상세 이벤트 로그)
router.get(
  '/brand/:id/orders/:orderId/events',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id, orderId } = req.params;
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }
      const order = await prisma.funnelOrder.findUnique({ where: { id: orderId } });
      if (!order || order.brandId !== id) throw new NotFoundError('Order not found');

      // 같은 sessionId의 events 시간순 (LANDING_VIEW부터 PURCHASE까지)
      const orderEvents = await prisma.funnelEvent.findMany({
        where: {
          campaignId: order.campaignId,
          OR: [
            { payload: { path: ['order_id'], equals: order.id } as any },
            ...(order.externalOrderId ? [{ payload: { path: ['external_order_id'], equals: order.externalOrderId } as any }] : []),
          ],
        },
        orderBy: { occurredAt: 'asc' },
      });

      // 추가: 같은 PURCHASE 이벤트의 sessionId로 같은 세션 모든 이벤트
      let sessionEvents: any[] = [];
      const purchaseEvent = orderEvents.find((e) => e.eventName === 'PURCHASE');
      if (purchaseEvent?.sessionId) {
        sessionEvents = await prisma.funnelEvent.findMany({
          where: { sessionId: purchaseEvent.sessionId },
          orderBy: { occurredAt: 'asc' },
        });
      }

      ok(res, sessionEvents.length > 0 ? sessionEvents : orderEvents);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/orders.csv (CSV 다운로드)
// ============================================
router.get(
  '/brand/:id/orders.csv',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }

      const dateRange = parseDateRange(req);
      const orders = await funnelOrderService.listByBrand(id, { ...dateRange, limit: 10000 });

      const headers = ['주문일시', '주문번호', '외부주문번호', '캠페인', '선수', '코드', '총결제액', '할인', '순매출', '환불액', '귀속근거', '상태'];
      const rows = orders.map((o) => [
        new Date(o.paidAt).toLocaleString(),
        o.id,
        o.externalOrderId || '',
        (o as any).campaign?.name || o.campaignId,
        (o as any).athlete?.name || o.athleteId,
        o.promoCode || '',
        o.grossAmount.toString(),
        o.discountAmount.toString(),
        o.netAmount.toString(),
        o.refundedAmount.toString(),
        o.attributionReason || '',
        o.status,
      ]);

      const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      // BOM 추가 (Excel 한글 깨짐 방지)
      const bom = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="orders-${id}-${Date.now()}.csv"`);
      res.send(bom + csv);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/compare.csv (BRD-02)
// ============================================
router.get(
  '/brand/:id/compare.csv',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }
      const dateRange = parseDateRange(req);
      const by = (req.query.by as 'athlete' | 'code' | 'content') || 'athlete';
      const report = await funnelReportService.getBrandReport(id, { ...dateRange, includeBreakdown: true });
      const rows = by === 'athlete'
        ? report.breakdown.athletes.map((a: any) => [a.name, a.tour || '', a.purchases, Math.round(a.netRevenue), a.purchases > 0 ? Math.round(a.netRevenue / a.purchases) : 0])
        : report.breakdown.codes.map((c: any) => [c.code, '', c.purchases, Math.round(c.netRevenue), c.purchases > 0 ? Math.round(c.netRevenue / c.purchases) : 0]);
      const headers = by === 'athlete' ? ['선수', '투어', '주문수', '순매출', '객단가'] : ['코드', '', '사용', '순매출', '객단가'];
      const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="compare-${by}-${id}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/athlete/:id/campaigns (ATH-01 - 본인 참여 캠페인)
// ============================================
router.get(
  '/athlete/:id/campaigns',
  authorize('ATHLETE', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (req.user!.role === 'ATHLETE') {
        const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!athlete || athlete.id !== id) throw new ForbiddenError();
      }
      // funnel_events/orders에서 이 선수가 연관된 캠페인 추출
      const [events, orders] = await Promise.all([
        prisma.funnelEvent.findMany({ where: { athleteId: id }, select: { campaignId: true }, distinct: ['campaignId'] }),
        prisma.funnelOrder.findMany({ where: { athleteId: id }, select: { campaignId: true }, distinct: ['campaignId'] }),
      ]);
      const campaignIds = [...new Set([...events, ...orders].map((e) => e.campaignId))];
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, name: true, brand: { select: { id: true, name: true } }, status: true, dateStart: true, dateEnd: true },
      });
      ok(res, campaigns);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/period-compare
// (REP-01: 기간 비교 - 이번 기간 vs 지난 동일 기간)
// ============================================
router.get(
  '/brand/:id/period-compare',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== id) throw new ForbiddenError();
      }
      const dateRange = parseDateRange(req);
      const from = dateRange.from || new Date(Date.now() - 30 * 86400000);
      const to = dateRange.to || new Date();
      // 사용자가 명시적으로 prev_from/prev_to를 보낸 경우 우선
      const prevFrom = req.query.prev_from ? new Date(req.query.prev_from as string) : new Date(from.getTime() - (to.getTime() - from.getTime()));
      const prevTo = req.query.prev_to ? new Date(req.query.prev_to as string) : new Date(to.getTime() - (to.getTime() - from.getTime()));
      const [current, previous] = await Promise.all([
        funnelReportService.getSummary({ brandId: id, from, to }),
        funnelReportService.getSummary({ brandId: id, from: prevFrom, to: prevTo }),
      ]);
      const delta = (a: number, b: number) => b === 0 ? null : ((a - b) / b) * 100;
      ok(res, {
        current,
        previous,
        delta: {
          landingViews: delta(current.landingViews, previous.landingViews),
          purchases: delta(current.purchases, previous.purchases),
          netRevenue: delta(current.netRevenue, previous.netRevenue),
          cvr: delta(current.cvr, previous.cvr),
        },
      });
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/share-link/:id
// (REP-01: 영업용 공유 링크 발급 - 간단 해시 기반)
// ============================================
router.post(
  '/share-link',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId, from, to } = req.body;
      if (!campaignId) throw new Error('campaignId required');
      // 간단한 토큰: base64(campaignId|from|to|timestamp)
      const payload = JSON.stringify({ campaignId, from, to, exp: Date.now() + 7 * 86400000 });
      const token = Buffer.from(payload).toString('base64url');
      ok(res, {
        shareUrl: `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/report/share/${token}`,
        expiresIn: '7일',
      });
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/campaign/:id/predict (Phase 3)
// ============================================
router.get(
  '/campaign/:id/predict',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const method = (req.query.method as 'sma' | 'ema') || 'ema';
      const data = await funnelPredictService.predictCampaign(id, method);
      ok(res, data);
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/segments (Phase 3)
// ============================================
router.get(
  '/brand/:id/segments',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dateRange = parseDateRange(req);
      const [newReturning, byDevice, byReferrer] = await Promise.all([
        funnelSegmentService.getNewVsReturning({ brandId: id, ...dateRange }),
        funnelSegmentService.getByDevice({ brandId: id, ...dateRange }),
        funnelSegmentService.getByReferrer({ brandId: id, ...dateRange }),
      ]);
      ok(res, { newReturning, byDevice, byReferrer });
    } catch (e) { next(e); }
  }
);

// ============================================
// GET /api/reports/brand/:id/attribution?model=LAST_TOUCH (Phase 3)
// ============================================
router.get(
  '/brand/:id/attribution',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dateRange = parseDateRange(req);
      const model = (req.query.model as AttributionModel) || 'LAST_TOUCH';
      const data = await funnelAttributionService.getAttributionByModel({
        brandId: id, model, ...dateRange,
      });
      ok(res, { model, distribution: data });
    } catch (e) { next(e); }
  }
);

export default router;

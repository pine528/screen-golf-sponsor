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
import { AuthRequest } from '../types';
import prisma from '../models/prisma';
import { ForbiddenError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function ok(res: Response, data: any) {
  return res.json({ success: true, data, error: null, request_id: (res.req as any).requestId });
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

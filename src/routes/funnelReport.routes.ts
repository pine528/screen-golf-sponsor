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

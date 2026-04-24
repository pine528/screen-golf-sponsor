/**
 * Admin Funnel Routes
 *
 * - 캠페인 자산 발급/관리
 * - 프로모션 코드 CRUD
 * - 트래킹 링크 CRUD
 * - 미니스토어 설정 + 상품 관리
 *
 * 모두 ADMIN 권한 (일부는 BRAND 본인 캠페인 한정 허용)
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { campaignAssetsService } from '../services/campaignAssets.service';
import { promoCodeService } from '../services/promoCode.service';
import { trackingLinkService } from '../services/trackingLink.service';
import { miniStoreService } from '../services/miniStore.service';
import { AuthRequest } from '../types';
import prisma from '../models/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function ok(res: Response, data: any) {
  return res.json({ success: true, data, error: null, request_id: (res.req as any).requestId });
}

// ============================================
// 캠페인 자산 (코드+링크+QR+스토어 일괄)
// ============================================

// POST /api/admin/campaigns/:campaignId/tracking-assets/generate
router.post(
  '/campaigns/:campaignId/tracking-assets/generate',
  authorize('ADMIN', 'BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new NotFoundError('Campaign not found');

      // BRAND는 자사 캠페인만
      if (req.user!.role === 'BRAND') {
        const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
        if (!brand || brand.id !== campaign.brandId) throw new ForbiddenError();
      }

      // 매칭된 선수 = preferredAthletes[0] 또는 contracts에서 첫 번째
      let athleteId: string | undefined = req.body.athlete_id;
      if (!athleteId) {
        const cc = await prisma.campaignContract.findFirst({
          where: { campaignId },
          include: { contract: { select: { athleteId: true } } },
        });
        athleteId = cc?.contract.athleteId;
      }
      if (!athleteId) {
        throw new BadRequestError('athlete_id is required (no matched athlete found)');
      }

      const result = await campaignAssetsService.generate({
        campaignId,
        brandId: campaign.brandId,
        athleteId,
        discountType: req.body.discount_type,
        discountValue: req.body.discount_value,
        validFrom: req.body.valid_from ? new Date(req.body.valid_from) : undefined,
        validTo: req.body.valid_to ? new Date(req.body.valid_to) : undefined,
      });

      ok(res, {
        campaign_id: result.campaignId,
        promo_code: result.promoCode,
        short_url: result.shortUrl,
        brand_mini_store_url: result.brandMiniStoreUrl,
        qr_url: result.qrUrl,
        status: result.status,
      });
    } catch (e) { next(e); }
  }
);

// GET /api/admin/campaigns/:campaignId/tracking-assets
router.get(
  '/campaigns/:campaignId/tracking-assets',
  authorize('ADMIN', 'BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const data = await campaignAssetsService.list(campaignId);
      ok(res, data);
    } catch (e) { next(e); }
  }
);

// ============================================
// 프로모션 코드
// ============================================

// GET /api/admin/promo-codes?campaignId=
router.get('/promo-codes', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) throw new BadRequestError('campaignId is required');
    const data = await promoCodeService.listByCampaign(campaignId as string);
    ok(res, data);
  } catch (e) { next(e); }
});

// GET /api/admin/promo-codes.csv?campaignId=
router.get('/promo-codes.csv', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) throw new BadRequestError('campaignId is required');
    const codes = await promoCodeService.listByCampaign(campaignId as string);
    const headers = ['코드', '할인타입', '할인값', '사용횟수', '상태', '발급일'];
    const rows = codes.map((c) => [c.code, c.discountType, c.discountValue.toString(), c.usageCount.toString(), c.status, new Date(c.createdAt).toISOString().slice(0, 10)]);
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="promo-codes-${campaignId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

// GET /api/admin/tracking-links.csv?campaignId=
router.get('/tracking-links.csv', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) throw new BadRequestError('campaignId is required');
    const links = await trackingLinkService.listByCampaign(campaignId as string);
    const headers = ['단축코드', '콘텐츠ID', '클릭수', '상태', '발급일'];
    const rows = links.map((l) => [l.shortCode, l.contentId || '', l.clickCount.toString(), l.status, new Date(l.createdAt).toISOString().slice(0, 10)]);
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tracking-links-${campaignId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

// POST /api/admin/promo-codes (수동 추가 발급)
router.post('/promo-codes', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = await promoCodeService.generate(req.body);
    ok(res, code);
  } catch (e) { next(e); }
});

// PATCH /api/admin/promo-codes/:id (비활성화)
router.patch('/promo-codes/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.body.status === 'DISABLED') {
      const updated = await promoCodeService.disable(req.params.id);
      return ok(res, updated);
    }
    throw new BadRequestError('Only status:DISABLED is supported');
  } catch (e) { next(e); }
});

// ============================================
// 트래킹 링크
// ============================================

// GET /api/admin/tracking-links?campaignId=
router.get('/tracking-links', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) throw new BadRequestError('campaignId is required');
    const data = await trackingLinkService.listByCampaign(campaignId as string);
    ok(res, data);
  } catch (e) { next(e); }
});

// POST /api/admin/tracking-links (콘텐츠별 추가 발급)
router.post('/tracking-links', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const link = await trackingLinkService.create(req.body);
    ok(res, link);
  } catch (e) { next(e); }
});

// PATCH /api/admin/tracking-links/:id
router.patch('/tracking-links/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.body.status === 'DISABLED') {
      const updated = await trackingLinkService.disable(req.params.id);
      return ok(res, updated);
    }
    throw new BadRequestError('Only status:DISABLED is supported');
  } catch (e) { next(e); }
});

// ============================================
// 미니스토어
// ============================================

// GET /api/admin/mini-stores/:campaignId
router.get('/mini-stores/:campaignId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const store = await miniStoreService.getByCampaign(req.params.campaignId, true);
    if (!store) throw new NotFoundError('Mini store not found');
    ok(res, store);
  } catch (e) { next(e); }
});

// PUT /api/admin/mini-stores/:campaignId (설정 업데이트)
router.put('/mini-stores/:campaignId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await miniStoreService.update(req.params.campaignId, req.body);
    ok(res, updated);
  } catch (e) { next(e); }
});

// PUT /api/admin/mini-stores/:campaignId/publish
router.put('/mini-stores/:campaignId/publish', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.body.status || 'PUBLISHED';
    const updated = await miniStoreService.setStatus(req.params.campaignId, status);
    ok(res, updated);
  } catch (e) { next(e); }
});

// POST /api/admin/mini-stores/:campaignId/products
router.post('/mini-stores/:campaignId/products', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const store = await miniStoreService.getByCampaign(req.params.campaignId);
    if (!store) throw new NotFoundError('Mini store not found');
    const product = await miniStoreService.addProduct({ ...req.body, storeId: store.id });
    ok(res, product);
  } catch (e) { next(e); }
});

// PATCH /api/admin/mini-stores/products/:productId
router.patch('/mini-stores/products/:productId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await miniStoreService.updateProduct(req.params.productId, req.body);
    ok(res, updated);
  } catch (e) { next(e); }
});

// DELETE /api/admin/mini-stores/products/:productId
router.delete('/mini-stores/products/:productId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await miniStoreService.deleteProduct(req.params.productId);
    ok(res, { deleted: true });
  } catch (e) { next(e); }
});

// ============================================
// Admin: 캠페인 목록 (ADM-01용 — 자산 상태 포함)
// ============================================

// GET /api/admin/funnel/campaigns
router.get('/funnel/campaigns', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        brand: { select: { id: true, name: true } },
        promoCodes: { select: { id: true, status: true } },
        trackingLinks: { select: { id: true, status: true } },
        miniStore: { select: { id: true, status: true } },
        contracts: { include: { contract: { include: { athlete: { select: { id: true, name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const data = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      brand: c.brand,
      athletes: c.contracts.map((cc) => cc.contract.athlete),
      status: c.status,
      dateStart: c.dateStart,
      dateEnd: c.dateEnd,
      assetStatus: {
        promoCode: c.promoCodes.some((p) => p.status === 'ACTIVE') ? 'READY' : 'MISSING',
        trackingLink: c.trackingLinks.some((l) => l.status === 'ACTIVE') ? 'READY' : 'MISSING',
        miniStore: c.miniStore?.status || 'MISSING',
      },
    }));
    ok(res, data);
  } catch (e) { next(e); }
});

// PATCH /api/admin/funnel/campaigns/:id/status (캠페인 비활성화/활성화 + 자동 자산 생성)
router.patch('/funnel/campaigns/:id/status', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'GENERATION_FAILED', 'DRAFT'].includes(status)) {
      throw new BadRequestError('Invalid status');
    }
    const before = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!before) throw new NotFoundError('Campaign not found');

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status },
    });

    // ACTIVE 전환 시 자산 자동 생성 (handoff 3-1)
    if (status === 'ACTIVE' && before.status !== 'ACTIVE') {
      const cc = await prisma.campaignContract.findFirst({
        where: { campaignId: req.params.id },
        include: { contract: { select: { athleteId: true } } },
      });
      if (cc?.contract.athleteId) {
        await campaignAssetsService.generate({
          campaignId: req.params.id,
          brandId: before.brandId,
          athleteId: cc.contract.athleteId,
        });
      }
    }
    ok(res, updated);
  } catch (e) { next(e); }
});

// GET /api/admin/funnel/campaigns/:id (상세 - ADM-02용)
router.get('/funnel/campaigns/:id', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        brand: true,
        contracts: { include: { contract: { include: { athlete: true } } } },
      },
    });
    if (!campaign) throw new NotFoundError('Campaign not found');
    const assets = await campaignAssetsService.list(campaign.id);
    ok(res, { campaign, assets });
  } catch (e) { next(e); }
});

// ============================================
// Phase 3: Performance Settlement 결과 조회
// ============================================

// GET /api/admin/funnel/settlements
router.get('/funnel/settlements', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, brandId, from, to } = req.query;
    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (brandId) where.brandId = brandId;
    if (from || to) {
      where.periodStart = {};
      if (from) where.periodStart.gte = new Date(from as string);
      if (to) where.periodStart.lte = new Date(to as string);
    }
    const settlements = await prisma.performanceSettlement.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: 100,
    });
    // 캠페인/브랜드 정보 조인
    const campaignIds = [...new Set(settlements.map((s) => s.campaignId))];
    const brandIds = [...new Set(settlements.map((s) => s.brandId))];
    const [campaigns, brands] = await Promise.all([
      prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } }),
      prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true } }),
    ]);
    const cMap = new Map(campaigns.map((c) => [c.id, c]));
    const bMap = new Map(brands.map((b) => [b.id, b]));
    const enriched = settlements.map((s) => ({
      ...s,
      campaign: cMap.get(s.campaignId),
      brand: bMap.get(s.brandId),
    }));
    ok(res, enriched);
  } catch (e) { next(e); }
});

// ============================================
// 주문 보정 + 귀속 수정 (handoff 8조)
// ============================================

// PATCH /api/admin/funnel/orders/:id (운영자 주문 보정)
router.patch('/funnel/orders/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.funnelOrder.findUnique({ where: { id: req.params.id } });
    if (!order) throw new NotFoundError('Order not found');

    const before = { ...order };
    const updates: any = {};
    const allowedFields = ['grossAmount', 'discountAmount', 'netAmount', 'isNewCustomer', 'status'];
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const updated = await prisma.funnelOrder.update({
      where: { id: req.params.id },
      data: updates,
    });

    await prisma.funnelOrderAuditLog.create({
      data: {
        orderId: order.id,
        adminUserId: req.user!.id,
        action: 'ADJUST_AMOUNT',
        beforeJson: JSON.parse(JSON.stringify(before)),
        afterJson: JSON.parse(JSON.stringify(updated)),
        reason: req.body.reason || null,
      },
    });
    ok(res, updated);
  } catch (e) { next(e); }
});

// POST /api/admin/funnel/orders/:id/reattribute (귀속 수정)
router.post('/funnel/orders/:id/reattribute', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.funnelOrder.findUnique({ where: { id: req.params.id } });
    if (!order) throw new NotFoundError('Order not found');

    const before = { campaignId: order.campaignId, athleteId: order.athleteId, brandId: order.brandId, attributionReason: order.attributionReason };

    const { campaignId, athleteId, brandId, reason } = req.body;
    if (!campaignId || !athleteId || !brandId) {
      throw new BadRequestError('campaignId, athleteId, brandId required');
    }

    const updated = await prisma.funnelOrder.update({
      where: { id: req.params.id },
      data: {
        campaignId, athleteId, brandId,
        attributionReason: 'manual',
        attributionStatus: 'ATTRIBUTED',
      },
    });

    await prisma.funnelOrderAuditLog.create({
      data: {
        orderId: order.id,
        adminUserId: req.user!.id,
        action: 'REATTRIBUTE',
        beforeJson: before,
        afterJson: { campaignId, athleteId, brandId, attributionReason: 'manual' },
        reason: reason || null,
      },
    });
    ok(res, updated);
  } catch (e) { next(e); }
});

// GET /api/admin/funnel/orders/:id/audit-logs
router.get('/funnel/orders/:id/audit-logs', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.funnelOrderAuditLog.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, logs);
  } catch (e) { next(e); }
});

// ============================================
// IMPRESSION_LOGGED 수동 기록 (handoff TABLE 5)
// 기존 ROI 시스템에서 노출 발생 시 호출
// ============================================
router.post('/funnel/impressions', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaign_id, brand_id, athlete_id, content_id, impressions, source_url, occurred_at } = req.body;
    if (!campaign_id || !brand_id || !athlete_id) throw new BadRequestError('campaign_id, brand_id, athlete_id required');

    // 노출 수 만큼 단일 이벤트 1개 생성 (payload에 횟수 기록)
    const event = await prisma.funnelEvent.create({
      data: {
        eventName: 'IMPRESSION_LOGGED',
        campaignId: campaign_id,
        brandId: brand_id,
        athleteId: athlete_id,
        contentId: content_id || null,
        payload: { impressions: Number(impressions || 1), source_url },
        occurredAt: occurred_at ? new Date(occurred_at) : new Date(),
      },
    });
    ok(res, { event_id: event.id, impressions: Number(impressions || 1) });
  } catch (e) { next(e); }
});

// POST /api/admin/funnel/settlements/run (수동 트리거)
router.post('/funnel/settlements/run', authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { funnelSettlementCron } = await import('../cron/funnelSettlement.cron');
    const targetDate = req.body.date ? new Date(req.body.date) : undefined;
    const results = await funnelSettlementCron.runDaily(targetDate);
    ok(res, results);
  } catch (e) { next(e); }
});

export default router;

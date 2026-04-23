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

export default router;

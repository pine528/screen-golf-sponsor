/**
 * External / Pixel / Postback Routes (Phase 2)
 *
 * - 외부 자사몰 JS Pixel 트래킹: POST /api/external/track
 *   - pixel_key 헤더 기반 검증
 *   - 도메인 화이트리스트 검증 (Origin 헤더)
 *
 * - Server-to-Server Postback: POST /api/external/postback/{purchase|refund}
 *   - HMAC-SHA256 서명 (X-Sponpik-Signature)
 *
 * - 픽셀 관리 (Admin): POST /api/external/pixels (브랜드별 키 발급)
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth';
import { funnelOrderService } from '../services/funnelOrder.service';
import { funnelEventService } from '../services/funnelEvent.service';
import { AuthRequest } from '../types';
import prisma from '../models/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();

function ok(res: Response, data: any) {
  return res.json({ success: true, data, error: null, request_id: (res.req as any).requestId });
}

// ============================================
// HMAC 서명 검증 미들웨어 (Postback)
// ============================================
async function verifyHmacSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.get('X-Sponpik-Signature');
    const pixelKey = req.get('X-Sponpik-Pixel-Key');
    if (!signature || !pixelKey) {
      throw new ForbiddenError('Missing signature or pixel key');
    }
    const install = await prisma.pixelInstall.findUnique({ where: { pixelKey } });
    if (!install || install.status !== 'ACTIVE') {
      throw new ForbiddenError('Invalid or inactive pixel key');
    }

    const payloadStr = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', install.secretKey).update(payloadStr).digest('hex');
    if (expected !== signature) {
      throw new ForbiddenError('HMAC signature mismatch');
    }
    (req as any).pixelInstall = install;

    // 마지막 호출 시각 업데이트
    await prisma.pixelInstall.update({
      where: { id: install.id },
      data: { lastSeenAt: new Date(), installedAt: install.installedAt || new Date() },
    });
    next();
  } catch (e) { next(e); }
}

// ============================================
// CORS 도메인 화이트리스트 검증 미들웨어 (Pixel JS)
// ============================================
async function verifyPixelOrigin(req: Request, res: Response, next: NextFunction) {
  try {
    const pixelKey = req.body.pixel_key || req.get('X-Sponpik-Pixel-Key');
    if (!pixelKey) throw new BadRequestError('pixel_key is required');

    const install = await prisma.pixelInstall.findUnique({ where: { pixelKey } });
    if (!install || install.status !== 'ACTIVE') {
      throw new ForbiddenError('Invalid pixel key');
    }

    const origin = req.get('origin') || req.get('referer');
    if (origin && install.domains.length > 0) {
      const url = new URL(origin);
      const hostMatch = install.domains.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`));
      if (!hostMatch) throw new ForbiddenError(`Domain ${url.hostname} not whitelisted`);
    }

    (req as any).pixelInstall = install;
    next();
  } catch (e) { next(e); }
}

// ============================================
// POST /api/external/track (JS Pixel 이벤트 일괄 수신)
// ============================================
router.post('/track', verifyPixelOrigin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const install = (req as any).pixelInstall;
    const { event_name, ...rest } = req.body;

    // 픽셀은 brandId가 install로 결정됨
    const eventBody = { ...rest, brand_id: install.brandId };

    if (event_name === 'purchase') {
      const result = await funnelOrderService.createPurchase({
        externalOrderId: rest.order_id,
        campaignId: rest.campaign_id,
        brandId: install.brandId,
        athleteId: rest.athlete_id,
        promoCode: rest.promo_code,
        grossAmount: Number(rest.gross_amount),
        discountAmount: Number(rest.discount_amount || 0),
        netAmount: Number(rest.net_amount),
        items: rest.items || [],
        sessionId: rest.session_id,
        anonymousId: rest.anonymous_id,
        userId: rest.user_id,
        customerEmail: rest.customer_email,
      });
      return ok(res, { event: 'purchase', orderId: result.order?.id });
    }

    // 일반 이벤트
    const eventNameMap: Record<string, any> = {
      landing_view: 'LANDING_VIEW',
      product_view: 'PRODUCT_VIEW',
      cta_click: 'CTA_CLICK',
      add_to_cart: 'ADD_TO_CART',
      begin_checkout: 'BEGIN_CHECKOUT',
      promo_apply: 'PROMO_APPLY',
    };
    const mapped = eventNameMap[event_name];
    if (!mapped) throw new BadRequestError(`Unknown event_name: ${event_name}`);

    const event = await funnelEventService.record(mapped, {
      campaignId: rest.campaign_id,
      brandId: install.brandId,
      athleteId: rest.athlete_id,
      sessionId: rest.session_id,
      anonymousId: rest.anonymous_id,
      payload: rest,
    });
    ok(res, { event_id: event.id });
  } catch (e) { next(e); }
});

// ============================================
// POST /api/external/postback/purchase (S2S)
// ============================================
router.post('/postback/purchase', verifyHmacSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const install = (req as any).pixelInstall;
    const result = await funnelOrderService.createPurchase({
      externalOrderId: req.body.order_id,
      campaignId: req.body.campaign_id,
      brandId: install.brandId,
      athleteId: req.body.athlete_id,
      promoCode: req.body.promo_code,
      grossAmount: Number(req.body.gross_amount),
      discountAmount: Number(req.body.discount_amount || 0),
      netAmount: Number(req.body.net_amount),
      items: req.body.items || [],
      customerEmail: req.body.customer_email,
      isNewCustomer: req.body.is_new_customer,
    });
    ok(res, {
      purchase_event_id: result.order?.id,
      order_status: result.order?.status?.toLowerCase(),
      attribution_status: result.attribution?.status?.toLowerCase(),
      already_processed: result.alreadyProcessed,
    });
  } catch (e) { next(e); }
});

// ============================================
// POST /api/external/postback/refund (S2S)
// ============================================
router.post('/postback/refund', verifyHmacSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const install = (req as any).pixelInstall;
    const result = await funnelOrderService.refundOrder({
      externalOrderId: req.body.order_id,
      brandId: install.brandId,
      refundAmount: req.body.refund_amount,
      reason: req.body.reason,
    });
    ok(res, {
      order_status: result.order?.status?.toLowerCase(),
      adjusted_net_revenue: result.adjustedNetRevenue,
      already_processed: result.alreadyProcessed,
    });
  } catch (e) { next(e); }
});

// ============================================
// 픽셀 관리 (Admin) - 인증 필요
// ============================================
const adminRouter = Router();
adminRouter.use(authenticate);

// POST /api/external/pixels (브랜드 픽셀 키 발급)
adminRouter.post('/pixels', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let brandId = req.body.brand_id;
    if (req.user!.role === 'BRAND') {
      const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!brand) throw new NotFoundError('Brand profile not found');
      brandId = brand.id;
    }
    if (!brandId) throw new BadRequestError('brand_id is required');

    // 멱등성: 기존 픽셀 있으면 반환
    const existing = await prisma.pixelInstall.findUnique({ where: { brandId } });
    if (existing) return ok(res, existing);

    const pixelKey = `pk_${crypto.randomBytes(16).toString('hex')}`;
    const secretKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const created = await prisma.pixelInstall.create({
      data: {
        brandId, pixelKey, secretKey,
        domains: req.body.domains || [],
      },
    });
    ok(res, created);
  } catch (e) { next(e); }
});

// GET /api/external/pixels/:brandId
adminRouter.get('/pixels/:brandId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let { brandId } = req.params;
    if (req.user!.role === 'BRAND') {
      const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!brand || brand.id !== brandId) throw new ForbiddenError();
    }
    const install = await prisma.pixelInstall.findUnique({ where: { brandId } });
    if (!install) throw new NotFoundError('Pixel not found');
    // BRAND에게는 secretKey 노출하지 않음
    if (req.user!.role === 'BRAND') {
      const { secretKey, ...safe } = install;
      return ok(res, safe);
    }
    ok(res, install);
  } catch (e) { next(e); }
});

// PATCH /api/external/pixels/:brandId (도메인 추가/제거)
adminRouter.patch('/pixels/:brandId', authorize('ADMIN', 'BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { brandId } = req.params;
    if (req.user!.role === 'BRAND') {
      const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!brand || brand.id !== brandId) throw new ForbiddenError();
    }
    const updated = await prisma.pixelInstall.update({
      where: { brandId },
      data: {
        domains: req.body.domains,
        status: req.body.status,
      },
    });
    ok(res, updated);
  } catch (e) { next(e); }
});

// 외부 트래킹 라우터에 admin 라우터 마운트
router.use('/', adminRouter);

export default router;

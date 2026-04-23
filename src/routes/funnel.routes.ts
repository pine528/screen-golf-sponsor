/**
 * Funnel Routes (공개 트래킹 + 이벤트 수집)
 *
 * - 인증 불필요 (공개 픽셀/이벤트 엔드포인트)
 * - rate limit은 상위에서 적용됨
 *
 * Endpoints:
 *   POST /api/tracking/click
 *   POST /api/events/landing-view
 *   POST /api/events/product-view
 *   POST /api/events/cta-click
 *   POST /api/events/add-to-cart
 *   POST /api/events/begin-checkout
 *   POST /api/events/promo-apply
 *   POST /api/events/purchase
 *   POST /api/events/refund
 *   POST /api/events/cancel
 */

import { Router, Request, Response, NextFunction } from 'express';
import { trackingLinkService } from '../services/trackingLink.service';
import { funnelEventService } from '../services/funnelEvent.service';
import { funnelOrderService } from '../services/funnelOrder.service';
import { promoCodeService } from '../services/promoCode.service';
import { FunnelEventType } from '@prisma/client';

const router = Router();

/**
 * Helper: 표준 응답
 */
function ok(res: Response, data: any) {
  return res.json({ success: true, data, error: null, request_id: (res.req as any).requestId });
}
function fail(res: Response, status: number, code: string, message: string, details?: any) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message, details },
    request_id: (res.req as any).requestId,
  });
}

function parseUtm(req: Request): Record<string, string | undefined> {
  // body 우선, 없으면 referer 또는 url에서 파싱
  const body = req.body || {};
  const out: any = {
    utmSource: body.utm_source,
    utmMedium: body.utm_medium,
    utmCampaign: body.utm_campaign,
    utmContent: body.utm_content,
    utmTerm: body.utm_term,
  };
  // 페이지 URL이 함께 전달된 경우 파싱
  const url = body.page_url || body.url || req.get('referer') || '';
  if (url) {
    try {
      const u = new URL(url);
      out.utmSource ??= u.searchParams.get('utm_source') || undefined;
      out.utmMedium ??= u.searchParams.get('utm_medium') || undefined;
      out.utmCampaign ??= u.searchParams.get('utm_campaign') || undefined;
      out.utmContent ??= u.searchParams.get('utm_content') || undefined;
      out.utmTerm ??= u.searchParams.get('utm_term') || undefined;
    } catch {}
  }
  return out;
}

function getMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
    referrer: req.get('referer') || req.body.referrer,
    deviceType: req.body.device_type || (req.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop'),
    ...parseUtm(req),
  };
}

// ============================================
// POST /api/tracking/click
// ============================================
router.post('/tracking/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { short_code, content_id, session_id, anonymous_id } = req.body;
    if (!short_code) return fail(res, 400, 'INVALID_REQUEST', 'short_code is required');

    const result = await trackingLinkService.trackClick({
      shortCode: short_code,
      contentId: content_id,
      sessionId: session_id,
      anonymousId: anonymous_id,
      ...getMeta(req),
    });
    ok(res, {
      redirect_url: result.redirectUrl,
      click_id: result.clickId,
      session_id: result.sessionId,
    });
  } catch (e) { next(e); }
});

// ============================================
// 일반 이벤트 핸들러 팩토리
// ============================================
function eventHandler(eventName: FunnelEventType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      const event = await funnelEventService.record(eventName, {
        campaignId: body.campaign_id,
        brandId: body.brand_id,
        athleteId: body.athlete_id,
        contentId: body.content_id,
        sessionId: body.session_id,
        anonymousId: body.anonymous_id,
        userId: body.user_id,
        promoCode: body.promo_code,
        occurredAt: body.occurred_at ? new Date(body.occurred_at) : undefined,
        payload: {
          product_id: body.product_id,
          cart_id: body.cart_id,
          button_type: body.button_type,
          quantity: body.quantity,
          landing_page_id: body.landing_page_id,
        },
        ...getMeta(req),
      });
      ok(res, { event_id: event.id });
    } catch (e: any) {
      if (e.message?.includes('Missing required attribution')) {
        return fail(res, 422, 'UNPROCESSABLE_ENTITY', e.message);
      }
      next(e);
    }
  };
}

router.post('/events/landing-view', eventHandler('LANDING_VIEW'));
router.post('/events/product-view', eventHandler('PRODUCT_VIEW'));
router.post('/events/cta-click', eventHandler('CTA_CLICK'));
router.post('/events/add-to-cart', eventHandler('ADD_TO_CART'));
router.post('/events/begin-checkout', eventHandler('BEGIN_CHECKOUT'));

// ============================================
// POST /api/events/promo-apply (코드 검증 + 할인액 계산)
// ============================================
router.post('/events/promo-apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promo_code, order_preview_amount, session_id } = req.body;
    if (!promo_code) return fail(res, 400, 'INVALID_REQUEST', 'promo_code is required');

    const result = await promoCodeService.applyCode(promo_code, order_preview_amount || 0);

    // 이벤트 적재 (검증된 코드 = 정상 귀속)
    if (result.applied && result.code) {
      await funnelEventService.record('PROMO_APPLY', {
        campaignId: result.code.campaignId,
        brandId: result.code.brandId,
        athleteId: result.code.athleteId,
        sessionId: session_id,
        promoCode: result.code.code,
        payload: {
          order_preview_amount,
          discount_amount: result.discountAmount,
        },
        ...getMeta(req),
      });
    }
    ok(res, {
      applied: result.applied,
      discount_amount: result.discountAmount,
      message: result.message,
    });
  } catch (e) { next(e); }
});

// ============================================
// POST /api/events/purchase (트랜잭션 + 멱등성)
// ============================================
router.post('/events/purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!body.gross_amount || !body.net_amount) {
      return fail(res, 400, 'INVALID_REQUEST', 'gross_amount and net_amount are required');
    }

    const result = await funnelOrderService.createPurchase({
      externalOrderId: body.order_id,
      campaignId: body.campaign_id,
      brandId: body.brand_id,
      athleteId: body.athlete_id,
      contentId: body.content_id,
      promoCode: body.promo_code,
      grossAmount: Number(body.gross_amount),
      discountAmount: Number(body.discount_amount || 0),
      netAmount: Number(body.net_amount),
      isNewCustomer: body.is_new_customer,
      items: body.items || [],
      sessionId: body.session_id,
      anonymousId: body.anonymous_id,
      userId: body.user_id,
      customerEmail: body.customer_email,
      ...getMeta(req),
    });

    ok(res, {
      purchase_event_id: result.order?.id,
      order_status: result.order?.status?.toLowerCase(),
      attribution_status: result.attribution?.status?.toLowerCase(),
      attribution_reason: result.attribution?.reason,
      already_processed: result.alreadyProcessed,
    });
  } catch (e: any) {
    if (e.message?.includes('Attribution failed')) {
      return fail(res, 422, 'UNPROCESSABLE_ENTITY', e.message);
    }
    next(e);
  }
});

// ============================================
// POST /api/events/refund
// ============================================
router.post('/events/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const result = await funnelOrderService.refundOrder({
      orderId: body.order_id_internal,
      externalOrderId: body.order_id,
      brandId: body.brand_id,
      refundAmount: body.refund_amount,
      reason: body.reason,
      occurredAt: body.occurred_at ? new Date(body.occurred_at) : undefined,
    });
    ok(res, {
      order_status: result.order?.status?.toLowerCase(),
      adjusted_net_revenue: result.adjustedNetRevenue,
      already_processed: result.alreadyProcessed,
    });
  } catch (e) { next(e); }
});

// ============================================
// POST /api/events/cancel
// ============================================
router.post('/events/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const result = await funnelOrderService.cancelOrder({
      orderId: body.order_id_internal,
      externalOrderId: body.order_id,
      brandId: body.brand_id,
      reason: body.reason,
      occurredAt: body.occurred_at ? new Date(body.occurred_at) : undefined,
    });
    ok(res, {
      order_status: result.order?.status?.toLowerCase(),
      already_processed: result.alreadyProcessed,
    });
  } catch (e) { next(e); }
});

export default router;

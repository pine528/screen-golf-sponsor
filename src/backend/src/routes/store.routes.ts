/**
 * Public Mini Store Routes
 *
 * - 공개 미니스토어 데이터 조회 (비회원 접근 가능)
 * - 단축 URL redirect (/s/:shortCode → 미니스토어로)
 *
 * Endpoints:
 *   GET /api/store/brand/:slug
 *   GET /api/store/brand/:slug/products
 *   GET /api/store/short/:shortCode (트래킹 클릭 + redirect)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { miniStoreService } from '../services/miniStore.service';
import { trackingLinkService } from '../services/trackingLink.service';

const router = Router();

function ok(res: Response, data: any) {
  return res.json({ success: true, data, error: null, request_id: (res.req as any).requestId });
}

// GET /api/store/brand/:slug
router.get('/brand/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await miniStoreService.getPublicBySlug(req.params.slug);
    ok(res, store);
  } catch (e) { next(e); }
});

// GET /api/store/brand/:slug/products (alias)
router.get('/brand/:slug/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await miniStoreService.getPublicBySlug(req.params.slug);
    ok(res, store.products);
  } catch (e) { next(e); }
});

// GET /api/store/short/:shortCode (단축링크 정보 + 클릭 기록)
// 실제 redirect는 프론트가 처리 (이 엔드포인트는 메타데이터 + 클릭 트래킹)
router.get('/short/:shortCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = (req.query.session_id as string) || undefined;
    const anonymousId = (req.query.anonymous_id as string) || undefined;
    const result = await trackingLinkService.trackClick({
      shortCode: req.params.shortCode,
      sessionId,
      anonymousId,
      referrer: req.get('referer') || undefined,
      userAgent: req.get('user-agent') || undefined,
      ipAddress: req.ip,
      deviceType: req.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop',
    });
    ok(res, {
      redirect_url: result.redirectUrl,
      session_id: result.sessionId,
      click_id: result.clickId,
    });
  } catch (e) { next(e); }
});

export default router;

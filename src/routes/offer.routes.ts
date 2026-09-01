/**
 * 지금 가능한 후원 API (핸드오프 v1.0 §13.1)
 * 목록·상세·견적은 비로그인 열람, 보관함·장바구니·결제는 브랜드 인증.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  OFFER_TYPES, PURPOSES, BUDGET_BANDS, SECTIONS, ORDER_GROUPS,
  CHECKOUT_HOLD_MINUTES, CART_KEEP_DAYS, CART_KEEP_DAYS_GUEST, APPROVAL_SLA_HOURS,
  listOffers, getSections, getOffer, quoteOffer,
  listSaved, saveOffer, unsaveOffer,
  getCart, addToCart, updateCartItem, removeCartItem, checkoutCart, trackImpressions,
} from '../services/offer.service';

const router = Router();

const ok = (res: Response, data: any, status = 200) =>
  res.status(status).json({ success: true, data, error: null, serverTime: new Date().toISOString() });

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: e?.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'), message: e?.message || '처리에 실패했습니다' },
    data: null,
    retryable: [409, 410].includes(status),
    serverTime: new Date().toISOString(),
  });
};

/** GET /api/available-offers/options — 필터·섹션·주문군 정책 */
router.get('/options', (_req: Request, res: Response) =>
  ok(res, {
    types: OFFER_TYPES,
    purposes: PURPOSES,
    budgets: BUDGET_BANDS,
    sections: SECTIONS,
    orderGroups: ORDER_GROUPS,
    durations: [
      { code: 'SINGLE_EVENT', label: '대회 1회' },
      { code: 'DAYS_30', label: '30일' },
      { code: 'MONTHS_3', label: '3개월' },
      { code: 'MONTHS_6', label: '6개월' },
      { code: 'MONTHS_12', label: '12개월' },
    ],
    modes: [
      { code: 'OFFLINE', label: '오프라인' }, { code: 'ONLINE', label: '온라인' },
      { code: 'CONTENT', label: '콘텐츠' }, { code: 'VISIT', label: '방문' }, { code: 'MARKET', label: '마켓' },
    ],
    states: [
      { code: 'BUY_NOW', label: '바로구매' }, { code: 'NEEDS_APPROVAL', label: '선수확인' },
      { code: 'NEGOTIABLE', label: '협의' }, { code: 'AUCTION', label: '경매' },
      { code: 'ONLINE_ONLY', label: '온라인 전용' }, { code: 'CLOSING', label: '마감임박' },
    ],
    sorts: [
      { code: 'CLOSING', label: '마감임박순' }, { code: 'PRICE_ASC', label: '낮은 가격순' },
      { code: 'RECENT', label: '최신 등록순' }, { code: 'POPULAR', label: '인기순' }, { code: 'DURATION', label: '기간순' },
    ],
    policy: {
      checkoutHoldMinutes: CHECKOUT_HOLD_MINUTES,
      cartKeepDays: CART_KEEP_DAYS,
      cartKeepDaysGuest: CART_KEEP_DAYS_GUEST,
      approvalSlaHours: APPROVAL_SLA_HOURS,
    },
  }));

/** GET /api/available-offers/sections — 랜딩 섹션 */
router.get('/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = (req.query.keys as string)?.split(',').filter(Boolean);
    ok(res, await getSections((req.query.surface as string) || 'SPONSOR_LANDING', keys));
  } catch (e) { next(e); }
});

/** GET /api/available-offers — 목록·필터·정렬 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await listOffers({
      q: req.query.q as string,
      purpose: req.query.purpose as string,
      budget: req.query.budget as string,
      duration: req.query.duration as string,
      mode: req.query.mode as string,
      state: req.query.state as string,
      section: req.query.section as string,
      sort: req.query.sort as string,
      limit: Number(req.query.limit) || 24,
    }));
  } catch (e) { next(e); }
});

/** POST /api/available-offers/impressions — 카드 노출 집계 */
router.post('/impressions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = Array.isArray(req.body?.offerIds) ? req.body.offerIds : [];
    ok(res, await trackImpressions(ids));
  } catch (e) { next(e); }
});

/** GET /api/available-offers/:id — 상세 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getOffer(req.params.id, { countView: true });
    if (!data) return fail(res, Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' }));
    ok(res, data);
  } catch (e) { next(e); }
});

/** POST /api/available-offers/:id/quote — 옵션 가격 */
router.post('/:id/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await quoteOffer({
      offerId: req.params.id,
      quantity: Number(req.body?.quantity) || 1,
      startDate: req.body?.startDate,
      options: req.body?.options || {},
    }));
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

/* ── 보관함 · 장바구니 (별도 라우터로 마운트) ────────── */

export const cartRouter = Router();

cartRouter.get('/saved', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await listSaved(req.user.id)); } catch (e) { next(e); }
});

cartRouter.post('/saved', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await saveOffer(req.user.id, req.body?.offerId), 201); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

cartRouter.delete('/saved/:offerId', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await unsaveOffer(req.user.id, req.params.offerId)); } catch (e) { next(e); }
});

cartRouter.get('/', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getCart(req.user.id)); } catch (e) { next(e); }
});

cartRouter.post('/items', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    if (!b.offerId) return fail(res, Object.assign(new Error('상품을 선택해주세요'), { status: 400, code: 'INVALID_REQUEST' }));
    ok(res, await addToCart(req.user.id, b), 201);
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

cartRouter.patch('/items/:itemId', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await updateCartItem(req.params.itemId, req.user.id, req.body || {})); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

cartRouter.delete('/items/:itemId', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await removeCartItem(req.params.itemId, req.user.id, req.query.keep === '1')); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** POST /api/offer-cart/checkout — 선택 항목을 주문(신청)으로 전환 */
cartRouter.post('/checkout', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await checkoutCart(req.user.id, {
      itemIds: Array.isArray(req.body?.itemIds) ? req.body.itemIds : [],
      brandInfo: req.body?.brandInfo,
    }), 201);
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/**
 * 직접 선택 PICK API (핸드오프 v1.0 §13.1)
 * 탐색·퀵프로필·오퍼·견적은 비로그인 열람 가능, 견적함·홀드·승인요청은 브랜드 인증 필요.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getOptions, listPickAthletes, getQuickProfile, getOffers, quote,
  getOrCreateDraft, getDraft, listDrafts, addItem, updateItem, removeItem,
  extendHolds, validateDraft, suggestAlternatives, submitDraft,
} from '../services/directPick.service';

const router = Router();

/** 응답 공통 필드 (§13.2) */
const ok = (res: Response, data: any, status = 200) =>
  res.status(status).json({
    success: true,
    data,
    error: null,
    serverTime: new Date().toISOString(),
  });

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: e?.code || (status === 409 ? 'CONFLICT' : status === 410 ? 'GONE' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
      message: e?.message || '처리에 실패했습니다',
    },
    data: null,
    retryable: status === 409 || status === 410,
    serverTime: new Date().toISOString(),
  });
};

/* ── 탐색 · 오퍼 (공개) ─────────────────────────────────── */

router.get('/options', (_req: Request, res: Response) => ok(res, getOptions()));

router.get('/athletes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await listPickAthletes({
      q: req.query.q as string,
      tour: req.query.tour as string,
      region: req.query.region as string,
      maxMonthly: Number(req.query.maxMonthly) || undefined,
      mode: req.query.mode as string,
      sort: req.query.sort as string,
      limit: Number(req.query.limit) || 60,
    }));
  } catch (e) { next(e); }
});

/** 퀵프로필 레이어 (§3.3) */
router.get('/athletes/:id/quick-profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getQuickProfile(req.params.id);
    if (!data) return fail(res, Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' }));
    ok(res, data);
  } catch (e) { next(e); }
});

/** 착장 슬롯 + 온라인 상품 (§4) */
router.get('/athletes/:id/offers', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await getOffers(req.params.id)); } catch (e) { next(e); }
});

/** 단건 견적 — 화면 안내용, 결제 권위는 draft validate (§5.6) */
router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    if (!b.athleteId || (!b.slotCode && !b.offerCode)) {
      return fail(res, Object.assign(new Error('선수와 상품을 선택해주세요'), { status: 400, code: 'INVALID_REQUEST' }));
    }
    ok(res, await quote(b));
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/* ── 견적함 (브랜드) ────────────────────────────────────── */

router.get('/drafts', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await listDrafts(req.user.id)); } catch (e) { next(e); }
});

/** 활성 견적함 — 없으면 생성 */
router.post('/drafts', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getOrCreateDraft(req.user.id), 201); } catch (e) { next(e); }
});

router.get('/drafts/:id', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const d = await getDraft(req.params.id, req.user.id);
    if (!d) return fail(res, Object.assign(new Error('견적함을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' }));
    if (d === 'FORBIDDEN') return fail(res, Object.assign(new Error('조회 권한이 없습니다'), { status: 403, code: 'FORBIDDEN' }));
    ok(res, d);
  } catch (e) { next(e); }
});

/** 항목 담기 — hold 15분 생성 (§6.2) */
router.post('/drafts/:id/items', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    if (!b.athleteId || (!b.slotCode && !b.offerCode)) {
      return fail(res, Object.assign(new Error('선수와 상품을 선택해주세요'), { status: 400, code: 'INVALID_REQUEST' }));
    }
    ok(res, await addItem(req.params.id, b, req.user.id, req.get('Idempotency-Key') || b.idempotencyKey), 201);
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.patch('/items/:itemId', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await updateItem(req.params.itemId, req.body || {}, req.user.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.delete('/items/:itemId', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await removeItem(req.params.itemId, req.user.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** 충돌 항목 대체안 (§6.3) */
router.get('/items/:itemId/alternatives', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await suggestAlternatives(req.params.itemId, req.user.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** hold 연장 — 결제 진입 시 1회 (§6.2) */
router.post('/drafts/:id/extend-hold', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await extendHolds(req.params.id, req.user.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** hard validation (§6.1) */
router.post('/drafts/:id/validate', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await validateDraft(req.params.id, req.user.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** 승인 요청 전환 (§8) */
router.post('/drafts/:id/submit', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await submitDraft(req.params.id, req.user.id, req.body?.brandInfo), 201); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

/**
 * 지금 가능한 후원 — 관리자 API (핸드오프 v1.0 §13.1)
 * 전 구간 ADMIN 권한.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  OFFER_TEMPLATES, listAdminOffers, getAlerts, getAdminOffer, createOffer, updateOffer,
  validateOffer, publishOffer, setOfferStatus, duplicateOffer, getBuilderSlots,
  listPlacements, upsertPlacement, removePlacement, getDashboard,
} from '../services/offerAdmin.service';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

const ok = (res: Response, data: any, status = 200) =>
  res.status(status).json({ success: true, data, error: null, serverTime: new Date().toISOString() });

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: e?.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'), message: e?.message || '처리에 실패했습니다' },
    data: null,
    serverTime: new Date().toISOString(),
  });
};

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.email?.split('@')[0] || '관리자' });

/** 템플릿 목록 (§8.1) */
router.get('/templates', (_req: Request, res: Response) => ok(res, { templates: OFFER_TEMPLATES }));

/** 운영 경보 (§11.3) */
router.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await getAlerts()); } catch (e) { next(e); }
});

/** 판매·전환·재고 대시보드 (§11.4) */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await getDashboard({ from: req.query.from as string, to: req.query.to as string })); } catch (e) { next(e); }
});

/** 진열 배치 (§8.3) */
router.get('/placements', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await listPlacements(req.query.surface as string)); } catch (e) { next(e); }
});

router.post('/placements', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await upsertPlacement(req.body || {}, actorOf(req)), 201); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.delete('/placements/:id', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await removePlacement(req.params.id, actorOf(req))); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** 빌더 2단계 — 선수 슬롯 인벤토리와 기간 충돌 */
router.get('/builder/athletes/:athleteId/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await getBuilderSlots(req.params.athleteId, { from: req.query.from as string, to: req.query.to as string }));
  } catch (e) { next(e); }
});

/** 상품 목록 (§11.1) */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await listAdminOffers({
      q: req.query.q as string,
      status: req.query.status as string,
      priceType: req.query.priceType as string,
      athleteId: req.query.athleteId as string,
      owner: req.query.owner as string,
      from: req.query.from as string,
      to: req.query.to as string,
      quick: req.query.quick as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
    }));
  } catch (e) { next(e); }
});

router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await createOffer(req.body || {}, actorOf(req)), 201); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getAdminOffer(req.params.id);
    if (!data) return fail(res, Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' }));
    ok(res, data);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await updateOffer(req.params.id, req.body || {}, actorOf(req))); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.post('/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await validateOffer(req.params.id)); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.post('/:id/publish', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await publishOffer(req.params.id, req.body || {}, actorOf(req))); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.post('/:id/status', async (req: any, res: Response, next: NextFunction) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    if (!['PAUSED', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return fail(res, Object.assign(new Error('상태 값이 올바르지 않습니다'), { status: 400, code: 'INVALID_REQUEST' }));
    }
    ok(res, await setOfferStatus(req.params.id, status as any, req.body?.reason, actorOf(req)));
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

router.post('/:id/duplicate', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await duplicateOffer(req.params.id, actorOf(req)), 201); }
  catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

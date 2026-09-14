/**
 * 디지털 파트너 월 구독 API (핸드오프 v1.0 §8.2)
 * 상품·선수·가격 열람은 비로그인 허용(UX-03), 신청·결제는 브랜드 인증 필요.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listPlans, listDigitalAthletes, getDigitalAthlete, applyDigital,
  getDigitalApplication, reviewDigital, checkoutDigital,
  listBrandSubscriptions, listAthleteDigitalRequests, listAllPlans, updatePlan } from '../services/digitalPartner.service';

const router = Router();

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: e?.message || '처리에 실패했습니다' },
    data: null,
  });
};

/** GET /api/digital-partner/plans — 플랜 목록 (공개) */
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await listPlans(), error: null }); } catch (e) { next(e); }
});

/** 관리자 Pricing Config (v2.1 §9.2) — 가격·수량·포함/미포함의 단일 출처 */
router.get('/admin/plans', authenticate, authorize('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await listAllPlans(), error: null }); } catch (e) { next(e); }
});
router.patch('/admin/plans/:code', authenticate, authorize('ADMIN'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const { reason, ...patch } = req.body || {};
    res.json({ success: true, data: await updatePlan(String(req.params.code), patch, req.user.id, String(reason || '')), error: null });
  } catch (e) { next(e); }
});

/** GET /api/digital-partner/athletes — 모집 중 선수 (공개) */
router.get('/athletes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDigitalAthletes({
      q: req.query.q as string, tour: req.query.tour as string,
      plan: req.query.plan as string, limit: Number(req.query.limit) || 40,
    });
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** GET /api/digital-partner/athletes/:id — 선수·플랜 상세 (공개) */
router.get('/athletes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getDigitalAthlete(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '선수를 찾을 수 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** GET /api/digital-partner/subscriptions — 내 구독 (브랜드) */
router.get('/subscriptions', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await listBrandSubscriptions(req.user.id), error: null }); } catch (e) { next(e); }
});

/** GET /api/digital-partner/athlete/requests — 선수 승인함 */
router.get('/athlete/requests', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await listAthleteDigitalRequests(req.user.id), error: null }); } catch (e) { next(e); }
});

/** POST /api/digital-partner/applications — 구독 신청 (브랜드) */
router.post('/applications', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    if (!b.athleteId || !b.planCode) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: '선수와 플랜을 선택해주세요' }, data: null });
      return;
    }
    const app = await applyDigital({
      athleteId: b.athleteId, planCode: b.planCode, category: b.category, region: b.region,
      homepage: b.homepage, storeCount: Number(b.storeCount) || undefined, logoUrl: b.logoUrl,
      scopes: Array.isArray(b.scopes) ? b.scopes.slice(0, 3) : undefined,
      brandMessage: b.brandMessage,
    }, req.user.id);
    res.status(201).json({ success: true, data: app, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** GET /api/digital-partner/applications/:id */
router.get('/applications/:id', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const app = await getDigitalApplication(req.params.id, req.user.id, req.user.role);
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '신청을 찾을 수 없습니다' }, data: null });
      return;
    }
    if (app === 'FORBIDDEN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '조회 권한이 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data: app, error: null });
  } catch (e) { next(e); }
});

/** POST /api/digital-partner/applications/:id/review — 선수 승인 */
router.post('/applications/:id/review', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const action = String(req.body?.action || '').toUpperCase();
    if (!['APPROVE', 'REVISION', 'REJECT'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: '승인·수정요청·거절 중 하나를 선택해주세요' }, data: null });
      return;
    }
    const app = await reviewDigital(req.params.id, action as any, { id: req.user.id, role: req.user.role }, req.body?.reasonCode, req.body?.comment);
    res.json({ success: true, data: app, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** POST /api/digital-partner/applications/:id/checkout — 계약·첫 결제 */
router.post('/applications/:id/checkout', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await checkoutDigital(req.params.id, req.user.id), error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

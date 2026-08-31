/**
 * 후원 신청·승인·결제 API (핸드오프 v1.0 §14.3)
 */
import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  submitApplication, getApplication, reviewItem, checkoutApplication,
  listAthleteRequests, listBrandApplications,
} from '../services/application.service';

const router = Router();

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: e?.message || '처리에 실패했습니다' },
    data: null,
  });
};

/** POST /api/applications — 추천안으로 신청 (브랜드) */
router.post('/', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const app = await submitApplication(
      {
        sourceId: req.body?.sourceId,
        planKey: req.body?.planKey,
        planName: req.body?.planName,
        durationMonths: Number(req.body?.durationMonths) || 1,
        items: Array.isArray(req.body?.items) ? req.body.items.slice(0, 4) : [],
        snapshot: req.body?.snapshot,
      },
      req.user.id,
    );
    res.status(201).json({ success: true, data: app, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** GET /api/applications — 내 신청 목록 (브랜드) */
router.get('/', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await listBrandApplications(req.user.id), error: null });
  } catch (e) { next(e); }
});

/** GET /api/applications/athlete/requests — 선수 승인함 */
router.get('/athlete/requests', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await listAthleteRequests(req.user.id), error: null });
  } catch (e) { next(e); }
});

/** GET /api/applications/:id — 상세 (브랜드 본인·포함 선수·ADMIN) */
router.get('/:id', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const app = await getApplication(req.params.id, req.user.id, req.user.role);
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

/** POST /api/applications/:id/items/:itemId/review — 선수 승인/수정요청/거절 */
router.post('/:id/items/:itemId/review', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const action = String(req.body?.action || '').toUpperCase();
    if (!['APPROVE', 'REVISION', 'REJECT'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: '승인·수정요청·거절 중 하나를 선택해주세요' }, data: null });
      return;
    }
    const app = await reviewItem(
      req.params.id, req.params.itemId, action as any,
      { id: req.user.id, role: req.user.role },
      req.body?.reasonCode, req.body?.comment,
    );
    res.json({ success: true, data: app, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** POST /api/applications/:id/checkout — 계약·결제 (브랜드) */
router.post('/:id/checkout', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const app = await checkoutApplication(req.params.id, req.user.id, { partial: !!req.body?.partial });
    res.json({ success: true, data: app, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

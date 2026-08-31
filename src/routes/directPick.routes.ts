/**
 * 직접 PICK API — 선수 · 슬롯 · 견적 (리디자인 v2.0)
 * 열람·견적은 비로그인 허용, 신청은 기존 /applications(브랜드 인증)을 쓴다.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { getOptions, listPickAthletes, getPickAthlete, getPickSlots, quote } from '../services/directPick.service';

const router = Router();

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: e?.message || '처리에 실패했습니다' },
    data: null,
  });
};

/** GET /api/direct-pick/options — 기간·유형·추가활동·구매방식 정책 */
router.get('/options', (_req: Request, res: Response) => {
  res.json({ success: true, data: getOptions(), error: null });
});

/** GET /api/direct-pick/athletes — 판매 슬롯 보유 선수 */
router.get('/athletes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listPickAthletes({
      q: req.query.q as string, tour: req.query.tour as string,
      region: req.query.region as string, limit: Number(req.query.limit) || 60,
    });
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** GET /api/direct-pick/athletes/:id — 선수 상세 패널 */
router.get('/athletes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPickAthlete(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '선수를 찾을 수 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** GET /api/direct-pick/athletes/:id/slots — 슬롯 도식·상태·가격 */
router.get('/athletes/:id/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getPickSlots(req.params.id), error: null });
  } catch (e) { next(e); }
});

/** POST /api/direct-pick/quote — 서버 재계산 견적 (§14.4) */
router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    if (!b.athleteId || !b.slotCode) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: '선수와 슬롯을 선택해주세요' }, data: null });
      return;
    }
    const data = await quote({
      athleteId: b.athleteId, slotCode: b.slotCode, durationCode: b.durationCode,
      productType: b.productType, addOns: Array.isArray(b.addOns) ? b.addOns.slice(0, 5) : [],
      transactionType: b.transactionType,
    });
    res.json({ success: true, data, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

export default router;

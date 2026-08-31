/**
 * 추천 PICK API (핸드오프 v1.0 §14.3)
 *
 * 비로그인도 3문항 미리보기까지 허용하고(RP-01), 신청·결제는 기존 브랜드 인증 경로를 쓴다.
 * 결과에는 engineVersion·dataAsOf를 함께 반환한다 (§14.4).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { createRecommendPick, extractFromText } from '../services/recommendPick.service';
import { getMatchRequest } from '../services/aiMatch.service';

const router = Router();

/** POST /api/recommend-pick/extract — 자연어에서 조건 추출 (확인·수정용, 규칙 기반) */
router.post('/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const text = String(req.body?.freeText || '').slice(0, 500);
    res.json({ success: true, data: extractFromText(text), error: null });
  } catch (e) { next(e); }
});

/** POST /api/recommend-pick — 3안 생성 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    if (!body.freeText && !body.objective) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: '후원 목표를 입력해주세요' },
        data: null,
      });
      return;
    }
    const result = await createRecommendPick(
      {
        freeText: typeof body.freeText === 'string' ? body.freeText.slice(0, 500) : undefined,
        objective: body.objective,
        budgetBand: body.budgetBand,
        durationBand: body.durationBand,
        category: body.category,
        targetAges: Array.isArray(body.targetAges) ? body.targetAges.slice(0, 4) : undefined,
        channels: Array.isArray(body.channels) ? body.channels.slice(0, 8) : undefined,
        preferredAthleteIds: Array.isArray(body.preferredAthleteIds) ? body.preferredAthleteIds.slice(0, 10) : undefined,
        excludedAthleteIds: Array.isArray(body.excludedAthleteIds) ? body.excludedAthleteIds.slice(0, 20) : undefined,
        constraints: typeof body.constraints === 'string' ? body.constraints.slice(0, 300) : undefined,
      },
      req.user?.id,
    );
    res.json({ success: true, data: result, error: null });
  } catch (e) { next(e); }
});

/** GET /api/recommend-pick/:id — 저장된 추천 결과 (작성자·ADMIN) */
router.get('/:id', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const r: any = await getMatchRequest(req.params.id);
    if (!r) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '추천 결과를 찾을 수 없습니다' }, data: null });
      return;
    }
    if (r.userId && r.userId !== req.user?.id && req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '조회 권한이 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data: r, error: null });
  } catch (e) { next(e); }
});

export default router;

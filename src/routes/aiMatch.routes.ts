/**
 * AI 간편 매칭 API (핸드오프 v1.0 §9.1)
 *
 * 공개 엔드포인트 — 비로그인 브랜드도 체험 가능. 로그인 시 userId를 함께 기록한다.
 * 추천 결과는 요청 레코드에 스냅샷으로 저장되어 URL 공유/재방문 시 동일하게 재현된다.
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { previewMatch, createMatchRequest, getMatchRequest, AiMatchInput } from '../services/aiMatch.service';

const router = Router();

const BRAND_TYPES = new Set(['BEAUTY', 'FOOD', 'FASHION', 'HEALTH', 'LOCAL', 'ETC']);
const GOALS = new Set(['BRAND_AWARENESS', 'SNS_CONTENT', 'FAN_STORE', 'LONG_TERM', 'EVENT_TEST']);
const METHODS = new Set(['AUCTION', 'DIRECT', 'MONTHLY', 'YEARLY', 'AI_RECOMMEND']);

function parseInput(body: any): { input?: AiMatchInput; error?: string } {
  const { brandType, goals, preferredMethod, preferredAthleteIds, budget, options } = body || {};
  if (!BRAND_TYPES.has(brandType)) return { error: '브랜드 유형을 선택해주세요' };
  if (!Array.isArray(goals) || goals.length === 0 || !goals.every((g) => GOALS.has(g))) return { error: '이용 목적을 선택해주세요' };
  if (!METHODS.has(preferredMethod)) return { error: '선호하는 방식을 선택해주세요' };
  const min = Number(budget?.min), max = Number(budget?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= 0) return { error: '예산 범위를 입력해주세요' };
  if (min > max) return { error: '예산 하한이 상한보다 클 수 없습니다' };
  return {
    input: {
      brandType,
      goals,
      preferredMethod,
      preferredAthleteIds: Array.isArray(preferredAthleteIds) ? preferredAthleteIds.slice(0, 3) : [],
      budget: { min, max },
      options: {
        includeSns: !!options?.includeSns,
        includeGrowthMarket: !!options?.includeGrowthMarket,
        performanceGuarantee50: !!options?.performanceGuarantee50,
      },
    },
  };
}

/** 로그인 토큰이 있으면 userId 추출 (없어도 통과) */
function optionalUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret') as any;
    return decoded?.userId || decoded?.sub;
  } catch {
    return undefined;
  }
}

/** POST /ai-match/preview — 현재 입력값으로 예상 후보 수 */
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input, error } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: error }, data: null });
      return;
    }
    const data = await previewMatch(input);
    res.json({ success: true, data, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /ai-match/requests — 추천 요청 생성 + 결과 반환 */
router.post('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input, error } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: error }, data: null });
      return;
    }
    const data = await createMatchRequest(input, optionalUserId(req));
    res.json({ success: true, data, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** GET /ai-match/requests/:id — 저장된 추천 스냅샷 조회 */
router.get('/requests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getMatchRequest(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '추천 요청을 찾을 수 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

export default router;

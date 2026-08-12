/**
 * AI 간편 매칭 API (핸드오프 v1.0 §9.1 · SIE v2.0)
 *
 * 2026-08-12: 브랜드 회원 전용으로 전환 (사용자 결정).
 *  - preview/requests 생성: BRAND 로그인 필수
 *  - 조회: 요청을 만든 브랜드 본인 또는 ADMIN만 (§13 RBAC)
 *  - brand-context: 가입 브랜드의 업종·최근 요청·협업 이력 → 입력 프리필/개인화
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  previewMatch,
  createMatchRequest,
  getMatchRequest,
  getBrandContext,
  saveBrandProfile,
  setAthletePreference,
  AiMatchInput,
} from '../services/aiMatch.service';
import { analyzeBrandUrls } from '../services/brandAnalyzer.service';

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
  // v3 심층 입력 (전부 선택)
  const { companyName, brandName, brandDescription, currentChannels, audience, desiredActions, recommendationStyle, excludedAthleteIds, brandProfile, portfolioMode } = body || {};
  const STYLES = new Set(['BEST', 'BALANCED', 'DISCOVERY']);
  const PORTFOLIO_MODES = new Set(['AUTO', 'SINGLE', 'MULTI']);
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
      companyName: typeof companyName === 'string' ? companyName.slice(0, 100) : undefined,
      brandName: typeof brandName === 'string' ? brandName.slice(0, 100) : undefined,
      brandDescription: typeof brandDescription === 'string' ? brandDescription.slice(0, 1000) : undefined,
      currentChannels: Array.isArray(currentChannels) ? currentChannels.slice(0, 8) : undefined,
      audience: audience && typeof audience === 'object' ? { ages: audience.ages?.slice?.(0, 4), gender: audience.gender } : undefined,
      desiredActions: Array.isArray(desiredActions) ? desiredActions.slice(0, 3) : undefined,
      recommendationStyle: STYLES.has(recommendationStyle) ? recommendationStyle : undefined,
      excludedAthleteIds: Array.isArray(excludedAthleteIds) ? excludedAthleteIds.slice(0, 20) : undefined,
      portfolioMode: PORTFOLIO_MODES.has(portfolioMode) ? portfolioMode : undefined,
      brandProfile: brandProfile && typeof brandProfile === 'object' ? brandProfile : undefined,
    },
  };
}

/** GET /ai-match/brand-context — 가입 브랜드 정보 기반 프리필/개인화 컨텍스트 */
router.get('/brand-context', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await getBrandContext(req.user.id);
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

/** POST /ai-match/brand-analyze — URL 기반 Brand Analyzer (v3 §4, 규칙 기반) */
router.post('/brand-analyze', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const urls = Array.isArray(req.body?.urls)
      ? req.body.urls.filter((u: any) => typeof u?.url === 'string' && u.url.length < 500).slice(0, 6)
      : [];
    if (urls.length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: '분석할 URL을 입력해주세요' }, data: null });
      return;
    }
    const data = await analyzeBrandUrls(urls);
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

/** POST /ai-match/brand-profile — 사용자가 확인·수정한 Brand Profile 승인 저장 (AC-02) */
router.post('/brand-profile', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const profile = req.body?.profile;
    if (!profile || typeof profile !== 'object') {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: '프로필 내용이 필요합니다' }, data: null });
      return;
    }
    const data = await saveBrandProfile(req.user.id, profile);
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

/** POST /ai-match/feedback — 선수 선호/제외 피드백 (v3 §8, AC-06) */
router.post('/feedback', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const { athleteId, action, reason } = req.body || {};
    if (typeof athleteId !== 'string' || !['PREFER', 'EXCLUDE', 'CLEAR'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'athleteId와 action(PREFER/EXCLUDE/CLEAR)이 필요합니다' }, data: null });
      return;
    }
    const data = await setAthletePreference(req.user.id, athleteId, action, reason);
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

/** POST /ai-match/preview — 현재 입력값으로 예상 후보 수 (브랜드 전용) */
router.post('/preview', authenticate, authorize('BRAND'), async (req: Request, res: Response, next: NextFunction) => {
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

/** POST /ai-match/requests — 추천 요청 생성 + 결과 반환 (브랜드 전용, 브랜드 개인화 반영) */
router.post('/requests', authenticate, authorize('BRAND'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const { input, error } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: error }, data: null });
      return;
    }
    const data = await createMatchRequest(input, req.user.id);
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

/** GET /ai-match/requests/:id — 스냅샷 조회 (작성 브랜드 본인 또는 관리자, §13 RBAC) */
router.get('/requests/:id', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await getMatchRequest(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '추천 요청을 찾을 수 없습니다' }, data: null });
      return;
    }
    const isOwner = data.userId && data.userId === req.user.id;
    if (!isOwner && req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '본인 브랜드의 추천만 조회할 수 있습니다' }, data: null });
      return;
    }
    res.json({ success: true, data, error: null, request_id: req.requestId });
  } catch (e) { next(e); }
});

export default router;

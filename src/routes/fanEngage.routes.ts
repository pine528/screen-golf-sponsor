/**
 * 팬 참여 API — 커뮤니티 · 팬레터 · 브랜드 추천 · 팬온도 (리디자인 v2.0)
 * 열람은 비로그인 허용, 작성·추천은 로그인 필요.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  ENGAGE_RULES, POST_TABS, SUGGEST_CATEGORIES,
  getTemperature, listCommunityAthletes, listPosts, createPost, toggleLike,
  listComments, addComment, suggestBrand, getBrandSuggestionSummary, getMyEngagement,
} from '../services/fanEngage.service';

const router = Router();

const fail = (res: Response, e: any) => {
  const status = e?.status || 500;
  res.status(status).json({
    success: false,
    error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: e?.message || '처리에 실패했습니다' },
    data: null,
  });
};

/** GET /api/fan-engage/rules — 활동별 팬온도·포인트 정책 (공개) */
router.get('/rules', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      rules: Object.entries(ENGAGE_RULES).map(([source, r]) => ({
        source, label: r.label, celsius: r.tempMilli / 1000, points: r.points,
      })),
      tabs: POST_TABS.map((t) => ({ key: t.key, label: t.label })),
      categories: SUGGEST_CATEGORIES,
    },
    error: null,
  });
});

/** GET /api/fan-engage/athletes — 커뮤니티 선수 목록 (팬온도 순) */
router.get('/athletes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listCommunityAthletes({ q: req.query.q as string, limit: Number(req.query.limit) || 24 });
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** GET /api/fan-engage/athletes/:id/temperature — 팬온도 + 구성 */
router.get('/athletes/:id/temperature', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getTemperature(req.params.id, req.user?.id), error: null });
  } catch (e) { next(e); }
});

/** GET /api/fan-engage/athletes/:id/posts?tab= — 커뮤니티 글 */
router.get('/athletes/:id/posts', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await listPosts(req.params.id, (req.query.tab as string) || 'ALL', req.user);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '선수를 찾을 수 없습니다' }, data: null });
      return;
    }
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** POST /api/fan-engage/athletes/:id/posts — 응원 글 · 팬레터 */
router.post('/athletes/:id/posts', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await createPost(
      { athleteId: req.params.id, type: req.body?.type, content: req.body?.content, imageUrl: req.body?.imageUrl },
      { id: req.user.id, role: req.user.role },
    );
    res.status(201).json({ success: true, data, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** POST /api/fan-engage/posts/:postId/like — 좋아요 토글 */
router.post('/posts/:postId/like', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await toggleLike(req.params.postId, req.user.id), error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** GET /api/fan-engage/posts/:postId/comments */
router.get('/posts/:postId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await listComments(req.params.postId), error: null });
  } catch (e) { next(e); }
});

/** POST /api/fan-engage/posts/:postId/comments */
router.post('/posts/:postId/comments', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await addComment(req.params.postId, req.body?.content, { id: req.user.id });
    res.status(201).json({ success: true, data, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** GET /api/fan-engage/athletes/:id/brand-suggestions — 추천 집계 */
router.get('/athletes/:id/brand-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getBrandSuggestionSummary(req.params.id), error: null });
  } catch (e) { next(e); }
});

/** POST /api/fan-engage/athletes/:id/brand-suggestions — 브랜드 추천 */
router.post('/athletes/:id/brand-suggestions', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await suggestBrand(
      { athleteId: req.params.id, category: req.body?.category, brandName: req.body?.brandName, reason: req.body?.reason },
      { id: req.user.id },
    );
    res.status(201).json({ success: true, data, error: null });
  } catch (e: any) { if (e?.status) return fail(res, e); next(e); }
});

/** GET /api/fan-engage/me — 내 팬포인트·응원 요약 */
router.get('/me', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getMyEngagement(req.user.id), error: null });
  } catch (e) { next(e); }
});

export default router;

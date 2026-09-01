/**
 * 팬 참여 v1.0 API (핸드오프 v1.0 2026-08-22 §18)
 * 허브 · Fan VOTE · 팬온도 · 팬포인트 · 응원편지 · 연말 캠페인 · 내 팬활동
 * 열람은 비로그인 허용, 참여·작성은 로그인 필요.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  VOTE_TYPES, RESULT_POLICIES, AD_CRITERIA,
  getHub, listVotes, getVote, submitBallot, sendLetter, getLetterQuota,
  getMyActivity, getAdCampaign,
} from '../services/fanHub.service';
import {
  EARN_RULES, SPEND_RULES, BADGES, POINT_EXPIRY_MONTHS,
  getMyPoints, getLedger,
} from '../services/fanPoint.service';
import * as brandSuggest from '../services/fanBrandSuggest.service';
import * as fanStore from '../services/fanStore.service';
import {
  COMPONENTS, TIERS, FORMULA_VERSION,
  getTemperatureView, getMyContributions, runDailySnapshot,
} from '../services/fanTemperature.service';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });

/** GET /api/fan-hub/meta — 정책표 (공개) */
router.get('/meta', (_req: Request, res: Response) => {
  ok(res, {
    voteTypes: VOTE_TYPES,
    resultPolicies: RESULT_POLICIES,
    earnRules: EARN_RULES,
    spendRules: SPEND_RULES,
    badges: BADGES,
    pointExpiryMonths: POINT_EXPIRY_MONTHS,
    temperature: { components: COMPONENTS, tiers: TIERS, formulaVersion: FORMULA_VERSION },
    adCriteria: AD_CRITERIA,
  });
});

/** GET /api/fan-hub — F01 팬 참여 랜딩 */
router.get('/', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getHub(req.user?.id)); } catch (e) { next(e); }
});

/* ── Fan VOTE ─────────────────────────────────────── */

/** GET /api/fan-hub/votes — F02 */
router.get('/votes', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await listVotes({
      tab: req.query.tab as string,
      athleteId: req.query.athleteId as string,
      type: req.query.type as string,
      sort: req.query.sort as string,
      limit: Number(req.query.limit) || 30,
      userId: req.user?.id,
    }));
  } catch (e) { next(e); }
});

/** GET /api/fan-hub/votes/:id — F03 · F04 */
router.get('/votes/:id', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await getVote(req.params.id, req.user?.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '투표를 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

/** POST /api/fan-hub/votes/:id/ballot — 투표 제출 */
router.post('/votes/:id/ballot', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await submitBallot(req.params.id, req.user.id, req.body?.answer);
    ok(res, { ...result, vote: await getVote(req.params.id, req.user.id) });
  } catch (e) { next(e); }
});

/* ── 팬온도 ───────────────────────────────────────── */

/** GET /api/fan-hub/athletes/:id/temperature — F07 */
router.get('/athletes/:id/temperature', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getTemperatureView(req.params.id, { userId: req.user?.id })); } catch (e) { next(e); }
});

/** GET /api/fan-hub/me/contributions — F08 */
router.get('/me/contributions', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getMyContributions(req.user.id)); } catch (e) { next(e); }
});

/* ── 팬포인트 ─────────────────────────────────────── */

/** GET /api/fan-hub/me/points — F09 */
router.get('/me/points', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getMyPoints(req.user.id)); } catch (e) { next(e); }
});

/** GET /api/fan-hub/me/point-ledger — F10 */
router.get('/me/point-ledger', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await getLedger(req.user.id, {
      kind: req.query.kind as string,
      from: req.query.from as string,
      to: req.query.to as string,
      athleteId: req.query.athleteId as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
    }));
  } catch (e) { next(e); }
});

/* ── 응원편지 (F06) ───────────────────────────────── */

router.get('/me/letter-quota', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getLetterQuota(req.user.id)); } catch (e) { next(e); }
});

router.post('/athletes/:id/letters', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await sendLetter({
      userId: req.user.id,
      athleteId: req.params.id,
      title: req.body?.title,
      content: req.body?.content,
      isPublic: req.body?.isPublic !== false,
      imageUrl: req.body?.imageUrl,
    }));
  } catch (e) { next(e); }
});

/* ── 브랜드 추천 (F14 · §9.1) ─────────────────────── */

router.get('/brand-suggest/options', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await brandSuggest.getOptions(req.user?.id)); } catch (e) { next(e); }
});

router.get('/me/brand-suggestions', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await brandSuggest.listMine(req.user.id)); } catch (e) { next(e); }
});

router.get('/athletes/:id/brand-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await brandSuggest.summaryFor(req.params.id)); } catch (e) { next(e); }
});

router.post('/athletes/:id/brand-suggestions', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await brandSuggest.create({
      userId: req.user.id,
      athleteId: req.params.id,
      category: req.body?.category,
      brandName: req.body?.brandName,
      reason: req.body?.reason,
      interest: req.body?.interest,
      isPublic: req.body?.isPublic,
    }));
  } catch (e) { next(e); }
});

/* ── 팬스토어 (F11~F13 · §8) ──────────────────────── */

/** GET /api/fan-hub/stores — F11 */
router.get('/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await fanStore.listStores({
      athleteId: req.query.athleteId as string,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

/** GET /api/fan-hub/stores/:idOrSlug — F12 */
router.get('/stores/:idOrSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await fanStore.getStore(req.params.idOrSlug);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '스토어를 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

/** GET /api/fan-hub/store-products/:id — F13 */
router.get('/store-products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await fanStore.getProduct(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '상품을 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

/** POST /api/fan-hub/stores/:id/exit — 외부몰 이동 (click_id 발급) */
router.post('/stores/:id/exit', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await fanStore.trackExit({
      storeId: req.params.id,
      productId: req.body?.productId,
      userId: req.user?.id,
    }));
  } catch (e) { next(e); }
});

/** GET /api/fan-hub/me/store-exits — 내 외부몰 이동 내역 */
router.get('/me/store-exits', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await fanStore.myExits(req.user.id)); } catch (e) { next(e); }
});

/** POST /api/fan-hub/store-postback — 브랜드 구매확정 회신 (관리자/연동) */
router.post('/store-postback', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '권한이 없습니다' }, data: null });
      return;
    }
    ok(res, await fanStore.confirmPurchase({
      clickId: req.body?.clickId,
      amount: Number(req.body?.amount) || 0,
    }));
  } catch (e) { next(e); }
});

/* ── 연말 캠페인 (F15) · 내 팬활동 (F16) ──────────── */

router.get('/campaign', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getAdCampaign(req.user?.id)); } catch (e) { next(e); }
});

router.get('/me/activity', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await getMyActivity(req.user.id)); } catch (e) { next(e); }
});

/** POST /api/fan-hub/admin/temperature-snapshot — 일배치 수동 실행 */
router.post('/admin/temperature-snapshot', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '관리자만 실행할 수 있습니다' }, data: null });
      return;
    }
    ok(res, await runDailySnapshot());
  } catch (e) { next(e); }
});

export default router;

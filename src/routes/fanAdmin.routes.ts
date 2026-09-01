/**
 * 팬 운영 관리자 API (핸드오프 v1.0 2026-08-22 §18.2 A01~A12)
 * 전 구간 ADMIN 전용. 조치성 요청은 서비스 계층에서 감사 로그를 남긴다.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as adm from '../services/fanAdmin.service';
import * as ops from '../services/fanAdminOps.service';
import { runDailySnapshot } from '../services/fanTemperature.service';
import { confirmPending, expirePoints } from '../services/fanPoint.service';
import { confirmPurchase } from '../services/fanStore.service';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });

/** 전 구간 관리자 전용 */
router.use(authenticate, (req: any, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '관리자만 접근할 수 있습니다' }, data: null });
    return;
  }
  next();
});

/* ── A01 대시보드 ───────────────────────────────────── */
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await adm.getDashboard()); } catch (e) { next(e); }
});

/* ── A02 VOTE 목록 · 캘린더 ─────────────────────────── */
router.get('/votes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listVotes({
      status: req.query.status as string,
      athleteId: req.query.athleteId as string,
      q: req.query.q as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
    }));
  } catch (e) { next(e); }
});

/* ── A03 VOTE 결과 확정 ─────────────────────────────── */
router.get('/votes/:id/settlement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getVoteSettlement(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '투표를 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

/* ── A04 콘텐츠 검수함 ──────────────────────────────── */
router.get('/moderation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listModeration({
      tab: req.query.tab as string,
      risk: req.query.risk as string,
      status: req.query.status as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.get('/moderation/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getModerationItem(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '항목을 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/moderation/:id/decide', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.decideModeration({
      id: req.params.id,
      decision: req.body?.decision,
      reason: req.body?.reason,
      note: req.body?.note,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/moderation/bulk-approve', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.bulkApproveModeration(req.body?.ids ?? [], req.user.id, req.body?.reason ?? '오탐 (정상 콘텐츠)'));
  } catch (e) { next(e); }
});

/* ── A05 신고 · 제재 · 이의제기 ─────────────────────── */
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listReports({
      tab: req.query.tab as string,
      risk: req.query.risk as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.get('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getReport(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '신고를 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/sanctions', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.createSanction({
      reportId: req.body?.reportId,
      userId: req.body?.userId,
      level: req.body?.level,
      days: req.body?.days ? Number(req.body.days) : undefined,
      reason: req.body?.reason,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/sanctions/:id/approve', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.approveSanction(req.params.id, req.user.id)); } catch (e) { next(e); }
});

router.post('/appeals/:id/decide', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.decideAppeal({
      id: req.params.id,
      decision: req.body?.decision,
      note: req.body?.note,
      days: req.body?.days ? Number(req.body.days) : undefined,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── A06 팬온도 산식 · 스냅샷 ───────────────────────── */
router.get('/formula', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await ops.getFormulaView(req.query.athleteId as string)); } catch (e) { next(e); }
});

router.post('/formula/publish', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.publishFormula({
      version: req.body?.version,
      weights: req.body?.weights ?? {},
      minSample: req.body?.minSample ? Number(req.body.minSample) : undefined,
      windowDays: req.body?.windowDays ? Number(req.body.windowDays) : undefined,
      recentBoost: req.body?.recentBoost ? Number(req.body.recentBoost) : undefined,
      note: req.body?.note,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/formula/exclude-events', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.excludeEvents({
      eventIds: req.body?.eventIds ?? [], reason: req.body?.reason, adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── A07 포인트 정책 · 캠페인 ───────────────────────── */
router.get('/point-policy', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await ops.getPointPolicy()); } catch (e) { next(e); }
});

router.post('/point-policy/publish', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.publishPointPolicy({
      version: req.body?.version,
      earnRules: req.body?.earnRules,
      spendRules: req.body?.spendRules,
      expiry: req.body?.expiry,
      summary: req.body?.summary,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/point-campaigns', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await ops.upsertCampaign({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

/* ── A08 포인트 조정 · 원장 ─────────────────────────── */
router.get('/point-ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.getPointLedgerAdmin({
      q: req.query.q as string,
      type: req.query.type as string,
      status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    }));
  } catch (e) { next(e); }
});

router.post('/point-adjustments', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.requestAdjustment({
      userId: req.body?.userId,
      delta: Number(req.body?.delta) || 0,
      reason: req.body?.reason,
      caseId: req.body?.caseId,
      evidenceUrl: req.body?.evidenceUrl,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/point-adjustments/:id/approve', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await ops.approveAdjustment(req.params.id, req.user.id)); } catch (e) { next(e); }
});

router.post('/point-adjustments/:id/reject', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await ops.rejectAdjustment(req.params.id, req.user.id, req.body?.reason)); } catch (e) { next(e); }
});

/* ── A09 팬스토어 · 외부몰 · 코드 ───────────────────── */
router.get('/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.listStoresAdmin({ status: req.query.status as string, q: req.query.q as string }));
  } catch (e) { next(e); }
});

router.get('/stores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ops.getStoreAdmin(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '스토어를 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/stores', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await ops.upsertStore({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

/* ── A10 주문 · 환불 · 정산 ─────────────────────────── */
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.getOrdersView({ from: req.query.from as string, to: req.query.to as string }));
  } catch (e) { next(e); }
});

router.post('/orders/postback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await confirmPurchase({ clickId: req.body?.clickId, amount: Number(req.body?.amount) || 0 }));
  } catch (e) { next(e); }
});

/* ── A11 브랜드 추천 파이프라인 ─────────────────────── */
router.get('/brand-suggestions', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await ops.getSuggestionBoard()); } catch (e) { next(e); }
});

router.get('/brand-suggestions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ops.getSuggestion(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '추천을 찾을 수 없습니다' }, data: null });
      return;
    }
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/brand-suggestions/:id/move', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await ops.moveSuggestion({
      id: req.params.id, status: req.body?.status, note: req.body?.note, adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── A12 통합 성과 리포트 ───────────────────────────── */
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.getReport12({ from: req.query.from as string, to: req.query.to as string }));
  } catch (e) { next(e); }
});

/* ── 배치 수동 실행 (A01 · A06) ─────────────────────── */
router.post('/batch/:job/run', async (req: any, res: Response, next: NextFunction) => {
  try {
    const job = req.params.job;
    const started = Date.now();
    let result: any;
    if (job === 'FAN_TEMPERATURE') result = await runDailySnapshot();
    else if (job === 'POINT_CONFIRM') result = await confirmPending({ before: new Date(Date.now() - 86400_000) });
    else if (job === 'POINT_EXPIRY') result = await expirePoints();
    else {
      res.status(400).json({ success: false, error: { code: 'UNKNOWN_JOB', message: '알 수 없는 배치입니다' }, data: null });
      return;
    }
    await adm.logAdmin(req.user.id, 'FAN_BATCH_RUN', 'FAN_BATCH', job, '수동 실행', result);
    ok(res, { job, durationMs: Date.now() - started, result });
  } catch (e) { next(e); }
});

export default router;

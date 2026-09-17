/**
 * 소개 운영 관리자 API IA01~IA14 (핸드오프 v1.0 2026-08-22 §20)
 * 전 구간 ADMIN 전용. 모든 조치는 서비스 계층에서 감사 로그를 남긴다.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as adm from '../services/aboutAdmin.service';
import { seedAboutPartners } from '../services/aboutDemo.service';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });
const notFound = (res: Response, message: string) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message }, data: null });

router.use(authenticate, (req: any, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '관리자만 접근할 수 있습니다' }, data: null });
    return;
  }
  next();
});

/* ── IA01 대시보드 ──────────────────────────────────── */
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await adm.getDashboard()); } catch (e) { next(e); }
});

/* ── IA02 페이지 · 메뉴 CMS ─────────────────────────── */
router.get('/pages', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await adm.listPages()); } catch (e) { next(e); }
});

router.get('/pages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getPageAdmin(req.params.id);
    if (!data) return notFound(res, '페이지를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/pages', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.savePage({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

router.post('/pages/:id/publish', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.publishPage(req.params.id, req.user.id, req.body?.scheduledAt)); } catch (e) { next(e); }
});

/* ── IA03 · IA04 매칭사례 ───────────────────────────── */
router.get('/cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listCasesAdmin({
      status: req.query.status as string,
      assignee: req.query.assignee as string,
      brand: req.query.brand as string,
      q: req.query.q as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.get('/cases/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getCaseAdmin(req.params.id);
    if (!data) return notFound(res, '사례를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/cases', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.saveCase({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

router.post('/cases/:id/move', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.moveCaseState({
      id: req.params.id, to: req.body?.to, reason: req.body?.reason,
      scheduledAt: req.body?.scheduledAt, adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.get('/cases/:id/gate', async (req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await adm.publishGate(req.params.id)); } catch (e) { next(e); }
});

/* ── IA05 공개범위 · 근거 검수 ──────────────────────── */
router.get('/cases/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getEvidenceReview(req.params.id);
    if (!data) return notFound(res, '사례를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/metrics/:id/review', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.reviewMetric({
      metricId: req.params.id,
      visibility: req.body?.visibility,
      verificationStatus: req.body?.verificationStatus,
      sourceName: req.body?.sourceName,
      sourceType: req.body?.sourceType,
      evidenceUri: req.body?.evidenceUri,
      note: req.body?.note,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── IA06 당사자 승인 ───────────────────────────────── */
router.get('/cases/:id/approval', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getCaseApproval(req.params.id);
    if (!data) return notFound(res, '사례를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/cases/:id/approval/request', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.requestApproval(req.params.id, req.user.id, req.body?.parties)); } catch (e) { next(e); }
});

router.post('/cases/:id/approval/record', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.recordApproval({
      caseId: req.params.id, party: req.body?.party, status: req.body?.status,
      comment: req.body?.comment, itemStatus: req.body?.itemStatus, adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── IA07 성과보장 정책 ─────────────────────────────── */
router.get('/policies', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await adm.listPolicies()); } catch (e) { next(e); }
});

router.get('/policies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getPolicy(req.params.id);
    if (!data) return notFound(res, '정책을 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/policies', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.savePolicy({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

router.post('/policies/:id/legal-approve', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.approvePolicyLegal(req.params.id, req.user.id, req.body?.note)); } catch (e) { next(e); }
});

router.post('/policies/:id/activate', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.activatePolicy(req.params.id, req.user.id)); } catch (e) { next(e); }
});

/* ── IA08 성과보장 판정 ─────────────────────────────── */
router.get('/judgements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listJudgements({
      status: req.query.status as string,
      q: req.query.q as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.get('/judgements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getJudgement(req.params.id);
    if (!data) return notFound(res, '계약을 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/observations/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.updateObservation({
      id: req.params.id,
      actual: req.body?.actual === undefined ? undefined : (req.body.actual === null ? null : Number(req.body.actual)),
      collectStatus: req.body?.collectStatus,
      excludeReason: req.body?.excludeReason,
      sourceName: req.body?.sourceName,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/judgements/:id/finalize', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.finalizeJudgement({ id: req.params.id, adminId: req.user.id, note: req.body?.note })); } catch (e) { next(e); }
});

/* ── IA09 이의제기 · 보완지원 ───────────────────────── */
router.get('/appeals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listAppeals({
      status: req.query.status as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.post('/appeals/:id/decide', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.decideAppeal({
      id: req.params.id,
      decisionType: req.body?.decisionType,
      decisionCode: req.body?.decisionCode,
      note: req.body?.note,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

router.post('/remedies', async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.issueRemedy({
      snapshotId: req.body?.snapshotId,
      ratio: Number(req.body?.ratio) || 0,
      capAmount: Number(req.body?.capAmount) || 0,
      validMonths: req.body?.validMonths ? Number(req.body.validMonths) : undefined,
      note: req.body?.note,
      approverId: req.body?.approverId,
      adminId: req.user.id,
    }));
  } catch (e) { next(e); }
});

/* ── IA10 브랜드 CMS ────────────────────────────────── */
router.get('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listBrandsAdmin({
      status: req.query.status as string,
      category: req.query.category as string,
      q: req.query.q as string,
    }));
  } catch (e) { next(e); }
});

router.get('/brands/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adm.getBrandAdmin(req.params.id);
    if (!data) return notFound(res, '브랜드를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

/** POST /api/admin/about/seed-partners — 구 소개 페이지의 파트너 브랜드 로고 10종 · 실측 사례 2건을 레코드로 (멱등) */
router.post('/seed-partners', async (_req: any, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await seedAboutPartners(), error: null }); } catch (e) { next(e); }
});

router.post('/brands', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.saveBrand({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

router.post('/brands/:id/publish', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.publishBrand(req.params.id, req.user.id)); } catch (e) { next(e); }
});

/* ── IA13 권리 · 만료 큐 ────────────────────────────── */
router.get('/rights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.listRights({
      assetType: req.query.assetType as string,
      holderType: req.query.holderType as string,
      status: req.query.status as string,
      q: req.query.q as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

router.post('/rights', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.saveRight({ ...req.body, adminId: req.user.id })); } catch (e) { next(e); }
});

router.post('/rights/sweep', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await adm.sweepRights(req.user.id)); } catch (e) { next(e); }
});

/* ── IA12 분석 · SEO ────────────────────────────────── */
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.getAnalytics({ from: req.query.from as string, to: req.query.to as string }));
  } catch (e) { next(e); }
});

/* ── IA14 감사로그 ──────────────────────────────────── */
router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await adm.getAuditLogs({
      from: req.query.from as string,
      to: req.query.to as string,
      actor: req.query.actor as string,
      action: req.query.action as string,
      entity: req.query.entity as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    }));
  } catch (e) { next(e); }
});

export default router;

/**
 * SPONPIK 소개 공개 API (핸드오프 v1.0 2026-08-22 §12.3)
 * 대부분 비로그인 열람 가능. 공개등급에 따라 응답에서 값을 빼거나 라벨로 바꾼다.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import * as about from '../services/about.service';
import * as guarantee from '../services/guarantee.service';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });
const notFound = (res: Response, message: string) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message }, data: null });

/** 브랜드 계정 id 를 뷰어 컨텍스트로 넘긴다 (PARTY_ONLY 판정용) */
async function viewerOf(req: any) {
  if (!req.user?.id) return undefined;
  if (req.user.role !== 'BRAND') return { id: req.user.id, role: req.user.role };
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const brand = await prisma.brand.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  return { id: req.user.id, role: req.user.role, brandId: brand?.id };
}

/* ── 메타 · 페이지 ──────────────────────────────────── */

router.get('/meta', (_req: Request, res: Response) => ok(res, about.getMeta()));

router.get('/pages/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await about.getPage(req.params.slug);
    if (!data) return notFound(res, '페이지를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

/* ── 매칭사례 ───────────────────────────────────────── */

router.get('/cases', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await about.listCases({
      sport: req.query.sport as string,
      tour: req.query.tour as string,
      sponsorType: req.query.sponsorType as string,
      category: req.query.category as string,
      objective: req.query.objective as string,
      brandSlug: req.query.brand as string,
      sort: req.query.sort as string,
      q: req.query.q as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 12,
    }, await viewerOf(req)));
  } catch (e) { next(e); }
});

router.get('/cases/:slug', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await about.getCase(req.params.slug, await viewerOf(req));
    if (!data) return notFound(res, '사례를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

/** 성과 근거 레이어 (IU04) */
router.get('/metrics/:id/evidence', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await about.getMetricEvidence(req.params.id, await viewerOf(req));
    if (!data) return notFound(res, '지표를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

/* ── 브랜드 ─────────────────────────────────────────── */

router.get('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await about.listBrands({
      category: req.query.category as string,
      q: req.query.q as string,
      hasStore: req.query.hasStore as string,
      status: req.query.status as string,
      sponsorType: req.query.sponsorType as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 12,
    }));
  } catch (e) { next(e); }
});

router.get('/brands/:slug', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await about.getBrand(req.params.slug, await viewerOf(req));
    if (!data) return notFound(res, '브랜드를 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

/* ── 성과보장 ───────────────────────────────────────── */

router.get('/guarantee/policy', async (_req: Request, res: Response, next: NextFunction) => {
  try { ok(res, await guarantee.getPublicPolicy()); } catch (e) { next(e); }
});

/** 내 보장 현황 (IU06) — 브랜드 전용 */
router.get('/me/guarantees', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const v = await viewerOf(req);
    if (!v?.brandId) {
      res.status(403).json({ success: false, error: { code: 'BRAND_ONLY', message: '브랜드 계정만 확인할 수 있습니다' }, data: null });
      return;
    }
    ok(res, await guarantee.getMyGuarantees(v.brandId));
  } catch (e) { next(e); }
});

/** 이의제기 작성 컨텍스트 (IU07) */
router.get('/me/guarantees/:id/appeal', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const v = await viewerOf(req);
    if (!v?.brandId) {
      res.status(403).json({ success: false, error: { code: 'BRAND_ONLY', message: '브랜드 계정만 확인할 수 있습니다' }, data: null });
      return;
    }
    const data = await guarantee.getAppealContext(req.params.id, v.brandId);
    if (!data) return notFound(res, '대상 계약을 찾을 수 없습니다');
    ok(res, data);
  } catch (e) { next(e); }
});

router.post('/me/guarantees/:id/appeal', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const v = await viewerOf(req);
    if (!v?.brandId) {
      res.status(403).json({ success: false, error: { code: 'BRAND_ONLY', message: '브랜드 계정만 신청할 수 있습니다' }, data: null });
      return;
    }
    ok(res, await guarantee.submitAppeal({
      snapshotId: req.params.id,
      brandId: v.brandId,
      brandUserId: req.user.id,
      reason: req.body?.reason,
      evidenceTypes: req.body?.evidenceTypes,
      attachments: req.body?.attachments,
      attested: !!req.body?.attested,
    }));
  } catch (e) { next(e); }
});

/* ── 분석 이벤트 (§13.1) ────────────────────────────── */

router.post('/events', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    ok(res, await about.trackEvent({
      event: req.body?.event,
      pageSlug: req.body?.pageSlug,
      visitorKey: req.body?.visitorKey,
      role: req.user?.role,
      params: req.body?.params,
    }));
  } catch (e) { next(e); }
});

export default router;

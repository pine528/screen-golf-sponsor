/**
 * 개편 Phase 6 — 이행·증빙 API (OPS-01~08, REP-01)
 */
import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { deliverableService } from '../services/deliverable.service';
import { brandService } from '../services/brand.service';
import { athleteService } from '../services/athlete.service';
import { ForbiddenError } from '../utils/errors';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });

async function actorOf(req: AuthRequest) {
  const role = req.user!.role;
  if (role === 'BRAND') {
    const brand = await brandService.findByUserId(req.user!.id);
    return { id: req.user!.id, role, brandId: brand.id };
  }
  if (role === 'ATHLETE') {
    const athlete = await athleteService.findByUserId(req.user!.id);
    return { id: req.user!.id, role, athleteId: athlete.id };
  }
  return { id: req.user!.id, role };
}

/** @route GET /deliverables — 역할별 이행 항목 목록 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    const proposalId = req.query.proposalId as string | undefined;
    if (actor.role === 'ATHLETE') return ok(res, await deliverableService.list({ athleteId: actor.athleteId, proposalId }));
    if (actor.role === 'BRAND') return ok(res, await deliverableService.list({ brandId: actor.brandId, proposalId }));
    if (actor.role === 'ADMIN') return ok(res, await deliverableService.list({ proposalId }));
    throw new ForbiddenError('조회 권한이 없습니다');
  } catch (e) { next(e); }
});

/** @route GET /deliverables/summary — 이행 현황 요약 (검증/미검증 구분) */
router.get('/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    const proposalId = req.query.proposalId as string | undefined;
    const filter =
      actor.role === 'ATHLETE' ? { athleteId: actor.athleteId, proposalId }
        : actor.role === 'BRAND' ? { brandId: actor.brandId, proposalId }
          : { proposalId };
    ok(res, await deliverableService.summary(filter));
  } catch (e) { next(e); }
});

/** @route GET /deliverables/pending-review — 검수 대기 (관리자) */
router.get('/pending-review', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await deliverableService.listPendingReview());
  } catch (e) { next(e); }
});

/** @route POST /deliverables/generate/:proposalId — 승인된 제안 → 이행 항목 생성 (관리자) */
router.post('/generate/:proposalId', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await deliverableService.generateFromProposal(req.params.proposalId));
  } catch (e) { next(e); }
});

/** @route POST /deliverables/:id/evidence — 증빙 등록 (선수) */
router.post('/:id/evidence', authenticate, authorize('ATHLETE'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const athlete = await athleteService.findByUserId(req.user!.id);
    ok(res, await deliverableService.submitEvidence(req.params.id, athlete.id, req.body));
  } catch (e) { next(e); }
});

/** @route POST /deliverables/evidence/:evidenceId/review — 증빙 검수 (관리자) */
router.post('/evidence/:evidenceId/review', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await deliverableService.reviewEvidence(req.params.evidenceId, !!req.body.approve, req.user!.id, req.body.note));
  } catch (e) { next(e); }
});

/** @route POST /deliverables/:id/substitution — 대체이행 요청 (선수·브랜드) */
router.post('/:id/substitution', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    if (!['ATHLETE', 'BRAND'].includes(actor.role)) throw new ForbiddenError('요청 권한이 없습니다');
    ok(res, await deliverableService.requestSubstitution(req.params.id, actor, req.body.type, req.body.note));
  } catch (e) { next(e); }
});

/** @route POST /deliverables/:id/substitution/review — 대체이행 승인·거절 (관리자) */
router.post('/:id/substitution/review', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await deliverableService.reviewSubstitution(req.params.id, !!req.body.approve, req.user!.id, req.body.note));
  } catch (e) { next(e); }
});

export default router;

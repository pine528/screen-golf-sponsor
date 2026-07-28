/**
 * 개편 Phase 5 — 장기 파트너십 제안 API (핸드오프 §14, WF-10)
 */
import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { proposalService } from '../services/proposal.service';
import { brandService } from '../services/brand.service';
import { athleteService } from '../services/athlete.service';
import { ForbiddenError } from '../utils/errors';

const router = Router();
const ok = (res: Response, data: any) => res.json({ success: true, data, error: null });

/** 요청자의 브랜드/선수 식별자 */
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

/** @route GET /proposals — 역할별 목록 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    if (actor.role === 'BRAND') return ok(res, await proposalService.listForBrand(actor.brandId!));
    if (actor.role === 'ATHLETE') return ok(res, await proposalService.listForAthlete(actor.athleteId!));
    if (actor.role === 'ADMIN') return ok(res, await proposalService.listForAdmin(req.query.status as any));
    throw new ForbiddenError('조회 권한이 없습니다');
  } catch (e) { next(e); }
});

/** @route GET /proposals/:id — 상세 (당사자·관리자만) */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    const p = await proposalService.detail(req.params.id);
    const mine =
      actor.role === 'ADMIN' ||
      (actor.role === 'BRAND' && p.brandId === actor.brandId) ||
      (actor.role === 'ATHLETE' && p.athleteId === actor.athleteId);
    if (!mine) throw new ForbiddenError('조회 권한이 없습니다');
    ok(res, p);
  } catch (e) { next(e); }
});

/** @route POST /proposals — 제안 작성(임시저장) */
router.post('/', authenticate, authorize('BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brand = await brandService.findByUserId(req.user!.id);
    ok(res, await proposalService.create(brand.id, req.body));
  } catch (e) { next(e); }
});

/** @route PATCH /proposals/:id — 임시저장 갱신 */
router.patch('/:id', authenticate, authorize('BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brand = await brandService.findByUserId(req.user!.id);
    ok(res, await proposalService.update(req.params.id, brand.id, req.body));
  } catch (e) { next(e); }
});

/** @route POST /proposals/:id/submit — 제출 */
router.post('/:id/submit', authenticate, authorize('BRAND'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brand = await brandService.findByUserId(req.user!.id);
    ok(res, await proposalService.submit(req.params.id, brand.id, req.user!.id));
  } catch (e) { next(e); }
});

/**
 * @route POST /proposals/:id/transition — 상태 전이
 * body: { to: ProposalStatus, note?: string }
 */
router.post('/:id/transition', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = await actorOf(req);
    ok(res, await proposalService.transition(req.params.id, req.body.to, actor, req.body.note));
  } catch (e) { next(e); }
});

/** @route POST /proposals/:id/contract — 승인된 제안 → 계약 진행 (관리자) */
router.post('/:id/contract', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await proposalService.convertToContract(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { penaltyService } from '../services/penalty.service';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { PenaltyType, PenaltyStatus } from '@prisma/client';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Validation Schemas (Zod)
// ============================================

const penaltyTypeEnum = z.enum([
  'ASSET_DEADLINE_MISSED',
  'CONTRACT_VIOLATION',
  'VERIFICATION_FAILURE',
  'INAPPROPRIATE_CONTENT',
  'ADMIN_MANUAL',
]);

const penaltyStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'REMOVED']);

const createPenaltySchema = z.object({
  athleteId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  type: penaltyTypeEnum,
  points: z.number().int().min(1).max(100).optional().default(10),
  reason: z.string().min(1, '사유를 입력하세요').max(1000),
  refType: z.string().optional(),
  refId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
}).refine(
  (data) => data.athleteId || data.brandId,
  { message: 'athleteId 또는 brandId 중 하나는 필수입니다' }
);

const removePenaltySchema = z.object({
  removeReason: z.string().min(1, '제거 사유를 입력하세요').max(1000),
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/admin/penalties
 * Admin: 페널티 목록 조회
 * ?athleteId=xxx&brandId=xxx&status=ACTIVE&type=ADMIN_MANUAL&q=검색어
 */
router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        athleteId: req.query.athleteId as string | undefined,
        brandId: req.query.brandId as string | undefined,
        userId: req.query.userId as string | undefined,
        status: req.query.status as PenaltyStatus | undefined,
        type: req.query.type as PenaltyType | undefined,
        q: req.query.q as string | undefined,
      };
      const penalties = await penaltyService.getPenalties(filters);
      res.json({ success: true, data: penalties });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/penalties/stats
 * Admin: 페널티 통계 조회
 */
router.get(
  '/stats',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await penaltyService.getPenaltyStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/penalties/:id
 * Admin: 페널티 상세 조회
 */
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const penalty = await penaltyService.getPenalty(req.params.id);
      if (!penalty) {
        return res.status(404).json({ success: false, message: '페널티를 찾을 수 없습니다' });
      }
      res.json({ success: true, data: penalty });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/penalties
 * Admin: 페널티 부여
 */
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(createPenaltySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const penalty = await penaltyService.createPenalty(req.user!.id, {
        ...req.body,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      });
      res.status(201).json({ success: true, data: penalty });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/penalties/:id/remove
 * Admin: 페널티 제거
 */
router.post(
  '/:id/remove',
  authenticate,
  requireRole('ADMIN'),
  validate(removePenaltySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const penalty = await penaltyService.removePenalty(
        req.params.id,
        req.user!.id,
        req.body.removeReason
      );
      res.json({ success: true, data: penalty });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/penalties/expire
 * Admin: 만료된 페널티 일괄 처리 (수동)
 */
router.post(
  '/expire',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const count = await penaltyService.expireOldPenalties();
      res.json({ success: true, data: { expiredCount: count } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/penalties/entity/:type/:entityId
 * Admin: 특정 엔티티의 페널티 목록 조회
 */
router.get(
  '/entity/:type/:entityId',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type.toUpperCase() as 'BRAND' | 'ATHLETE' | 'USER';
      if (!['BRAND', 'ATHLETE', 'USER'].includes(type)) {
        return res.status(400).json({ success: false, message: '유효하지 않은 엔티티 타입입니다' });
      }

      const statusFilter = req.query.status as PenaltyStatus | undefined;
      const penalties = await penaltyService.getEntityPenalties(type, req.params.entityId, statusFilter);
      res.json({ success: true, data: penalties });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/penalties/check/:type/:entityId
 * Admin: 참여 자격 검사
 */
router.get(
  '/check/:type/:entityId',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type.toUpperCase() as 'BRAND' | 'ATHLETE';
      if (!['BRAND', 'ATHLETE'].includes(type)) {
        return res.status(400).json({ success: false, message: '유효하지 않은 엔티티 타입입니다' });
      }

      // userId를 가져오기 위해 엔티티 조회 필요 (간소화를 위해 entityId를 직접 사용)
      const result = await penaltyService.checkParticipationEligibility(
        '', // userId는 내부에서 사용하지 않으므로 빈 문자열
        type,
        req.params.entityId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

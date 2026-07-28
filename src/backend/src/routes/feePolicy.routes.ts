import { Router } from 'express';
import { z } from 'zod';
import { feePolicyController } from '../controllers/feePolicy.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// ============================================
// Validation Schemas (Zod)
// ============================================

const createPolicySchema = z.object({
  type: z.enum(['FAN_VOTE_OPEN', 'FAN_VOTE_ENTRY', 'FAN_VOTE_SETTLE'], {
    errorMap: () => ({ message: '유효하지 않은 정책 유형입니다 (FAN_VOTE_OPEN, FAN_VOTE_ENTRY, FAN_VOTE_SETTLE)' }),
  }),
  ratePercent: z.number()
    .min(0, '수수료율은 0 이상이어야 합니다')
    .max(1, '수수료율은 1(100%) 이하여야 합니다'),
  minAmount: z.number()
    .min(0, '최소 금액은 0 이상이어야 합니다'),
  maxAmount: z.number()
    .min(0, '최대 금액은 0 이상이어야 합니다'),
  platformSharePercent: z.number()
    .min(0, '플랫폼 배분율은 0 이상이어야 합니다')
    .max(1, '플랫폼 배분율은 1(100%) 이하여야 합니다')
    .optional(),
  creatorSharePercent: z.number()
    .min(0, '개설자 배분율은 0 이상이어야 합니다')
    .max(1, '개설자 배분율은 1(100%) 이하여야 합니다')
    .optional(),
  effectiveFrom: z.string().or(z.date()).transform((val) => new Date(val)),
  effectiveTo: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

const updatePolicySchema = z.object({
  ratePercent: z.number().min(0).max(1).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  platformSharePercent: z.number().min(0).max(1).optional(),
  creatorSharePercent: z.number().min(0).max(1).optional(),
  effectiveTo: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const simulateSchema = z.object({
  seedPoints: z.number()
    .min(0, 'Seed 포인트는 0 이상이어야 합니다'),
  entryFee: z.number()
    .min(0, '참여비는 0 이상이어야 합니다'),
  participantCount: z.number()
    .int('참여자 수는 정수여야 합니다')
    .min(1, '참여자 수는 1 이상이어야 합니다'),
});

// ============================================
// Public Routes (인증 불필요)
// ============================================

/**
 * @route GET /api/fan-votes/fee/info
 * @desc 현재 수수료 정책 요약 조회 (공개)
 */
router.get('/info', feePolicyController.getFeeInfo);

/**
 * @route POST /api/fan-votes/fee/simulate
 * @desc 수수료 시뮬레이션 (공개)
 */
router.post('/simulate', validate(simulateSchema), feePolicyController.simulateFees);

// ============================================
// Admin Routes (인증 + ADMIN 권한 필요)
// ============================================

const adminRouter = Router();
adminRouter.use(authenticate, authorize('ADMIN'));

/**
 * @route GET /api/admin/fee-policies
 * @desc 정책 목록 조회
 */
adminRouter.get('/', feePolicyController.listPolicies);

/**
 * @route GET /api/admin/fee-policies/active
 * @desc 현재 활성 정책 조회
 */
adminRouter.get('/active', feePolicyController.getActivePolicies);

/**
 * @route POST /api/admin/fee-policies/simulate
 * @desc Admin 수수료 시뮬레이션
 */
adminRouter.post('/simulate', validate(simulateSchema), feePolicyController.adminSimulate);

/**
 * @route GET /api/admin/fee-policies/:id
 * @desc 정책 상세 조회
 */
adminRouter.get('/:id', feePolicyController.getPolicy);

/**
 * @route POST /api/admin/fee-policies
 * @desc 정책 생성
 */
adminRouter.post('/', validate(createPolicySchema), feePolicyController.createPolicy);

/**
 * @route PATCH /api/admin/fee-policies/:id
 * @desc 정책 수정
 */
adminRouter.patch('/:id', validate(updatePolicySchema), feePolicyController.updatePolicy);

/**
 * @route DELETE /api/admin/fee-policies/:id
 * @desc 정책 비활성화
 */
adminRouter.delete('/:id', feePolicyController.deactivatePolicy);

export { router as feeInfoRouter, adminRouter as adminFeePolicyRouter };

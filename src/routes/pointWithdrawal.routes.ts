import { Router } from 'express';
import { pointWithdrawalController } from '../controllers/pointWithdrawal.controller';
import { authenticate, authorize, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
const adminRouter = Router();

// ============================================
// User Routes (ATHLETE 권한 필요)
// ============================================

// 출금 가능 잔액 조회
router.get(
  '/balance',
  authenticate,
  authorize('ATHLETE'),
  pointWithdrawalController.getWithdrawableBalance.bind(pointWithdrawalController)
);

// 내 출금 요청 목록
router.get(
  '/my',
  authenticate,
  authorize('ATHLETE'),
  pointWithdrawalController.getMyWithdrawals.bind(pointWithdrawalController)
);

// 출금 요청 생성
const createWithdrawalSchema = z.object({
  amount: z.number().int().min(1000, '최소 출금 금액은 1,000P입니다'),
  bankName: z.string().min(1, '은행명을 입력하세요'),
  bankAccountNumber: z.string().min(1, '계좌번호를 입력하세요'),
  accountHolder: z.string().min(1, '예금주를 입력하세요'),
  reason: z.string().max(200).optional(),
});

router.post(
  '/',
  authenticate,
  authorize('ATHLETE'),
  validate(createWithdrawalSchema),
  pointWithdrawalController.createWithdrawal.bind(pointWithdrawalController)
);

// ============================================
// Admin Routes (ADMIN 권한 필요)
// ============================================

// 모든 출금 요청 목록
adminRouter.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  pointWithdrawalController.getAllWithdrawals.bind(pointWithdrawalController)
);

// 출금 승인
adminRouter.post(
  '/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  pointWithdrawalController.approveWithdrawal.bind(pointWithdrawalController)
);

// 출금 거부
const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

adminRouter.post(
  '/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  validate(rejectSchema),
  pointWithdrawalController.rejectWithdrawal.bind(pointWithdrawalController)
);

// 지급 완료
const completeSchema = z.object({
  payoutReference: z.string().max(100).optional(),
});

adminRouter.post(
  '/:id/complete',
  authenticate,
  requireRole('ADMIN'),
  validate(completeSchema),
  pointWithdrawalController.completeWithdrawal.bind(pointWithdrawalController)
);

export { router as pointWithdrawalRoutes, adminRouter as adminPointWithdrawalRoutes };

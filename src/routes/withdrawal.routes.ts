import { Router } from 'express';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const createWithdrawalSchema = z.object({
  amount: z.number().int().positive('출금 금액은 양수여야 합니다'),
  bankName: z.string().min(1, '은행명을 입력하세요'),
  bankAccountNumber: z.string().min(1, '계좌번호를 입력하세요'),
  accountHolder: z.string().min(1, '예금주를 입력하세요'),
  reason: z.string().max(500).optional(),
});

// ============================================
// All routes require ATHLETE role
// ============================================

router.use(authenticate, requireRole('ATHLETE'));

// POST /api/withdrawals - 출금 요청 생성
router.post(
  '/',
  validate(createWithdrawalSchema),
  withdrawalController.create.bind(withdrawalController)
);

// GET /api/withdrawals/available-balance - 출금 가능 잔액 조회
router.get(
  '/available-balance',
  withdrawalController.getAvailableBalance.bind(withdrawalController)
);

// GET /api/withdrawals/my - 내 출금 요청 목록
router.get(
  '/my',
  withdrawalController.getMyList.bind(withdrawalController)
);

// GET /api/withdrawals/my/:id - 내 출금 요청 상세
router.get(
  '/my/:id',
  withdrawalController.getMyDetail.bind(withdrawalController)
);

export default router;

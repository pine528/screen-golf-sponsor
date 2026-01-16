import { Router } from 'express';
import { pointController } from '../controllers/point.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 포인트 랭킹 조회
router.get('/ranking', pointController.getRanking.bind(pointController));

// ============================================
// Fan Routes (FAN 권한 필요)
// ============================================

// 내 포인트 잔액 조회
router.get(
  '/me',
  authenticate,
  requireRole('FAN'),
  pointController.getMyBalance.bind(pointController)
);

// 내 포인트 내역 조회
router.get(
  '/me/history',
  authenticate,
  requireRole('FAN'),
  pointController.getMyHistory.bind(pointController)
);

// ============================================
// Admin Routes (ADMIN 권한 필요)
// ============================================

// 관리자: 포인트 지급
const grantSchema = z.object({
  userId: z.string().uuid('유효한 사용자 ID를 입력하세요'),
  amount: z.number().int().positive('지급 금액은 양수여야 합니다'),
  reasonText: z.string().optional(),
});

router.post(
  '/admin/grant',
  authenticate,
  requireRole('ADMIN'),
  validate(grantSchema),
  pointController.adminGrant.bind(pointController)
);

// 관리자: 사용자 포인트 잔액 조회
router.get(
  '/admin/user/:userId/balance',
  authenticate,
  requireRole('ADMIN'),
  pointController.adminGetUserBalance.bind(pointController)
);

// 관리자: 사용자 포인트 내역 조회
router.get(
  '/admin/user/:userId/history',
  authenticate,
  requireRole('ADMIN'),
  pointController.adminGetUserHistory.bind(pointController)
);

export default router;

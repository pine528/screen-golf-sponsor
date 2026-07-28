/**
 * Point Topup Routes
 * 포인트 충전 API 라우트
 */

import { Router } from 'express';
import { pointTopupController } from '../controllers/pointTopup.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// User Routes (인증된 모든 사용자)
// ============================================

// 충전 생성 (Checkout 세션)
const createTopupSchema = z.object({
  amount: z.number().int().min(1000, '최소 충전 금액은 1,000원입니다').max(10000000, '최대 충전 금액은 1,000만원입니다'),
  provider: z.enum(['TOSS', 'STRIPE']).optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
});

router.post(
  '/create',
  authenticate,
  validate(createTopupSchema),
  pointTopupController.createTopup.bind(pointTopupController)
);

// 결제 확인
const confirmTopupSchema = z.object({
  paymentKey: z.string().min(1, 'paymentKey는 필수입니다'),
});

router.post(
  '/:id/confirm',
  authenticate,
  validate(confirmTopupSchema),
  pointTopupController.confirmTopup.bind(pointTopupController)
);

// 내 충전 내역
router.get(
  '/my',
  authenticate,
  pointTopupController.getMyTopups.bind(pointTopupController)
);

// orderId로 조회 (결제 콜백용)
router.get(
  '/order/:orderId',
  authenticate,
  pointTopupController.getTopupByOrderId.bind(pointTopupController)
);

// 단일 충전 조회
router.get(
  '/:id',
  authenticate,
  pointTopupController.getTopupById.bind(pointTopupController)
);

// ============================================
// Admin Routes
// ============================================

// 전체 충전 목록
router.get(
  '/admin/all',
  authenticate,
  requireRole('ADMIN'),
  pointTopupController.adminGetAllTopups.bind(pointTopupController)
);

// 통계
router.get(
  '/admin/stats',
  authenticate,
  requireRole('ADMIN'),
  pointTopupController.adminGetStats.bind(pointTopupController)
);

// 환불 처리
const refundSchema = z.object({
  reason: z.string().max(500).optional(),
});

router.post(
  '/admin/:id/refund',
  authenticate,
  requireRole('ADMIN'),
  validate(refundSchema),
  pointTopupController.adminRefund.bind(pointTopupController)
);

export default router;

import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ============================================
// Brand Routes (결제자)
// ============================================

// 내 결제 내역
router.get(
  '/my',
  authenticate,
  requireRole('BRAND'),
  paymentController.getMyPayments.bind(paymentController)
);

// 결제 생성
router.post(
  '/',
  authenticate,
  requireRole('BRAND'),
  paymentController.createPayment.bind(paymentController)
);

// 결제 시작 (PG 연동)
router.post(
  '/:id/initiate',
  authenticate,
  requireRole('BRAND'),
  paymentController.initiatePayment.bind(paymentController)
);

// 결제 취소
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('BRAND'),
  paymentController.cancelPayment.bind(paymentController)
);

// ============================================
// PG Webhook / Callback Routes
// ============================================

// 결제 완료 처리 (PG 웹훅에서 호출)
router.post(
  '/:id/complete',
  paymentController.completePayment.bind(paymentController)
);

// ============================================
// Admin Routes
// ============================================

// 모든 결제 목록
router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  paymentController.listPayments.bind(paymentController)
);

// 결제 상세 조회
router.get(
  '/:id',
  authenticate,
  paymentController.getPayment.bind(paymentController)
);

// 환불 처리
router.post(
  '/:id/refund',
  authenticate,
  requireRole('ADMIN'),
  paymentController.refundPayment.bind(paymentController)
);

// 결제 통계
router.get(
  '/stats/summary',
  authenticate,
  requireRole('ADMIN'),
  paymentController.getPaymentStats.bind(paymentController)
);

// 일별 결제 통계
router.get(
  '/stats/daily',
  authenticate,
  requireRole('ADMIN'),
  paymentController.getDailyPaymentStats.bind(paymentController)
);

export default router;

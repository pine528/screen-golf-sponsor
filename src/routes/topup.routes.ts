/**
 * Phase 10-1: Topup Routes
 * 브랜드 지갑 충전 API 라우트
 */

import { Router } from 'express';
import { topupController } from '../controllers/topup.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ==========================================
// Brand Routes (/api/brand/topups)
// ==========================================
const brandRouter = Router();

// 인증 필요
brandRouter.use(authenticate);

// POST /api/brand/topups - 충전 생성
brandRouter.post('/', topupController.create.bind(topupController));

// POST /api/brand/topups/:id/confirm - 결제 확인
brandRouter.post('/:id/confirm', topupController.confirm.bind(topupController));

// GET /api/brand/topups/my - 내 충전 내역
brandRouter.get('/my', topupController.getMyList.bind(topupController));

// GET /api/brand/topups/my/:id - 내 충전 상세
brandRouter.get('/my/:id', topupController.getMyDetail.bind(topupController));

// ==========================================
// Webhook Routes (/api/payments/webhook)
// 인증 없음, 서명 검증
// ==========================================
const webhookRouter = Router();

// POST /api/payments/webhook/toss
webhookRouter.post('/toss', topupController.handleTossWebhook.bind(topupController));

// POST /api/payments/webhook/stripe
webhookRouter.post('/stripe', topupController.handleStripeWebhook.bind(topupController));

// ==========================================
// Admin Routes (/api/admin/finance/topups)
// ==========================================
const adminRouter = Router();

// 인증 + ADMIN 권한 필요
adminRouter.use(authenticate);
adminRouter.use(requireRole('ADMIN'));

// GET /api/admin/finance/topups - 전체 충전 목록
adminRouter.get('/', topupController.adminGetAll.bind(topupController));

// GET /api/admin/finance/topups/stats - 충전 통계
adminRouter.get('/stats', topupController.adminGetStats.bind(topupController));

// GET /api/admin/finance/topups/:id - 충전 상세
adminRouter.get('/:id', topupController.adminGetDetail.bind(topupController));

export const brandTopupRoutes = brandRouter;
export const webhookRoutes = webhookRouter;
export const adminTopupRoutes = adminRouter;

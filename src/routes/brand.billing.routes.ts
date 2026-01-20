import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * ★ Phase 11-2A: Brand Billing APIs
 * 모든 라우트는 BRAND 권한 필요
 */

// ============================================
// Billing Profile
// ============================================

/**
 * @route GET /brand/billing/profile
 * @desc 청구 프로필 조회
 */
router.get('/profile', authenticate, authorize('BRAND'), billingController.getBillingProfile);

/**
 * @route POST /brand/billing/profile
 * @desc 청구 프로필 생성
 */
router.post('/profile', authenticate, authorize('BRAND'), billingController.createBillingProfile);

/**
 * @route PATCH /brand/billing/profile
 * @desc 청구 프로필 수정
 */
router.patch('/profile', authenticate, authorize('BRAND'), billingController.updateBillingProfile);

// ============================================
// Statements
// ============================================

/**
 * @route GET /brand/billing/statements/summary
 * @desc 기간별 요약 조회
 * @query from: YYYY-MM-DD
 * @query to: YYYY-MM-DD
 */
router.get('/statements/summary', authenticate, authorize('BRAND'), billingController.getStatementSummary);

/**
 * @route GET /brand/billing/statements/items
 * @desc 거래 내역 조회 (페이지네이션)
 * @query from: YYYY-MM-DD
 * @query to: YYYY-MM-DD
 * @query page: number (default: 1)
 * @query pageSize: number (default: 20)
 */
router.get('/statements/items', authenticate, authorize('BRAND'), billingController.getStatementItems);

/**
 * @route GET /brand/billing/statements/export.csv
 * @desc CSV 내보내기
 * @query from: YYYY-MM-DD
 * @query to: YYYY-MM-DD
 */
router.get('/statements/export.csv', authenticate, authorize('BRAND'), billingController.exportStatementCsv);

/**
 * @route GET /brand/billing/statements/export.pdf
 * @desc PDF 내보내기
 * @query from: YYYY-MM-DD
 * @query to: YYYY-MM-DD
 */
router.get('/statements/export.pdf', authenticate, authorize('BRAND'), billingController.exportStatementPdf);

// ============================================
// Tax Invoice
// ============================================

/**
 * @route POST /brand/billing/tax-invoices/request
 * @desc 세금계산서 발행 요청
 * @body billingProfileId, from, to, idempotencyKey
 */
router.post('/tax-invoices/request', authenticate, authorize('BRAND'), billingController.requestTaxInvoice);

/**
 * @route GET /brand/billing/tax-invoices/my
 * @desc 내 세금계산서 요청 목록
 * @query status?: REQUESTED | APPROVED | ISSUED | REJECTED
 * @query page?: number
 * @query pageSize?: number
 */
router.get('/tax-invoices/my', authenticate, authorize('BRAND'), billingController.getMyTaxInvoices);

export default router;

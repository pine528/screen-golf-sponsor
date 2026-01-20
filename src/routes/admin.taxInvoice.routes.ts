import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * ★ Phase 11-2A: Admin Tax Invoice APIs
 * 모든 라우트는 ADMIN 권한 필요
 */

/**
 * @route GET /admin/finance/tax-invoices
 * @desc 세금계산서 요청 목록
 * @query status?: REQUESTED | APPROVED | ISSUED | REJECTED
 * @query page?: number
 * @query pageSize?: number
 */
router.get('/', authenticate, authorize('ADMIN'), billingController.getAllTaxInvoices);

/**
 * @route GET /admin/finance/tax-invoices/stats
 * @desc 세금계산서 통계
 */
router.get('/stats', authenticate, authorize('ADMIN'), billingController.getTaxInvoiceStats);

/**
 * @route GET /admin/finance/tax-invoices/:id
 * @desc 세금계산서 상세 조회
 */
router.get('/:id', authenticate, authorize('ADMIN'), billingController.getTaxInvoiceById);

/**
 * @route POST /admin/finance/tax-invoices/:id/approve
 * @desc 세금계산서 승인
 */
router.post('/:id/approve', authenticate, authorize('ADMIN'), billingController.approveTaxInvoice);

/**
 * @route POST /admin/finance/tax-invoices/:id/reject
 * @desc 세금계산서 거부
 * @body reason: string (10자 이상)
 */
router.post('/:id/reject', authenticate, authorize('ADMIN'), billingController.rejectTaxInvoice);

/**
 * @route POST /admin/finance/tax-invoices/:id/issue
 * @desc 세금계산서 발행 (Danger Zone)
 * @body invoiceNumber: string, confirmText: "ISSUE"
 */
router.post('/:id/issue', authenticate, authorize('ADMIN'), billingController.issueTaxInvoice);

export default router;

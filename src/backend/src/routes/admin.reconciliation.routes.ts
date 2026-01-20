/**
 * Phase 10-3: Admin Reconciliation Routes
 * 결제/환불 대사 관리 API
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { reconciliationController } from '../controllers/reconciliation.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// 모든 라우트: ADMIN 또는 FINANCE 역할 필요
router.use(authenticate, authorize('ADMIN', 'FINANCE'));

// 수동 대사 실행 Rate Limiter (분당 5회 제한)
const runRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: '대사 실행 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  },
});

// GET /runs - 대사 실행 목록
router.get('/runs', reconciliationController.listRuns.bind(reconciliationController));

// POST /runs - 수동 대사 실행
router.post('/runs', runRateLimiter, reconciliationController.createRun.bind(reconciliationController));

// GET /issues - 이슈 목록
router.get('/issues', reconciliationController.listIssues.bind(reconciliationController));

// GET /issues/summary - 이슈 요약 통계
router.get('/issues/summary', reconciliationController.getIssuesSummary.bind(reconciliationController));

// GET /issues.csv - 이슈 CSV Export
router.get('/issues.csv', reconciliationController.exportIssuesCsv.bind(reconciliationController));

// PATCH /issues/:id/status - 이슈 상태 변경
router.patch('/issues/:id/status', reconciliationController.updateIssueStatus.bind(reconciliationController));

export default router;

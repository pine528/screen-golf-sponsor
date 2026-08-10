import { Router } from 'express';
import authRoutes from './auth.routes';
import brandRoutes from './brand.routes';
import aiMatchRoutes from './aiMatch.routes';
import athleteRoutes from './athlete.routes';
import eventRoutes from './event.routes';
import slotRoutes from './slot.routes';
import proposalRoutes from './proposal.routes';
import deliverableRoutes from './deliverable.routes';
import auctionRoutes from './auction.routes';
import contractRoutes from './contract.routes';
import adminRoutes from './admin.routes';
import adminFinanceRoutes from './admin.finance.routes';
import adminReportsRoutes from './admin.reports.routes';
import adminEntitiesRoutes from './admin.entities.routes';
import adminOpsRoutes from './admin.ops.routes';
import uploadRoutes from './upload.routes';
import campaignRoutes from './campaign.routes';
import paymentRoutes from './payment.routes';
import notificationRoutes from './notification.routes';
import fanRoutes from './fan.routes';
import pointRoutes from './point.routes';
import shopRoutes from './shop.routes';
import withdrawalRoutes from './withdrawal.routes';
import { brandTopupRoutes, webhookRoutes, adminTopupRoutes } from './topup.routes';
import adminReconciliationRoutes from './admin.reconciliation.routes';
import faqRoutes from './faq.routes';
import adminPenaltyRoutes from './admin.penalty.routes';
import reportRoutes from './report.routes';
import exposureRoutes from './exposure.routes';
import seasonRoutes from './season.routes';
import brandBillingRoutes from './brand.billing.routes';
import adminTaxInvoiceRoutes from './admin.taxInvoice.routes';
import { feeInfoRouter, adminFeePolicyRouter } from './feePolicy.routes';
import pointTopupRoutes from './pointTopup.routes';
import agencyRoutes from './agency.routes';
import donationRoutes from './donation.routes';
import { pointWithdrawalRoutes, adminPointWithdrawalRoutes } from './pointWithdrawal.routes';
import tournamentRulesRoutes from './tournamentRules.routes';
import { brandCreativeApprovalRoutes, adminCreativeApprovalRoutes } from './creativeApproval.routes';
import voteV2Routes from './voteV2.routes';
import roiRoutes from './roi.routes';
import sportRoutes from './sport.routes';
import youtubeRoutes from './youtube.routes';
// Full Funnel Data Reporting (스폰픽 풀 퍼널)
import funnelRoutes from './funnel.routes';
import funnelReportRoutes from './funnelReport.routes';
import adminFunnelRoutes from './admin.funnel.routes';
import storeRoutes from './store.routes';
import externalRoutes from './external.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/brands', brandRoutes);
router.use('/athletes', athleteRoutes);
router.use('/ai-match', aiMatchRoutes);
router.use('/events', eventRoutes);
router.use('/slots', slotRoutes);
router.use('/proposals', proposalRoutes);
router.use('/deliverables', deliverableRoutes);
router.use('/auctions', auctionRoutes);
router.use('/contracts', contractRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/finance', adminFinanceRoutes);
router.use('/admin/reports', adminReportsRoutes);
router.use('/admin/entities', adminEntitiesRoutes);
router.use('/admin/ops', adminOpsRoutes);
router.use('/upload', uploadRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/fan', fanRoutes);
router.use('/points', pointRoutes);
router.use('/shop', shopRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/brand/topups', brandTopupRoutes);
router.use('/brand/billing', brandBillingRoutes);
router.use('/payments/webhook', webhookRoutes);
router.use('/admin/finance/topups', adminTopupRoutes);
router.use('/admin/finance/tax-invoices', adminTaxInvoiceRoutes);
router.use('/point-topups', pointTopupRoutes);
router.use('/admin/fee-policies', adminFeePolicyRouter);
router.use('/admin/reconciliation', adminReconciliationRoutes);
router.use('/faq', faqRoutes);
router.use('/admin/penalties', adminPenaltyRoutes);
router.use('/reports', reportRoutes);
router.use('/exposure', exposureRoutes);
router.use('/seasons', seasonRoutes);
router.use('/agencies', agencyRoutes);
router.use('/donations', donationRoutes);
router.use('/point-withdrawals', pointWithdrawalRoutes);
router.use('/admin/point-withdrawals', adminPointWithdrawalRoutes);
router.use('/', tournamentRulesRoutes);
router.use('/brand/creative-approvals', brandCreativeApprovalRoutes);
router.use('/admin/creative-approvals', adminCreativeApprovalRoutes);
router.use('/votes', voteV2Routes);  // Vote V2 → /votes (메인 투표 시스템)
router.use('/roi', roiRoutes);  // ROI 리포트 대시보드
router.use('/sports', sportRoutes);  // SPONPIK 종목 카테고리 (1차: 골프/스크린골프)
router.use('/youtube', youtubeRoutes);  // SPONPIK Phase 2 SNS — YouTube Data API 연동

// ===== Full Funnel Data Reporting =====
// 공개 미니스토어 (먼저 마운트): /api/store/brand/:slug
router.use('/store', storeRoutes);
// 외부 픽셀 / Postback (Phase 2): /api/external/*
router.use('/external', externalRoutes);
// 공개 트래킹 + 이벤트 (인증 불필요): /api/tracking/click, /api/events/*
router.use('/', funnelRoutes);
// 리포트 (인증 필요): /api/reports/{campaign,brand,athlete}/:id
router.use('/reports', funnelReportRoutes);
// Admin 자산 관리: /api/admin/...
router.use('/admin', adminFunnelRoutes);
// API spec 호환 alias: /api/campaigns/:id/tracking-assets/* (admin 없이도 접근)
// 마지막에 마운트 — 다른 라우트 매칭 후
router.use('/', adminFunnelRoutes);

// Alias routes for OpenAPI compatibility
router.use('/slot-instances', slotRoutes);

export default router;

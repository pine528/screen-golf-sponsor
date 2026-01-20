import { Router } from 'express';
import authRoutes from './auth.routes';
import brandRoutes from './brand.routes';
import athleteRoutes from './athlete.routes';
import eventRoutes from './event.routes';
import slotRoutes from './slot.routes';
import auctionRoutes from './auction.routes';
import contractRoutes from './contract.routes';
import adminRoutes from './admin.routes';
import adminFinanceRoutes from './admin.finance.routes';
import adminReportsRoutes from './admin.reports.routes';
import adminEntitiesRoutes from './admin.entities.routes';
import adminOpsRoutes from './admin.ops.routes';
import uploadRoutes from './upload.routes';
import campaignRoutes from './campaign.routes';
import voteRoutes from './vote.routes';
import paymentRoutes from './payment.routes';
import notificationRoutes from './notification.routes';
import fanRoutes from './fan.routes';
import pointRoutes from './point.routes';
import fanVoteRoutes from './fanVote.routes';
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

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/brands', brandRoutes);
router.use('/athletes', athleteRoutes);
router.use('/events', eventRoutes);
router.use('/slots', slotRoutes);
router.use('/auctions', auctionRoutes);
router.use('/contracts', contractRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/finance', adminFinanceRoutes);
router.use('/admin/reports', adminReportsRoutes);
router.use('/admin/entities', adminEntitiesRoutes);
router.use('/admin/ops', adminOpsRoutes);
router.use('/upload', uploadRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/votes', voteRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/fan', fanRoutes);
router.use('/points', pointRoutes);
router.use('/fan-votes', fanVoteRoutes);
router.use('/shop', shopRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/brand/topups', brandTopupRoutes);
router.use('/brand/billing', brandBillingRoutes);
router.use('/payments/webhook', webhookRoutes);
router.use('/admin/finance/topups', adminTopupRoutes);
router.use('/admin/reconciliation', adminReconciliationRoutes);
router.use('/faq', faqRoutes);
router.use('/admin/penalties', adminPenaltyRoutes);
router.use('/reports', reportRoutes);
router.use('/exposure', exposureRoutes);
router.use('/seasons', seasonRoutes);

// Alias routes for OpenAPI compatibility
router.use('/slot-instances', slotRoutes);

export default router;

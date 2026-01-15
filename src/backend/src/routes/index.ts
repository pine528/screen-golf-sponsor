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
import uploadRoutes from './upload.routes';
import campaignRoutes from './campaign.routes';
import voteRoutes from './vote.routes';
import paymentRoutes from './payment.routes';
import notificationRoutes from './notification.routes';

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
router.use('/upload', uploadRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/votes', voteRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);

// Alias routes for OpenAPI compatibility
router.use('/slot-instances', slotRoutes);

export default router;

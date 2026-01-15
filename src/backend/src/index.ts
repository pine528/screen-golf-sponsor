import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

import config from './config';
import routes from './routes';
import metricsRoutes from './routes/metrics.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { requestIdMiddleware } from './middleware/requestId';
import { initSentry, Sentry } from './lib/sentry';
import { auctionService } from './services/auction.service';
import { contractService } from './services/contract.service';
import { settlementService } from './services/settlement.service';
import { socketService } from './services/socket.service';
import { escrowService } from './services/escrow.service';
import { notificationService } from './services/notification.service';
import { reportsService } from './services/reports.service';

// Sentry 초기화 (가장 먼저)
initSentry();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
socketService.initialize(httpServer);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
}));

// Request ID 미들웨어 (가장 먼저)
app.use(requestIdMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development only, or all environments as needed)
if (config.nodeEnv !== 'test') {
  app.use(requestLogger);
}

// Static file serving for uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// API routes
app.use('/api', routes);
app.use('/api/metrics', metricsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Sentry 에러 핸들러 (가장 마지막)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}

// Scheduled Jobs - 타임존: Asia/Seoul
const cronOptions = {
  scheduled: true,
  timezone: 'Asia/Seoul',
};

// Process auctions every minute
cron.schedule('* * * * *', async () => {
  try {
    const started = await auctionService.processScheduledAuctions();
    const ended = await auctionService.processExpiredAuctions();
    if (started > 0 || ended > 0) {
      console.log(`[Cron] Auctions: ${started} started, ${ended} ended`);
    }
  } catch (error) {
    console.error('[Cron] Auction processing error:', error);
  }
}, cronOptions);

// Process expired contract deadlines every hour
cron.schedule('0 * * * *', async () => {
  try {
    const expired = await contractService.processExpiredDeadlines();
    if (expired > 0) {
      console.log(`[Cron] Contracts: ${expired} expired due to missed deadline`);
    }
  } catch (error) {
    console.error('[Cron] Contract deadline processing error:', error);
  }
}, cronOptions);

// Process settlements daily at 9 AM KST
cron.schedule('0 9 * * *', async () => {
  try {
    const processed = await settlementService.processReadySettlements();
    console.log(`[Cron] Settlements: ${processed} created`);
  } catch (error) {
    console.error('[Cron] Settlement processing error:', error);
  }
}, cronOptions);

// Process expired escrows daily at 3 AM KST (30일 경과 자동 환불)
cron.schedule('0 3 * * *', async () => {
  try {
    const refunded = await escrowService.processExpiredEscrows(30);
    if (refunded > 0) {
      console.log(`[Cron] Escrows: ${refunded} expired and refunded`);
    }
  } catch (error) {
    console.error('[Cron] Escrow expiry processing error:', error);
  }
}, cronOptions);

// Clean up old read notifications weekly (Sunday 4 AM KST)
cron.schedule('0 4 * * 0', async () => {
  try {
    const deleted = await notificationService.deleteOld(90);
    if (deleted > 0) {
      console.log(`[Cron] Notifications: ${deleted} old notifications deleted`);
    }
  } catch (error) {
    console.error('[Cron] Notification cleanup error:', error);
  }
}, cronOptions);

// Anomaly detection and alert daily at 9:05 AM KST
cron.schedule('5 9 * * *', async () => {
  try {
    const alerts = await reportsService.detectAnomalies('7D');
    if (alerts.length > 0) {
      const notified = await notificationService.notifyAdminAlert(alerts);
      console.log(`[Cron] Anomaly alerts: ${alerts.length} detected, ${notified} admins notified`);
    }
  } catch (error) {
    console.error('[Cron] Anomaly detection error:', error);
  }
}, cronOptions);

// Start server
const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Screen Golf Sponsor Marketplace API v0.9                 ║
║                                                            ║
║   Server running on http://localhost:${PORT}                  ║
║   WebSocket enabled                                        ║
║   Environment: ${config.nodeEnv}                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export { app, httpServer, socketService };

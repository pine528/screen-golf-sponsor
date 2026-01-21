import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

import config, { validateEnv } from './config';
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
import { reconciliationService } from './services/reconciliation.service';
import { fanVoteService } from './services/fanVote.service';
import { validateEncryptionKey } from './utils/crypto';
import prisma from './models/prisma';

// 환경변수 검증 (가장 먼저)
validateEnv();

// Sentry 초기화
initSentry();

// 암호화 키 검증 (출금 계좌 암호화용)
// 프로덕션에서는 키가 없으면 서버 부팅 실패
if (config.nodeEnv === 'production') {
  if (!validateEncryptionKey()) {
    console.error('[FATAL] 암호화 키 검증 실패. 서버를 종료합니다.');
    process.exit(1);
  }
} else {
  // 개발/테스트 환경에서는 경고만 출력
  if (!process.env.BANK_ACCOUNT_ENC_KEY) {
    console.warn('[WARN] BANK_ACCOUNT_ENC_KEY가 설정되지 않았습니다. 계좌 암호화가 작동하지 않습니다.');
  } else {
    validateEncryptionKey();
  }
}

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
socketService.initialize(httpServer);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-idempotency-key'],
}));

// Request ID 미들웨어 (가장 먼저)
app.use(requestIdMiddleware);

// Rate limiting (프로덕션에서도 넉넉하게)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 200, // 분당 200 요청
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
  skip: () => config.nodeEnv === 'development', // 개발환경에서는 rate limit 스킵
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

// Withdrawal anomaly detection daily at 9:10 AM KST
cron.schedule('10 9 * * *', async () => {
  try {
    console.log('[Cron] 출금 정합성 검사 시작...');
    const alerts = await reportsService.detectWithdrawalAnomalies();
    if (alerts.length > 0) {
      const notified = await notificationService.notifyAdminAlert(alerts);
      console.log(`[Cron] 출금 이상징후 ${alerts.length}건 감지, ${notified}명 관리자에게 알림`);
    } else {
      console.log('[Cron] 출금 정합성 정상');
    }
  } catch (error) {
    console.error('[Cron] 출금 정합성 검사 실패:', error);
  }
}, cronOptions);

// ★ Phase 9-1.1: Process expired Direct Buy reservations every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    const count = await contractService.processExpiredReservations();
    if (count > 0) {
      console.log(`[Cron] Direct Buy: ${count} expired reservations released`);
    }
  } catch (error) {
    console.error('[Cron] Direct Buy reservation expiry error:', error);
  }
}, cronOptions);

// ★ Phase 10-3: Reconciliation - Daily Full at 9:20 AM KST
cron.schedule('20 9 * * *', async () => {
  try {
    console.log('[Cron] 결제/환불 대사 시작 (Full)...');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const result = await reconciliationService.runReconciliation('FULL', yesterday, now);

    console.log(`[Cron] 대사 완료: ${result.totalChecked}건 검사, ${result.issuesFound}건 이상 발견`);

    // HIGH+ 이슈 발견 시 관리자 알림
    const highOrCritical =
      (result.issuesBySeverity['HIGH'] || 0) +
      (result.issuesBySeverity['CRITICAL'] || 0);

    if (highOrCritical > 0) {
      const alerts = [
        {
          type: 'RECONCILIATION_ISSUES',
          severity: result.issuesBySeverity['CRITICAL'] ? 'critical' : 'high',
          title: '결제/환불 정합성 이상 발견',
          detail: `${result.issuesFound}건의 정합성 이상 발견 (CRITICAL: ${result.issuesBySeverity['CRITICAL'] || 0}, HIGH: ${result.issuesBySeverity['HIGH'] || 0})`,
          value: result.issuesFound,
          threshold: 0,
        },
      ];

      const notified = await notificationService.notifyAdminAlert(alerts as any);
      console.log(`[Cron] 관리자에게 대사 이상 알림 발송: ${notified}명`);
    }
  } catch (error) {
    console.error('[Cron] 결제/환불 대사 실패:', error);
  }
}, cronOptions);

// ★ Fan Vote: Auto-close expired votes every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await fanVoteService.autoCloseExpiredEvents();
    if (result.closedCount > 0) {
      console.log(`[Cron] Fan Votes: ${result.closedCount} expired votes closed`);
    }
  } catch (error) {
    console.error('[Cron] Fan Vote auto-close error:', error);
  }
}, cronOptions);

// Startup migration: Remove wallet FK constraints if they exist
async function runStartupMigrations() {
  try {
    console.log('[Startup] Checking wallet FK constraints...');

    // Try to drop the FK constraints (will silently fail if they don't exist)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallet_athlete_fk";
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallet_brand_fk";
    `);

    console.log('[Startup] Wallet FK constraints removed (if existed)');
  } catch (error) {
    console.warn('[Startup] Could not remove FK constraints (may not exist):', error);
  }
}

// Start server
const PORT = config.port;

// Run startup migrations then start server
runStartupMigrations().then(() => {
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
});

export { app, httpServer, socketService };

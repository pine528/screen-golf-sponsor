/**
 * 운영 지표 API
 * 에스크로/정산 핵심 지표 및 헬스체크
 */

import { Router, Request, Response } from 'express';
import prisma from '../models/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

/**
 * @route GET /api/metrics/health
 * @desc 운영 헬스체크 (대시보드용)
 * @access Admin
 */
router.get('/health', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    // DB 연결 체크
    await prisma.$queryRaw`SELECT 1`;

    // 대기 중인 리뷰 수
    const [pendingAssets, pendingVerifications] = await Promise.all([
      prisma.creativeAsset.count({ where: { status: 'SUBMITTED' } }),
      prisma.verification.count({ where: { status: 'SUBMITTED' } }),
    ]);

    // HELD 상태 에스크로 (주의 필요)
    const heldEscrows = await prisma.escrow.count({ where: { status: 'HELD' } });

    // 30일 이상 HELD 상태 (만료 임박)
    const expiringDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000); // 25일 경과
    const expiringEscrows = await prisma.escrow.count({
      where: {
        status: 'HELD',
        createdAt: { lt: expiringDate },
      },
    });

    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      pendingReviews: {
        assets: pendingAssets,
        verifications: pendingVerifications,
        total: pendingAssets + pendingVerifications,
      },
      escrows: {
        held: heldEscrows,
        expiringSoon: expiringEscrows,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
      },
    });
  }
});

/**
 * @route GET /api/metrics/escrow
 * @desc 에스크로/정산 핵심 지표 (관리자 전용)
 * @access Admin
 */
router.get('/escrow', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // 오늘 통계
  const [todayHeld, todayReleased, todayRefunded] = await Promise.all([
    prisma.escrow.aggregate({
      where: { status: 'HELD', createdAt: { gte: today } },
      _count: true,
      _sum: { grossAmount: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'RELEASED', releasedAt: { gte: today } },
      _count: true,
      _sum: { grossAmount: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'REFUNDED', refundedAt: { gte: today } },
      _count: true,
      _sum: { grossAmount: true },
    }),
  ]);

  // 전체 통계
  const totalStats = await prisma.escrow.groupBy({
    by: ['status'],
    _count: true,
    _sum: { grossAmount: true },
  });

  // 지난 7일 추이 (일별)
  const dailyStats = await prisma.$queryRaw<Array<{
    date: Date;
    status: string;
    count: bigint;
    total: Decimal;
  }>>`
    SELECT
      DATE("created_at") as date,
      status,
      COUNT(*) as count,
      COALESCE(SUM("gross_amount"), 0) as total
    FROM "Escrow"
    WHERE "created_at" >= ${weekAgo}
    GROUP BY DATE("created_at"), status
    ORDER BY date DESC
  `;

  // 플랫폼 수익 (수수료 합계)
  const platformRevenue = await prisma.escrow.aggregate({
    where: { status: 'RELEASED' },
    _sum: { platformFee: true },
  });

  // 선수 정산 대기 (HELD 상태)
  const pendingPayout = await prisma.escrow.aggregate({
    where: { status: 'HELD' },
    _sum: { athletePayout: true },
  });

  sendSuccess(res, {
    today: {
      held: {
        count: todayHeld._count,
        amount: todayHeld._sum.grossAmount?.toString() || '0',
      },
      released: {
        count: todayReleased._count,
        amount: todayReleased._sum.grossAmount?.toString() || '0',
      },
      refunded: {
        count: todayRefunded._count,
        amount: todayRefunded._sum.grossAmount?.toString() || '0',
      },
    },
    total: totalStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = {
        count: stat._count,
        amount: stat._sum.grossAmount?.toString() || '0',
      };
      return acc;
    }, {} as Record<string, { count: number; amount: string }>),
    weekly: dailyStats.map(d => ({
      date: d.date,
      status: d.status,
      count: Number(d.count),
      amount: d.total.toString(),
    })),
    summary: {
      platformRevenue: platformRevenue._sum.platformFee?.toString() || '0',
      pendingAthletePayouts: pendingPayout._sum.athletePayout?.toString() || '0',
    },
  });
});

/**
 * @route GET /api/metrics/wallets
 * @desc 지갑 잔액 현황 (관리자 전용)
 * @access Admin
 */
router.get('/wallets', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  // 지갑 유형별 합계
  const walletStats = await prisma.wallet.groupBy({
    by: ['ownerType'],
    _sum: {
      balance: true,
      frozenAmount: true,
    },
    _count: true,
  });

  // 플랫폼 지갑 상세
  const platformWallet = await prisma.wallet.findUnique({
    where: {
      ownerType_ownerId: { ownerType: 'PLATFORM', ownerId: 'SYSTEM' },
    },
  });

  // 잔액 상위 10 브랜드
  const topBrands = await prisma.wallet.findMany({
    where: { ownerType: 'BRAND' },
    orderBy: { balance: 'desc' },
    take: 10,
    include: {
      brand: {
        select: { id: true, name: true },
      },
    },
  });

  // 잔액 상위 10 선수
  const topAthletes = await prisma.wallet.findMany({
    where: { ownerType: 'ATHLETE' },
    orderBy: { balance: 'desc' },
    take: 10,
    include: {
      athlete: {
        select: { id: true, name: true },
      },
    },
  });

  sendSuccess(res, {
    byType: walletStats.map(w => ({
      ownerType: w.ownerType,
      count: w._count,
      totalBalance: w._sum.balance?.toString() || '0',
      totalFrozen: w._sum.frozenAmount?.toString() || '0',
    })),
    platform: platformWallet ? {
      balance: platformWallet.balance.toString(),
      frozenAmount: platformWallet.frozenAmount.toString(),
    } : null,
    topBrands: topBrands.map(w => ({
      brandId: w.ownerId,
      brandName: (w as any).brand?.name || 'Unknown',
      balance: w.balance.toString(),
      frozenAmount: w.frozenAmount.toString(),
    })),
    topAthletes: topAthletes.map(w => ({
      athleteId: w.ownerId,
      athleteName: (w as any).athlete?.name || 'Unknown',
      balance: w.balance.toString(),
    })),
  });
});

export default router;

/**
 * Reports Service
 * 운영 리포트 및 이상징후 감지
 */

import prisma from '../models/prisma';

interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  value: number;
  threshold: number;
  createdAt: string;
}

type RangeType = 'TODAY' | '7D' | '30D' | 'MTD' | 'QTD' | 'YTD';

function getDateRange(range: RangeType): { start: Date; end: Date } {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const kstToday = new Date(kstNow.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const todayStart = new Date(kstToday.getTime() - kstOffset);

  let start: Date;
  const end = now;

  switch (range) {
    case 'TODAY':
      start = todayStart;
      break;
    case '7D':
      start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      break;
    case '30D':
      start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
      break;
    case 'MTD':
      const monthStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), 1);
      start = new Date(monthStart.getTime() - kstOffset);
      break;
    case 'QTD':
      const quarter = Math.floor(kstNow.getMonth() / 3);
      const quarterStart = new Date(kstNow.getFullYear(), quarter * 3, 1);
      start = new Date(quarterStart.getTime() - kstOffset);
      break;
    case 'YTD':
      const yearStart = new Date(kstNow.getFullYear(), 0, 1);
      start = new Date(yearStart.getTime() - kstOffset);
      break;
    default:
      start = todayStart;
  }

  return { start, end };
}

export class ReportsService {
  /**
   * Detect anomalies based on predefined rules
   */
  async detectAnomalies(range: RangeType = '7D'): Promise<Anomaly[]> {
    const alerts: Anomaly[] = [];
    const now = new Date();

    const { start: rangeStart } = getDateRange(range);
    const todayStart = getDateRange('TODAY').start;

    // 1. 환불률 급증 체크
    const [recentRefundRate, todayRefundRate] = await Promise.all([
      (async () => {
        const released = await prisma.escrow.count({
          where: { status: 'RELEASED', releasedAt: { gte: rangeStart, lt: todayStart } },
        });
        const refunded = await prisma.escrow.count({
          where: { status: 'REFUNDED', refundedAt: { gte: rangeStart, lt: todayStart } },
        });
        return released + refunded > 0 ? (refunded / (released + refunded)) * 100 : 0;
      })(),
      (async () => {
        const released = await prisma.escrow.count({
          where: { status: 'RELEASED', releasedAt: { gte: todayStart } },
        });
        const refunded = await prisma.escrow.count({
          where: { status: 'REFUNDED', refundedAt: { gte: todayStart } },
        });
        return released + refunded > 0 ? (refunded / (released + refunded)) * 100 : 0;
      })(),
    ]);

    if (todayRefundRate > recentRefundRate * 1.5 && todayRefundRate > 10) {
      alerts.push({
        type: 'REFUND_RATE_SPIKE',
        severity: todayRefundRate > recentRefundRate * 2 ? 'high' : 'medium',
        title: '환불률 급증',
        detail: `오늘 환불률 ${todayRefundRate.toFixed(1)}%가 최근 평균 ${recentRefundRate.toFixed(1)}% 대비 급증했습니다.`,
        value: todayRefundRate,
        threshold: recentRefundRate * 1.5,
        createdAt: now.toISOString(),
      });
    }

    // 2. HELD over 24h 비율 급증
    const totalHeld = await prisma.escrow.count({ where: { status: 'HELD' } });
    const heldOver24h = await prisma.escrow.count({
      where: { status: 'HELD', createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    const heldOver24hRate = totalHeld > 0 ? (heldOver24h / totalHeld) * 100 : 0;

    if (heldOver24hRate > 30) {
      alerts.push({
        type: 'HELD_BACKLOG_HIGH',
        severity: heldOver24hRate > 50 ? 'high' : 'medium',
        title: 'HELD 백로그 증가',
        detail: `24시간 이상 HELD 상태인 에스크로가 ${heldOver24h}건 (${heldOver24hRate.toFixed(1)}%)입니다.`,
        value: heldOver24hRate,
        threshold: 30,
        createdAt: now.toISOString(),
      });
    }

    // 3. 수동처리 오늘 급증
    const [recentManualAvg, todayManual] = await Promise.all([
      (async () => {
        const count = await prisma.adminActionLog.count({
          where: {
            createdAt: { gte: rangeStart, lt: todayStart },
            action: { in: ['ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL'] },
          },
        });
        const days = Math.max(1, Math.floor((todayStart.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)));
        return count / days;
      })(),
      prisma.adminActionLog.count({
        where: {
          createdAt: { gte: todayStart },
          action: { in: ['ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL'] },
        },
      }),
    ]);

    if (todayManual > recentManualAvg * 3 && todayManual >= 3) {
      alerts.push({
        type: 'MANUAL_ACTION_SPIKE',
        severity: todayManual > recentManualAvg * 5 ? 'high' : 'medium',
        title: '수동 처리 급증',
        detail: `오늘 수동 처리 ${todayManual}건이 일평균 ${recentManualAvg.toFixed(1)}건 대비 급증했습니다.`,
        value: todayManual,
        threshold: recentManualAvg * 3,
        createdAt: now.toISOString(),
      });
    }

    // 4. Pending Reviews 임계치 초과
    const pendingAssets = await prisma.creativeAsset.count({ where: { status: 'SUBMITTED' } });
    const pendingVerifications = await prisma.verification.count({ where: { status: 'SUBMITTED' } });
    const totalPending = pendingAssets + pendingVerifications;

    if (totalPending > 50) {
      alerts.push({
        type: 'PENDING_REVIEWS_HIGH',
        severity: totalPending > 100 ? 'high' : 'medium',
        title: '대기 리뷰 과다',
        detail: `대기 중인 리뷰가 ${totalPending}건 (에셋 ${pendingAssets}, 검증 ${pendingVerifications})입니다.`,
        value: totalPending,
        threshold: 50,
        createdAt: now.toISOString(),
      });
    }

    // 5. HELD over 7d (장기 미처리)
    const heldOver7d = await prisma.escrow.count({
      where: { status: 'HELD', createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    });

    if (heldOver7d > 5) {
      alerts.push({
        type: 'HELD_LONG_TERM',
        severity: heldOver7d > 10 ? 'critical' : 'high',
        title: '장기 HELD 에스크로',
        detail: `7일 이상 HELD 상태인 에스크로가 ${heldOver7d}건 있습니다. 만료 임박 여부 확인 필요.`,
        value: heldOver7d,
        threshold: 5,
        createdAt: now.toISOString(),
      });
    }

    // severity 순으로 정렬
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  }
}

export const reportsService = new ReportsService();

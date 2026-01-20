/**
 * Reports Service
 * 운영 리포트 및 이상징후 감지
 */

import prisma from '../models/prisma';
import { withdrawalService } from './withdrawal.service';

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

  /**
   * 출금 관련 이상징후 감지
   * - 승인 후 지급 대기 과다
   * - 일일 지급 급증
   * - 배치 실패율 높음
   * - 동결금액 정합성 오류
   * - 장기 미승인 건 과다
   */
  async detectWithdrawalAnomalies(): Promise<Anomaly[]> {
    const alerts: Anomaly[] = [];
    const now = new Date();

    // 메트릭 조회
    const metrics = await withdrawalService.getMetrics();

    // 규칙 1: 승인 후 지급 대기 과다 (> 50건)
    const pendingApprovedCount = metrics.pending.approved.count;
    if (pendingApprovedCount > 50) {
      alerts.push({
        type: 'WITHDRAWAL_PENDING_HIGH',
        severity: pendingApprovedCount > 100 ? 'high' : 'medium',
        title: '출금 지급 대기 과다',
        detail: `승인 후 지급 대기 중인 출금이 ${pendingApprovedCount}건입니다. 배치 처리가 필요합니다.`,
        value: pendingApprovedCount,
        threshold: 50,
        createdAt: now.toISOString(),
      });
    }

    // 규칙 2: 일일 지급 급증 (7일 평균 대비 2배 이상)
    const todayPaidCount = metrics.today.paid.count;
    const avg7d = await withdrawalService.getAvgPaidLast7Days();
    if (todayPaidCount > avg7d * 2 && avg7d > 0 && todayPaidCount >= 5) {
      alerts.push({
        type: 'WITHDRAWAL_PAID_SPIKE',
        severity: 'medium',
        title: '출금 지급 급증',
        detail: `오늘 지급 완료 ${todayPaidCount}건이 7일 일평균 ${avg7d.toFixed(1)}건 대비 급증했습니다.`,
        value: todayPaidCount,
        threshold: avg7d * 2,
        createdAt: now.toISOString(),
      });
    }

    // 규칙 3: 배치 실패율 높음 (> 10%)
    // 배치에 포함되어 있지만 여전히 APPROVED 상태인 건 / 전체 배치 포함 건
    const failedLast24h = metrics.failed.last24h;
    const batchTotalToday = metrics.batch.todayCompleted > 0
      ? await this.getBatchItemCountLast24h()
      : 0;

    if (batchTotalToday > 0) {
      const failRate = failedLast24h / batchTotalToday;
      if (failRate > 0.1) {
        alerts.push({
          type: 'WITHDRAWAL_BATCH_FAIL_RATE',
          severity: 'high',
          title: '배치 처리 실패율 높음',
          detail: `최근 24시간 배치 처리 실패율이 ${(failRate * 100).toFixed(1)}%입니다. (실패 ${failedLast24h}건 / 총 ${batchTotalToday}건)`,
          value: failRate * 100,
          threshold: 10,
          createdAt: now.toISOString(),
        });
      }
    }

    // 규칙 4: 동결금액 정합성 오류 (frozen < 0 OR frozen > balance)
    const frozenAnomalies = await withdrawalService.checkFrozenIntegrity();
    if (frozenAnomalies.length > 0) {
      alerts.push({
        type: 'WITHDRAWAL_FROZEN_ANOMALY',
        severity: 'critical',
        title: '동결금액 정합성 오류',
        detail: `${frozenAnomalies.length}개 지갑에서 동결금액 정합성 오류 발견. ` +
          `문제: ${frozenAnomalies.map(a => `${a.ownerId}(${a.issue})`).slice(0, 3).join(', ')}${frozenAnomalies.length > 3 ? ' 외' : ''}`,
        value: frozenAnomalies.length,
        threshold: 0,
        createdAt: now.toISOString(),
      });
    }

    // 규칙 5: 장기 미승인 건 과다 (3일 이상 REQUESTED 상태 > 10건)
    const longPendingCount = await withdrawalService.getLongPendingCount(3);
    if (longPendingCount > 10) {
      alerts.push({
        type: 'WITHDRAWAL_LONG_PENDING',
        severity: longPendingCount > 30 ? 'high' : 'medium',
        title: '장기 미승인 출금',
        detail: `3일 이상 승인 대기 중인 출금 요청이 ${longPendingCount}건입니다. 검토가 필요합니다.`,
        value: longPendingCount,
        threshold: 10,
        createdAt: now.toISOString(),
      });
    }

    // severity 순으로 정렬
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  }

  /**
   * 최근 24시간 배치에 포함된 총 출금 건수
   */
  private async getBatchItemCountLast24h(): Promise<number> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma.withdrawalRequest.count({
      where: {
        batchId: { not: null },
        updatedAt: { gte: last24h },
      },
    });
    return result;
  }
}

export const reportsService = new ReportsService();

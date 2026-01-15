/**
 * Admin Reports Routes
 * 운영 리포트 API - 매출/수수료/환불/백로그/이상징후
 */

import { Router, Request, Response } from 'express';
import prisma from '../models/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// 모든 라우트에 ADMIN 인증 필요
router.use(authenticate, authorize('ADMIN'));

// =========================================
// 헬퍼 함수들
// =========================================

type RangeType = 'TODAY' | '7D' | '30D' | 'MTD' | 'QTD' | 'YTD';

function getDateRange(range: RangeType, tz = 'Asia/Seoul'): { start: Date; end: Date } {
  const now = new Date();
  // KST 기준 오늘 시작
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

function toDecimalString(val: Decimal | null | undefined): string {
  if (!val) return '0';
  return val.toString();
}

function toNumber(val: Decimal | bigint | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'number') return val;
  return val.toNumber();
}

// CSV 필드 이스케이프 (수식 주입 방어)
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // 수식 주입 방어: = + - @ 로 시작하면 앞에 ' 추가
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: any[]): string {
  return fields.map(escapeCsvField).join(',');
}

// =========================================
// A) GET /admin/reports/overview
// =========================================
router.get('/overview', async (req: Request, res: Response) => {
  const range = (req.query.range as RangeType) || '7D';
  const { start, end } = getDateRange(range);

  // 에스크로 통계
  const [heldStats, releasedStats, refundedStats] = await Promise.all([
    prisma.escrow.aggregate({
      where: { status: 'HELD', createdAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'RELEASED', releasedAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true, platformFee: true, athletePayout: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'REFUNDED', refundedAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true },
    }),
  ]);

  // 수동 액션 카운트
  const manualActionCount = await prisma.adminActionLog.count({
    where: {
      createdAt: { gte: start, lte: end },
      action: { in: ['ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL'] },
    },
  });

  // 백로그
  const [pendingAssets, pendingVerifications] = await Promise.all([
    prisma.creativeAsset.count({ where: { status: 'SUBMITTED' } }),
    prisma.verification.count({ where: { status: 'SUBMITTED' } }),
  ]);

  // HELD over 24h / 7d
  const now = new Date();
  const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [heldOver24h, heldOver7d] = await Promise.all([
    prisma.escrow.count({ where: { status: 'HELD', createdAt: { lt: h24Ago } } }),
    prisma.escrow.count({ where: { status: 'HELD', createdAt: { lt: d7Ago } } }),
  ]);

  const releasedCount = releasedStats._count;
  const refundedCount = refundedStats._count;
  const refundRate = releasedCount + refundedCount > 0
    ? (refundedCount / (releasedCount + refundedCount) * 100).toFixed(2)
    : '0.00';

  sendSuccess(res, {
    range,
    period: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      grossHeldTotal: toDecimalString(heldStats._sum.grossAmount),
      grossReleasedTotal: toDecimalString(releasedStats._sum.grossAmount),
      grossRefundedTotal: toDecimalString(refundedStats._sum.grossAmount),
      platformFeeTotal: toDecimalString(releasedStats._sum.platformFee),
      athletePayoutTotal: toDecimalString(releasedStats._sum.athletePayout),
      refundRate,
    },
    counts: {
      heldCount: heldStats._count,
      releasedCount,
      refundedCount,
      manualActionCount,
    },
    backlogs: {
      pendingAssets,
      pendingVerifications,
      pendingTotal: pendingAssets + pendingVerifications,
      heldOver24hCount: heldOver24h,
      heldOver7dCount: heldOver7d,
    },
  });
});

// =========================================
// B) GET /admin/reports/timeseries
// =========================================
router.get('/timeseries', async (req: Request, res: Response) => {
  const range = (req.query.range as RangeType) || '7D';
  const metric = (req.query.metric as string) || 'gross';
  const bucket = range === 'TODAY' ? 'hour' : 'day';
  const { start, end } = getDateRange(range);

  let data: Array<{ t: string; value: string | number }> = [];

  // KST 기준 버킷팅을 위한 SQL
  const dateTrunc = bucket === 'hour'
    ? `DATE_TRUNC('hour', "created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`
    : `DATE_TRUNC('day', "created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`;

  const releasedDateTrunc = bucket === 'hour'
    ? `DATE_TRUNC('hour', "released_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`
    : `DATE_TRUNC('day', "released_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`;

  const refundedDateTrunc = bucket === 'hour'
    ? `DATE_TRUNC('hour', "refunded_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`
    : `DATE_TRUNC('day', "refunded_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')`;

  switch (metric) {
    case 'gross':
      // Released gross amount
      const grossData = await prisma.$queryRaw<Array<{ t: Date; value: Decimal }>>`
        SELECT ${releasedDateTrunc}::timestamp as t, COALESCE(SUM("gross_amount"), 0) as value
        FROM "Escrow"
        WHERE status = 'RELEASED' AND "released_at" >= ${start} AND "released_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = grossData.map(d => ({ t: d.t.toISOString(), value: toDecimalString(d.value) }));
      break;

    case 'fee':
      // Platform fee
      const feeData = await prisma.$queryRaw<Array<{ t: Date; value: Decimal }>>`
        SELECT ${releasedDateTrunc}::timestamp as t, COALESCE(SUM("platform_fee"), 0) as value
        FROM "Escrow"
        WHERE status = 'RELEASED' AND "released_at" >= ${start} AND "released_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = feeData.map(d => ({ t: d.t.toISOString(), value: toDecimalString(d.value) }));
      break;

    case 'payout':
      // Athlete payout
      const payoutData = await prisma.$queryRaw<Array<{ t: Date; value: Decimal }>>`
        SELECT ${releasedDateTrunc}::timestamp as t, COALESCE(SUM("athlete_payout"), 0) as value
        FROM "Escrow"
        WHERE status = 'RELEASED' AND "released_at" >= ${start} AND "released_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = payoutData.map(d => ({ t: d.t.toISOString(), value: toDecimalString(d.value) }));
      break;

    case 'refundCount':
      const refundData = await prisma.$queryRaw<Array<{ t: Date; value: bigint }>>`
        SELECT ${refundedDateTrunc}::timestamp as t, COUNT(*) as value
        FROM "Escrow"
        WHERE status = 'REFUNDED' AND "refunded_at" >= ${start} AND "refunded_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = refundData.map(d => ({ t: d.t.toISOString(), value: toNumber(d.value) }));
      break;

    case 'manualActions':
      const manualData = await prisma.$queryRaw<Array<{ t: Date; value: bigint }>>`
        SELECT ${dateTrunc}::timestamp as t, COUNT(*) as value
        FROM "admin_action_logs"
        WHERE "created_at" >= ${start} AND "created_at" <= ${end}
          AND action IN ('ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL')
        GROUP BY 1
        ORDER BY 1
      `;
      data = manualData.map(d => ({ t: d.t.toISOString(), value: toNumber(d.value) }));
      break;

    case 'pendingReviews':
      // 스냅샷 방식: 현재 시점 기준으로 과거 데이터를 정확히 알 수 없음
      // 대신 최근 제출된 건수로 대체
      const pendingData = await prisma.$queryRaw<Array<{ t: Date; value: bigint }>>`
        SELECT ${dateTrunc}::timestamp as t, COUNT(*) as value
        FROM "creative_assets"
        WHERE "created_at" >= ${start} AND "created_at" <= ${end}
          AND status = 'SUBMITTED'
        GROUP BY 1
        ORDER BY 1
      `;
      data = pendingData.map(d => ({ t: d.t.toISOString(), value: toNumber(d.value) }));
      break;

    case 'heldCount':
      const heldData = await prisma.$queryRaw<Array<{ t: Date; value: bigint }>>`
        SELECT ${dateTrunc}::timestamp as t, COUNT(*) as value
        FROM "Escrow"
        WHERE status = 'HELD' AND "created_at" >= ${start} AND "created_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = heldData.map(d => ({ t: d.t.toISOString(), value: toNumber(d.value) }));
      break;

    case 'releasedCount':
      const releasedData = await prisma.$queryRaw<Array<{ t: Date; value: bigint }>>`
        SELECT ${releasedDateTrunc}::timestamp as t, COUNT(*) as value
        FROM "Escrow"
        WHERE status = 'RELEASED' AND "released_at" >= ${start} AND "released_at" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      data = releasedData.map(d => ({ t: d.t.toISOString(), value: toNumber(d.value) }));
      break;

    default:
      break;
  }

  sendSuccess(res, { range, metric, bucket, data });
});

// =========================================
// C) GET /admin/reports/funnel
// =========================================
router.get('/funnel', async (req: Request, res: Response) => {
  const range = (req.query.range as RangeType) || '7D';
  const { start, end } = getDateRange(range);

  const [
    contractsCreated,
    fullySigned,
    escrowHeld,
    assetSubmitted,
    assetApproved,
    verificationSubmitted,
    verificationVerified,
    released,
    refunded,
  ] = await Promise.all([
    prisma.contract.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.contract.count({ where: { signedAt: { gte: start, lte: end } } }),
    prisma.escrow.count({ where: { status: 'HELD', createdAt: { gte: start, lte: end } } }),
    prisma.creativeAsset.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.creativeAsset.count({ where: { status: 'APPROVED', reviewedAt: { gte: start, lte: end } } }),
    prisma.verification.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.verification.count({ where: { status: 'VERIFIED', verifiedAt: { gte: start, lte: end } } }),
    prisma.escrow.count({ where: { status: 'RELEASED', releasedAt: { gte: start, lte: end } } }),
    prisma.escrow.count({ where: { status: 'REFUNDED', refundedAt: { gte: start, lte: end } } }),
  ]);

  // 전환율 계산
  const calcRate = (current: number, prev: number): string => {
    if (prev === 0) return '0.00';
    return ((current / prev) * 100).toFixed(2);
  };

  sendSuccess(res, {
    range,
    funnel: [
      { stage: 'contractsCreated', count: contractsCreated, rate: '100.00' },
      { stage: 'fullySigned', count: fullySigned, rate: calcRate(fullySigned, contractsCreated) },
      { stage: 'escrowHeld', count: escrowHeld, rate: calcRate(escrowHeld, fullySigned) },
      { stage: 'assetSubmitted', count: assetSubmitted, rate: calcRate(assetSubmitted, escrowHeld) },
      { stage: 'assetApproved', count: assetApproved, rate: calcRate(assetApproved, assetSubmitted) },
      { stage: 'verificationSubmitted', count: verificationSubmitted, rate: calcRate(verificationSubmitted, assetApproved) },
      { stage: 'verificationVerified', count: verificationVerified, rate: calcRate(verificationVerified, verificationSubmitted) },
      { stage: 'released', count: released, rate: calcRate(released, verificationVerified) },
      { stage: 'refunded', count: refunded, rate: calcRate(refunded, escrowHeld) },
    ],
  });
});

// =========================================
// D) GET /admin/reports/anomalies
// =========================================
interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  value: number;
  threshold: number;
  createdAt: string;
}

router.get('/anomalies', async (req: Request, res: Response) => {
  const range = (req.query.range as RangeType) || '7D';
  const alerts: Anomaly[] = [];
  const now = new Date();

  // 기준: 지난 7일 평균 vs 오늘
  const { start: rangeStart } = getDateRange(range);
  const todayStart = getDateRange('TODAY').start;

  // 1. 환불률 급증 체크
  const [recentRefundRate, todayRefundRate] = await Promise.all([
    // 지난 7일 평균 환불률
    (async () => {
      const released = await prisma.escrow.count({
        where: { status: 'RELEASED', releasedAt: { gte: rangeStart, lt: todayStart } },
      });
      const refunded = await prisma.escrow.count({
        where: { status: 'REFUNDED', refundedAt: { gte: rangeStart, lt: todayStart } },
      });
      return released + refunded > 0 ? (refunded / (released + refunded)) * 100 : 0;
    })(),
    // 오늘 환불률
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

  sendSuccess(res, { range, alerts, alertCount: alerts.length });
});

// =========================================
// E) GET /admin/reports/export.csv
// =========================================
router.get('/export.csv', async (req: Request, res: Response) => {
  const range = (req.query.range as RangeType) || '7D';
  const { start, end } = getDateRange(range);

  // Overview 데이터
  const [heldStats, releasedStats, refundedStats] = await Promise.all([
    prisma.escrow.aggregate({
      where: { status: 'HELD', createdAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'RELEASED', releasedAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true, platformFee: true, athletePayout: true },
    }),
    prisma.escrow.aggregate({
      where: { status: 'REFUNDED', refundedAt: { gte: start, lte: end } },
      _count: true,
      _sum: { grossAmount: true },
    }),
  ]);

  const manualActionCount = await prisma.adminActionLog.count({
    where: {
      createdAt: { gte: start, lte: end },
      action: { in: ['ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL'] },
    },
  });

  const pendingAssets = await prisma.creativeAsset.count({ where: { status: 'SUBMITTED' } });
  const pendingVerifications = await prisma.verification.count({ where: { status: 'SUBMITTED' } });

  // Daily timeseries
  const dailyData = await prisma.$queryRaw<Array<{
    date: Date;
    held_count: bigint;
    released_count: bigint;
    refunded_count: bigint;
    gross_released: Decimal;
    platform_fee: Decimal;
  }>>`
    SELECT
      DATE("released_at" AT TIME ZONE 'Asia/Seoul') as date,
      COUNT(CASE WHEN status = 'HELD' THEN 1 END) as held_count,
      COUNT(CASE WHEN status = 'RELEASED' THEN 1 END) as released_count,
      COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) as refunded_count,
      COALESCE(SUM(CASE WHEN status = 'RELEASED' THEN "gross_amount" ELSE 0 END), 0) as gross_released,
      COALESCE(SUM(CASE WHEN status = 'RELEASED' THEN "platform_fee" ELSE 0 END), 0) as platform_fee
    FROM "Escrow"
    WHERE ("released_at" >= ${start} AND "released_at" <= ${end})
       OR ("refunded_at" >= ${start} AND "refunded_at" <= ${end})
       OR ("created_at" >= ${start} AND "created_at" <= ${end})
    GROUP BY 1
    ORDER BY 1
  `;

  // CSV 생성
  const lines: string[] = [];

  // 섹션 1: Overview
  lines.push('=== Overview ===');
  lines.push(toCsvRow(['Metric', 'Value']));
  lines.push(toCsvRow(['Range', range]));
  lines.push(toCsvRow(['Period Start', start.toISOString()]));
  lines.push(toCsvRow(['Period End', end.toISOString()]));
  lines.push(toCsvRow(['Held Count', heldStats._count]));
  lines.push(toCsvRow(['Held Total', toDecimalString(heldStats._sum.grossAmount)]));
  lines.push(toCsvRow(['Released Count', releasedStats._count]));
  lines.push(toCsvRow(['Released Total', toDecimalString(releasedStats._sum.grossAmount)]));
  lines.push(toCsvRow(['Platform Fee Total', toDecimalString(releasedStats._sum.platformFee)]));
  lines.push(toCsvRow(['Athlete Payout Total', toDecimalString(releasedStats._sum.athletePayout)]));
  lines.push(toCsvRow(['Refunded Count', refundedStats._count]));
  lines.push(toCsvRow(['Refunded Total', toDecimalString(refundedStats._sum.grossAmount)]));
  lines.push(toCsvRow(['Manual Actions', manualActionCount]));
  lines.push(toCsvRow(['Pending Assets', pendingAssets]));
  lines.push(toCsvRow(['Pending Verifications', pendingVerifications]));
  lines.push('');

  // 섹션 2: Daily Data
  lines.push('=== Daily Data ===');
  lines.push(toCsvRow(['Date', 'Held', 'Released', 'Refunded', 'Gross Released', 'Platform Fee']));
  for (const row of dailyData) {
    lines.push(toCsvRow([
      row.date?.toISOString().slice(0, 10) || '',
      toNumber(row.held_count),
      toNumber(row.released_count),
      toNumber(row.refunded_count),
      toDecimalString(row.gross_released),
      toDecimalString(row.platform_fee),
    ]));
  }

  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=finance_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send('\uFEFF' + csv);
});

export default router;

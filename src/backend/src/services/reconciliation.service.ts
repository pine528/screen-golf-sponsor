/**
 * Phase 10-3: Reconciliation Service
 * 결제/환불 데이터 정합성 자동 점검
 */

import prisma from '../models/prisma';
import {
  ReconciliationScope,
  ReconciliationRunStatus,
  ReconciliationIssueSeverity,
  ReconciliationIssueType,
  ReconciliationIssueStatus,
  TopupPaymentStatus,
  RefundRequestStatus,
  LedgerTxType,
  Prisma,
} from '@prisma/client';
import { toNumber } from './escrow.service';

interface ReconciliationResult {
  runId: string;
  scope: ReconciliationScope;
  totalChecked: number;
  issuesFound: number;
  issuesBySeverity: Record<string, number>;
  duration: number;
}

interface IssueDetail {
  issueType: ReconciliationIssueType;
  severity: ReconciliationIssueSeverity;
  relatedTopupId?: string;
  relatedRefundId?: string;
  relatedWalletId?: string;
  detail: any;
}

export class ReconciliationService {
  /**
   * 전체 대사 실행
   */
  async runReconciliation(
    scope: ReconciliationScope,
    fromDate: Date,
    toDate: Date
  ): Promise<ReconciliationResult> {
    const startTime = Date.now();
    let totalChecked = 0;
    const issues: IssueDetail[] = [];

    // ReconciliationRun 생성
    const run = await prisma.reconciliationRun.create({
      data: {
        scope,
        fromDate,
        toDate,
        status: ReconciliationRunStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // 1. Topup 검사
      const topupIssues = await this.checkTopups(fromDate, toDate);
      issues.push(...topupIssues.issues);
      totalChecked += topupIssues.checked;

      // 2. Refund 검사
      const refundIssues = await this.checkRefunds(fromDate, toDate);
      issues.push(...refundIssues.issues);
      totalChecked += refundIssues.checked;

      // 3. Wallet 음수 검사 (항상 실행 - CRITICAL)
      const walletIssues = await this.checkWalletSanity();
      issues.push(...walletIssues.issues);
      totalChecked += walletIssues.checked;

      // 4. FULL scope에서만 버전 충돌 검사 (LOW priority)
      if (scope === ReconciliationScope.FULL) {
        const versionIssues = await this.checkVersionConflictSpike(fromDate, toDate);
        issues.push(...versionIssues.issues);
        totalChecked += versionIssues.checked;
      }

      // CRITICAL_ONLY scope에서는 CRITICAL 이슈만 저장
      const issuesToSave = scope === ReconciliationScope.CRITICAL_ONLY
        ? issues.filter(i => i.severity === ReconciliationIssueSeverity.CRITICAL)
        : issues;

      // ReconciliationIssue 생성
      if (issuesToSave.length > 0) {
        await prisma.reconciliationIssue.createMany({
          data: issuesToSave.map(issue => ({
            runId: run.id,
            severity: issue.severity,
            issueType: issue.issueType,
            relatedTopupId: issue.relatedTopupId,
            relatedRefundId: issue.relatedRefundId,
            relatedWalletId: issue.relatedWalletId,
            detail: issue.detail,
            status: ReconciliationIssueStatus.OPEN,
          })),
        });
      }

      // Run 완료 처리
      await prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.COMPLETED,
          totalChecked,
          issuesFound: issuesToSave.length,
          completedAt: new Date(),
        },
      });

      const issuesBySeverity = issuesToSave.reduce((acc, i) => {
        acc[i.severity] = (acc[i.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        runId: run.id,
        scope,
        totalChecked,
        issuesFound: issuesToSave.length,
        issuesBySeverity,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      // Run 실패 처리
      await prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.FAILED,
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Topup 정합성 검사
   */
  async checkTopups(fromDate: Date, toDate: Date): Promise<{ checked: number; issues: IssueDetail[] }> {
    const issues: IssueDetail[] = [];
    let checked = 0;

    // 1. PAID인데 LedgerTx 없음 (CRITICAL)
    const paidTopups = await prisma.topupPayment.findMany({
      where: {
        status: TopupPaymentStatus.PAID,
        paidAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, walletId: true, amount: true, paidAt: true },
    });
    checked += paidTopups.length;

    for (const topup of paidTopups) {
      const ledgerTx = await prisma.ledgerTx.findFirst({
        where: {
          walletId: topup.walletId,
          type: LedgerTxType.TOPUP_DEPOSIT,
          refType: 'TOPUP_PAYMENT',
          refId: topup.id,
        },
      });

      if (!ledgerTx) {
        issues.push({
          issueType: ReconciliationIssueType.TOPUP_PAID_NO_LEDGER,
          severity: ReconciliationIssueSeverity.CRITICAL,
          relatedTopupId: topup.id,
          relatedWalletId: topup.walletId,
          detail: {
            message: 'TopupPayment가 PAID 상태이지만 해당 LedgerTx가 없습니다',
            amount: toNumber(topup.amount),
            paidAt: topup.paidAt,
          },
        });
      }
    }

    // 2. LedgerTx는 있는데 TopupPayment가 PAID가 아님 (HIGH)
    const topupLedgerTxs = await prisma.ledgerTx.findMany({
      where: {
        type: LedgerTxType.TOPUP_DEPOSIT,
        refType: 'TOPUP_PAYMENT',
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, refId: true, walletId: true, amount: true },
    });
    checked += topupLedgerTxs.length;

    for (const ltx of topupLedgerTxs) {
      if (!ltx.refId) continue;

      const topup = await prisma.topupPayment.findUnique({
        where: { id: ltx.refId },
        select: { id: true, status: true },
      });

      if (!topup || topup.status !== TopupPaymentStatus.PAID) {
        issues.push({
          issueType: ReconciliationIssueType.LEDGER_TOPUP_NO_PAID,
          severity: ReconciliationIssueSeverity.HIGH,
          relatedTopupId: ltx.refId,
          relatedWalletId: ltx.walletId,
          detail: {
            message: 'LedgerTx(TOPUP_DEPOSIT)가 있지만 TopupPayment가 PAID 상태가 아닙니다',
            ledgerTxId: ltx.id,
            topupStatus: topup?.status || 'NOT_FOUND',
          },
        });
      }
    }

    return { checked, issues };
  }

  /**
   * Refund 정합성 검사
   */
  async checkRefunds(fromDate: Date, toDate: Date): Promise<{ checked: number; issues: IssueDetail[] }> {
    const issues: IssueDetail[] = [];
    let checked = 0;

    // 1. REFUNDED인데 LedgerTx 없음 (CRITICAL)
    const refundedRequests = await prisma.refundRequest.findMany({
      where: {
        status: RefundRequestStatus.REFUNDED,
        updatedAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, walletId: true, amount: true, topupPaymentId: true },
    });
    checked += refundedRequests.length;

    for (const refund of refundedRequests) {
      const ledgerTx = await prisma.ledgerTx.findFirst({
        where: {
          walletId: refund.walletId,
          type: LedgerTxType.TOPUP_REFUND,
          refType: 'REFUND_REQUEST',
          refId: refund.id,
        },
      });

      if (!ledgerTx) {
        issues.push({
          issueType: ReconciliationIssueType.REFUND_REFUNDED_NO_LEDGER,
          severity: ReconciliationIssueSeverity.CRITICAL,
          relatedRefundId: refund.id,
          relatedTopupId: refund.topupPaymentId,
          relatedWalletId: refund.walletId,
          detail: {
            message: 'RefundRequest가 REFUNDED 상태이지만 해당 LedgerTx가 없습니다',
            amount: toNumber(refund.amount),
          },
        });
      }
    }

    // 2. LedgerTx는 있는데 RefundRequest가 REFUNDED가 아님 (HIGH)
    const refundLedgerTxs = await prisma.ledgerTx.findMany({
      where: {
        type: LedgerTxType.TOPUP_REFUND,
        refType: 'REFUND_REQUEST',
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, refId: true, walletId: true, amount: true },
    });
    checked += refundLedgerTxs.length;

    for (const ltx of refundLedgerTxs) {
      if (!ltx.refId) continue;

      const refund = await prisma.refundRequest.findUnique({
        where: { id: ltx.refId },
        select: { id: true, status: true },
      });

      if (!refund || refund.status !== RefundRequestStatus.REFUNDED) {
        issues.push({
          issueType: ReconciliationIssueType.LEDGER_REFUND_NO_REQUEST,
          severity: ReconciliationIssueSeverity.HIGH,
          relatedRefundId: ltx.refId,
          relatedWalletId: ltx.walletId,
          detail: {
            message: 'LedgerTx(TOPUP_REFUND)가 있지만 RefundRequest가 REFUNDED 상태가 아닙니다',
            ledgerTxId: ltx.id,
            refundStatus: refund?.status || 'NOT_FOUND',
          },
        });
      }
    }

    // 3. refundedAmount 불일치 검사 (MEDIUM)
    const topupsWithRefunds = await prisma.topupPayment.findMany({
      where: {
        refundedAmount: { gt: 0 },
        updatedAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, refundedAmount: true },
    });
    checked += topupsWithRefunds.length;

    for (const topup of topupsWithRefunds) {
      const refundSum = await prisma.refundRequest.aggregate({
        where: {
          topupPaymentId: topup.id,
          status: RefundRequestStatus.REFUNDED,
        },
        _sum: { amount: true },
      });

      const sumFromRequests = toNumber(refundSum._sum.amount);
      const recordedAmount = toNumber(topup.refundedAmount);

      // 1원 허용 오차
      if (Math.abs(sumFromRequests - recordedAmount) > 1) {
        issues.push({
          issueType: ReconciliationIssueType.REFUNDED_AMOUNT_MISMATCH,
          severity: ReconciliationIssueSeverity.MEDIUM,
          relatedTopupId: topup.id,
          detail: {
            message: 'TopupPayment.refundedAmount와 RefundRequest 합계가 일치하지 않습니다',
            recordedAmount,
            sumFromRequests,
            difference: recordedAmount - sumFromRequests,
          },
        });
      }
    }

    return { checked, issues };
  }

  /**
   * Wallet 음수 검사 (항상 실행)
   */
  async checkWalletSanity(): Promise<{ checked: number; issues: IssueDetail[] }> {
    const issues: IssueDetail[] = [];

    // 음수 잔액/동결 검사
    const anomalousWallets = await prisma.wallet.findMany({
      where: {
        OR: [
          { balance: { lt: 0 } },
          { frozenAmount: { lt: 0 } },
        ],
      },
      select: { id: true, ownerType: true, ownerId: true, balance: true, frozenAmount: true },
    });

    for (const wallet of anomalousWallets) {
      const balance = toNumber(wallet.balance);
      const frozen = toNumber(wallet.frozenAmount);

      issues.push({
        issueType: ReconciliationIssueType.WALLET_NEGATIVE,
        severity: ReconciliationIssueSeverity.CRITICAL,
        relatedWalletId: wallet.id,
        detail: {
          message: balance < 0
            ? 'Wallet 잔액이 음수입니다'
            : 'Wallet 동결 금액이 음수입니다',
          ownerType: wallet.ownerType,
          ownerId: wallet.ownerId,
          balance,
          frozenAmount: frozen,
        },
      });
    }

    const totalWallets = await prisma.wallet.count();
    return { checked: totalWallets, issues };
  }

  /**
   * 버전 충돌 급증 검사 (LOW priority, FULL scope만)
   */
  async checkVersionConflictSpike(fromDate: Date, toDate: Date): Promise<{ checked: number; issues: IssueDetail[] }> {
    const issues: IssueDetail[] = [];

    // 평균 대비 최대 버전이 현저히 높은 경우 플래그
    const walletStats = await prisma.wallet.aggregate({
      _avg: { version: true },
      _max: { version: true },
    });

    const avgVersion = walletStats._avg.version || 0;
    const maxVersion = walletStats._max.version || 0;

    // 최대 버전이 평균의 10배 이상이고 평균이 10 이상인 경우
    if (maxVersion > avgVersion * 10 && avgVersion > 10) {
      issues.push({
        issueType: ReconciliationIssueType.VERSION_CONFLICT_SPIKE,
        severity: ReconciliationIssueSeverity.LOW,
        detail: {
          message: 'Wallet 버전 충돌이 비정상적으로 높을 수 있습니다',
          avgVersion,
          maxVersion,
        },
      });
    }

    return { checked: 1, issues };
  }

  // =============================================
  // Admin API 헬퍼
  // =============================================

  /**
   * 대사 실행 목록 조회
   */
  async listRuns(options: {
    status?: ReconciliationRunStatus;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Prisma.ReconciliationRunWhereInput = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.reconciliationRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { issues: true } },
        },
      }),
      prisma.reconciliationRun.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 이슈 목록 조회
   */
  async listIssues(options: {
    runId?: string;
    severity?: ReconciliationIssueSeverity;
    issueType?: ReconciliationIssueType;
    status?: ReconciliationIssueStatus;
    limit?: number;
    offset?: number;
  } = {}) {
    const { runId, severity, issueType, status, limit = 50, offset = 0 } = options;

    const where: Prisma.ReconciliationIssueWhereInput = {};
    if (runId) where.runId = runId;
    if (severity) where.severity = severity;
    if (issueType) where.issueType = issueType;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.reconciliationIssue.findMany({
        where,
        orderBy: [
          { severity: 'asc' }, // CRITICAL 먼저 (알파벳순: CRITICAL < HIGH < LOW < MEDIUM)
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          run: { select: { id: true, scope: true, startedAt: true } },
        },
      }),
      prisma.reconciliationIssue.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 이슈 상태 변경
   */
  async updateIssueStatus(
    issueId: string,
    status: ReconciliationIssueStatus,
    adminId: string,
    note?: string
  ) {
    const issue = await prisma.reconciliationIssue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new Error('Issue not found');
    }

    const updateData: Prisma.ReconciliationIssueUpdateInput = { status };

    if (
      status === ReconciliationIssueStatus.RESOLVED ||
      status === ReconciliationIssueStatus.IGNORED
    ) {
      updateData.resolvedBy = adminId;
      updateData.resolvedAt = new Date();
      updateData.resolvedNote = note;
    }

    return prisma.reconciliationIssue.update({
      where: { id: issueId },
      data: updateData,
    });
  }

  /**
   * 이슈 요약 통계
   */
  async getIssuesSummary() {
    const [bySeverity, byType, byStatus] = await Promise.all([
      prisma.reconciliationIssue.groupBy({
        by: ['severity'],
        _count: true,
        where: { status: ReconciliationIssueStatus.OPEN },
      }),
      prisma.reconciliationIssue.groupBy({
        by: ['issueType'],
        _count: true,
        where: { status: ReconciliationIssueStatus.OPEN },
      }),
      prisma.reconciliationIssue.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return { bySeverity, byType, byStatus };
  }
}

export const reconciliationService = new ReconciliationService();

/**
 * Phase 10-3: Reconciliation Controller
 * 결제/환불 대사 Admin API
 */

import { Response, NextFunction } from 'express';
import { reconciliationService } from '../services/reconciliation.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import {
  ReconciliationScope,
  ReconciliationIssueSeverity,
  ReconciliationIssueType,
  ReconciliationIssueStatus,
} from '@prisma/client';

// CSV 헬퍼 (기존 패턴 재사용)
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Formula injection 방지
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

export class ReconciliationController {
  /**
   * GET /api/admin/reconciliation/runs
   * 대사 실행 목록
   */
  async listRuns(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, limit, offset } = req.query;

      const result = await reconciliationService.listRuns({
        status: status as any,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/reconciliation/runs
   * 수동 대사 실행
   */
  async createRun(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { scope, fromDate, toDate } = req.body;

      const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = toDate ? new Date(toDate) : new Date();

      const result = await reconciliationService.runReconciliation(
        (scope as ReconciliationScope) || ReconciliationScope.FULL,
        from,
        to
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/reconciliation/issues
   * 이슈 목록
   */
  async listIssues(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { runId, severity, issueType, status, limit, offset } = req.query;

      const result = await reconciliationService.listIssues({
        runId: runId as string,
        severity: severity as ReconciliationIssueSeverity,
        issueType: issueType as ReconciliationIssueType,
        status: status as ReconciliationIssueStatus,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/reconciliation/issues/summary
   * 이슈 요약 통계
   */
  async getIssuesSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await reconciliationService.getIssuesSummary();
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/reconciliation/issues/:id/status
   * 이슈 상태 변경
   */
  async updateIssueStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      const adminId = req.user!.id;

      // 유효한 상태만 허용
      const validStatuses = ['ACKED', 'RESOLVED', 'IGNORED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `유효하지 않은 상태입니다. 허용: ${validStatuses.join(', ')}`,
        });
      }

      const result = await reconciliationService.updateIssueStatus(
        id,
        status as ReconciliationIssueStatus,
        adminId,
        note
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/reconciliation/issues.csv
   * 이슈 CSV Export
   */
  async exportIssuesCsv(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { severity, issueType, status } = req.query;

      const { items } = await reconciliationService.listIssues({
        severity: severity as ReconciliationIssueSeverity,
        issueType: issueType as ReconciliationIssueType,
        status: status as ReconciliationIssueStatus,
        limit: 10000, // CSV export 최대 건수
      });

      const headers = [
        'ID',
        'Run ID',
        'Severity',
        'Issue Type',
        'Status',
        'Related Topup',
        'Related Refund',
        'Related Wallet',
        'Detail',
        'Created At',
        'Resolved By',
        'Resolved At',
        'Note',
      ];

      const rows = items.map((issue: any) =>
        toCsvRow([
          issue.id,
          issue.runId,
          issue.severity,
          issue.issueType,
          issue.status,
          issue.relatedTopupId || '',
          issue.relatedRefundId || '',
          issue.relatedWalletId || '',
          JSON.stringify(issue.detail || {}),
          issue.createdAt?.toISOString() || '',
          issue.resolvedBy || '',
          issue.resolvedAt?.toISOString() || '',
          issue.resolvedNote || '',
        ])
      );

      const csv = [toCsvRow(headers), ...rows].join('\n');
      const dateStr = new Date().toISOString().split('T')[0];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reconciliation-issues-${dateStr}.csv`
      );
      res.send('\uFEFF' + csv); // BOM for Excel
    } catch (error) {
      next(error);
    }
  }
}

export const reconciliationController = new ReconciliationController();

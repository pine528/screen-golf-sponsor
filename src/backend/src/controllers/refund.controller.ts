/**
 * Phase 10-2: Refund Controller
 * 환불 관리 Admin API
 */

import { Response, NextFunction } from 'express';
import { refundService } from '../services/refund.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { RefundRequestStatus } from '@prisma/client';

export class RefundController {
  /**
   * POST /api/admin/finance/refunds
   * 환불 요청 생성 (Admin)
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.id;
      const { topupPaymentId, amount, reason, idempotencyKey } = req.body;

      if (!topupPaymentId || !amount || !reason) {
        return res.status(400).json({
          error: 'topupPaymentId, amount, reason은 필수입니다',
        });
      }

      const result = await refundService.createRefundRequest({
        topupPaymentId,
        amount: Number(amount),
        reason,
        requestedBy: adminId,
        idempotencyKey,
      });

      const statusCode = result.alreadyProcessed ? 200 : 201;
      res.status(statusCode);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/finance/refunds
   * 환불 요청 목록 (Admin)
   */
  async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, topupPaymentId, startDate, endDate, limit, offset } = req.query;

      const result = await refundService.getRefundRequests({
        status: status as RefundRequestStatus | undefined,
        topupPaymentId: topupPaymentId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/finance/refunds/stats
   * 환불 통계 (Admin)
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      const result = await refundService.getRefundStats({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/finance/refunds/:id
   * 환불 요청 상세 (Admin)
   */
  async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const refundRequest = await refundService.getById(id);

      sendSuccess(res, refundRequest);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/finance/refunds/:id/approve
   * 환불 요청 승인 (Admin)
   */
  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;

      const result = await refundService.approveRefundRequest(id, adminId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/finance/refunds/:id/reject
   * 환불 요청 거절 (Admin)
   */
  async reject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: '거절 사유를 입력해주세요' });
      }

      const result = await refundService.rejectRefundRequest(id, adminId, reason);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/finance/refunds/:id/process
   * 환불 처리 (PG API 호출, Admin)
   */
  async process(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;

      const result = await refundService.processRefund(id, adminId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const refundController = new RefundController();

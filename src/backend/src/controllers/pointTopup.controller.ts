/**
 * Point Topup Controller
 * 포인트 충전 API 컨트롤러
 */

import { Response, NextFunction } from 'express';
import { pointTopupService } from '../services/pointTopup.service';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';
import { PaymentProvider, PointTopupStatus } from '@prisma/client';

export class PointTopupController {
  /**
   * 포인트 충전 생성 (Checkout 세션)
   * POST /api/point-topups/create
   */
  async createTopup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { amount, provider, successUrl, failUrl } = req.body;

      const result = await pointTopupService.createTopup({
        userId,
        amount,
        provider: provider || PaymentProvider.TOSS,
        successUrl,
        failUrl,
      });

      return sendSuccess(res, {
        topup: result.topup,
        checkoutUrl: result.checkoutUrl,
        alreadyCreated: result.alreadyCreated || false,
        message: result.alreadyCreated ? '기존 충전 세션을 반환합니다' : '충전 세션이 생성되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 결제 확인 (successUrl 도착 후)
   * POST /api/point-topups/:id/confirm
   */
  async confirmTopup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { paymentKey } = req.body;

      const result = await pointTopupService.confirmTopup(id, paymentKey, userId);

      return sendSuccess(res, {
        topup: result.data,
        alreadyProcessed: result.alreadyProcessed,
        message: result.alreadyProcessed ? '이미 처리된 충전입니다' : '포인트 충전이 완료되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 내 충전 내역 조회
   * GET /api/point-topups/my
   */
  async getMyTopups(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { status, limit, offset } = req.query;

      const parsedLimit = limit ? parseInt(limit as string) : 20;
      const parsedOffset = offset ? parseInt(offset as string) : 0;
      const page = Math.floor(parsedOffset / parsedLimit) + 1;

      const result = await pointTopupService.getMyTopups(userId, {
        status: status as PointTopupStatus | undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      return sendPaginated(res, result.items, page, parsedLimit, result.total);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 단일 충전 조회
   * GET /api/point-topups/:id
   */
  async getTopupById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const topup = await pointTopupService.getTopupById(id, userId);

      return sendSuccess(res, { topup });
    } catch (error) {
      next(error);
    }
  }

  /**
   * orderId로 충전 조회 (결제 콜백용)
   * GET /api/point-topups/order/:orderId
   */
  async getTopupByOrderId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { orderId } = req.params;

      const topup = await pointTopupService.getTopupByOrderId(orderId);

      // 본인 확인
      if (topup.userId !== userId) {
        return sendError(res, 'FORBIDDEN', '권한이 없습니다', 403);
      }

      return sendSuccess(res, { topup });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [Admin] 전체 충전 목록
   * GET /api/point-topups/admin/all
   */
  async adminGetAllTopups(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, provider, userId, startDate, endDate, limit, offset } = req.query;

      const parsedLimit = limit ? parseInt(limit as string) : 50;
      const parsedOffset = offset ? parseInt(offset as string) : 0;
      const page = Math.floor(parsedOffset / parsedLimit) + 1;

      const result = await pointTopupService.getAllTopups({
        status: status as PointTopupStatus | undefined,
        provider: provider as PaymentProvider | undefined,
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      return sendPaginated(res, result.items, page, parsedLimit, result.total);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [Admin] 통계 조회
   * GET /api/point-topups/admin/stats
   */
  async adminGetStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      const stats = await pointTopupService.getTopupStats({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      return sendSuccess(res, { stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [Admin] 환불 처리
   * POST /api/point-topups/admin/:id/refund
   */
  async adminRefund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pointTopupService.processRefund(id, adminUserId, reason);

      return sendSuccess(res, {
        topup: result.data,
        alreadyProcessed: result.alreadyProcessed,
        message: result.alreadyProcessed ? '이미 환불 처리된 충전입니다' : '환불이 완료되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pointTopupController = new PointTopupController();

import { Request, Response, NextFunction } from 'express';
import { pointService } from '../services/point.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { PointTxReason } from '@prisma/client';

export class PointController {
  /**
   * GET /api/points/me
   * 내 포인트 잔액 조회
   */
  async getMyBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const balance = await pointService.getBalance(userId);
      sendSuccess(res, balance);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/points/me/history
   * 내 포인트 내역 조회
   */
  async getMyHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
      const reason = req.query.reason as PointTxReason | undefined;

      const history = await pointService.getHistory(userId, {
        page,
        pageSize,
        reason,
      });

      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/points/grant
   * 관리자: 포인트 지급
   */
  async adminGrant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, amount, reasonText } = req.body;

      // grantId는 요청마다 고유하게 생성 (UUID)
      const { v4: uuidv4 } = await import('uuid');
      const grantId = uuidv4();

      const result = await pointService.adminGrant(userId, amount, grantId, reasonText);

      sendSuccess(res, {
        ...result,
        message: result.alreadyProcessed
          ? '이미 처리된 요청입니다'
          : `${amount}P 지급 완료`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/points/user/:userId/balance
   * 관리자: 특정 사용자 포인트 잔액 조회
   */
  async adminGetUserBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const balance = await pointService.getBalance(userId);
      sendSuccess(res, balance);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/points/user/:userId/history
   * 관리자: 특정 사용자 포인트 내역 조회
   */
  async adminGetUserHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
      const reason = req.query.reason as PointTxReason | undefined;

      const history = await pointService.getHistory(userId, {
        page,
        pageSize,
        reason,
      });

      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }
}

export const pointController = new PointController();

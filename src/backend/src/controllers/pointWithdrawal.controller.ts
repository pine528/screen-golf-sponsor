import { Response, NextFunction } from 'express';
import { pointWithdrawalService } from '../services/pointWithdrawal.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { BadRequestError } from '../utils/errors';
import { PointWithdrawalStatus } from '@prisma/client';

export class PointWithdrawalController {
  /**
   * POST /api/point-withdrawals
   * 포인트 출금 요청 생성 (ATHLETE 권한)
   */
  async createWithdrawal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { amount, bankName, bankAccountNumber, accountHolder, reason } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      if (!amount || !bankName || !bankAccountNumber || !accountHolder) {
        throw new BadRequestError('필수 항목을 모두 입력해주세요');
      }

      const withdrawal = await pointWithdrawalService.createWithdrawalRequest(
        userId,
        { amount, bankName, bankAccountNumber, accountHolder, reason },
        idempotencyKey
      );

      sendSuccess(res, {
        withdrawal,
        message: '포인트 출금 요청이 등록되었습니다',
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/point-withdrawals/my
   * 내 출금 요청 목록 조회 (ATHLETE 권한)
   */
  async getMyWithdrawals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = req.query.status as PointWithdrawalStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const result = await pointWithdrawalService.getMyWithdrawals(userId, { status, page, limit });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/point-withdrawals/balance
   * 출금 가능 잔액 조회 (ATHLETE 권한)
   */
  async getWithdrawableBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const balance = await pointWithdrawalService.getWithdrawableBalance(userId);
      sendSuccess(res, balance);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * GET /api/admin/point-withdrawals
   * 모든 출금 요청 목록 (ADMIN 권한)
   */
  async getAllWithdrawals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as PointWithdrawalStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const result = await pointWithdrawalService.getAllWithdrawals({ status, page, limit });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/point-withdrawals/:id/approve
   * 출금 승인 (ADMIN 권한)
   */
  async approveWithdrawal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user!.id;

      const result = await pointWithdrawalService.approveWithdrawal(id, adminUserId);
      sendSuccess(res, {
        withdrawal: result,
        message: '출금 요청이 승인되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/point-withdrawals/:id/reject
   * 출금 거부 (ADMIN 권한)
   */
  async rejectWithdrawal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user!.id;
      const { reason } = req.body;

      const result = await pointWithdrawalService.rejectWithdrawal(id, adminUserId, reason);
      sendSuccess(res, {
        withdrawal: result,
        message: '출금 요청이 거부되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/point-withdrawals/:id/complete
   * 지급 완료 처리 (ADMIN 권한)
   */
  async completeWithdrawal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user!.id;
      const { payoutReference } = req.body;

      const result = await pointWithdrawalService.completeWithdrawal(id, adminUserId, payoutReference);
      sendSuccess(res, {
        withdrawal: result,
        message: '지급이 완료되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pointWithdrawalController = new PointWithdrawalController();

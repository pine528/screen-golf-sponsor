import { Response, NextFunction } from 'express';
import { withdrawalService } from '../services/withdrawal.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';
import { WithdrawalStatus } from '@prisma/client';

export class WithdrawalController {
  /**
   * POST /api/withdrawals
   * 선수 출금 요청 생성
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const athleteId = req.user!.athleteId;

      if (!athleteId) {
        return sendError(res, 'FORBIDDEN', '선수만 출금을 요청할 수 있습니다', 403);
      }

      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const { amount, bankName, bankAccountNumber, accountHolder, reason } = req.body;

      const result = await withdrawalService.createRequest(athleteId, req.user!.id, {
        amount: Number(amount),
        bankName,
        bankAccountNumber,
        accountHolder,
        reason,
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
   * GET /api/withdrawals/my
   * 내 출금 요청 목록
   */
  async getMyList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const athleteId = req.user!.athleteId;

      if (!athleteId) {
        return sendError(res, 'FORBIDDEN', '선수만 조회할 수 있습니다', 403);
      }

      const { status, page, pageSize } = req.query;

      const result = await withdrawalService.getByAthlete(athleteId, {
        status: status as WithdrawalStatus | undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/withdrawals/my/:id
   * 내 출금 요청 상세
   */
  async getMyDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const athleteId = req.user!.athleteId;

      if (!athleteId) {
        return sendError(res, 'FORBIDDEN', '선수만 조회할 수 있습니다', 403);
      }

      const { id } = req.params;
      const request = await withdrawalService.getById(id);

      // 본인 요청인지 확인
      if (request.athleteId !== athleteId) {
        return sendError(res, 'FORBIDDEN', '본인의 출금 요청만 조회할 수 있습니다', 403);
      }

      sendSuccess(res, request);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/withdrawals/available-balance
   * 출금 가능 잔액 조회
   */
  async getAvailableBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const athleteId = req.user!.athleteId;

      if (!athleteId) {
        return sendError(res, 'FORBIDDEN', '선수만 조회할 수 있습니다', 403);
      }

      const result = await withdrawalService.getAvailableBalance(athleteId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const withdrawalController = new WithdrawalController();

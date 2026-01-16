import { Request, Response, NextFunction } from 'express';
import { fanVoteService } from '../services/fanVote.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class FanVoteController {
  /**
   * GET /api/fan-votes/active
   * 활성화된 팬 투표 목록 조회 (Public)
   */
  async listActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const events = await fanVoteService.listActive();
      sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fan-votes/ended
   * 종료된 팬 투표 목록 조회 (Public)
   */
  async listEnded(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const events = await fanVoteService.listEnded(limit);
      sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fan-votes/:id
   * 팬 투표 상세 조회 (Public, 로그인 시 참여 여부 포함)
   */
  async getEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const result = await fanVoteService.getEvent(id, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fan-votes/:id/enter
   * 팬 투표 참여 (FAN 권한 필요)
   */
  async enterVote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { optionIndex } = req.body;
      const userId = req.user!.id;
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const result = await fanVoteService.enterVote(userId, id, optionIndex, idempotencyKey);

      sendSuccess(res, {
        ...result,
        message: result.alreadyProcessed ? '이미 참여한 투표입니다' : '투표 참여가 완료되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fan-votes/my/entries
   * 내 참여 내역 조회 (FAN 권한 필요)
   */
  async getMyEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;

      const result = await fanVoteService.getMyEntries(userId, { page, pageSize });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/fan-votes
   * 관리자: 팬 투표 생성
   */
  async createEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const creatorUserId = req.user!.id;
      const event = await fanVoteService.createEvent({
        creatorUserId,
        ...req.body,
      });
      sendSuccess(res, event, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/fan-votes/:id/activate
   * 관리자: 팬 투표 활성화
   */
  async activateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = await fanVoteService.activateEvent(id);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/fan-votes/:id/close
   * 관리자: 팬 투표 종료
   */
  async closeEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = await fanVoteService.closeEvent(id);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }
}

export const fanVoteController = new FanVoteController();

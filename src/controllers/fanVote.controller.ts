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

  // ============================================
  // Phase F4: Fan-created Votes
  // ============================================

  /**
   * POST /api/fan-votes/create
   * 팬이 투표 생성
   */
  async createByFan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { title, question, options, entryFeePoints, winnersCount, startsAt, endsAt } = req.body;

      const event = await fanVoteService.createByFan(userId, {
        title,
        question,
        options,
        entryFeePoints,
        winnersCount,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      });

      sendSuccess(res, event, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fan-votes/:id/submit
   * 팬이 투표 제출 (DRAFT -> SUBMITTED)
   */
  async submitFanVote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const event = await fanVoteService.submitFanVote(userId, id);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fan-votes/my/events
   * 내가 만든 투표 목록
   */
  async getMyCreatedEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;

      const result = await fanVoteService.getMyCreatedEvents(userId, { page, pageSize });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fan-votes/:id/result
   * 투표 결과 조회
   */
  async getEventResult(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const result = await fanVoteService.getEventResult(id, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Admin: Phase F4
  // ============================================

  /**
   * GET /api/fan-votes/admin/pending
   * 승인 대기 투표 목록
   */
  async listPendingApproval(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;

      const result = await fanVoteService.listPendingApproval({ page, pageSize });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fan-votes/admin/:id/approve-and-activate
   * 관리자: 승인 및 활성화
   */
  async approveAndActivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;

      const event = await fanVoteService.adminApproveAndActivate(id, adminId);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fan-votes/admin/:id/settle
   * 관리자: 정산 실행
   */
  async settleEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { resultOptionIndex } = req.body;
      const adminId = req.user!.id;

      const result = await fanVoteService.adminSettle(id, adminId, resultOptionIndex);

      sendSuccess(res, {
        ...result,
        message: result.alreadyProcessed ? '이미 정산된 투표입니다' : '정산이 완료되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const fanVoteController = new FanVoteController();

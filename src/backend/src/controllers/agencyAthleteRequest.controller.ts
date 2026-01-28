import { Response, NextFunction } from 'express';
import { agencyAthleteRequestService } from '../services/agencyAthleteRequest.service';
import { AuthRequest } from '../types';
import { sendSuccess } from '../utils/response';
import { ForbiddenError, BadRequestError } from '../utils/errors';
import { AgencyAthleteRequestStatus } from '@prisma/client';

export class AgencyAthleteRequestController {
  /**
   * GET /agencies/athletes/search - 연결 가능한 선수 검색
   */
  async searchAthletes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.agencyId) {
        throw new ForbiddenError('에이전시 권한이 필요합니다');
      }

      const { q, tour, page, limit } = req.query;

      const result = await agencyAthleteRequestService.searchAvailableAthletes(req.user.agencyId, {
        q: q as string,
        tour: tour as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /agencies/athletes/request - 선수에게 연결 요청 발송
   */
  async createRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('에이전시 권한이 필요합니다');
      }

      const { athleteId, message } = req.body;

      if (!athleteId) {
        throw new BadRequestError('선수 ID가 필요합니다');
      }

      const request = await agencyAthleteRequestService.createRequest(
        req.user.agencyId,
        req.user.id,
        athleteId,
        message
      );

      sendSuccess(res, { request }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/requests/sent - 보낸 요청 목록
   */
  async getSentRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.agencyId) {
        throw new ForbiddenError('에이전시 권한이 필요합니다');
      }

      const { status, page, limit } = req.query;

      const result = await agencyAthleteRequestService.getSentRequests(req.user.agencyId, {
        status: status as AgencyAthleteRequestStatus | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /agencies/requests/:requestId - 요청 취소
   */
  async cancelRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('에이전시 권한이 필요합니다');
      }

      const { requestId } = req.params;

      const request = await agencyAthleteRequestService.cancelRequest(
        req.user.agencyId,
        requestId,
        req.user.id
      );

      sendSuccess(res, { request, message: '요청이 취소되었습니다' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /athletes/agency-requests - 받은 요청 목록 (선수용)
   */
  async getReceivedRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new ForbiddenError('선수 권한이 필요합니다');
      }

      const { status, page, limit } = req.query;

      const result = await agencyAthleteRequestService.getReceivedRequests(req.user.athleteId, {
        status: (status as any) || 'PENDING',
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /athletes/agency-requests/:requestId/approve - 요청 승인 (선수용)
   */
  async approveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.athleteId) {
        throw new ForbiddenError('선수 권한이 필요합니다');
      }

      const { requestId } = req.params;

      const request = await agencyAthleteRequestService.approveRequest(
        req.user.athleteId,
        requestId,
        req.user.id
      );

      sendSuccess(res, { request, message: '에이전시와 연결되었습니다' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /athletes/agency-requests/:requestId/reject - 요청 거부 (선수용)
   */
  async rejectRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.athleteId) {
        throw new ForbiddenError('선수 권한이 필요합니다');
      }

      const { requestId } = req.params;
      const { reason } = req.body;

      const request = await agencyAthleteRequestService.rejectRequest(
        req.user.athleteId,
        requestId,
        req.user.id,
        reason
      );

      sendSuccess(res, { request, message: '요청을 거부했습니다' });
    } catch (error) {
      next(error);
    }
  }
}

export const agencyAthleteRequestController = new AgencyAthleteRequestController();

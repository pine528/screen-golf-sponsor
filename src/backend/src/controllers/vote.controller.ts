import { Request, Response, NextFunction } from 'express';
import { voteService } from '../services/vote.service';
import { AuthenticatedRequest } from '../types';

export class VoteController {
  // ============================================
  // VoteEvent 관리 (Admin)
  // ============================================

  async createVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.createVoteEvent({
        eventId: req.body.eventId,
        title: req.body.title,
        description: req.body.description,
        questionType: req.body.questionType,
        question: req.body.question,
        options: req.body.options,
        pointsPerCorrect: req.body.pointsPerCorrect,
        sponsorBrandId: req.body.sponsorBrandId,
        startAt: new Date(req.body.startAt),
        endAt: new Date(req.body.endAt),
      });

      res.status(201).json({
        success: true,
        data: voteEvent,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVoteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.findVoteEventById(req.params.id);

      res.json({
        success: true,
        data: voteEvent,
      });
    } catch (error) {
      next(error);
    }
  }

  async listVoteEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as any;
      const eventId = req.query.eventId as string;
      const questionType = req.query.questionType as string;

      const result = await voteService.listVoteEvents(page, limit, {
        status,
        eventId,
        questionType,
      });

      res.json({
        success: true,
        data: result.voteEvents,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listActiveVoteEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await voteService.listActiveVoteEvents(page, limit);

      res.json({
        success: true,
        data: result.voteEvents,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.updateVoteEvent(req.params.id, {
        title: req.body.title,
        description: req.body.description,
        question: req.body.question,
        options: req.body.options,
        pointsPerCorrect: req.body.pointsPerCorrect,
        startAt: req.body.startAt ? new Date(req.body.startAt) : undefined,
        endAt: req.body.endAt ? new Date(req.body.endAt) : undefined,
      });

      res.json({
        success: true,
        data: voteEvent,
      });
    } catch (error) {
      next(error);
    }
  }

  async activateVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.activateVoteEvent(req.params.id);

      res.json({
        success: true,
        data: voteEvent,
        message: 'Vote event activated',
      });
    } catch (error) {
      next(error);
    }
  }

  async closeVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.closeVoteEvent(req.params.id);

      res.json({
        success: true,
        data: voteEvent,
        message: 'Vote event closed',
      });
    } catch (error) {
      next(error);
    }
  }

  async settleVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const voteEvent = await voteService.settleVoteEvent(
        req.params.id,
        req.body.correctOptionId
      );

      res.json({
        success: true,
        data: voteEvent,
        message: 'Vote event settled and points distributed',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVoteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await voteService.deleteVoteEvent(req.params.id);

      res.json({
        success: true,
        message: 'Vote event deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  async getVoteEventStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await voteService.getVoteEventStats(req.params.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Vote (사용자 투표)
  // ============================================

  async submitVote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const vote = await voteService.submitVote(
        req.user!.id,
        req.params.voteEventId,
        req.body.selectedOptionId
      );

      res.status(201).json({
        success: true,
        data: vote,
        message: 'Vote submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyVotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await voteService.getUserVotes(req.user!.id, page, limit);

      res.json({
        success: true,
        data: result.votes,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Points (포인트)
  // ============================================

  async getMyPoints(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const points = await voteService.getUserPoints(req.user!.id);

      res.json({
        success: true,
        data: points,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyPointHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await voteService.getPointHistory(req.user!.id, page, limit);

      res.json({
        success: true,
        data: result.ledgers,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async redeemPoints(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await voteService.redeemPoints(
        req.user!.id,
        req.body.amount,
        req.body.description
      );

      res.json({
        success: true,
        data: result,
        message: 'Points redeemed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // 랭킹
  // ============================================

  async getAthleteRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.query.eventId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 10;

      const ranking = await voteService.getAthleteRanking(eventId, limit);

      res.json({
        success: true,
        data: ranking,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const voteController = new VoteController();

import { Response, NextFunction } from 'express';
import { donationService } from '../services/donation.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import prisma from '../models/prisma';

export class DonationController {
  /**
   * POST /api/donations
   * 후원 생성 (FAN 권한 필요)
   */
  async createDonation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const donorUserId = req.user!.id;
      const { athleteId, amount, message, isAnonymous } = req.body;

      if (!athleteId || !amount) {
        throw new BadRequestError('athleteId와 amount는 필수입니다');
      }

      if (typeof amount !== 'number' || amount <= 0) {
        throw new BadRequestError('amount는 양수여야 합니다');
      }

      const donation = await donationService.createDonation(
        donorUserId,
        athleteId,
        amount,
        message,
        isAnonymous ?? false
      );

      sendSuccess(res, {
        donation,
        message: '후원이 완료되었습니다',
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/donations/my
   * 내 후원 내역 조회 (FAN 권한 필요)
   */
  async getMyDonations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const result = await donationService.getDonationsByUser(userId, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/donations/athlete/:athleteId
   * 선수의 후원자 목록 조회 (ATHLETE 본인만 조회 가능)
   */
  async getAthleteDonations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { athleteId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // 선수 본인 확인
      const athlete = await prisma.athlete.findUnique({
        where: { id: athleteId },
        select: { userId: true },
      });

      if (!athlete) {
        throw new BadRequestError('선수를 찾을 수 없습니다');
      }

      if (athlete.userId !== userId) {
        throw new ForbiddenError('본인의 후원자 목록만 조회할 수 있습니다');
      }

      const result = await donationService.getDonationsForAthlete(athleteId, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/donations/received
   * 내가 받은 후원 목록 (ATHLETE 권한 필요)
   */
  async getMyReceivedDonations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // 선수 정보 조회
      const athlete = await prisma.athlete.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!athlete) {
        throw new ForbiddenError('선수 정보를 찾을 수 없습니다');
      }

      const result = await donationService.getDonationsForAthlete(athlete.id, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/donations/athletes
   * 후원 가능한 선수 목록 조회 (Public)
   */
  async getAthleteList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const search = req.query.search as string | undefined;

      const result = await donationService.getAthleteList(page, limit, search);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const donationController = new DonationController();

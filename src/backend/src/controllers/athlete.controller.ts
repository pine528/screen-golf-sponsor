import { Response, NextFunction } from 'express';
import { athleteService } from '../services/athlete.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class AthleteController {
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const athlete = await athleteService.findById(id);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const athlete = await athleteService.findById(req.user.athleteId);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, tour, kycStatus } = req.query;
      const { athletes, total } = await athleteService.list(
        Number(page),
        Number(limit),
        { tour: tour as string, kycStatus: kycStatus as any }
      );
      sendPaginated(res, athletes, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const athlete = await athleteService.update(req.user.athleteId, req.user.id, req.body);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async updateBankInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const { bankAccount, taxInfo } = req.body;
      const athlete = await athleteService.updateBankInfo(
        req.user.athleteId,
        req.user.id,
        bankAccount,
        taxInfo
      );
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async updateSlotAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const { blockedCategories } = req.body;
      const athlete = await athleteService.updateSlotAvailability(
        req.user.athleteId,
        req.user.id,
        blockedCategories
      );
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const stats = await athleteService.getStats(req.user.athleteId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const { eventId } = req.query;
      const slots = await athleteService.getAvailableSlots(
        req.user.athleteId,
        eventId as string
      );
      sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  }

  async submitKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents } = req.body;
      const athlete = await athleteService.submitKyc(req.user!.id, documents);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  async updateBankAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated with this user');
      }
      const { bankName, accountNumber, accountHolder } = req.body;
      const athlete = await athleteService.updateBankInfo(
        req.user.athleteId,
        req.user.id,
        { bankName, accountNumber, accountHolder }
      );
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }
}

export const athleteController = new AthleteController();

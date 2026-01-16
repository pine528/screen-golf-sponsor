import { Response, NextFunction } from 'express';
import { campaignService } from '../services/campaign.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class CampaignController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { name, description, budget, targetCategories, excludedAthletes, preferredAthletes, dateStart, dateEnd } = req.body;

      const campaign = await campaignService.create(req.user.brandId, {
        name,
        description,
        budget,
        targetCategories,
        excludedAthletes,
        preferredAthletes,
        dateStart: new Date(dateStart),
        dateEnd: new Date(dateEnd),
      });

      sendSuccess(res, campaign, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await campaignService.findById(id);
      sendSuccess(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status } = req.query;

      // 브랜드 사용자는 자신의 캠페인만 조회
      const brandId = req.user?.role === 'BRAND' ? req.user.brandId : undefined;

      const { campaigns, total } = await campaignService.list(
        brandId,
        Number(page),
        Number(limit),
        status as string
      );

      sendPaginated(res, campaigns, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async getMyCampaigns(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { page = 1, limit = 20, status } = req.query;

      const { campaigns, total } = await campaignService.list(
        req.user.brandId,
        Number(page),
        Number(limit),
        status as string
      );

      sendPaginated(res, campaigns, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { id } = req.params;
      const { name, description, budget, targetCategories, excludedAthletes, preferredAthletes, dateStart, dateEnd, status } = req.body;

      const campaign = await campaignService.update(id, req.user.brandId, {
        name,
        description,
        budget,
        targetCategories,
        excludedAthletes,
        preferredAthletes,
        dateStart: dateStart ? new Date(dateStart) : undefined,
        dateEnd: dateEnd ? new Date(dateEnd) : undefined,
        status,
      });

      sendSuccess(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { id } = req.params;
      await campaignService.delete(id, req.user.brandId);
      sendSuccess(res, { message: 'Campaign deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async activate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { id } = req.params;
      const campaign = await campaignService.activate(id, req.user.brandId);
      sendSuccess(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async pause(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const { id } = req.params;
      const campaign = await campaignService.pause(id, req.user.brandId);
      sendSuccess(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const stats = await campaignService.getStats(req.user.brandId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const campaignController = new CampaignController();

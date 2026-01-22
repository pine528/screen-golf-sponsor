import { Response, NextFunction } from 'express';
import { slotTemplateService, slotInstanceService } from '../services/slot.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class SlotTemplateController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await slotTemplateService.create(req.body);
      sendSuccess(res, template, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const template = await slotTemplateService.findById(id);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isActive } = req.query;
      const templates = await slotTemplateService.list(
        isActive !== undefined ? isActive === 'true' : undefined
      );
      sendSuccess(res, templates);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const template = await slotTemplateService.update(id, req.body);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }
}

export class SlotInstanceController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const instance = await slotInstanceService.create(req.body);
      sendSuccess(res, instance, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const instance = await slotInstanceService.findById(id);
      sendSuccess(res, instance);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, eventId, athleteId, slotCode, status, enableDirectBuy } = req.query;
      const { instances, total } = await slotInstanceService.list({
        eventId: eventId as string,
        athleteId: athleteId as string,
        slotCode: slotCode as string,
        status: status as any,
        enableDirectBuy: enableDirectBuy === 'true' ? true : enableDirectBuy === 'false' ? false : undefined,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, instances, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const instance = await slotInstanceService.update(id, req.body);
      sendSuccess(res, instance);
    } catch (error) {
      next(error);
    }
  }

  async getAvailable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId, athleteId, slotCode, minPrice, maxPrice } = req.query;
      const instances = await slotInstanceService.getAvailableForBidding({
        eventId: eventId as string,
        athleteId: athleteId as string,
        slotCode: slotCode as string,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      });
      sendSuccess(res, instances);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId, athleteId, templateIds } = req.body;
      const instances = await slotInstanceService.bulkCreate(eventId, athleteId, templateIds);
      sendSuccess(res, instances, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const slotTemplateController = new SlotTemplateController();
export const slotInstanceController = new SlotInstanceController();

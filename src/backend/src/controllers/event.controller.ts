import { Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class EventController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.create(req.body);
      sendSuccess(res, event, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = await eventService.findById(id);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, tour, from, to, status } = req.query;
      const { events, total } = await eventService.list({
        tour: tour as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        status: status as any,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, events, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = await eventService.update(id, req.body);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await eventService.delete(id);
      sendSuccess(res, { message: 'Event deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10 } = req.query;
      const events = await eventService.getUpcoming(Number(limit));
      sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  async addParticipant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { athleteId } = req.body;
      const participation = await eventService.addParticipant(id, athleteId);
      sendSuccess(res, participation, 201);
    } catch (error) {
      next(error);
    }
  }

  async confirmParticipation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const athleteId = req.user?.athleteId;
      if (!athleteId) {
        throw new Error('No athlete associated');
      }
      const participation = await eventService.confirmParticipation(id, athleteId);
      sendSuccess(res, participation);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();

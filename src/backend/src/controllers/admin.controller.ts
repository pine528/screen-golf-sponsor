import { Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { slotTemplateService } from '../services/slot.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class AdminController {
  // Dashboard
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  // KYC Management
  async getPendingKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pending = await adminService.getPendingKyc();
      sendSuccess(res, pending);
    } catch (error) {
      next(error);
    }
  }

  async reviewBrandKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { brandId } = req.params;
      const { status, notes } = req.body;
      const brand = await adminService.reviewBrandKyc(brandId, status, notes);
      sendSuccess(res, brand);
    } catch (error) {
      next(error);
    }
  }

  async reviewAthleteKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { athleteId } = req.params;
      const { status, notes } = req.body;
      const athlete = await adminService.reviewAthleteKyc(athleteId, status, notes);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  // Slot Templates
  async createSlotTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await slotTemplateService.create(req.body);
      sendSuccess(res, template, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateSlotTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const template = await slotTemplateService.update(id, req.body);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  // Forbidden Categories
  async getForbiddenCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await adminService.getForbiddenCategories();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }

  async createForbiddenCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await adminService.createForbiddenCategory(req.body);
      sendSuccess(res, category, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateForbiddenCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const category = await adminService.updateForbiddenCategory(id, req.body);
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  // Category Mappings
  async getCategoryMappings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const mappings = await adminService.getCategoryMappings();
      sendSuccess(res, mappings);
    } catch (error) {
      next(error);
    }
  }

  async createCategoryMapping(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const mapping = await adminService.createCategoryMapping(req.body);
      sendSuccess(res, mapping, 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteCategoryMapping(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await adminService.deleteCategoryMapping(id);
      sendSuccess(res, { message: 'Mapping deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Audit Logs
  async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 50, userId, entityType, action } = req.query;
      const { logs, total } = await adminService.getAuditLogs({
        userId: userId as string,
        entityType: entityType as string,
        action: action as string,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, logs, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  // Monitoring
  async getAuctionMonitoring(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const monitoring = await adminService.getAuctionMonitoring();
      sendSuccess(res, monitoring);
    } catch (error) {
      next(error);
    }
  }

  async getPendingReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pending = await adminService.getPendingReviews();
      sendSuccess(res, pending);
    } catch (error) {
      next(error);
    }
  }

  // User Management
  async getUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, role, isActive } = req.query;
      const { users, total } = await adminService.getUsers({
        role: role as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, users, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async toggleUserActive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const user = await adminService.toggleUserActive(userId, isActive);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  // System Settings
  async getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await adminService.getSettings();
      sendSuccess(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const setting = await adminService.updateSetting(key, value);
      sendSuccess(res, setting);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();

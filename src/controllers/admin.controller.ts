import { Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { slotTemplateService } from '../services/slot.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';
import { extractAndValidateDangerZone, getRoleChangeConfirmText } from '../utils/dangerZone';

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

  // Brand Registration Requests
  async getBrandRegistrations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status, q } = req.query;
      const { requests, total } = await adminService.getBrandRegistrations({
        status: status as string,
        q: q as string,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, requests, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async approveBrandRegistration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;
      const result = await adminService.approveBrandRegistration(id, req.user!.id, adminNote);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async rejectBrandRegistration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;
      const result = await adminService.rejectBrandRegistration(id, req.user!.id, adminNote);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Admin Management (RBAC)
  // ============================================

  /**
   * 관리자 목록 조회
   */
  async getAdmins(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { admins, total } = await adminService.getAdmins({
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, admins, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 관리자 역할 변경 (Danger Zone)
   */
  async changeAdminRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { adminId } = req.params;
      const { role, confirmText, reason } = req.body;

      // 대상 관리자 정보 조회
      const targetAdmin = await adminService.getAdminById(adminId);
      const expectedConfirmText = getRoleChangeConfirmText(targetAdmin.user.email);

      // Danger Zone 검증
      extractAndValidateDangerZone({ confirmText, reason }, expectedConfirmText);

      const result = await adminService.changeAdminRole(
        adminId,
        role,
        req.user!.id,
        reason
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 관리자 권한 변경
   */
  async updateAdminPermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { adminId } = req.params;
      const { permissions, reason } = req.body;

      if (!reason || reason.length < 10) {
        throw new Error('사유는 최소 10자 이상 입력해주세요');
      }

      const result = await adminService.updateAdminPermissions(
        adminId,
        permissions,
        req.user!.id,
        reason
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Featured Auctions (공개 이벤트 경매)
  // ============================================

  async createFeaturedAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { athleteId, eventId, slotTemplateId, reservePrice, auctionEndAt, enableDirectBuy, directBuyPrice } = req.body;

      const result = await adminService.createFeaturedAuction({
        athleteId,
        eventId,
        slotTemplateId,
        reservePrice: Number(reservePrice),
        auctionEndAt: new Date(auctionEndAt),
        enableDirectBuy,
        directBuyPrice: directBuyPrice ? Number(directBuyPrice) : undefined,
      });

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreateFeaturedAuctions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { athleteId, eventId, slots, auctionEndAt, enableDirectBuy } = req.body;

      const result = await adminService.bulkCreateFeaturedAuctions({
        athleteId,
        eventId,
        slots,
        auctionEndAt: new Date(auctionEndAt),
        enableDirectBuy,
      });

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getFeaturedAuctions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const auctions = await adminService.getFeaturedAuctions(limit);
      sendSuccess(res, auctions);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();

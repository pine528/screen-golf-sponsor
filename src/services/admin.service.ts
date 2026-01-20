import prisma from '../models/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { KycStatus, UserRole } from '@prisma/client';
import { emailService } from './email.service';
import { settingsService } from './settings.service';

export class AdminService {
  // KYC Management
  async getPendingKyc() {
    const [brands, athletes] = await Promise.all([
      prisma.brand.findMany({
        where: { kycStatus: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.athlete.findMany({
        where: { kycStatus: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    // kycDocuments에서 businessNumber 추출하여 최상위로 노출
    const brandsWithBusinessNumber = brands.map(brand => ({
      ...brand,
      businessNumber: (brand.kycDocuments as any)?.businessNumber || null,
    }));

    return { brands: brandsWithBusinessNumber, athletes };
  }

  async reviewBrandKyc(brandId: string, status: KycStatus, notes?: string) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { user: true },
    });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    const updatedBrand = await prisma.brand.update({
      where: { id: brandId },
      data: {
        kycStatus: status,
        kycDocuments: {
          ...((brand.kycDocuments as any) || {}),
          reviewNotes: notes,
          reviewedAt: new Date(),
        },
      },
    });

    // Send email notification
    if (status === 'APPROVED') {
      emailService.sendKycApprovedNotification(brand.user.email, brand.name, 'BRAND');
    } else if (status === 'REJECTED') {
      emailService.sendKycRejectedNotification(brand.user.email, brand.name, 'BRAND', notes || '서류 검토 결과 승인이 거절되었습니다.');
    }

    return updatedBrand;
  }

  async reviewAthleteKyc(athleteId: string, status: KycStatus, notes?: string) {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { user: true },
    });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    const updatedAthlete = await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        kycStatus: status,
        kycDocuments: {
          ...((athlete.kycDocuments as any) || {}),
          reviewNotes: notes,
          reviewedAt: new Date(),
        },
      },
    });

    // Send email notification
    if (status === 'APPROVED') {
      emailService.sendKycApprovedNotification(athlete.user.email, athlete.name, 'ATHLETE');
    } else if (status === 'REJECTED') {
      emailService.sendKycRejectedNotification(athlete.user.email, athlete.name, 'ATHLETE', notes || '서류 검토 결과 승인이 거절되었습니다.');
    }

    return updatedAthlete;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const [
      totalBrands,
      pendingBrandKyc,
      totalAthletes,
      pendingAthleteKyc,
      totalEvents,
      upcomingEvents,
      liveAuctions,
      totalContracts,
      pendingSettlements,
      totalRevenue,
    ] = await Promise.all([
      prisma.brand.count(),
      prisma.brand.count({ where: { kycStatus: 'PENDING' } }),
      prisma.athlete.count(),
      prisma.athlete.count({ where: { kycStatus: 'PENDING' } }),
      prisma.event.count(),
      prisma.event.count({ where: { status: 'UPCOMING' } }),
      prisma.auction.count({ where: { status: 'LIVE' } }),
      prisma.contract.count(),
      prisma.settlement.count({ where: { status: 'PENDING' } }),
      prisma.settlement.aggregate({
        where: { status: 'PAID' },
        _sum: { platformFee: true },
      }),
    ]);

    return {
      brands: { total: totalBrands, pendingKyc: pendingBrandKyc },
      athletes: { total: totalAthletes, pendingKyc: pendingAthleteKyc },
      events: { total: totalEvents, upcoming: upcomingEvents },
      auctions: { live: liveAuctions },
      contracts: { total: totalContracts },
      settlements: { pending: pendingSettlements },
      revenue: { total: totalRevenue._sum.platformFee || 0 },
    };
  }

  // Forbidden Categories Management
  async getForbiddenCategories() {
    return prisma.forbiddenCategory.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createForbiddenCategory(data: { code: string; name: string; description?: string }) {
    return prisma.forbiddenCategory.create({ data });
  }

  async updateForbiddenCategory(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    return prisma.forbiddenCategory.update({
      where: { id },
      data,
    });
  }

  // Category Mapping Management
  async getCategoryMappings() {
    return prisma.categoryMapping.findMany({
      orderBy: [{ exclusivityGroup: 'asc' }, { categoryCode: 'asc' }],
    });
  }

  async createCategoryMapping(data: { categoryCode: string; exclusivityGroup: string }) {
    return prisma.categoryMapping.create({ data });
  }

  async deleteCategoryMapping(id: string) {
    return prisma.categoryMapping.delete({ where: { id } });
  }

  // Audit Logs
  async getAuditLogs(filters: {
    userId?: string;
    entityType?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, entityType, action, page = 1, limit = 50 } = filters;

    const where: any = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  // Monitoring
  async getAuctionMonitoring() {
    const [live, endingSoon, flagged] = await Promise.all([
      prisma.auction.findMany({
        where: { status: 'LIVE' },
        include: {
          slotInstance: {
            include: {
              event: true,
              athlete: true,
              slotTemplate: true,
            },
          },
          _count: { select: { bids: true } },
        },
        orderBy: { endAt: 'asc' },
      }),
      prisma.auction.findMany({
        where: {
          status: 'LIVE',
          endAt: { lte: new Date(Date.now() + 10 * 60 * 1000) },
        },
        include: {
          slotInstance: {
            include: { event: true, athlete: true },
          },
        },
      }),
      // Detect suspicious bidding patterns
      prisma.auction.findMany({
        where: {
          status: 'LIVE',
          totalExtended: { gte: 300 }, // Extended 5+ minutes
        },
        include: {
          slotInstance: true,
          bids: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
    ]);

    return { live, endingSoon, flagged };
  }

  // Pending Reviews
  async getPendingReviews() {
    const [assets, verifications] = await Promise.all([
      prisma.creativeAsset.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          contract: {
            include: {
              brand: { select: { id: true, name: true } },
              athlete: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.verification.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          contract: {
            include: {
              brand: { select: { id: true, name: true } },
              athlete: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { assets, verifications };
  }

  // User Management
  async getUsers(filters: {
    role?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { role, isActive, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          brand: { select: { id: true, name: true, kycStatus: true } },
          athlete: { select: { id: true, name: true, kycStatus: true } },
          admin: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async toggleUserActive(userId: string, isActive: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  // System Settings
  async getSettings() {
    return settingsService.getAll();
  }

  async updateSetting(key: string, value: string) {
    await settingsService.set(key, value);
    return { key, value };
  }

  // Brand Registration Requests
  async getBrandRegistrations(filters: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, q, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { brandName: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.brandRegistrationRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          fan: {
            include: {
              user: {
                select: { id: true, email: true },
              },
            },
          },
        },
      }),
      prisma.brandRegistrationRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async approveBrandRegistration(requestId: string, adminUserId: string, adminNote?: string) {
    const request = await prisma.brandRegistrationRequest.findUnique({
      where: { id: requestId },
      include: {
        fan: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('브랜드 등록 신청을 찾을 수 없습니다');
    }

    if (request.status !== 'SUBMITTED') {
      throw new Error('이미 처리된 신청입니다');
    }

    // Transaction: Update request + Create Brand + Update user role
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update request status
      const updatedRequest = await tx.brandRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          adminNote,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      });

      // 2. Update user role to BRAND
      await tx.user.update({
        where: { id: request.fan.userId },
        data: { role: 'BRAND' },
      });

      // 3. Create Brand profile
      const brand = await tx.brand.create({
        data: {
          userId: request.fan.userId,
          name: request.brandName,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
          website: request.website,
          category: '미분류',
        },
      });

      // 4. Create notification for user
      await tx.notification.create({
        data: {
          userId: request.fan.userId,
          type: 'BRAND_REGISTRATION_APPROVED',
          title: '브랜드 등록 승인',
          message: `${request.brandName} 브랜드 등록이 승인되었습니다. 이제 브랜드 계정으로 로그인하실 수 있습니다.`,
          data: { brandId: brand.id },
        },
      });

      // 5. Create audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'BRAND_REGISTRATION_APPROVE',
          entityType: 'BrandRegistrationRequest',
          entityId: requestId,
          newValue: { status: 'APPROVED', adminNote, brandId: brand.id },
        },
      });

      return { request: updatedRequest, brand };
    });

    return result;
  }

  async rejectBrandRegistration(requestId: string, adminUserId: string, adminNote?: string) {
    const request = await prisma.brandRegistrationRequest.findUnique({
      where: { id: requestId },
      include: {
        fan: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('브랜드 등록 신청을 찾을 수 없습니다');
    }

    if (request.status !== 'SUBMITTED') {
      throw new Error('이미 처리된 신청입니다');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update request status
      const updatedRequest = await tx.brandRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminNote,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      });

      // 2. Create notification for user
      await tx.notification.create({
        data: {
          userId: request.fan.userId,
          type: 'BRAND_REGISTRATION_REJECTED',
          title: '브랜드 등록 반려',
          message: `${request.brandName} 브랜드 등록이 반려되었습니다.${adminNote ? ` 사유: ${adminNote}` : ''}`,
          data: { requestId },
        },
      });

      // 3. Create audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'BRAND_REGISTRATION_REJECT',
          entityType: 'BrandRegistrationRequest',
          entityId: requestId,
          newValue: { status: 'REJECTED', adminNote },
        },
      });

      return updatedRequest;
    });

    return result;
  }

  // ============================================
  // Admin Management (RBAC)
  // ============================================

  /**
   * 관리자 목록 조회
   */
  async getAdmins(filters: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;

    const where = {
      role: { in: ['ADMIN', 'FINANCE', 'SUPPORT', 'AUDITOR'] as UserRole[] },
    };

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          admin: {
            select: {
              id: true,
              name: true,
              department: true,
              permissions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { admins, total };
  }

  /**
   * 관리자 ID로 조회
   */
  async getAdminById(adminId: string) {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundError('관리자를 찾을 수 없습니다');
    }

    return admin;
  }

  /**
   * 관리자 역할 변경
   */
  async changeAdminRole(
    adminId: string,
    newRole: UserRole,
    actorUserId: string,
    reason: string
  ) {
    const admin = await this.getAdminById(adminId);
    const oldRole = admin.user.role;

    // 유효한 관리자 역할인지 확인
    const validAdminRoles: UserRole[] = ['ADMIN', 'FINANCE', 'SUPPORT', 'AUDITOR'];
    if (!validAdminRoles.includes(newRole)) {
      throw new BadRequestError('유효하지 않은 관리자 역할입니다');
    }

    // 자기 자신의 역할은 변경 불가
    if (admin.userId === actorUserId) {
      throw new BadRequestError('자신의 역할은 변경할 수 없습니다');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update user role
      const updatedUser = await tx.user.update({
        where: { id: admin.userId },
        data: { role: newRole },
      });

      // 2. Create admin action log
      await tx.adminActionLog.create({
        data: {
          actorId: actorUserId,
          action: 'ADMIN_ROLE_CHANGE',
          targetType: 'USER',
          targetId: admin.userId,
          requestBody: { oldRole, newRole, reason },
          result: { success: true },
          reason,
        },
      });

      // 3. Create audit log
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: 'ADMIN_ROLE_CHANGE',
          entityType: 'User',
          entityId: admin.userId,
          oldValue: { role: oldRole },
          newValue: { role: newRole },
          metadata: { reason },
        },
      });

      return updatedUser;
    });

    return result;
  }

  /**
   * 관리자 권한 변경
   */
  async updateAdminPermissions(
    adminId: string,
    permissions: string[],
    actorUserId: string,
    reason: string
  ) {
    const admin = await this.getAdminById(adminId);
    const oldPermissions = (admin.permissions as string[]) || [];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update admin permissions
      const updatedAdmin = await tx.admin.update({
        where: { id: adminId },
        data: { permissions },
      });

      // 2. Create admin action log
      await tx.adminActionLog.create({
        data: {
          actorId: actorUserId,
          action: 'ADMIN_PERMISSIONS_CHANGE',
          targetType: 'ADMIN',
          targetId: adminId,
          requestBody: { oldPermissions, newPermissions: permissions, reason },
          result: { success: true },
          reason,
        },
      });

      // 3. Create audit log
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: 'ADMIN_PERMISSIONS_CHANGE',
          entityType: 'Admin',
          entityId: adminId,
          oldValue: { permissions: oldPermissions },
          newValue: { permissions },
          metadata: { reason },
        },
      });

      return updatedAdmin;
    });

    return result;
  }
}

export const adminService = new AdminService();

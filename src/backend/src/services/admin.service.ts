import prisma from '../models/prisma';
import { NotFoundError } from '../utils/errors';
import { KycStatus } from '@prisma/client';
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
}

export const adminService = new AdminService();

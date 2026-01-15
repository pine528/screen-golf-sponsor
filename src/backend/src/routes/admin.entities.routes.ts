import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../models/prisma';
import { KycStatus } from '@prisma/client';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorize('ADMIN'));

/**
 * @route GET /admin/entities/athletes
 * @desc Get athletes list with filters
 * @query page, pageSize, q (search), kycStatus, isActive, from, to
 */
router.get('/athletes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const q = (req.query.q as string) || '';
    const kycStatus = req.query.kycStatus as KycStatus | undefined;
    const isActive = req.query.isActive as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    // Build where clause
    const where: any = {};

    // Search by name, realName, or user email
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { realName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // KYC status filter
    if (kycStatus && ['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'].includes(kycStatus)) {
      where.kycStatus = kycStatus;
    }

    // Active status filter (based on user.isActive)
    if (isActive === 'true' || isActive === 'false') {
      where.user = {
        ...where.user,
        isActive: isActive === 'true',
      };
    }

    // Date range filter
    if (from) {
      where.createdAt = { ...where.createdAt, gte: new Date(from) };
    }
    if (to) {
      where.createdAt = { ...where.createdAt, lte: new Date(to + 'T23:59:59.999Z') };
    }

    // Get athletes with pagination
    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              contracts: true,
              slotInstances: true,
            },
          },
        },
      }),
      prisma.athlete.count({ where }),
    ]);

    // Get summary stats
    const [totalAthletes, pendingKyc, approvedKyc, activeAthletes] = await Promise.all([
      prisma.athlete.count(),
      prisma.athlete.count({ where: { kycStatus: 'PENDING' } }),
      prisma.athlete.count({ where: { kycStatus: 'APPROVED' } }),
      prisma.athlete.count({
        where: { user: { isActive: true } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        athletes,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        summary: {
          total: totalAthletes,
          pendingKyc,
          approvedKyc,
          active: activeAthletes,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /admin/entities/brands
 * @desc Get brands list with filters
 * @query page, pageSize, q (search), kycStatus, isActive, from, to
 */
router.get('/brands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const q = (req.query.q as string) || '';
    const kycStatus = req.query.kycStatus as KycStatus | undefined;
    const isActive = req.query.isActive as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    // Build where clause
    const where: any = {};

    // Search by name, contactName, contactEmail, or user email
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // KYC status filter
    if (kycStatus && ['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'].includes(kycStatus)) {
      where.kycStatus = kycStatus;
    }

    // Active status filter (based on user.isActive)
    if (isActive === 'true' || isActive === 'false') {
      where.user = {
        ...where.user,
        isActive: isActive === 'true',
      };
    }

    // Date range filter
    if (from) {
      where.createdAt = { ...where.createdAt, gte: new Date(from) };
    }
    if (to) {
      where.createdAt = { ...where.createdAt, lte: new Date(to + 'T23:59:59.999Z') };
    }

    // Get brands with pagination
    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              bids: true,
              contracts: true,
              campaigns: true,
            },
          },
        },
      }),
      prisma.brand.count({ where }),
    ]);

    // Get summary stats
    const [totalBrands, pendingKyc, approvedKyc, activeBrands] = await Promise.all([
      prisma.brand.count(),
      prisma.brand.count({ where: { kycStatus: 'PENDING' } }),
      prisma.brand.count({ where: { kycStatus: 'APPROVED' } }),
      prisma.brand.count({
        where: { user: { isActive: true } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        brands,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        summary: {
          total: totalBrands,
          pendingKyc,
          approvedKyc,
          active: activeBrands,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /admin/entities/athletes/:id/toggle-active
 * @desc Toggle athlete user active status
 */
router.patch('/athletes/:id/toggle-active', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const athlete = await prisma.athlete.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!athlete) {
      return res.status(404).json({ success: false, error: 'Athlete not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: athlete.userId },
      data: { isActive: !athlete.user.isActive },
    });

    res.json({
      success: true,
      data: { isActive: updatedUser.isActive },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /admin/entities/brands/:id/toggle-active
 * @desc Toggle brand user active status
 */
router.patch('/brands/:id/toggle-active', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: brand.userId },
      data: { isActive: !brand.user.isActive },
    });

    res.json({
      success: true,
      data: { isActive: updatedUser.isActive },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

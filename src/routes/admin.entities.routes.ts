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
 * @route GET /admin/entities/athletes/:id
 * @desc Get athlete detail by ID with wallet, withdrawal stats, ledger
 */
router.get('/athletes/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. 기본 선수 정보 조회
    const athlete = await prisma.athlete.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        realName: true,
        tour: true,
        profileImageUrl: true,
        bio: true,
        socialLinks: true,
        primarySponsors: true,
        blockedCategories: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
        // 민감정보 제외: bankAccount, taxInfo, kycDocuments
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
            withdrawalRequests: true,
          },
        },
        // 최근 계약 5건
        contracts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            priceFinal: true,
            createdAt: true,
            brand: {
              select: { id: true, name: true },
            },
          },
        },
        // 최근 슬롯 5건
        slotInstances: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            slotTemplate: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!athlete) {
      return res.status(404).json({ success: false, error: 'Athlete not found' });
    }

    // 2. 지갑 조회
    const wallet = await prisma.wallet.findFirst({
      where: { ownerType: 'ATHLETE', ownerId: id },
      select: { id: true, balance: true, frozenAmount: true, updatedAt: true },
    });

    // 3. 출금 통계 (상태별 groupBy)
    const withdrawalGrouped = await prisma.withdrawalRequest.groupBy({
      by: ['status'],
      where: { athleteId: id },
      _count: true,
      _sum: { amount: true },
    });

    // 출금 통계를 객체로 변환
    const withdrawalStats = {
      requested: { count: 0, amount: '0' },
      approved: { count: 0, amount: '0' },
      paid: { count: 0, amount: '0' },
      rejected: { count: 0, amount: '0' },
    };
    for (const g of withdrawalGrouped) {
      const key = g.status.toLowerCase() as keyof typeof withdrawalStats;
      if (withdrawalStats[key]) {
        withdrawalStats[key] = {
          count: g._count,
          amount: (g._sum.amount || 0).toString(),
        };
      }
    }

    // 4. 최근 출금 10건
    const recentWithdrawals = await prisma.withdrawalRequest.findMany({
      where: { athleteId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        amount: true,
        bankAccountMasked: true,
        createdAt: true,
        paidAt: true,
      },
    });

    // 5. 최근 원장 10건
    const recentLedger = wallet
      ? await prisma.ledgerTx.findMany({
          where: { walletId: wallet.id },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            refType: true,
            refId: true,
            createdAt: true,
          },
        })
      : [];

    // 6. 계약 통계
    const [totalContracts, activeContracts, completedContracts, contractAmountSum] = await Promise.all([
      prisma.contract.count({ where: { athleteId: id } }),
      prisma.contract.count({
        where: { athleteId: id, status: { in: ['ACTIVE', 'ASSET_PENDING', 'VERIFICATION_PENDING'] } },
      }),
      prisma.contract.count({ where: { athleteId: id, status: 'COMPLETED' } }),
      prisma.contract.aggregate({
        where: { athleteId: id },
        _sum: { priceFinal: true },
      }),
    ]);

    // 응답 조립
    res.json({
      success: true,
      data: {
        ...athlete,
        // 계약에 priceFinal을 string으로 변환
        contracts: athlete.contracts.map((c) => ({
          ...c,
          priceFinal: c.priceFinal?.toString() || null,
        })),
        // 지갑 정보
        wallet: wallet
          ? {
              id: wallet.id,
              balance: wallet.balance.toString(),
              frozenAmount: wallet.frozenAmount.toString(),
              available: wallet.balance.sub(wallet.frozenAmount).toString(),
              updatedAt: wallet.updatedAt,
            }
          : null,
        // 출금 통계
        withdrawalStats,
        // 최근 출금
        recentWithdrawals: recentWithdrawals.map((w) => ({
          ...w,
          amount: w.amount.toString(),
        })),
        // 최근 원장
        recentLedger: recentLedger.map((l) => ({
          ...l,
          amount: l.amount.toString(),
          balanceAfter: l.balanceAfter.toString(),
        })),
        // 계약 통계
        contractStats: {
          total: totalContracts,
          active: activeContracts,
          completed: completedContracts,
          totalAmount: (contractAmountSum._sum.priceFinal || 0).toString(),
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
 * @route GET /admin/entities/brands/:id
 * @desc Get brand detail by ID with wallet, escrow stats, ledger
 */
router.get('/brands/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. 기본 브랜드 정보 조회
    const brand = await prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bizNo: true, // 마스킹 처리 필요
        category: true,
        contactEmail: true,
        contactPhone: true,
        contactName: true,
        website: true,
        description: true,
        address: true,
        penaltyScore: true,
        kycStatus: true,
        kycDocuments: true, // KYC 상세 정보용 (직접 노출 X)
        createdAt: true,
        updatedAt: true,
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
        // 최근 계약 5건
        contracts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            priceFinal: true,
            createdAt: true,
            athlete: {
              select: { id: true, name: true },
            },
          },
        },
        // 최근 캠페인 5건
        campaigns: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            budget: true,
            spentAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // 2. 지갑 조회
    const wallet = await prisma.wallet.findFirst({
      where: { ownerType: 'BRAND', ownerId: id },
      select: { id: true, balance: true, frozenAmount: true, updatedAt: true },
    });

    // 3. 에스크로 통계 (상태별 groupBy)
    const escrowGrouped = await prisma.escrow.groupBy({
      by: ['status'],
      where: { brandId: id },
      _count: true,
      _sum: { grossAmount: true },
    });

    // 에스크로 통계를 객체로 변환
    const escrowStats = {
      held: { count: 0, totalAmount: '0' },
      released: { count: 0, totalAmount: '0' },
      refunded: { count: 0, totalAmount: '0' },
    };
    for (const g of escrowGrouped) {
      const status = g.status.toLowerCase();
      const amount = g._sum.grossAmount?.toString() || '0';
      if (status === 'held') {
        escrowStats.held = { count: g._count, totalAmount: amount };
      } else if (status === 'released' || status === 'partially_released') {
        escrowStats.released.count += g._count;
        const current = BigInt(escrowStats.released.totalAmount);
        const add = BigInt(amount);
        escrowStats.released.totalAmount = (current + add).toString();
      } else if (status === 'refunded') {
        escrowStats.refunded = { count: g._count, totalAmount: amount };
      }
    }

    // 4. 최근 에스크로 10건
    const recentEscrows = await prisma.escrow.findMany({
      where: { brandId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        grossAmount: true,
        athletePayout: true,
        createdAt: true,
        releasedAt: true,
        contract: {
          select: {
            athlete: { select: { id: true, name: true } },
          },
        },
      },
    });

    // 5. 최근 원장 10건
    const recentLedger = wallet
      ? await prisma.ledgerTx.findMany({
          where: { walletId: wallet.id },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            refType: true,
            refId: true,
            createdAt: true,
          },
        })
      : [];

    // 6. 입찰 통계
    const [totalBids, wonBids, bidSpentSum] = await Promise.all([
      prisma.bid.count({ where: { brandId: id } }),
      prisma.bid.count({ where: { brandId: id, isWinning: true } }),
      prisma.bid.aggregate({
        where: { brandId: id, isWinning: true },
        _sum: { maxBid: true },
      }),
    ]);

    // 사업자번호 마스킹 (123-45-67890 → 123-45-*****)
    let maskedBizNo = null;
    if (brand.bizNo) {
      const parts = brand.bizNo.split('-');
      if (parts.length === 3) {
        maskedBizNo = `${parts[0]}-${parts[1]}-*****`;
      } else {
        maskedBizNo = brand.bizNo.slice(0, -5) + '*****';
      }
    }

    // KYC 상세 정보 추출 (kycDocuments에서 verifiedAt, businessStatus 등)
    let kycDetail = null;
    if (brand.kycDocuments && typeof brand.kycDocuments === 'object') {
      const kycDoc = brand.kycDocuments as any;
      kycDetail = {
        businessNumber: maskedBizNo,
        businessStatus: kycDoc?.verificationResult?.businessStatus || null,
        verifiedAt: kycDoc?.verificationResult?.verifiedAt || null,
      };
    }

    // 응답 조립 (kycDocuments 원본은 제외)
    const { kycDocuments, ...brandWithoutKycDocs } = brand;

    res.json({
      success: true,
      data: {
        ...brandWithoutKycDocs,
        bizNo: maskedBizNo,
        // 계약에 priceFinal을 string으로 변환
        contracts: brand.contracts.map((c) => ({
          ...c,
          priceFinal: c.priceFinal?.toString() || null,
        })),
        // 캠페인 budget/spentAmount 그대로 (Int)
        // 지갑 정보
        wallet: wallet
          ? {
              id: wallet.id,
              balance: wallet.balance.toString(),
              frozenAmount: wallet.frozenAmount.toString(),
              available: wallet.balance.sub(wallet.frozenAmount).toString(),
              updatedAt: wallet.updatedAt,
            }
          : null,
        // 에스크로 통계
        escrowStats,
        // 최근 에스크로
        recentEscrows: recentEscrows.map((e) => ({
          id: e.id,
          status: e.status,
          grossAmount: e.grossAmount.toString(),
          athletePayout: e.athletePayout.toString(),
          createdAt: e.createdAt,
          releasedAt: e.releasedAt,
          athlete: e.contract?.athlete || null,
        })),
        // 최근 원장
        recentLedger: recentLedger.map((l) => ({
          ...l,
          amount: l.amount.toString(),
          balanceAfter: l.balanceAfter.toString(),
        })),
        // 입찰 통계
        bidStats: {
          total: totalBids,
          won: wonBids,
          totalSpent: (bidSpentSum._sum?.maxBid || 0).toString(),
        },
        // KYC 상세
        kycDetail,
      },
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

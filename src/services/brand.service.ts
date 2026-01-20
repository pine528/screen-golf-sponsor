import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { KycStatus, WalletOwnerType } from '@prisma/client';
import { kycVerificationService } from './kyc-verification.service';
import { settingsService } from './settings.service';

export class BrandService {
  async findById(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        campaigns: true,
        _count: {
          select: {
            bids: true,
            contracts: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // 프론트엔드가 기대하는 필드명으로 변환하여 반환
    return {
      ...brand,
      companyName: brand.name,
      businessNumber: brand.bizNo,
      industry: brand.category,
    };
  }

  async findByUserId(userId: string) {
    const brand = await prisma.brand.findUnique({
      where: { userId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    return brand;
  }

  async list(page: number = 1, limit: number = 20, filters?: { kycStatus?: KycStatus; category?: string }) {
    const where: any = {};
    if (filters?.kycStatus) where.kycStatus = filters.kycStatus;
    if (filters?.category) where.category = filters.category;

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              bids: true,
              contracts: true,
            },
          },
        },
      }),
      prisma.brand.count({ where }),
    ]);

    return { brands, total };
  }

  async update(id: string, userId: string, data: {
    name?: string;
    companyName?: string;
    category?: string;
    industry?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactName?: string;
    bizNo?: string;
    businessNumber?: string;
    website?: string;
    description?: string;
    address?: string;
  }) {
    const brand = await prisma.brand.findUnique({ where: { id } });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this brand');
    }

    // 프론트엔드 필드명을 DB 필드명으로 매핑
    const updateData: any = {};

    // undefined가 아닌 경우에만 업데이트 (빈 문자열도 허용)
    if (data.name !== undefined) updateData.name = data.name;
    if (data.companyName !== undefined) updateData.name = data.companyName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.industry !== undefined) updateData.category = data.industry;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.contactName !== undefined) updateData.contactName = data.contactName;
    if (data.bizNo !== undefined) updateData.bizNo = data.bizNo;
    if (data.businessNumber !== undefined) updateData.bizNo = data.businessNumber;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.address !== undefined) updateData.address = data.address;

    return prisma.brand.update({
      where: { id },
      data: updateData,
    });
  }

  async updateKycStatus(id: string, status: KycStatus, documents?: any) {
    return prisma.brand.update({
      where: { id },
      data: {
        kycStatus: status,
        kycDocuments: documents,
      },
    });
  }

  async submitKyc(
    userId: string,
    documents: { type: string; url: string }[],
    businessNumber?: string
  ) {
    const brand = await prisma.brand.findUnique({ where: { userId } });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.kycStatus === 'APPROVED') {
      throw new ForbiddenError('KYC already approved');
    }

    // 사업자등록번호가 제공된 경우 자동 검증
    let verificationResult = null;
    let autoApproved = false;

    // 관리자 설정에서 자동 승인 여부 확인
    const autoApproveEnabled = await settingsService.getBoolean('KYC_AUTO_APPROVE_ENABLED');

    if (businessNumber) {
      const verification = await kycVerificationService.verifyBrandKyc({
        businessNumber,
        companyName: brand.name,
      });

      verificationResult = verification.results;

      // 자동 승인 조건: 설정이 켜져 있고, 사업자등록번호가 유효한 계속사업자
      if (autoApproveEnabled && verification.autoApprove) {
        autoApproved = true;
      }
    }

    const kycData = {
      documents,
      businessNumber: businessNumber || null,
      verification: verificationResult ? JSON.parse(JSON.stringify(verificationResult)) : null,
      autoApproved,
      submittedAt: new Date().toISOString(),
    };

    // 자동 승인이 켜져 있고 검증 통과한 경우에만 APPROVED, 그 외에는 PENDING
    return prisma.brand.update({
      where: { id: brand.id },
      data: {
        kycStatus: autoApproved ? 'APPROVED' : 'PENDING',
        kycDocuments: kycData,
      },
    });
  }

  async addPenalty(id: string, points: number) {
    return prisma.brand.update({
      where: { id },
      data: {
        penaltyScore: {
          increment: points,
        },
      },
    });
  }

  async getStats(brandId: string) {
    const [bidsCount, contractsCount, totalSpent] = await Promise.all([
      prisma.bid.count({ where: { brandId } }),
      prisma.contract.count({ where: { brandId } }),
      prisma.contract.aggregate({
        where: { brandId, status: 'COMPLETED' },
        _sum: { priceFinal: true },
      }),
    ]);

    return {
      totalBids: bidsCount,
      totalContracts: contractsCount,
      totalSpent: totalSpent._sum.priceFinal || 0,
    };
  }

  /**
   * ★ Phase 9-3: 브랜드 예약 목록 (Direct Buy + Auction 낙찰)
   * - PENDING_SIGNATURE 상태 + athleteSignedAt null (선수 서명 대기)
   */
  async getMyReservations(brandId: string) {
    const now = new Date();
    const contracts = await prisma.contract.findMany({
      where: {
        brandId,
        status: 'PENDING_SIGNATURE',
        athleteSignedAt: null,
        brandSignedAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true } },
                athlete: { select: { id: true, name: true } },
                slotTemplate: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return contracts.map((contract) => {
      const slot = contract.auction.slotInstance;
      const reservedUntil = contract.reservedUntil || new Date(0);
      const remainingMs = reservedUntil.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

      // Auction 낙찰인지 Direct Buy인지 판단
      const isAuctionWin = contract.auction.status === 'ENDED' && contract.auction.winningBidId !== null;

      return {
        id: contract.id,
        slotId: slot.id,
        slotName: slot.slotTemplate.name,
        athleteName: slot.athlete.name,
        athleteId: slot.athlete.id,
        eventName: slot.event.name,
        eventId: slot.event.id,
        price: contract.priceFinal,
        reservedUntil,
        remainingSeconds,
        type: isAuctionWin ? 'AUCTION' : 'DIRECT_BUY',
        createdAt: contract.createdAt,
        isExpired: remainingSeconds === 0,
      };
    });
  }

  /**
   * ★ Phase 9-3: 브랜드 입찰 목록
   * - 내가 입찰한 경매 목록 + 내 입찰 상태
   */
  async getMyBids(brandId: string) {
    const now = new Date();
    const bids = await prisma.bid.findMany({
      where: { brandId },
      orderBy: { updatedAt: 'desc' },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true } },
                athlete: { select: { id: true, name: true } },
                slotTemplate: { select: { id: true, name: true } },
              },
            },
            bids: {
              orderBy: { currentProxy: 'desc' },
              take: 1,
              select: { currentProxy: true },
            },
          },
        },
      },
    });

    return bids.map((bid) => {
      const auction = bid.auction;
      const slot = auction.slotInstance;
      const highestBid = auction.bids[0]?.currentProxy || 0;
      const remainingMs = auction.endAt.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

      return {
        id: bid.id,
        auctionId: auction.id,
        slotId: slot.id,
        slotName: slot.slotTemplate.name,
        athleteName: slot.athlete.name,
        athleteId: slot.athlete.id,
        eventName: slot.event.name,
        eventId: slot.event.id,
        myBidAmount: bid.maxBid,
        myCurrentProxy: bid.currentProxy,
        currentHighest: highestBid,
        isHighest: bid.isWinning,
        auctionEndAt: auction.endAt,
        remainingSeconds,
        status: auction.status,
        createdAt: bid.createdAt,
        updatedAt: bid.updatedAt,
      };
    });
  }

  /**
   * ★ Phase 9-3: 브랜드 낙찰 목록
   * - Contract 생성된 목록 (PENDING_SIGNATURE 이후 상태 포함)
   */
  async getMyWins(brandId: string) {
    const contracts = await prisma.contract.findMany({
      where: {
        brandId,
        // PENDING_SIGNATURE 포함 - 낙찰 확정된 모든 계약
      },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true } },
                athlete: { select: { id: true, name: true } },
                slotTemplate: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return contracts.map((contract) => {
      const slot = contract.auction.slotInstance;
      const isAuctionWin = contract.auction.status === 'ENDED' && contract.auction.winningBidId !== null;

      return {
        id: contract.id,
        auctionId: contract.auctionId,
        slotId: slot.id,
        slotName: slot.slotTemplate.name,
        athleteName: slot.athlete.name,
        athleteId: slot.athlete.id,
        eventName: slot.event.name,
        eventId: slot.event.id,
        price: contract.priceFinal,
        status: contract.status,
        type: isAuctionWin ? 'AUCTION' : 'DIRECT_BUY',
        brandSignedAt: contract.brandSignedAt,
        athleteSignedAt: contract.athleteSignedAt,
        signedAt: contract.signedAt,
        createdAt: contract.createdAt,
      };
    });
  }

  /**
   * ★ Phase 10-1: 브랜드 지갑 조회
   */
  async getMyWallet(brandId: string) {
    // getOrCreate wallet
    const wallet = await prisma.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: WalletOwnerType.BRAND, ownerId: brandId } },
      create: {
        ownerType: WalletOwnerType.BRAND,
        ownerId: brandId,
        balance: 0,
        frozenAmount: 0,
        version: 0,
      },
      update: {},
    });

    // 최근 거래 내역
    const recentTransactions = await prisma.ledgerTx.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        frozenAmount: wallet.frozenAmount,
        availableBalance: Number(wallet.balance) - Number(wallet.frozenAmount),
      },
      recentTransactions,
    };
  }
}

export const brandService = new BrandService();

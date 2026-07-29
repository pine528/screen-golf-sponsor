import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { KycStatus } from '@prisma/client';

export class AthleteService {
  async findById(id: string) {
    const athlete = await prisma.athlete.findUnique({
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
        slotInstances: {
          include: {
            slotTemplate: true,
            event: true,
          },
        },
        eventParticipations: {
          include: {
            event: true,
          },
        },
        _count: {
          select: {
            contracts: true,
            slotInstances: true,
          },
        },
      },
    });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    return athlete;
  }

  async findByUserId(userId: string) {
    const athlete = await prisma.athlete.findUnique({
      where: { userId },
    });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    return athlete;
  }

  async list(page: number = 1, limit: number = 20, filters?: {
    tour?: string;
    kycStatus?: KycStatus;
  }) {
    const where: any = {};
    if (filters?.tour) where.tour = filters.tour;
    if (filters?.kycStatus) where.kycStatus = filters.kycStatus;

    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
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

    return { athletes, total };
  }

  async update(id: string, userId: string, data: {
    name?: string;
    displayName?: string;
    realName?: string;
    bio?: string;
    profileImageUrl?: string;
    socialLinks?: Record<string, string>;
    socialMedia?: string;
    blockedCategories?: string[];
    primarySponsors?: any;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
    // SPONPIK 4. 권장 데이터 항목 (구조화 필드)
    height?: number | null;
    region?: string | null;
    debutYear?: number | null;
    affiliation?: string | null;
    education?: string | null;
    awards?: string | null;
    career?: string | null;
    sportType?: string | null;
    sportId?: string | null;
    isActive?: boolean;
  }) {
    console.log('[AthleteService.update] Input:', { id, userId, data });

    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      console.log('[AthleteService.update] Athlete not found:', id);
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      console.log('[AthleteService.update] Authorization failed:', { athleteUserId: athlete.userId, requestUserId: userId });
      throw new ForbiddenError('Not authorized to update this athlete');
    }

    // 프론트엔드 필드명을 DB 필드명으로 매핑
    const updateData: any = {};

    // undefined가 아닌 경우에만 업데이트 (빈 문자열도 허용)
    // name 필드는 displayName이 빈 문자열이 아닌 경우에만 업데이트
    if (data.name !== undefined && data.name !== '') updateData.name = data.name;
    if (data.displayName !== undefined && data.displayName !== '') updateData.name = data.displayName;
    if (data.realName !== undefined) updateData.realName = data.realName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;
    if (data.socialMedia !== undefined) updateData.socialLinks = { instagram: data.socialMedia };
    if (data.blockedCategories !== undefined) updateData.blockedCategories = data.blockedCategories;
    if (data.primarySponsors !== undefined) updateData.primarySponsors = data.primarySponsors;

    // SPONPIK 4. 권장 데이터 항목 (구조화 필드) — 선수가 직접 수정 가능
    // 범위 검증 (악의적 값 차단)
    if (data.height !== undefined) {
      if (data.height !== null && (data.height < 100 || data.height > 250)) {
        throw new BadRequestError('신장은 100~250cm 범위로 입력해주세요');
      }
      updateData.height = data.height;
    }
    if (data.region !== undefined) {
      if (data.region !== null && data.region.length > 100) {
        throw new BadRequestError('거주 지역은 100자 이내로 입력해주세요');
      }
      updateData.region = data.region;
    }
    if (data.debutYear !== undefined) {
      const currentYear = new Date().getFullYear();
      if (data.debutYear !== null && (data.debutYear < 1950 || data.debutYear > currentYear + 1)) {
        throw new BadRequestError(`데뷔 연도는 1950~${currentYear + 1} 범위로 입력해주세요`);
      }
      updateData.debutYear = data.debutYear;
    }
    if (data.affiliation !== undefined) {
      if (data.affiliation !== null && data.affiliation.length > 200) {
        throw new BadRequestError('소속은 200자 이내로 입력해주세요');
      }
      updateData.affiliation = data.affiliation;
    }
    // 선수 프로필 구조화 — 학력/수상/경력 (각 500자 이내)
    for (const key of ['education', 'awards', 'career'] as const) {
      if (data[key] !== undefined) {
        if (data[key] !== null && (data[key] as string).length > 500) {
          throw new BadRequestError('학력/수상/경력은 각 500자 이내로 입력해주세요');
        }
        updateData[key] = data[key];
      }
    }
    if (data.sportType !== undefined) {
      // 화이트리스트 검증 (1차 골프/스크린골프)
      if (data.sportType !== null && !['GOLF', 'SCREEN_GOLF', 'BASEBALL', 'SOCCER', 'VOLLEYBALL', 'BASKETBALL', 'TENNIS'].includes(data.sportType)) {
        throw new BadRequestError('지원하지 않는 종목입니다');
      }
      updateData.sportType = data.sportType;
    }
    if (data.sportId !== undefined) updateData.sportId = data.sportId;
    // isActive는 운영자 전용 토글 — service.update에서는 제외
    // (관리자 전용 라우트 별도 필요)

    // 은행 정보는 bankAccount JSON 필드에 저장
    if (data.bankName !== undefined || data.bankAccount !== undefined || data.bankHolder !== undefined) {
      const existingBankAccount = (athlete.bankAccount as any) || {};
      updateData.bankAccount = {
        ...existingBankAccount,
        bankName: data.bankName !== undefined ? data.bankName : existingBankAccount.bankName,
        accountNumber: data.bankAccount !== undefined ? data.bankAccount : existingBankAccount.accountNumber,
        accountHolder: data.bankHolder !== undefined ? data.bankHolder : existingBankAccount.accountHolder,
      };
    }

    console.log('[AthleteService.update] UpdateData:', updateData);

    // 선수가 직접 프로필을 고친 경우에만 수정 시각을 남긴다 (목록의 UPDATE 뱃지 기준).
    // 은행 정보처럼 공개되지 않는 항목만 바꾼 경우는 제외한다.
    const PUBLIC_FIELDS = [
      'name', 'realName', 'bio', 'profileImageUrl', 'socialLinks', 'primarySponsors',
      'height', 'region', 'debutYear', 'affiliation', 'education', 'awards', 'career', 'sportType',
    ];
    if (PUBLIC_FIELDS.some((f) => updateData[f] !== undefined)) {
      updateData.profileUpdatedAt = new Date();
    }

    const updated = await prisma.athlete.update({
      where: { id },
      data: updateData,
    });

    console.log('[AthleteService.update] Updated athlete:', updated);
    return updated;
  }

  async updateKycStatus(id: string, status: KycStatus, documents?: any) {
    return prisma.athlete.update({
      where: { id },
      data: {
        kycStatus: status,
        kycDocuments: documents,
      },
    });
  }

  async submitKyc(userId: string, documents: { type: string; url: string }[]) {
    const athlete = await prisma.athlete.findUnique({ where: { userId } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.kycStatus === 'APPROVED') {
      throw new ForbiddenError('KYC already approved');
    }

    return prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        kycStatus: 'PENDING',
        kycDocuments: {
          documents,
          submittedAt: new Date(),
        },
      },
    });
  }

  async updateBankInfo(id: string, userId: string, bankAccount: any, taxInfo?: any) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.athlete.update({
      where: { id },
      data: {
        bankAccount,
        taxInfo,
      },
    });
  }

  async updateSlotAvailability(id: string, userId: string, blockedCategories: string[]) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.athlete.update({
      where: { id },
      data: { blockedCategories },
    });
  }

  async getStats(athleteId: string) {
    const [contractsCount, totalEarnings, activeSlots] = await Promise.all([
      prisma.contract.count({ where: { athleteId } }),
      prisma.settlement.aggregate({
        where: {
          contract: { athleteId },
          status: 'PAID',
        },
        _sum: { payoutAmount: true },
      }),
      prisma.slotInstance.count({
        where: { athleteId, status: { in: ['OPEN', 'IN_AUCTION'] } },
      }),
    ]);

    return {
      totalContracts: contractsCount,
      totalEarnings: totalEarnings._sum.payoutAmount || 0,
      activeSlots,
    };
  }

  async getAvailableSlots(athleteId: string, eventId?: string) {
    // OPEN, IN_AUCTION, RESERVED 상태 모두 포함 (경매중/예약 슬롯도 표시)
    const where: any = {
      athleteId,
      status: { in: ['OPEN', 'IN_AUCTION', 'RESERVED'] },
    };
    if (eventId) where.eventId = eventId;

    return prisma.slotInstance.findMany({
      where,
      include: {
        slotTemplate: true,
        event: true,
        auction: {
          select: {
            id: true,
            status: true,
            currentPrice: true,
            startAt: true,
            endAt: true,
            isFeatured: true,
            _count: { select: { bids: true } },
            // Contract는 Auction을 통해 연결됨 (1:1 관계)
            contract: {
              select: {
                id: true,
                status: true,
                priceFinal: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { event: { dateStart: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * ★ Phase 9-3: 선수의 서명 대기 계약 목록
   * - brandSignedAt 있고 athleteSignedAt 없는 계약
   * - 60분 이하면 urgent 표시
   */
  async getPendingSignatures(athleteId: string) {
    const now = new Date();
    const urgentThreshold = 60 * 60 * 1000; // 60분

    const contracts = await prisma.contract.findMany({
      where: {
        athleteId,
        status: 'PENDING_SIGNATURE',
        brandSignedAt: { not: null },
        athleteSignedAt: null,
      },
      orderBy: [
        { reservedUntil: 'asc' }, // 만료 임박순
        { createdAt: 'desc' },
      ],
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true } },
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
      const isUrgent = remainingMs > 0 && remainingMs <= urgentThreshold;

      // Auction 낙찰인지 Direct Buy인지 판단
      const isAuctionWin = contract.auction.status === 'ENDED' && contract.auction.winningBidId !== null;

      return {
        id: contract.id,
        slotId: slot.id,
        slotName: slot.slotTemplate.name,
        brandId: contract.brand.id,
        brandName: contract.brand.name,
        brandCategory: contract.brand.category,
        eventName: slot.event.name,
        eventId: slot.event.id,
        price: contract.priceFinal,
        reservedUntil,
        remainingSeconds,
        type: isAuctionWin ? 'AUCTION' : 'DIRECT_BUY',
        createdAt: contract.createdAt,
        isUrgent,
        isExpired: remainingSeconds === 0,
      };
    });
  }
}

export const athleteService = new AthleteService();

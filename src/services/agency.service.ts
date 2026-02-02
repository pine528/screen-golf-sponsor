import { prisma } from '../models/prisma';
import { KycStatus, UserRole } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import bcrypt from 'bcryptjs';

interface AgencyUpdateData {
  name?: string;
  bizNo?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  website?: string;
  description?: string;
}

interface RegisterAthleteData {
  email: string;
  password: string;
  name: string;
  tour: string;
  realName?: string;
  bio?: string;
  profileImageUrl?: string;
}

interface SlotSaleModeData {
  enableAuction?: boolean;
  enableDirectBuy?: boolean;
  directBuyPrice?: number;
  auctionMinBid?: number;
  auctionEndAt?: Date;
  isPublic?: boolean;
}

export class AgencyService {
  /**
   * 에이전시 ID로 조회
   */
  async findById(id: string) {
    const agency = await prisma.agency.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, role: true, isActive: true },
        },
        athletes: {
          select: {
            id: true,
            name: true,
            tour: true,
            kycStatus: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    return agency;
  }

  /**
   * 사용자 ID로 에이전시 조회
   */
  async findByUserId(userId: string) {
    const agency = await prisma.agency.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, role: true, isActive: true },
        },
        athletes: {
          select: {
            id: true,
            name: true,
            tour: true,
            kycStatus: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    return agency;
  }

  /**
   * 에이전시 목록 조회
   */
  async list(page: number = 1, limit: number = 20, filters?: { kycStatus?: KycStatus }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.kycStatus) {
      where.kycStatus = filters.kycStatus;
    }

    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true },
          },
          _count: {
            select: { athletes: true },
          },
        },
      }),
      prisma.agency.count({ where }),
    ]);

    return {
      agencies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 에이전시 프로필 수정
   */
  async update(id: string, userId: string, data: AgencyUpdateData) {
    const agency = await prisma.agency.findUnique({ where: { id } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this agency');
    }

    return prisma.agency.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * KYC 제출
   */
  async submitKyc(userId: string, documents: { type: string; url: string }[]) {
    const agency = await prisma.agency.findUnique({ where: { userId } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.kycStatus === 'APPROVED') {
      throw new BadRequestError('KYC already approved');
    }

    return prisma.agency.update({
      where: { id: agency.id },
      data: {
        kycStatus: 'PENDING',
        kycDocuments: {
          documents,
          submittedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * KYC 상태 업데이트 (Admin 전용)
   */
  async updateKycStatus(id: string, status: KycStatus, adminNote?: string) {
    const agency = await prisma.agency.findUnique({ where: { id } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    const kycDocuments = (agency.kycDocuments as any) || {};

    return prisma.agency.update({
      where: { id },
      data: {
        kycStatus: status,
        kycDocuments: {
          ...kycDocuments,
          reviewedAt: new Date().toISOString(),
          reviewNote: adminNote,
          status,
        },
      },
    });
  }

  /**
   * 선수 등록 (에이전시 KYC 승인 후에만 가능)
   */
  async registerAthlete(agencyId: string, agencyUserId: string, data: RegisterAthleteData) {
    // 에이전시 확인
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== agencyUserId) {
      throw new ForbiddenError('Not authorized');
    }

    // KYC 승인 확인
    if (agency.kycStatus !== 'APPROVED') {
      throw new ForbiddenError('Agency KYC must be approved before registering athletes');
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(data.password, 12);

    // 트랜잭션으로 User와 Athlete 생성
    const result = await prisma.$transaction(async (tx) => {
      // User 생성
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: UserRole.ATHLETE,
        },
      });

      // Athlete 생성 (에이전시 연결)
      const athlete = await tx.athlete.create({
        data: {
          userId: user.id,
          name: data.name,
          realName: data.realName,
          tour: data.tour,
          bio: data.bio,
          profileImageUrl: data.profileImageUrl,
          agencyId: agencyId,
          agencyAssignedAt: new Date(),
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_REGISTER_ATHLETE',
          entityType: 'ATHLETE',
          entityId: athlete.id,
          newValue: {
            athleteId: athlete.id,
            athleteName: data.name,
            agencyId: agencyId,
          },
        },
      });

      return { user, athlete };
    });

    return result.athlete;
  }

  /**
   * 에이전시 소속 선수 목록
   */
  async getAthletes(agencyId: string, agencyUserId: string) {
    console.log('[getAthletes] Called with:', { agencyId, agencyUserId });

    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== agencyUserId) {
      throw new ForbiddenError('Not authorized');
    }

    const athletes = await prisma.athlete.findMany({
      where: { agencyId },
      include: {
        user: {
          select: { email: true, isActive: true },
        },
        _count: {
          select: {
            slotInstances: true,
            contracts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[getAthletes] Found athletes:', athletes.length);

    return athletes;
  }

  /**
   * 선수 해제 (에이전시 연결 해제)
   */
  async unassignAthlete(agencyId: string, athleteId: string, agencyUserId: string) {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== agencyUserId) {
      throw new ForbiddenError('Not authorized');
    }

    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.agencyId !== agencyId) {
      throw new BadRequestError('Athlete does not belong to this agency');
    }

    return prisma.$transaction(async (tx) => {
      const updatedAthlete = await tx.athlete.update({
        where: { id: athleteId },
        data: {
          agencyId: null,
          agencyAssignedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_UNASSIGN_ATHLETE',
          entityType: 'ATHLETE',
          entityId: athleteId,
          oldValue: { agencyId },
          newValue: { agencyId: null },
        },
      });

      return updatedAthlete;
    });
  }

  /**
   * 에이전시가 선수의 슬롯 조회
   */
  async getAthleteSlots(agencyId: string, athleteId: string, agencyUserId: string) {
    // 권한 확인
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const slots = await prisma.slotInstance.findMany({
      where: { athleteId },
      include: {
        event: {
          select: { id: true, name: true, dateStart: true, dateEnd: true, status: true },
        },
        slotTemplate: {
          select: { id: true, code: true, name: true, bodyPart: true },
        },
        auction: {
          select: { id: true, status: true, currentPrice: true, endAt: true, isFeatured: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return slots;
  }

  /**
   * 에이전시가 선수 대신 슬롯 생성
   */
  async createAthleteSlot(
    agencyId: string,
    agencyUserId: string,
    athleteId: string,
    data: { eventId: string; templateId: string; reservePrice?: number }
  ) {
    // 권한 확인
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    // 이벤트 확인
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // 템플릿 확인
    const template = await prisma.slotTemplate.findUnique({ where: { id: data.templateId } });
    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    // 중복 확인
    const existing = await prisma.slotInstance.findUnique({
      where: {
        eventId_athleteId_slotTemplateId: {
          eventId: data.eventId,
          athleteId,
          slotTemplateId: data.templateId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Slot already exists for this event/athlete/template combination');
    }

    const slot = await prisma.$transaction(async (tx) => {
      const newSlot = await tx.slotInstance.create({
        data: {
          eventId: data.eventId,
          athleteId,
          slotTemplateId: data.templateId,
          reservePrice: data.reservePrice || template.defaultReservePrice,
        },
        include: {
          event: { select: { id: true, name: true } },
          slotTemplate: { select: { id: true, code: true, name: true, bodyPart: true } },
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_CREATE_ATHLETE_SLOT',
          entityType: 'SLOT_INSTANCE',
          entityId: newSlot.id,
          metadata: {
            agencyId,
            athleteId,
            eventId: data.eventId,
            templateId: data.templateId,
          },
        },
      });

      return newSlot;
    });

    return slot;
  }

  /**
   * 에이전시가 선수 대신 슬롯 일괄 생성
   */
  async bulkCreateAthleteSlots(
    agencyId: string,
    agencyUserId: string,
    athleteId: string,
    data: { eventId: string; templateIds: string[] }
  ) {
    // 권한 확인
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    // 이벤트 확인
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // 템플릿들 확인
    const templates = await prisma.slotTemplate.findMany({
      where: { id: { in: data.templateIds } },
    });

    if (templates.length !== data.templateIds.length) {
      throw new NotFoundError('Some slot templates not found');
    }

    // 기존 슬롯 확인
    const existingSlots = await prisma.slotInstance.findMany({
      where: {
        eventId: data.eventId,
        athleteId,
        slotTemplateId: { in: data.templateIds },
      },
    });

    const existingTemplateIds = new Set(existingSlots.map(s => s.slotTemplateId));
    const newTemplateIds = data.templateIds.filter(id => !existingTemplateIds.has(id));

    if (newTemplateIds.length === 0) {
      throw new ConflictError('All slots already exist');
    }

    const slots = await prisma.$transaction(async (tx) => {
      const createdSlots = [];

      for (const templateId of newTemplateIds) {
        const template = templates.find(t => t.id === templateId)!;
        const newSlot = await tx.slotInstance.create({
          data: {
            eventId: data.eventId,
            athleteId,
            slotTemplateId: templateId,
            reservePrice: template.defaultReservePrice,
          },
          include: {
            event: { select: { id: true, name: true } },
            slotTemplate: { select: { id: true, code: true, name: true, bodyPart: true } },
          },
        });
        createdSlots.push(newSlot);
      }

      // 감사 로그
      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_BULK_CREATE_ATHLETE_SLOTS',
          entityType: 'SLOT_INSTANCE',
          entityId: createdSlots[0]?.id || 'bulk',
          metadata: {
            agencyId,
            athleteId,
            eventId: data.eventId,
            templateIds: newTemplateIds,
            count: createdSlots.length,
          },
        },
      });

      return createdSlots;
    });

    return slots;
  }

  /**
   * 에이전시가 선수의 슬롯 판매모드 설정
   */
  async updateAthleteSlotSaleMode(
    agencyUserId: string,
    athleteId: string,
    slotId: string,
    data: SlotSaleModeData
  ) {
    // 권한 확인
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: { auction: true },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (slot.athleteId !== athleteId) {
      throw new BadRequestError('Slot does not belong to this athlete');
    }

    if (slot.status !== 'OPEN' && slot.status !== 'IN_AUCTION') {
      throw new BadRequestError('Cannot modify slot in current status');
    }

    // 최소 하나는 활성화되어야 함
    const enableAuction = data.enableAuction ?? slot.enableAuction;
    const enableDirectBuy = data.enableDirectBuy ?? slot.enableDirectBuy;
    const directBuyPrice = data.directBuyPrice !== undefined ? data.directBuyPrice : slot.directBuyPrice;
    const auctionMinBid = data.auctionMinBid !== undefined ? data.auctionMinBid : slot.auctionMinBid;
    const auctionEndAt = data.auctionEndAt !== undefined ? data.auctionEndAt : slot.auctionEndAt;

    if (!enableAuction && !enableDirectBuy) {
      throw new BadRequestError('At least one sale mode must be enabled');
    }

    // 경매 활성화 시 필수 필드 검증
    if (enableAuction) {
      if (!auctionMinBid || Number(auctionMinBid) <= 0) {
        throw new BadRequestError('Auction minimum bid is required when auction is enabled');
      }
      if (!auctionEndAt) {
        throw new BadRequestError('Auction end date is required when auction is enabled');
      }
      if (new Date(auctionEndAt) <= new Date()) {
        throw new BadRequestError('Auction end date must be in the future');
      }
    }

    // 트랜잭션으로 슬롯 업데이트 + 경매 생성/업데이트
    return prisma.$transaction(async (tx) => {
      // 슬롯 업데이트
      const updatedSlot = await tx.slotInstance.update({
        where: { id: slotId },
        data: {
          enableAuction,
          enableDirectBuy,
          directBuyPrice: enableDirectBuy && directBuyPrice ? directBuyPrice : null,
          auctionMinBid: enableAuction && auctionMinBid ? auctionMinBid : null,
          auctionEndAt: enableAuction ? auctionEndAt : null,
          status: enableAuction ? 'IN_AUCTION' : 'OPEN',
        },
        include: {
          event: true,
          athlete: true,
          slotTemplate: true,
          auction: true,
        },
      });

      // 경매 활성화 시 Auction 레코드 생성/업데이트
      if (enableAuction && auctionMinBid && auctionEndAt) {
        const now = new Date();
        const startPrice = Number(auctionMinBid);

        if (slot.auction) {
          // 기존 경매가 있으면 항상 UPDATE (slotInstanceId가 UNIQUE이므로 새로 생성 불가)
          await tx.auction.update({
            where: { id: slot.auction.id },
            data: {
              startAt: now,
              endAt: new Date(auctionEndAt),
              originalEndAt: new Date(auctionEndAt),
              currentPrice: startPrice,
              status: 'LIVE',
              // 종료/취소/유찰 상태에서 재활성화 시 초기화
              totalExtended: 0,
              winningBidId: null,
              isFeatured: data.isPublic ?? slot.auction.isFeatured,
            },
          });
        } else {
          // 새 경매 생성 - 즉시 LIVE 상태로
          await tx.auction.create({
            data: {
              slotInstanceId: slotId,
              startAt: now,
              endAt: new Date(auctionEndAt),
              originalEndAt: new Date(auctionEndAt),
              currentPrice: startPrice,
              status: 'LIVE',
              softCloseSec: 120,
              maxExtensionSec: 600,
              minBidIncrement: 10000,
              isFeatured: data.isPublic ?? false,
            },
          });
        }
      } else if (!enableAuction && slot.auction) {
        // 경매 비활성화 시 기존 경매 취소
        if (slot.auction.status === 'SCHEDULED' || slot.auction.status === 'LIVE') {
          await tx.auction.update({
            where: { id: slot.auction.id },
            data: { status: 'CANCELLED' },
          });
        }
      }

      // 최종 슬롯 정보 반환
      return tx.slotInstance.findUnique({
        where: { id: slotId },
        include: {
          event: true,
          athlete: true,
          slotTemplate: true,
          auction: true,
        },
      });
    });
  }

  /**
   * 에이전시가 선수 대신 계약 서명
   */
  async signContractForAthlete(
    agencyUserId: string,
    athleteId: string,
    contractId: string
  ) {
    // 권한 확인
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { athlete: true },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.athleteId !== athleteId) {
      throw new BadRequestError('Contract does not belong to this athlete');
    }

    if (contract.status !== 'PENDING_SIGNATURE') {
      throw new BadRequestError('Contract is not pending signature');
    }

    if (!contract.brandSignedAt) {
      throw new BadRequestError('Brand must sign first');
    }

    if (contract.athleteSignedAt) {
      throw new BadRequestError('Athlete already signed');
    }

    // 예약 만료 확인
    if (contract.reservedUntil && new Date() > contract.reservedUntil) {
      throw new BadRequestError('Reservation has expired');
    }

    return prisma.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          athleteSignedAt: new Date(),
          signedAt: new Date(),
          status: 'ACTIVE',
        },
      });

      // 슬롯 상태 업데이트
      const auction = await tx.auction.findUnique({
        where: { id: contract.auctionId },
      });

      if (auction) {
        await tx.slotInstance.update({
          where: { id: auction.slotInstanceId },
          data: { status: 'SOLD' },
        });
      }

      // 감사 로그
      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_SIGN_CONTRACT_FOR_ATHLETE',
          entityType: 'CONTRACT',
          entityId: contractId,
          newValue: {
            athleteId,
            signedAt: new Date(),
            signedByAgency: true,
          },
        },
      });

      return updatedContract;
    });
  }

  /**
   * 에이전시가 관리하는 선수들의 서명 대기 계약 조회
   */
  async getPendingSignatures(agencyId: string, agencyUserId: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: { athletes: { select: { id: true } } },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== agencyUserId) {
      throw new ForbiddenError('Not authorized');
    }

    const athleteIds = agency.athletes.map((a) => a.id);

    if (athleteIds.length === 0) {
      return [];
    }

    const contracts = await prisma.contract.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: 'PENDING_SIGNATURE',
        brandSignedAt: { not: null },
        athleteSignedAt: null,
      },
      include: {
        athlete: {
          select: { id: true, name: true, profileImageUrl: true },
        },
        brand: {
          select: { id: true, name: true },
        },
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true, dateStart: true } },
                slotTemplate: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ reservedUntil: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    const urgentThreshold = 60 * 60 * 1000; // 60분

    return contracts.map((contract) => {
      const remainingMs = contract.reservedUntil
        ? contract.reservedUntil.getTime() - now.getTime()
        : null;
      const remainingSeconds = remainingMs
        ? Math.max(0, Math.floor(remainingMs / 1000))
        : null;

      return {
        ...contract,
        remainingSeconds,
        isUrgent: remainingMs !== null && remainingMs > 0 && remainingMs <= urgentThreshold,
        isExpired: remainingMs !== null && remainingMs <= 0,
      };
    });
  }

  /**
   * 에이전시가 해당 선수를 관리할 수 있는지 확인
   */
  async canManageAthlete(agencyUserId: string, athleteId: string): Promise<boolean> {
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId },
      include: { athletes: { select: { id: true } } },
    });

    if (!agency) {
      return false;
    }

    return agency.athletes.some((a) => a.id === athleteId);
  }

  /**
   * 에이전시 통계
   */
  async getStats(agencyId: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        athletes: {
          select: { id: true },
        },
      },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    const athleteIds = agency.athletes.map((a) => a.id);

    if (athleteIds.length === 0) {
      return {
        totalAthletes: 0,
        activeSlots: 0,
        pendingContracts: 0,
        totalContractValue: 0,
      };
    }

    const [activeSlots, pendingContracts, completedContracts] = await Promise.all([
      prisma.slotInstance.count({
        where: {
          athleteId: { in: athleteIds },
          status: { in: ['OPEN', 'IN_AUCTION'] },
        },
      }),
      prisma.contract.count({
        where: {
          athleteId: { in: athleteIds },
          status: 'PENDING_SIGNATURE',
        },
      }),
      prisma.contract.aggregate({
        where: {
          athleteId: { in: athleteIds },
          status: { in: ['COMPLETED', 'ACTIVE', 'VERIFIED'] },
        },
        _sum: { priceFinal: true },
      }),
    ]);

    return {
      totalAthletes: athleteIds.length,
      activeSlots,
      pendingContracts,
      totalContractValue: completedContracts._sum.priceFinal || 0,
    };
  }

  // ============================================
  // 선수 대리 기능 (에이전시가 선수 대신 수행)
  // ============================================

  /**
   * 에이전시가 선수 프로필 수정
   */
  async updateAthleteProfile(
    agencyUserId: string,
    athleteId: string,
    data: {
      name?: string;
      realName?: string;
      bio?: string;
      profileImageUrl?: string;
      socialLinks?: any;
      blockedCategories?: string[];
    }
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedAthlete = await tx.athlete.update({
        where: { id: athleteId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_UPDATE_ATHLETE_PROFILE',
          entityType: 'ATHLETE',
          entityId: athleteId,
          oldValue: {
            name: athlete.name,
            realName: athlete.realName,
            bio: athlete.bio,
            profileImageUrl: athlete.profileImageUrl,
          },
          newValue: data,
        },
      });

      return updatedAthlete;
    });

    return result;
  }

  /**
   * 에이전시가 선수 KYC 대신 제출
   */
  async submitAthleteKyc(
    agencyUserId: string,
    athleteId: string,
    documents: { type: string; url: string }[]
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.kycStatus === 'APPROVED') {
      throw new BadRequestError('Athlete KYC already approved');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedAthlete = await tx.athlete.update({
        where: { id: athleteId },
        data: {
          kycStatus: 'PENDING',
          kycDocuments: {
            documents,
            submittedAt: new Date().toISOString(),
            submittedByAgency: true,
            agencyUserId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_SUBMIT_ATHLETE_KYC',
          entityType: 'ATHLETE',
          entityId: athleteId,
          newValue: {
            kycStatus: 'PENDING',
            documentCount: documents.length,
          },
        },
      });

      return updatedAthlete;
    });

    return result;
  }

  /**
   * 에이전시가 선수 은행 계좌 업데이트
   */
  async updateAthleteBankAccount(
    agencyUserId: string,
    athleteId: string,
    data: { bankName: string; accountNumber: string; accountHolder: string }
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedAthlete = await tx.athlete.update({
        where: { id: athleteId },
        data: {
          bankAccount: data,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: agencyUserId,
          action: 'AGENCY_UPDATE_ATHLETE_BANK',
          entityType: 'ATHLETE',
          entityId: athleteId,
          newValue: {
            bankName: data.bankName,
            // 계좌번호 마스킹
            accountNumber: data.accountNumber.slice(0, 4) + '****',
          },
        },
      });

      return updatedAthlete;
    });

    return result;
  }

  /**
   * 에이전시가 선수 상세 정보 조회 (프로필, KYC, 은행 정보 포함)
   */
  async getAthleteDetail(agencyUserId: string, athleteId: string) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        user: {
          select: { id: true, email: true, isActive: true, createdAt: true },
        },
        _count: {
          select: {
            slotInstances: true,
            contracts: true,
            withdrawalRequests: true,
          },
        },
      },
    });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    return athlete;
  }

  /**
   * 에이전시가 선수 정산 내역 조회
   */
  async getAthleteSettlements(
    agencyUserId: string,
    athleteId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const skip = (page - 1) * limit;

    const [payoutItems, total] = await Promise.all([
      prisma.payoutItem.findMany({
        where: { athleteId },
        include: {
          batch: {
            select: { id: true, status: true, createdAt: true },
          },
          escrow: {
            select: { id: true, status: true, athletePayout: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payoutItem.count({ where: { athleteId } }),
    ]);

    return {
      payoutItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 에이전시가 선수 출금 내역 조회
   */
  async getAthleteWithdrawals(
    agencyUserId: string,
    athleteId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: { athleteId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawalRequest.count({ where: { athleteId } }),
    ]);

    return {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 에이전시가 선수 계약 내역 조회
   */
  async getAthleteContracts(
    agencyUserId: string,
    athleteId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const skip = (page - 1) * limit;
    const where: any = { athleteId };
    if (status) {
      where.status = status;
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          auction: {
            include: {
              slotInstance: {
                include: {
                  event: { select: { id: true, name: true, dateStart: true } },
                  slotTemplate: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 에이전시가 선수 성과 통계 조회
   */
  async getAthletePerformance(agencyUserId: string, athleteId: string) {
    const canManage = await this.canManageAthlete(agencyUserId, athleteId);
    if (!canManage) {
      throw new ForbiddenError('Not authorized to manage this athlete');
    }

    const [
      totalSlots,
      soldSlots,
      openSlots,
      totalContracts,
      activeContracts,
      completedContracts,
      totalEarnings,
      pendingPayouts,
      totalWithdrawals,
    ] = await Promise.all([
      prisma.slotInstance.count({ where: { athleteId } }),
      prisma.slotInstance.count({ where: { athleteId, status: 'SOLD' } }),
      prisma.slotInstance.count({ where: { athleteId, status: { in: ['OPEN', 'IN_AUCTION'] } } }),
      prisma.contract.count({ where: { athleteId } }),
      prisma.contract.count({ where: { athleteId, status: 'ACTIVE' } }),
      prisma.contract.count({ where: { athleteId, status: { in: ['COMPLETED', 'VERIFIED'] } } }),
      prisma.contract.aggregate({
        where: { athleteId, status: { in: ['ACTIVE', 'COMPLETED', 'VERIFIED'] } },
        _sum: { priceFinal: true },
      }),
      prisma.payoutItem.aggregate({
        where: { athleteId, batch: { status: 'PENDING' } },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { athleteId, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    return {
      slots: {
        total: totalSlots,
        sold: soldSlots,
        open: openSlots,
      },
      contracts: {
        total: totalContracts,
        active: activeContracts,
        completed: completedContracts,
      },
      earnings: {
        total: Number(totalEarnings._sum?.priceFinal || 0),
        pending: Number(pendingPayouts._sum?.amount || 0),
        withdrawn: Number(totalWithdrawals._sum?.amount || 0),
      },
    };
  }

  /**
   * 에이전시가 모든 관리 선수의 종합 성과 조회
   */
  async getAllAthletesPerformance(agencyId: string, agencyUserId: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: { athletes: { select: { id: true, name: true, profileImageUrl: true } } },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.userId !== agencyUserId) {
      throw new ForbiddenError('Not authorized');
    }

    const athleteIds = agency.athletes.map((a) => a.id);

    if (athleteIds.length === 0) {
      return [];
    }

    const performances = await Promise.all(
      agency.athletes.map(async (athlete) => {
        const [soldSlots, activeContracts, earnings] = await Promise.all([
          prisma.slotInstance.count({ where: { athleteId: athlete.id, status: 'SOLD' } }),
          prisma.contract.count({ where: { athleteId: athlete.id, status: 'ACTIVE' } }),
          prisma.contract.aggregate({
            where: { athleteId: athlete.id, status: { in: ['ACTIVE', 'COMPLETED', 'VERIFIED'] } },
            _sum: { priceFinal: true },
          }),
        ]);

        return {
          athlete: {
            id: athlete.id,
            name: athlete.name,
            profileImageUrl: athlete.profileImageUrl,
          },
          soldSlots,
          activeContracts,
          totalEarnings: earnings._sum.priceFinal || 0,
        };
      })
    );

    return performances;
  }
}

export const agencyService = new AgencyService();

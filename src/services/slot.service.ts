import prisma from '../models/prisma';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors';
import { BodyPart, MaterialRule, SlotStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notification.service';
import { conflictService } from './conflict.service';

export class SlotTemplateService {
  async create(data: {
    code: string;
    name: string;
    bodyPart: BodyPart;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    recommendedWMm?: number;
    recommendedHMm?: number;
    forbiddenNotes?: string;
    materialRules?: MaterialRule;
    requiredAngles?: string[];
    categoryExclusivityGroup?: string;
    defaultReservePrice: number;
  }) {
    const existing = await prisma.slotTemplate.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictError('Slot template code already exists');
    }

    return prisma.slotTemplate.create({ data });
  }

  async findById(id: string) {
    const template = await prisma.slotTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    return template;
  }

  async findByCode(code: string) {
    const template = await prisma.slotTemplate.findUnique({
      where: { code },
    });

    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    return template;
  }

  async list(isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;

    return prisma.slotTemplate.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async update(id: string, data: Partial<{
    name: string;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    recommendedWMm: number;
    recommendedHMm: number;
    forbiddenNotes: string;
    materialRules: MaterialRule;
    requiredAngles: string[];
    categoryExclusivityGroup: string;
    defaultReservePrice: number;
    isActive: boolean;
  }>) {
    return prisma.slotTemplate.update({
      where: { id },
      data,
    });
  }
}

export class SlotInstanceService {
  async create(data: {
    eventId: string;
    athleteId: string;
    slotTemplateId: string;
    reservePrice?: number;
  }) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check if athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: data.athleteId },
    });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    // Check if slot template exists
    const template = await prisma.slotTemplate.findUnique({
      where: { id: data.slotTemplateId },
    });
    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    // Check for duplicate
    const existing = await prisma.slotInstance.findUnique({
      where: {
        eventId_athleteId_slotTemplateId: {
          eventId: data.eventId,
          athleteId: data.athleteId,
          slotTemplateId: data.slotTemplateId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Slot instance already exists for this event/athlete/slot combination');
    }

    return prisma.slotInstance.create({
      data: {
        ...data,
        reservePrice: data.reservePrice || template.defaultReservePrice,
      },
      include: {
        event: true,
        athlete: true,
        slotTemplate: true,
      },
    });
  }

  async findById(id: string) {
    const instance = await prisma.slotInstance.findUnique({
      where: { id },
      include: {
        event: true,
        athlete: true,
        slotTemplate: true,
        auction: {
          include: {
            bids: {
              orderBy: { currentProxy: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Slot instance not found');
    }

    return instance;
  }

  async list(filters: {
    eventId?: string;
    athleteId?: string;
    slotCode?: string;
    status?: SlotStatus;
    page?: number;
    limit?: number;
  }) {
    const { eventId, athleteId, slotCode, status, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (eventId) where.eventId = eventId;
    if (athleteId) where.athleteId = athleteId;
    if (status) where.status = status;
    if (slotCode) {
      where.slotTemplate = { code: slotCode };
    }

    const [instances, total] = await Promise.all([
      prisma.slotInstance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: true,
          athlete: {
            select: {
              id: true,
              name: true,
              tour: true,
              profileImageUrl: true,
            },
          },
          slotTemplate: true,
          auction: {
            select: {
              id: true,
              status: true,
              currentPrice: true,
              endAt: true,
            },
          },
        },
      }),
      prisma.slotInstance.count({ where }),
    ]);

    return { instances, total };
  }

  async update(id: string, data: Partial<{
    reservePrice: number;
    status: SlotStatus;
    overrideSpecs: any;
  }>) {
    return prisma.slotInstance.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: SlotStatus) {
    return prisma.slotInstance.update({
      where: { id },
      data: { status },
    });
  }

  async getAvailableForBidding(filters?: {
    eventId?: string;
    athleteId?: string;
    slotCode?: string;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const where: any = {
      status: 'OPEN',
    };

    if (filters?.eventId) where.eventId = filters.eventId;
    if (filters?.athleteId) where.athleteId = filters.athleteId;
    if (filters?.slotCode) {
      where.slotTemplate = { code: filters.slotCode };
    }
    if (filters?.minPrice || filters?.maxPrice) {
      where.reservePrice = {};
      if (filters.minPrice) where.reservePrice.gte = filters.minPrice;
      if (filters.maxPrice) where.reservePrice.lte = filters.maxPrice;
    }

    return prisma.slotInstance.findMany({
      where,
      include: {
        event: true,
        athlete: {
          select: {
            id: true,
            name: true,
            tour: true,
            profileImageUrl: true,
            blockedCategories: true,
          },
        },
        slotTemplate: true,
      },
      orderBy: [
        { event: { dateStart: 'asc' } },
        { reservePrice: 'asc' },
      ],
    });
  }

  async bulkCreate(eventId: string, athleteId: string, templateIds: string[]) {
    const templates = await prisma.slotTemplate.findMany({
      where: { id: { in: templateIds }, isActive: true },
    });

    const results = await Promise.all(
      templates.map(async (template) => {
        try {
          const instance = await this.create({
            eventId,
            athleteId,
            slotTemplateId: template.id,
            reservePrice: template.defaultReservePrice,
          });
          return { success: true, data: instance, templateId: template.id, templateName: template.name };
        } catch (e: any) {
          return {
            success: false,
            error: e.message || 'Unknown error',
            templateId: template.id,
            templateName: template.name
          };
        }
      })
    );

    const created = results.filter((r) => r.success).map((r) => r.data);
    const failed = results.filter((r) => !r.success);

    return { created, failed, total: templates.length };
  }

  /**
   * Update sale mode for a slot (auction / direct buy options)
   * - enableAuction이 true이고 필요 필드가 모두 있으면 Auction 레코드 자동 생성
   */
  async updateSaleMode(
    slotId: string,
    athleteId: string,
    data: {
      enableAuction?: boolean;
      enableDirectBuy?: boolean;
      directBuyPrice?: number | null;
      auctionMinBid?: number | null;
      auctionEndAt?: Date | null;
    }
  ) {
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: { auction: true, slotTemplate: true },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (slot.athleteId !== athleteId) {
      throw new ForbiddenError('Not authorized to update this slot');
    }

    if (slot.status !== 'OPEN' && slot.status !== 'IN_AUCTION') {
      throw new ConflictError('Cannot update sale mode for this slot status');
    }

    // Validation
    const enableDirectBuy = data.enableDirectBuy ?? slot.enableDirectBuy;
    const enableAuction = data.enableAuction ?? slot.enableAuction;
    const directBuyPrice = data.directBuyPrice !== undefined ? data.directBuyPrice : slot.directBuyPrice;
    const auctionMinBid = data.auctionMinBid !== undefined ? data.auctionMinBid : slot.auctionMinBid;
    const auctionEndAt = data.auctionEndAt !== undefined ? data.auctionEndAt : slot.auctionEndAt;

    if (!enableAuction && !enableDirectBuy) {
      throw new BadRequestError('At least one sale mode must be enabled');
    }

    if (enableDirectBuy && (directBuyPrice === null || directBuyPrice === undefined || Number(directBuyPrice) <= 0)) {
      throw new BadRequestError('Direct buy price is required when direct buy is enabled');
    }

    if (enableAuction) {
      if (auctionMinBid === null || auctionMinBid === undefined || Number(auctionMinBid) <= 0) {
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
          directBuyPrice: enableDirectBuy && directBuyPrice ? new Decimal(directBuyPrice) : null,
          auctionMinBid: enableAuction && auctionMinBid ? new Decimal(auctionMinBid) : null,
          auctionEndAt: enableAuction ? auctionEndAt : null,
          // 경매 활성화 시 상태 변경
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
          // 기존 경매가 있으면 업데이트 (SCHEDULED 또는 LIVE 상태일 때만)
          if (slot.auction.status === 'SCHEDULED' || slot.auction.status === 'LIVE') {
            await tx.auction.update({
              where: { id: slot.auction.id },
              data: {
                endAt: new Date(auctionEndAt),
                currentPrice: startPrice,
                status: 'LIVE', // 즉시 LIVE로 변경
              },
            });
          }
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
            },
          });
        }
      } else if (!enableAuction && slot.auction) {
        // 경매 비활성화 시 기존 경매 취소 (SCHEDULED 또는 LIVE 상태일 때만)
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
   * Process direct buy (즉시구매)
   * - 브랜드가 즉시구매 시 계약 생성 (브랜드 선서명)
   * - 선수 서명 후 에스크로 HOLD (기존 sign() 흐름 활용)
   */
  async processBuyNow(slotId: string, brandId: string, brandUserId: string) {
    // 트랜잭션 외부에서 먼저 기본 검증 수행
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: {
        event: true,
        athlete: { include: { user: true } },
        slotTemplate: true,
      },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (!slot.enableDirectBuy) {
      throw new BadRequestError('Direct buy is not enabled for this slot');
    }

    if (!slot.directBuyPrice) {
      throw new BadRequestError('Direct buy price not set');
    }

    if (slot.status !== 'OPEN') {
      throw new ConflictError('Slot is no longer available for purchase');
    }

    // Get brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // 잔액 검증: 가용 잔액 >= directBuyPrice
    const brandWallet = await prisma.wallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: 'BRAND',
          ownerId: brandId,
        },
      },
    });

    if (!brandWallet) {
      throw new BadRequestError('Wallet not found. Please deposit first.');
    }

    const available = new Decimal(brandWallet.balance).minus(brandWallet.frozenAmount);
    if (available.lt(slot.directBuyPrice)) {
      throw new BadRequestError(
        `Insufficient balance. Available: ${available.toString()}, Required: ${slot.directBuyPrice.toString()}`
      );
    }

    // ★ 충돌룰: 카테고리 충돌 전체 검사
    await conflictService.checkCategoryConflict({
      eventId: slot.eventId,
      athleteId: slot.athleteId,
      brandId,
      brandCategory: brand.category,
      excludeSlotId: slotId, // 현재 슬롯은 제외
    });

    // 활성 계약 존재 여부 확인 (슬롯당 1개 제한)
    const existingContract = await prisma.contract.findFirst({
      where: {
        auction: { slotInstanceId: slotId },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
    });
    if (existingContract) {
      throw new ConflictError('Slot already has an active contract');
    }

    // 트랜잭션으로 원자적 처리
    const contract = await prisma.$transaction(async (tx) => {
      // 동시성 방어: 상태 조건부 업데이트
      const updateResult = await tx.slotInstance.updateMany({
        where: { id: slotId, status: 'OPEN' },
        data: { status: 'RESERVED' },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Slot already purchased by another buyer');
      }

      // ★ Phase 9-1.1: frozenAmount 증가 (예약 동결)
      const price = slot.directBuyPrice!;
      await tx.wallet.update({
        where: { id: brandWallet.id },
        data: {
          frozenAmount: { increment: price },
          version: { increment: 1 },
        },
      });

      // ★ Phase 9-1.1: LedgerTx 기록 (감사 목적)
      // 먼저 Contract를 생성해야 refId로 사용 가능하므로 아래에서 처리

      // Create a dummy auction record for contract linkage
      const now = new Date();
      const auction = await tx.auction.create({
        data: {
          slotInstanceId: slotId,
          startAt: now,
          endAt: now,
          originalEndAt: now,
          status: 'ENDED',
          currentPrice: Number(slot.directBuyPrice),
        },
      });

      // ★ Phase 9-1.1: reservedUntil = now + 24시간
      const reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create contract with brand pre-signed
      const createdContract = await tx.contract.create({
        data: {
          auctionId: auction.id,
          brandId,
          athleteId: slot.athleteId,
          priceFinal: Number(slot.directBuyPrice),
          status: 'PENDING_SIGNATURE',
          brandSignedAt: now, // 브랜드 선서명
          reservedUntil, // ★ Phase 9-1.1: 예약 만료 시간
          assetDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          brand: true,
          athlete: true,
          auction: {
            include: {
              slotInstance: {
                include: {
                  event: true,
                  slotTemplate: true,
                },
              },
            },
          },
        },
      });

      // ★ Phase 9-1.1: LedgerTx 기록 (DIRECT_BUY_RESERVE)
      await tx.ledgerTx.create({
        data: {
          walletId: brandWallet.id,
          type: 'DIRECT_BUY_RESERVE',
          amount: price, // 동결 금액 (양수로 기록 - balance는 변경 없음)
          balanceAfter: brandWallet.balance, // balance는 그대로
          refType: 'CONTRACT',
          refId: createdContract.id,
          description: `Direct buy reserve for slot ${slotId}`,
        },
      });

      // AuditLog 기록
      await tx.auditLog.create({
        data: {
          userId: brandUserId,
          action: 'DIRECT_BUY_RESERVE',
          entityType: 'CONTRACT',
          entityId: createdContract.id,
          newValue: {
            slotId,
            brandId,
            athleteId: slot.athleteId,
            price: Number(slot.directBuyPrice),
            reservedUntil: reservedUntil.toISOString(),
          },
        },
      });

      return createdContract;
    });

    // 선수에게 알림 발송 (트랜잭션 외부)
    try {
      await notificationService.create({
        userId: slot.athlete.user.id,
        type: 'CONTRACT_CREATED',
        title: '즉시구매 계약 생성',
        message: `${brand.name}님이 ${slot.slotTemplate.name} 슬롯을 즉시구매했습니다. 24시간 내 서명을 완료해주세요.`,
        data: {
          contractId: contract.id,
          slotName: slot.slotTemplate.name,
          eventName: slot.event.name,
          brandName: brand.name,
          price: Number(slot.directBuyPrice),
        },
      });
    } catch (e) {
      console.error('Failed to send direct buy notification:', e);
    }

    return contract;
  }
}

export const slotTemplateService = new SlotTemplateService();
export const slotInstanceService = new SlotInstanceService();

import prisma from '../models/prisma';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors';
import { BodyPart, MaterialRule, SlotStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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

    const instances = await Promise.all(
      templates.map((template) =>
        this.create({
          eventId,
          athleteId,
          slotTemplateId: template.id,
          reservePrice: template.defaultReservePrice,
        }).catch((e) => null) // Ignore duplicates
      )
    );

    return instances.filter((i) => i !== null);
  }

  /**
   * Update sale mode for a slot (auction / direct buy options)
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
      include: { auction: true },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (slot.athleteId !== athleteId) {
      throw new ForbiddenError('Not authorized to update this slot');
    }

    if (slot.status !== 'OPEN') {
      throw new ConflictError('Cannot update sale mode for non-open slots');
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

    return prisma.slotInstance.update({
      where: { id: slotId },
      data: {
        enableAuction,
        enableDirectBuy,
        directBuyPrice: enableDirectBuy && directBuyPrice ? new Decimal(directBuyPrice) : null,
        auctionMinBid: enableAuction && auctionMinBid ? new Decimal(auctionMinBid) : null,
        auctionEndAt: enableAuction ? auctionEndAt : null,
      },
      include: {
        event: true,
        athlete: true,
        slotTemplate: true,
      },
    });
  }

  /**
   * Process direct buy (즉시구매)
   */
  async processBuyNow(slotId: string, brandId: string) {
    return await prisma.$transaction(async (tx) => {
      // Get slot with lock
      const slot = await tx.slotInstance.findUnique({
        where: { id: slotId },
        include: {
          event: true,
          athlete: true,
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
      const brand = await tx.brand.findUnique({
        where: { id: brandId },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

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

      // Update slot status
      await tx.slotInstance.update({
        where: { id: slotId },
        data: { status: 'SOLD' },
      });

      // Create contract
      const contract = await tx.contract.create({
        data: {
          auctionId: auction.id,
          brandId,
          athleteId: slot.athleteId,
          priceFinal: Number(slot.directBuyPrice),
          status: 'PENDING_SIGNATURE',
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

      // Get or create brand wallet
      let brandWallet = await tx.wallet.findUnique({
        where: {
          ownerType_ownerId: {
            ownerType: 'BRAND',
            ownerId: brandId,
          },
        },
      });

      if (!brandWallet) {
        brandWallet = await tx.wallet.create({
          data: {
            ownerType: 'BRAND',
            ownerId: brandId,
            balance: 0,
          },
        });
      }

      // Calculate fees
      const grossAmount = Number(slot.directBuyPrice);
      const platformFeeRate = 0.1; // 10%
      const platformFee = Math.floor(grossAmount * platformFeeRate);
      const athletePayout = grossAmount - platformFee;

      // Create escrow
      await tx.escrow.create({
        data: {
          contractId: contract.id,
          brandId,
          athleteId: slot.athleteId,
          grossAmount: new Decimal(grossAmount),
          platformFee: new Decimal(platformFee),
          platformFeeRate: new Decimal(platformFeeRate),
          athletePayout: new Decimal(athletePayout),
          status: 'HELD',
        },
      });

      // Create ledger transaction for escrow hold
      const newBalance = new Decimal(brandWallet.balance).minus(grossAmount);
      await tx.ledgerTx.create({
        data: {
          walletId: brandWallet.id,
          type: 'ESCROW_HOLD',
          amount: new Decimal(-grossAmount),
          balanceAfter: newBalance,
          refType: 'CONTRACT',
          refId: contract.id,
          description: `Direct buy: ${slot.slotTemplate.name} - ${slot.event.name}`,
        },
      });

      // Update wallet balance
      await tx.wallet.update({
        where: { id: brandWallet.id },
        data: {
          balance: newBalance,
          frozenAmount: new Decimal(brandWallet.frozenAmount).plus(grossAmount),
        },
      });

      return contract;
    });
  }
}

export const slotTemplateService = new SlotTemplateService();
export const slotInstanceService = new SlotInstanceService();

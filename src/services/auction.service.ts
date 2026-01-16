import prisma from '../models/prisma';
import config from '../config';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors';
import { AuctionStatus, SlotStatus } from '@prisma/client';
import { createAuditLog } from '../middleware/audit';
import { emailService } from './email.service';
import { socketService } from './socket.service';
import { contractService } from './contract.service';

export class AuctionService {
  async create(data: {
    slotInstanceId: string;
    startAt: Date;
    endAt: Date;
    softCloseSec?: number;
    maxExtensionSec?: number;
    minBidIncrement?: number;
  }) {
    // Check slot instance exists and is available
    const slotInstance = await prisma.slotInstance.findUnique({
      where: { id: data.slotInstanceId },
      include: { auction: true },
    });

    if (!slotInstance) {
      throw new NotFoundError('Slot instance not found');
    }

    if (slotInstance.status !== 'OPEN') {
      throw new ConflictError('Slot is not available for auction');
    }

    if (slotInstance.auction) {
      throw new ConflictError('Auction already exists for this slot');
    }

    // Create auction and update slot status
    const [auction] = await prisma.$transaction([
      prisma.auction.create({
        data: {
          slotInstanceId: data.slotInstanceId,
          startAt: data.startAt,
          endAt: data.endAt,
          originalEndAt: data.endAt,
          softCloseSec: data.softCloseSec || config.auction.defaultSoftCloseSec,
          maxExtensionSec: data.maxExtensionSec || config.auction.defaultMaxExtensionSec,
          minBidIncrement: data.minBidIncrement || config.auction.defaultMinBidIncrement,
          currentPrice: slotInstance.reservePrice,
          status: new Date(data.startAt) <= new Date() ? 'LIVE' : 'SCHEDULED',
        },
        include: {
          slotInstance: {
            include: {
              event: true,
              athlete: true,
              slotTemplate: true,
            },
          },
        },
      }),
      prisma.slotInstance.update({
        where: { id: data.slotInstanceId },
        data: { status: 'IN_AUCTION' },
      }),
    ]);

    return auction;
  }

  async findById(id: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        slotInstance: {
          include: {
            event: true,
            athlete: true,
            slotTemplate: true,
          },
        },
        bids: {
          orderBy: { currentProxy: 'desc' },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
        contract: true,
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    return auction;
  }

  async list(filters: {
    status?: AuctionStatus;
    eventId?: string;
    athleteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, eventId, athleteId, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (eventId) where.slotInstance = { eventId };
    if (athleteId) where.slotInstance = { ...where.slotInstance, athleteId };

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { endAt: 'asc' },
        include: {
          slotInstance: {
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
            },
          },
          _count: {
            select: { bids: true },
          },
        },
      }),
      prisma.auction.count({ where }),
    ]);

    return { auctions, total };
  }

  async getLiveAuctions() {
    return prisma.auction.findMany({
      where: { status: 'LIVE' },
      orderBy: { endAt: 'asc' },
      include: {
        slotInstance: {
          include: {
            event: true,
            athlete: {
              select: {
                id: true,
                name: true,
                tour: true,
              },
            },
            slotTemplate: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
    });
  }

  async getEndingSoon(minutes: number = 10) {
    const now = new Date();
    const threshold = new Date(now.getTime() + minutes * 60 * 1000);

    return prisma.auction.findMany({
      where: {
        status: 'LIVE',
        endAt: {
          gte: now,
          lte: threshold,
        },
      },
      orderBy: { endAt: 'asc' },
      include: {
        slotInstance: {
          include: {
            event: true,
            athlete: true,
            slotTemplate: true,
          },
        },
      },
    });
  }

  async startAuction(id: string) {
    const auction = await prisma.auction.findUnique({ where: { id } });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'SCHEDULED') {
      throw new BadRequestError('Auction is not in scheduled status');
    }

    return prisma.auction.update({
      where: { id },
      data: { status: 'LIVE' },
    });
  }

  async endAuction(id: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        bids: {
          orderBy: { currentProxy: 'desc' },
          include: {
            brand: {
              include: {
                user: true,
              },
            },
          },
        },
        slotInstance: {
          include: {
            event: true,
            athlete: {
              include: {
                user: true,
              },
            },
            slotTemplate: true,
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'LIVE') {
      throw new BadRequestError('Auction is not live');
    }

    const winningBid = auction.bids[0];
    const hasValidBid = winningBid && winningBid.currentProxy >= auction.slotInstance.reservePrice;

    // Update auction, slot, and bid status
    await prisma.$transaction(async (tx) => {
      // Update auction
      await tx.auction.update({
        where: { id },
        data: {
          status: hasValidBid ? 'ENDED' : 'UNSOLD',
          winningBidId: hasValidBid ? winningBid.id : null,
        },
      });

      // Update slot status
      await tx.slotInstance.update({
        where: { id: auction.slotInstanceId },
        data: {
          status: hasValidBid ? 'SOLD' : 'OPEN',
        },
      });

      // Mark winning bid
      if (hasValidBid) {
        await tx.bid.update({
          where: { id: winningBid.id },
          data: { isWinning: true },
        });
      }
    });

    // Send socket notification
    socketService.emitAuctionStatusChanged(
      id,
      hasValidBid ? 'ENDED' : 'UNSOLD',
      hasValidBid ? { brandName: winningBid.brand.name, amount: winningBid.currentProxy } : undefined
    );

    // Send email notifications
    if (hasValidBid) {
      const slot = auction.slotInstance;
      const notificationData = {
        auctionTitle: slot.slotTemplate.name,
        athleteName: slot.athlete.name,
        eventName: slot.event.name,
        currentPrice: winningBid.currentProxy,
      };

      // Notify winning brand
      emailService.sendAuctionWonNotification(
        winningBid.brand.user.email,
        {
          recipientName: winningBid.brand.name,
          ...notificationData,
        }
      );

      // Notify athlete about the sale
      emailService.sendBidPlacedNotification(
        slot.athlete.user.email,
        {
          recipientName: slot.athlete.name,
          ...notificationData,
          bidderName: winningBid.brand.name,
        }
      );

      // Notify other bidders they lost
      for (const bid of auction.bids.slice(1)) {
        emailService.sendOutbidNotification(
          bid.brand.user.email,
          {
            recipientName: bid.brand.name,
            ...notificationData,
          }
        );
      }
    }

    // 낙찰된 경우 계약 자동 생성
    if (hasValidBid) {
      try {
        const contract = await contractService.createFromAuction(id);
        console.log(`[AuctionService] Contract auto-created: ${contract.id} for auction ${id}`);
      } catch (err: any) {
        // ConflictError = 이미 계약이 존재함 → 무시
        if (err.name === 'ConflictError' || err.message?.includes('already exists')) {
          console.log(`[AuctionService] Contract already exists for auction ${id}, skipping`);
        } else {
          // 다른 에러는 로그만 남기고 진행 (경매 종료 자체는 성공했으므로)
          console.error(`[AuctionService] Failed to auto-create contract for auction ${id}:`, err);
        }
      }
    }

    return this.findById(id);
  }

  async cancelAuction(id: string, reason?: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: { slotInstance: true },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
      throw new BadRequestError('Cannot cancel this auction');
    }

    await prisma.$transaction([
      prisma.auction.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.slotInstance.update({
        where: { id: auction.slotInstanceId },
        data: { status: 'OPEN' },
      }),
    ]);

    return this.findById(id);
  }

  async extendAuction(id: string, extensionSec: number) {
    const auction = await prisma.auction.findUnique({ where: { id } });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'LIVE') {
      throw new BadRequestError('Auction is not live');
    }

    const newTotalExtension = auction.totalExtended + extensionSec;
    if (newTotalExtension > auction.maxExtensionSec) {
      throw new BadRequestError('Maximum extension time exceeded');
    }

    const newEndAt = new Date(auction.endAt.getTime() + extensionSec * 1000);

    return prisma.auction.update({
      where: { id },
      data: {
        endAt: newEndAt,
        totalExtended: newTotalExtension,
      },
    });
  }

  // Scheduler job: Start scheduled auctions
  async processScheduledAuctions() {
    const now = new Date();

    const toStart = await prisma.auction.findMany({
      where: {
        status: 'SCHEDULED',
        startAt: { lte: now },
      },
    });

    for (const auction of toStart) {
      await this.startAuction(auction.id);
    }

    return toStart.length;
  }

  // Scheduler job: End expired auctions
  async processExpiredAuctions() {
    const now = new Date();

    const toEnd = await prisma.auction.findMany({
      where: {
        status: 'LIVE',
        endAt: { lte: now },
      },
    });

    for (const auction of toEnd) {
      await this.endAuction(auction.id);
    }

    return toEnd.length;
  }
}

export const auctionService = new AuctionService();

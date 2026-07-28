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
    // Check slot instance exists and is available (athlete/event 비활성 동시 검증)
    const slotInstance = await prisma.slotInstance.findUnique({
      where: { id: data.slotInstanceId },
      include: {
        auction: true,
        athlete: { select: { isActive: true, kycStatus: true } },
        event: { select: { isActive: true } },
      },
    });

    if (!slotInstance) {
      throw new NotFoundError('Slot instance not found');
    }

    // SPONPIK docx 4 — 비활성 entity 위에 새 경매 생성 차단
    if (!slotInstance.isActive) {
      throw new BadRequestError('비활성 상태인 슬롯에는 경매를 개설할 수 없습니다');
    }
    if (!slotInstance.athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수의 슬롯에는 경매를 개설할 수 없습니다');
    }
    if (slotInstance.athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 미승인 선수의 슬롯에는 경매를 개설할 수 없습니다');
    }
    if (!slotInstance.event.isActive) {
      throw new BadRequestError('비활성 상태인 대회의 슬롯에는 경매를 개설할 수 없습니다');
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
    includeInactive?: boolean; // ADMIN 전용
  }) {
    const { status, eventId, athleteId, page = 1, limit = 20, includeInactive = false } = filters;

    const where: any = {};
    if (status) where.status = status;

    // SPONPIK docx 4 — 공개 목록은 비활성 선수/슬롯/대회의 경매 제외
    // (관리자 명시 요청 시 includeInactive=true)
    const slotFilter: any = {};
    if (eventId) slotFilter.eventId = eventId;
    if (athleteId) slotFilter.athleteId = athleteId;
    if (!includeInactive) {
      slotFilter.isActive = true;
      slotFilter.athlete = { isActive: true, kycStatus: 'APPROVED' };
      slotFilter.event = { isActive: true };
    }
    if (Object.keys(slotFilter).length > 0) where.slotInstance = slotFilter;

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
                  isRecommended: true, // 메인 노출 필터용 (추천 선수만)
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
    // SPONPIK docx 4 — 공개 LIVE 응답은 비활성 선수/슬롯/대회 제외
    return prisma.auction.findMany({
      where: {
        status: 'LIVE',
        slotInstance: {
          isActive: true,
          athlete: { isActive: true, kycStatus: 'APPROVED' },
          event: { isActive: true },
        },
      },
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
      // SPONPIK docx 4 — 비활성 선수/슬롯/대회 제외
      where: {
        status: 'LIVE',
        endAt: { gte: now, lte: threshold },
        slotInstance: {
          isActive: true,
          athlete: { isActive: true, kycStatus: 'APPROVED' },
          event: { isActive: true },
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
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        slotInstance: {
          select: {
            isActive: true,
            athlete: { select: { isActive: true, kycStatus: true } },
            event: { select: { isActive: true } },
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'SCHEDULED') {
      throw new BadRequestError('Auction is not in scheduled status');
    }

    // SPONPIK docx 4 — 비활성 entity 위에서 경매 시작 차단
    if (!auction.slotInstance.isActive) {
      throw new BadRequestError('비활성 상태인 슬롯의 경매를 시작할 수 없습니다');
    }
    if (!auction.slotInstance.athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수의 경매를 시작할 수 없습니다');
    }
    if (auction.slotInstance.athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 미승인 선수의 경매를 시작할 수 없습니다');
    }
    if (!auction.slotInstance.event.isActive) {
      throw new BadRequestError('비활성 상태인 대회의 경매를 시작할 수 없습니다');
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
      // ★ Phase 9-2: 낙찰 시 RESERVED (선수 서명 대기), 선수 서명 후 SOLD로 전환
      await tx.slotInstance.update({
        where: { id: auction.slotInstanceId },
        data: {
          status: hasValidBid ? 'RESERVED' : 'OPEN',
        },
      });

      // Mark winning bid (isWinning은 이미 placeBid에서 설정됨)
      if (hasValidBid && !winningBid.isWinning) {
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

    // SPONPIK docx 4 — 비활성 entity 위의 SCHEDULED 경매는 cron에서 자동 시작 차단
    const toStart = await prisma.auction.findMany({
      where: {
        status: 'SCHEDULED',
        startAt: { lte: now },
        slotInstance: {
          isActive: true,
          athlete: { isActive: true, kycStatus: 'APPROVED' },
          event: { isActive: true },
        },
      },
    });

    let started = 0;
    for (const auction of toStart) {
      try {
        await this.startAuction(auction.id);
        started++;
      } catch (e: any) {
        // 부분 실패는 무시하고 다음 경매 진행 (이미 비활성 필터링했지만 race condition 대비)
        console.warn(`[processScheduledAuctions] skip auction ${auction.id}:`, e?.message);
      }
    }

    return started;
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

  /**
   * Featured Auctions: 어드민이 설정한 특별 공개 경매 목록
   * - isFeatured=true인 LIVE 또는 SCHEDULED 경매
   * - 비로그인 사용자도 조회 가능
   * - SPONPIK docx 4: 비활성 entity 제외
   */
  async getFeaturedAuctions() {
    return prisma.auction.findMany({
      where: {
        isFeatured: true,
        status: { in: ['LIVE', 'SCHEDULED'] },
        slotInstance: {
          isActive: true,
          athlete: { isActive: true, kycStatus: 'APPROVED' },
          event: { isActive: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // LIVE first
        { endAt: 'asc' },
      ],
      include: {
        slotInstance: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                dateStart: true,
                dateEnd: true,
                venue: true,
              },
            },
            athlete: {
              select: {
                id: true,
                name: true,
                tour: true,
                profileImageUrl: true,
              },
            },
            slotTemplate: {
              select: {
                id: true,
                name: true,
                bodyPart: true,
                defaultReservePrice: true,
              },
            },
          },
        },
        _count: {
          select: { bids: true },
        },
      },
    });
  }

  /**
   * ★ Phase 9-3: 경매 요약 정보 (폴링용)
   * - currentPrice, bidCount, remainingSeconds, status
   * - myIsHighest: 로그인한 브랜드가 최고 입찰자인지 (optional)
   */
  async getSummary(auctionId: string, brandId?: string) {
    const now = new Date();

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          orderBy: { currentProxy: 'desc' },
          take: 1,
          select: {
            brandId: true,
            currentProxy: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    const remainingMs = auction.endAt.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const highestBid = auction.bids[0];

    return {
      id: auction.id,
      currentPrice: auction.currentPrice,
      bidCount: auction._count.bids,
      remainingSeconds,
      status: auction.status,
      endAt: auction.endAt,
      // 로그인한 브랜드가 최고 입찰자인지
      myIsHighest: brandId && highestBid ? highestBid.brandId === brandId : undefined,
    };
  }
}

export const auctionService = new AuctionService();

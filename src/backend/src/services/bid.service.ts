import prisma from '../models/prisma';
import config from '../config';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors';
import { BidResult } from '../types';
import { auctionService } from './auction.service';
import { socketService } from './socket.service';
import { conflictService } from './conflict.service';
import { phase2UnlockService } from './phase2Unlock.service';
import { notificationService } from './notification.service';
import { Decimal } from '@prisma/client/runtime/library';

export class BidService {
  /**
   * Place a bid with proxy/auto-bid support
   * Implements 2nd-price auction logic, anti-sniping, and frozenAmount management
   *
   * Phase 9-2: 최고 입찰자만 frozenAmount 동결
   * - 새 최고 입찰자: frozenAmount += maxBid
   * - 이전 최고 입찰자 (outbid): frozenAmount -= previousFrozenAmount
   */
  async placeBid(
    auctionId: string,
    brandId: string,
    maxBid: number,
    autoBid: boolean = true
  ): Promise<BidResult> {
    // Get auction with current bids (event도 포함 — 비활성 검증용)
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            athlete: true,
            slotTemplate: true,
            event: { select: { isActive: true } },
          },
        },
        bids: {
          orderBy: { currentProxy: 'desc' },
        },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'LIVE') {
      throw new BadRequestError('Auction is not accepting bids');
    }

    if (new Date() > auction.endAt) {
      throw new BadRequestError('Auction has ended');
    }

    // SPONPIK docx 4 — 운영 비활성 entity 차단 (서버 사이드 강제)
    const slotInst = auction.slotInstance;
    if (!slotInst.isActive) {
      throw new BadRequestError('비활성 상태인 슬롯입니다');
    }
    if (!slotInst.athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수입니다');
    }
    if (slotInst.athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 미승인 선수의 슬롯입니다');
    }
    if (slotInst.event && (slotInst.event as any).isActive === false) {
      throw new BadRequestError('비활성 상태인 대회입니다');
    }

    // Get brand and check restrictions
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.kycStatus !== 'APPROVED') {
      throw new ForbiddenError('KYC approval required to place bids');
    }

    // ★ Phase 9-2: 지갑 잔액 검증 (available = balance - frozenAmount >= maxBid)
    const brandWallet = await prisma.wallet.findFirst({
      where: { ownerType: 'BRAND', ownerId: brandId },
    });
    if (!brandWallet) {
      throw new BadRequestError('Brand wallet not found. Please contact support.');
    }

    const available = new Decimal(brandWallet.balance).minus(brandWallet.frozenAmount);

    // 기존 입찰이 있으면, 이미 동결된 금액을 고려 (증가분만 추가 동결)
    const existingBidForBalance = auction.bids.find((b) => b.brandId === brandId);
    const alreadyFrozen = existingBidForBalance?.frozenAmount
      ? new Decimal(existingBidForBalance.frozenAmount)
      : new Decimal(0);
    const additionalRequired = new Decimal(maxBid).minus(alreadyFrozen);

    if (additionalRequired.gt(0) && available.lt(additionalRequired)) {
      throw new BadRequestError(
        `Insufficient available balance. Required: ${additionalRequired.toNumber()}, Available: ${available.toNumber()}`,
        'INSUFFICIENT_BALANCE'
      );
    }

    // ★ 충돌룰: 카테고리 충돌 전체 검사
    await conflictService.checkCategoryConflict({
      eventId: auction.slotInstance.eventId,
      athleteId: auction.slotInstance.athleteId,
      brandId,
      brandCategory: brand.category,
      excludeAuctionId: auctionId, // 현재 경매는 제외
    });

    // ★ v2: 대회 규칙 통합 검증 (maxSlotsPerBrandPerPlayer, prohibitedCategories, creativeApprovalRequired)
    const tournamentValidation = await phase2UnlockService.validateTournamentRulesForBid(
      auction.slotInstance.eventId,
      auction.slotInstance.athleteId,
      brandId,
      brand.category
    );
    if (!tournamentValidation.valid) {
      throw new BadRequestError(tournamentValidation.errors.join(' '));
    }

    // Check for existing brand bids in same auction
    const existingBid = auction.bids.find((b) => b.brandId === brandId);

    // Validate bid amount
    const reservePrice = auction.slotInstance.reservePrice;
    if (maxBid < reservePrice) {
      throw new BadRequestError(
        `Bid must be at least the reserve price: ${reservePrice}`,
        'BELOW_RESERVE'
      );
    }

    // Calculate minimum required bid
    const currentHighBid = auction.bids[0];
    let minRequiredBid = reservePrice;

    if (currentHighBid && currentHighBid.brandId !== brandId) {
      minRequiredBid = Math.max(
        currentHighBid.currentProxy + auction.minBidIncrement,
        Math.floor(currentHighBid.currentProxy * (1 + config.auction.defaultMinBidIncrementPercent / 100))
      );
    }

    if (maxBid < minRequiredBid && !existingBid) {
      throw new BadRequestError(
        `Minimum bid required: ${minRequiredBid}`,
        'BELOW_MINIMUM'
      );
    }

    // Process the bid
    let bidResult: BidResult;
    // 개편 Phase 4 (AUC-15): 트랜잭션 밖에서 알림을 보내기 위한 정보
    let outbidInfo: { brandId: string; capExceeded: boolean } | null = null;

    await prisma.$transaction(async (tx) => {
      // ★ Phase 9-2: 이전 최고 입찰자 찾기 (현재 isWinning=true && 다른 브랜드)
      const previousWinner = await tx.bid.findFirst({
        where: {
          auctionId,
          isWinning: true,
          brandId: { not: brandId },
        },
      });

      let bid;

      // 먼저 기존 입찰 확인 (maxBid 검증용)
      const existingBidInTx = await tx.bid.findUnique({
        where: {
          auctionId_brandId: { auctionId, brandId }
        }
      });

      console.log(`[BidService] placeBid - auctionId: ${auctionId}, brandId: ${brandId}, maxBid: ${maxBid}`);
      console.log(`[BidService] existingBidInTx: ${existingBidInTx ? `id=${existingBidInTx.id}, maxBid=${existingBidInTx.maxBid}` : 'null'}`);

      // 기존 입찰이 있고 새 금액이 더 낮으면 거부
      if (existingBidInTx && maxBid <= existingBidInTx.maxBid) {
        throw new BadRequestError('New max bid must be higher than current max bid');
      }

      // ★ PostgreSQL 네이티브 UPSERT 사용 (INSERT ON CONFLICT)
      // Prisma upsert 대신 raw SQL로 atomic하게 처리
      const bidId = existingBidInTx?.id || crypto.randomUUID();
      const now = new Date();

      await tx.$executeRaw`
        INSERT INTO bids (id, auction_id, brand_id, max_bid, current_proxy, auto_bid, created_at, updated_at)
        VALUES (${bidId}, ${auctionId}, ${brandId}, ${maxBid}, ${minRequiredBid}, ${autoBid}, ${now}, ${now})
        ON CONFLICT (auction_id, brand_id)
        DO UPDATE SET
          max_bid = ${maxBid},
          auto_bid = ${autoBid},
          updated_at = ${now}
      `;

      // 생성/수정된 bid 조회
      bid = await tx.bid.findUnique({
        where: { auctionId_brandId: { auctionId, brandId } }
      });

      if (!bid) {
        throw new BadRequestError('Failed to create or update bid');
      }

      console.log(`[BidService] Bid upsert successful: ${bid.id}`);

      // Process auto-bid competition (determines winner)
      const { newCurrentPrice, winningBidId } = await this.processAutoBidCompetition(
        tx,
        auctionId,
        auction.minBidIncrement
      );

      // ★ Phase 9-2: frozenAmount 처리
      const isNewWinner = winningBidId === bid.id;
      const maxBidDecimal = new Decimal(maxBid);

      // 개편 Phase 4 (AUC-15): 추월당한 이전 최고입찰자 기록
      // capExceeded = 자동입찰 상한(maxBid)까지 올렸는데도 밀린 경우 → 상한 초과 안내
      if (isNewWinner && previousWinner && previousWinner.brandId !== brandId) {
        outbidInfo = {
          brandId: previousWinner.brandId,
          capExceeded: previousWinner.autoBid && newCurrentPrice >= previousWinner.maxBid,
        };
      }

      if (isNewWinner) {
        // 새 최고 입찰자가 된 경우

        // 1. 이전 최고 입찰자의 frozenAmount 해제 (다른 브랜드인 경우)
        if (previousWinner && previousWinner.frozenAmount) {
          const prevWallet = await tx.wallet.findFirst({
            where: { ownerType: 'BRAND', ownerId: previousWinner.brandId },
          });
          if (prevWallet) {
            await tx.wallet.update({
              where: { id: prevWallet.id },
              data: {
                frozenAmount: { decrement: previousWinner.frozenAmount },
                version: { increment: 1 },
              },
            });
            // ★ refId에 타임스탬프 추가하여 unique constraint 충돌 방지
            await tx.ledgerTx.create({
              data: {
                walletId: prevWallet.id,
                type: 'AUCTION_BID_RESERVE_RELEASE',
                amount: new Decimal(previousWinner.frozenAmount).negated(),
                balanceAfter: prevWallet.balance,
                refType: 'BID',
                refId: `${previousWinner.id}:${Date.now()}`,
                description: `Outbid - auction ${auctionId}`,
              },
            });
            // 이전 입찰자의 frozenAmount 초기화
            await tx.bid.update({
              where: { id: previousWinner.id },
              data: { frozenAmount: null, isWinning: false },
            });
          }
        }

        // 2. 새 입찰자의 frozenAmount 동결 (증가분만)
        const currentFrozen = existingBid?.frozenAmount
          ? new Decimal(existingBid.frozenAmount)
          : new Decimal(0);
        const incrementAmount = maxBidDecimal.minus(currentFrozen);

        if (incrementAmount.gt(0)) {
          await tx.wallet.update({
            where: { id: brandWallet.id },
            data: {
              frozenAmount: { increment: incrementAmount },
              version: { increment: 1 },
            },
          });
          // ★ refId에 타임스탬프 추가하여 unique constraint 충돌 방지
          await tx.ledgerTx.create({
            data: {
              walletId: brandWallet.id,
              type: 'AUCTION_BID_RESERVE',
              amount: incrementAmount,
              balanceAfter: brandWallet.balance,
              refType: 'BID',
              refId: `${bid.id}:${Date.now()}`,
              description: `Auction bid freeze - auction ${auctionId}`,
            },
          });
        }

        // 3. 새 입찰의 frozenAmount 업데이트
        await tx.bid.update({
          where: { id: bid.id },
          data: { frozenAmount: maxBidDecimal, isWinning: true },
        });
      } else {
        // 최고 입찰자가 아닌 경우 (outbid 당함)
        // 이미 동결된 금액이 있다면 해제
        if (existingBid?.frozenAmount) {
          await tx.wallet.update({
            where: { id: brandWallet.id },
            data: {
              frozenAmount: { decrement: existingBid.frozenAmount },
              version: { increment: 1 },
            },
          });
          // ★ refId에 타임스탬프 추가하여 unique constraint 충돌 방지
          await tx.ledgerTx.create({
            data: {
              walletId: brandWallet.id,
              type: 'AUCTION_BID_RESERVE_RELEASE',
              amount: new Decimal(existingBid.frozenAmount).negated(),
              balanceAfter: brandWallet.balance,
              refType: 'BID',
              refId: `${bid.id}:${Date.now()}`,
              description: `Outbid - auction ${auctionId}`,
            },
          });
        }
        await tx.bid.update({
          where: { id: bid.id },
          data: { frozenAmount: null, isWinning: false },
        });
      }

      // Update auction current price
      await tx.auction.update({
        where: { id: auctionId },
        data: { currentPrice: newCurrentPrice },
      });

      // Check for anti-sniping extension
      const timeRemaining = auction.endAt.getTime() - Date.now();
      if (timeRemaining <= auction.softCloseSec * 1000) {
        const extensionSec = Math.min(
          auction.softCloseSec,
          auction.maxExtensionSec - auction.totalExtended
        );

        if (extensionSec > 0) {
          await tx.auction.update({
            where: { id: auctionId },
            data: {
              endAt: new Date(auction.endAt.getTime() + extensionSec * 1000),
              totalExtended: auction.totalExtended + extensionSec,
            },
          });
        }
      }

      // Get final bid state
      const finalBid = await tx.bid.findUnique({ where: { id: bid.id } });

      bidResult = {
        bidId: bid.id,
        auctionId,
        brandId,
        maxBid: finalBid!.maxBid,
        effectiveCurrentPrice: newCurrentPrice,
        rank: isNewWinner ? 1 : 2,
        isWinning: isNewWinner,
      };
    });

    // Emit socket events for real-time updates
    const updatedAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { _count: { select: { bids: true } } },
    });

    socketService.emitBidPlaced(auctionId, {
      bidId: bidResult!.bidId,
      brandName: brand.name,
      amount: bidResult!.effectiveCurrentPrice,
      currentPrice: bidResult!.effectiveCurrentPrice,
      bidCount: updatedAuction?._count.bids || 0,
      timestamp: new Date(),
    });

    // Check if time was extended (anti-snipe)
    if (updatedAuction && updatedAuction.endAt > auction.endAt) {
      socketService.emitTimeExtended(
        auctionId,
        updatedAuction.endAt,
        updatedAuction.totalExtended
      );
    }

    // 개편 Phase 4 (AUC-15): 최고입찰자 변경 / 자동입찰 상한 초과 알림
    if (outbidInfo) {
      const info = outbidInfo as { brandId: string; capExceeded: boolean };
      try {
        await notificationService.notifyOutbid(auctionId, info.brandId, bidResult!.effectiveCurrentPrice);
        if (info.capExceeded) {
          await notificationService.notifyAutoBidCapExceeded(
            auctionId,
            info.brandId,
            bidResult!.effectiveCurrentPrice
          );
        }
      } catch (e) {
        console.error('[Bid] 추월 알림 발송 실패:', e);
      }
    }

    return bidResult!;
  }

  /**
   * Process auto-bid competition between bidders
   * Returns the new current price and winning bid ID
   */
  private async processAutoBidCompetition(
    tx: any,
    auctionId: string,
    minIncrement: number
  ): Promise<{ newCurrentPrice: number; winningBidId: string }> {
    // Get all bids sorted by maxBid
    const bids = await tx.bid.findMany({
      where: { auctionId },
      orderBy: { maxBid: 'desc' },
    });

    if (bids.length === 0) {
      throw new BadRequestError('No bids found');
    }

    if (bids.length === 1) {
      // 단독 입찰자는 '이기는 데 필요한 최소 금액'만 지불한다 (핸드오프 §12.3).
      // 최대입찰가는 경쟁이 붙을 때만 단계적으로 소진되며 외부에 공개되지 않는다.
      // (기존에는 곧바로 최대입찰가 전액이 현재가가 되어 첫 입찰자가 상한을 다 내고,
      //  현재가만 보면 상한이 그대로 드러났다 — 2026-07-29 수정)
      const only = bids[0];
      const minRequired = only.currentProxy > 0 ? only.currentProxy : only.maxBid;
      const newCurrentPrice = Math.min(only.maxBid, minRequired);

      if (only.currentProxy !== newCurrentPrice) {
        await tx.bid.update({ where: { id: only.id }, data: { currentProxy: newCurrentPrice } });
      }
      return { newCurrentPrice, winningBidId: only.id };
    }

    const highestBid = bids[0];
    const secondHighestBid = bids[1];

    // Calculate new current price (2nd price + increment, capped at highest max bid)
    let newCurrentPrice = Math.min(
      secondHighestBid.maxBid + minIncrement,
      highestBid.maxBid
    );

    // If second highest bid equals highest, use timestamp priority
    if (highestBid.maxBid === secondHighestBid.maxBid) {
      // Earlier bid wins
      const winner = highestBid.createdAt <= secondHighestBid.createdAt
        ? highestBid
        : secondHighestBid;
      newCurrentPrice = winner.maxBid;

      return {
        newCurrentPrice,
        winningBidId: winner.id,
      };
    }

    // Update current proxy for winning bid
    await tx.bid.update({
      where: { id: highestBid.id },
      data: { currentProxy: newCurrentPrice },
    });

    // Update current proxy for second bid (to their max)
    await tx.bid.update({
      where: { id: secondHighestBid.id },
      data: { currentProxy: secondHighestBid.maxBid },
    });

    return {
      newCurrentPrice,
      winningBidId: highestBid.id,
    };
  }

  async getBidsByAuction(auctionId: string) {
    return prisma.bid.findMany({
      where: { auctionId },
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
    });
  }

  async getBidsByBrand(brandId: string) {
    return prisma.bid.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: true,
                athlete: true,
                slotTemplate: true,
              },
            },
          },
        },
      },
    });
  }

  async getWinningBids(brandId: string) {
    return prisma.bid.findMany({
      where: {
        brandId,
        isWinning: true,
      },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: true,
                athlete: true,
                slotTemplate: true,
              },
            },
            contract: true,
          },
        },
      },
    });
  }

  async deleteBid(bidId: string, brandId: string) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { auction: true },
    });

    if (!bid) {
      throw new NotFoundError('Bid not found');
    }

    if (bid.brandId !== brandId) {
      throw new ForbiddenError('Not authorized to delete this bid');
    }

    if (bid.auction.status !== 'LIVE') {
      throw new BadRequestError('Cannot delete bid from non-live auction');
    }

    // Deleting bid triggers recalculation
    await prisma.$transaction(async (tx) => {
      // ★ Phase 9-2: 동결된 금액이 있으면 해제
      if (bid.frozenAmount) {
        const wallet = await tx.wallet.findFirst({
          where: { ownerType: 'BRAND', ownerId: brandId },
        });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              frozenAmount: { decrement: bid.frozenAmount },
              version: { increment: 1 },
            },
          });
          // ★ refId에 타임스탬프 추가하여 unique constraint 충돌 방지
          await tx.ledgerTx.create({
            data: {
              walletId: wallet.id,
              type: 'AUCTION_BID_RESERVE_RELEASE',
              amount: new Decimal(bid.frozenAmount).negated(),
              balanceAfter: wallet.balance,
              refType: 'BID',
              refId: `${bidId}:${Date.now()}`,
              description: `Bid deleted - auction ${bid.auctionId}`,
            },
          });
        }
      }

      await tx.bid.delete({ where: { id: bidId } });

      // Recalculate current price
      const remainingBids = await tx.bid.findMany({
        where: { auctionId: bid.auctionId },
        orderBy: { maxBid: 'desc' },
      });

      if (remainingBids.length > 0) {
        const { newCurrentPrice, winningBidId } = await this.processAutoBidCompetition(
          tx,
          bid.auctionId,
          bid.auction.minBidIncrement
        );

        // ★ Phase 9-2: 새 최고 입찰자에게 frozenAmount 설정
        const newWinner = remainingBids.find(b => b.id === winningBidId);
        if (newWinner && !newWinner.frozenAmount) {
          const winnerWallet = await tx.wallet.findFirst({
            where: { ownerType: 'BRAND', ownerId: newWinner.brandId },
          });
          if (winnerWallet) {
            const freezeAmount = new Decimal(newWinner.maxBid);
            await tx.wallet.update({
              where: { id: winnerWallet.id },
              data: {
                frozenAmount: { increment: freezeAmount },
                version: { increment: 1 },
              },
            });
            // ★ refId에 타임스탬프 추가하여 unique constraint 충돌 방지
            await tx.ledgerTx.create({
              data: {
                walletId: winnerWallet.id,
                type: 'AUCTION_BID_RESERVE',
                amount: freezeAmount,
                balanceAfter: winnerWallet.balance,
                refType: 'BID',
                refId: `${newWinner.id}:${Date.now()}`,
                description: `New winning bid after deletion - auction ${bid.auctionId}`,
              },
            });
            await tx.bid.update({
              where: { id: newWinner.id },
              data: { frozenAmount: freezeAmount, isWinning: true },
            });
          }
        }

        await tx.auction.update({
          where: { id: bid.auctionId },
          data: { currentPrice: newCurrentPrice },
        });
      } else {
        // No bids left - reset to reserve
        const auction = await tx.auction.findUnique({
          where: { id: bid.auctionId },
          include: { slotInstance: true },
        });

        await tx.auction.update({
          where: { id: bid.auctionId },
          data: { currentPrice: auction!.slotInstance.reservePrice },
        });
      }
    });
  }
}

export const bidService = new BidService();

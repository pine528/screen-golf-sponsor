import prisma from '../models/prisma';
import config from '../config';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors';
import { BidResult } from '../types';
import { auctionService } from './auction.service';
import { socketService } from './socket.service';

export class BidService {
  /**
   * Place a bid with proxy/auto-bid support
   * Implements 2nd-price auction logic and anti-sniping
   */
  async placeBid(
    auctionId: string,
    brandId: string,
    maxBid: number,
    autoBid: boolean = true
  ): Promise<BidResult> {
    // Get auction with current bids
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            athlete: true,
            slotTemplate: true,
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

    // Get brand and check restrictions
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.kycStatus !== 'APPROVED') {
      throw new ForbiddenError('KYC approval required to place bids');
    }

    // Check category exclusivity/conflict
    const athlete = auction.slotInstance.athlete;
    if (athlete.blockedCategories.includes(brand.category)) {
      throw new ConflictError('Brand category is blocked by athlete', 'CATEGORY_BLOCKED');
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

    // Check exclusivity conflict (same event, same category)
    await this.checkExclusivityConflict(auction.id, brandId, brand.category);

    // Process the bid
    let bidResult: BidResult;

    await prisma.$transaction(async (tx) => {
      let bid;

      if (existingBid) {
        // Update existing bid
        if (maxBid <= existingBid.maxBid) {
          throw new BadRequestError('New max bid must be higher than current max bid');
        }

        bid = await tx.bid.update({
          where: { id: existingBid.id },
          data: {
            maxBid,
            autoBid,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new bid
        bid = await tx.bid.create({
          data: {
            auctionId,
            brandId,
            maxBid,
            currentProxy: minRequiredBid,
            autoBid,
          },
        });
      }

      // Process auto-bid competition
      const { newCurrentPrice, winningBidId } = await this.processAutoBidCompetition(
        tx,
        auctionId,
        auction.minBidIncrement
      );

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
        rank: winningBidId === bid.id ? 1 : 2,
        isWinning: winningBidId === bid.id,
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
      // Single bidder - current price is their proxy (reserve or min bid)
      return {
        newCurrentPrice: bids[0].currentProxy,
        winningBidId: bids[0].id,
      };
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

  /**
   * Check for category exclusivity conflicts
   */
  private async checkExclusivityConflict(
    auctionId: string,
    brandId: string,
    category: string
  ): Promise<void> {
    // Get the slot's event
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            event: true,
            slotTemplate: true,
          },
        },
      },
    });

    if (!auction) return;

    // Find any winning bids by same-category brands in same event
    const conflictingContracts = await prisma.contract.findMany({
      where: {
        auction: {
          slotInstance: {
            eventId: auction.slotInstance.eventId,
            athleteId: auction.slotInstance.athleteId,
          },
          status: { in: ['ENDED'] },
        },
        brand: {
          category,
          id: { not: brandId },
        },
        status: { not: 'CANCELLED' },
      },
    });

    if (conflictingContracts.length > 0) {
      throw new ConflictError(
        'Category exclusivity conflict: Another brand in the same category has already won a slot for this athlete in this event',
        'EXCLUSIVITY_CONFLICT'
      );
    }
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
      await tx.bid.delete({ where: { id: bidId } });

      // Recalculate current price
      const remainingBids = await tx.bid.findMany({
        where: { auctionId: bid.auctionId },
        orderBy: { maxBid: 'desc' },
      });

      if (remainingBids.length > 0) {
        const { newCurrentPrice } = await this.processAutoBidCompetition(
          tx,
          bid.auctionId,
          bid.auction.minBidIncrement
        );

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

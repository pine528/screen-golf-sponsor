import { Response, NextFunction } from 'express';
import { auctionService } from '../services/auction.service';
import { bidService } from '../services/bid.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class AuctionController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const auction = await auctionService.create(req.body);
      sendSuccess(res, auction, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const auction = await auctionService.findById(id);
      sendSuccess(res, auction);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status, eventId, athleteId } = req.query;
      const { auctions, total } = await auctionService.list({
        status: status as any,
        eventId: eventId as string,
        athleteId: athleteId as string,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, auctions, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async getLive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctions = await auctionService.getLiveAuctions();
      sendSuccess(res, auctions);
    } catch (error) {
      next(error);
    }
  }

  async getEndingSoon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { minutes = 10 } = req.query;
      const auctions = await auctionService.getEndingSoon(Number(minutes));
      sendSuccess(res, auctions);
    } catch (error) {
      next(error);
    }
  }

  async placeBid(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { maxBid, autoBid } = req.body;

      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const result = await bidService.placeBid(id, req.user.brandId, maxBid, autoBid);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getBids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const bids = await bidService.getBidsByAuction(id);
      sendSuccess(res, bids);
    } catch (error) {
      next(error);
    }
  }

  async cancelAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const auction = await auctionService.cancelAuction(id, reason);
      sendSuccess(res, auction);
    } catch (error) {
      next(error);
    }
  }

  async startAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const auction = await auctionService.startAuction(id);
      sendSuccess(res, auction);
    } catch (error) {
      next(error);
    }
  }

  async getMyBids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const bids = await bidService.getBidsByBrand(req.user.brandId);
      sendSuccess(res, bids);
    } catch (error) {
      next(error);
    }
  }

  async getMyWinningBids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      const bids = await bidService.getWinningBids(req.user.brandId);
      sendSuccess(res, bids);
    } catch (error) {
      next(error);
    }
  }

  async deleteBid(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId, bidId } = req.params;

      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }

      await bidService.deleteBid(bidId, req.user.brandId);
      sendSuccess(res, { message: 'Bid deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ★ Phase 9-3: 경매 요약 정보 (폴링용)
   * - 인증 선택적 (로그인 시 myIsHighest 포함)
   */
  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const brandId = req.user?.brandId;
      const summary = await auctionService.getSummary(id, brandId);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 어드민이 설정한 특별 공개 경매 목록 (Featured Auctions)
   */
  async getFeatured(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctions = await auctionService.getFeaturedAuctions();
      sendSuccess(res, auctions);
    } catch (error) {
      next(error);
    }
  }
}

export const auctionController = new AuctionController();

import { Response, NextFunction } from 'express';
import { brandService } from '../services/brand.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class BrandController {
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const brand = await brandService.findById(id);
      sendSuccess(res, brand);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const brand = await brandService.findById(req.user.brandId);
      sendSuccess(res, brand);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, kycStatus, category } = req.query;
      const { brands, total } = await brandService.list(
        Number(page),
        Number(limit),
        { kycStatus: kycStatus as any, category: category as string }
      );
      sendPaginated(res, brands, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const brand = await brandService.update(req.user.brandId, req.user.id, req.body);
      sendSuccess(res, brand);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const stats = await brandService.getStats(req.user.brandId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async submitKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents, businessNumber } = req.body;
      const brand = await brandService.submitKyc(req.user!.id, documents, businessNumber);
      sendSuccess(res, brand);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ★ Phase 9-3: 브랜드 예약 목록 (Direct Buy + Auction 낙찰)
   */
  async getMyReservations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const reservations = await brandService.getMyReservations(req.user.brandId);
      sendSuccess(res, reservations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ★ Phase 9-3: 브랜드 입찰 목록
   */
  async getMyBids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const bids = await brandService.getMyBids(req.user.brandId);
      sendSuccess(res, bids);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ★ Phase 9-3: 브랜드 낙찰 목록
   */
  async getMyWins(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const wins = await brandService.getMyWins(req.user.brandId);
      sendSuccess(res, wins);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ★ Phase 10-1: 브랜드 지갑 조회
   */
  async getMyWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const wallet = await brandService.getMyWallet(req.user.brandId);
      sendSuccess(res, wallet);
    } catch (error) {
      next(error);
    }
  }

  async updateRoiSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new Error('No brand associated with this user');
      }
      const { keywords, competitors, blockedCategories } = req.body;
      const updated = await brandService.updateRoiSettings(req.user.brandId, {
        keywords,
        competitors,
        blockedCategories,
      });
      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
}

export const brandController = new BrandController();

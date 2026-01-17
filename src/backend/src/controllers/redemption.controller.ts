import { Request, Response, NextFunction } from 'express';
import { redemptionService } from '../services/redemption.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { ShopItemStatus, RedemptionStatus } from '@prisma/client';

export class RedemptionController {
  // ============================================
  // Public
  // ============================================

  /**
   * 상품 목록 조회
   */
  async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, pageSize } = req.query;
      const result = await redemptionService.listItems({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 상품 상세 조회
   */
  async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await redemptionService.getItem(id);
      sendSuccess(res, item);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Fan (로그인 필요)
  // ============================================

  /**
   * 교환 주문 생성
   */
  async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { itemId, quantity, shipping, memo } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const result = await redemptionService.createOrder(userId, {
        itemId,
        quantity: quantity || 1,
        shipping,
        memo,
        idempotencyKey,
      });

      res.status(result.alreadyProcessed ? 200 : 201);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 내 주문 목록 조회
   */
  async getMyOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { page, pageSize, status } = req.query;

      const result = await redemptionService.getMyOrders(userId, {
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        status: status as RedemptionStatus | undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 주문 취소
   */
  async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await redemptionService.cancelOrder(userId, id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Admin
  // ============================================

  /**
   * 상품 생성
   */
  async createItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, imageUrl, pricePoints, stock, requiresShipping } = req.body;

      const item = await redemptionService.createItem({
        title,
        description,
        imageUrl,
        pricePoints,
        stock,
        requiresShipping,
      });

      res.status(201);
      sendSuccess(res, item);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 상품 수정
   */
  async updateItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { title, description, imageUrl, pricePoints, stock, status, requiresShipping } = req.body;

      const item = await redemptionService.updateItem(id, {
        title,
        description,
        imageUrl,
        pricePoints,
        stock,
        status: status as ShopItemStatus | undefined,
        requiresShipping,
      });

      sendSuccess(res, item);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 관리자: 상품 목록 (모든 상태)
   */
  async adminListItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, pageSize } = req.query;
      const result = await redemptionService.listItems({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        includeAll: true,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 관리자: 주문 목록
   */
  async adminListOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, pageSize, status, q } = req.query;

      const result = await redemptionService.adminListOrders({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        status: status as RedemptionStatus | undefined,
        q: q as string | undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 관리자: 주문 처리 완료
   */
  async adminFulfillOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;
      const { memo } = req.body;

      const order = await redemptionService.adminFulfill(id, adminId, memo);
      sendSuccess(res, order);
    } catch (error) {
      next(error);
    }
  }
}

export const redemptionController = new RedemptionController();

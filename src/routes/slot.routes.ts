import { Router, Response, NextFunction } from 'express';
import { slotTemplateController, slotInstanceController } from '../controllers/slot.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSlotTemplateSchema, createSlotInstanceSchema } from '../utils/validation';
import { slotInstanceService } from '../services/slot.service';
import { athleteService } from '../services/athlete.service';
import { brandService } from '../services/brand.service';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Slot Templates
// ============================================

/**
 * @route GET /slots/templates
 * @desc List all slot templates
 */
router.get('/templates', authenticate, slotTemplateController.list);

/**
 * @route POST /slots/templates
 * @desc Create slot template (admin only)
 */
router.post(
  '/templates',
  authenticate,
  authorize('ADMIN'),
  validate(createSlotTemplateSchema),
  slotTemplateController.create
);

/**
 * @route GET /slots/templates/:id
 * @desc Get slot template by ID
 */
router.get('/templates/:id', authenticate, slotTemplateController.getById);

/**
 * @route PATCH /slots/templates/:id
 * @desc Update slot template (admin only)
 */
router.patch(
  '/templates/:id',
  authenticate,
  authorize('ADMIN'),
  slotTemplateController.update
);

// ============================================
// Slot Instances
// ============================================

/**
 * @route GET /slots/instances
 * @desc List slot instances with filters (public - non-logged-in users can view)
 */
router.get('/instances', optionalAuth, slotInstanceController.list);

/**
 * @route GET /slots/instances/available
 * @desc Get available slots for bidding (public - non-logged-in users can view)
 */
router.get('/instances/available', optionalAuth, slotInstanceController.getAvailable);

/**
 * @route POST /slots/instances
 * @desc Create slot instance
 */
router.post(
  '/instances',
  authenticate,
  authorize('ADMIN', 'ATHLETE'),
  validate(createSlotInstanceSchema),
  slotInstanceController.create
);

/**
 * @route POST /slots/instances/bulk
 * @desc Bulk create slot instances
 */
router.post(
  '/instances/bulk',
  authenticate,
  authorize('ADMIN', 'ATHLETE'),
  slotInstanceController.bulkCreate
);

/**
 * @route GET /slots/instances/:id
 * @desc Get slot instance by ID
 */
router.get('/instances/:id', authenticate, slotInstanceController.getById);

/**
 * @route PATCH /slots/instances/:id
 * @desc Update slot instance
 */
router.patch(
  '/instances/:id',
  authenticate,
  authorize('ADMIN', 'ATHLETE'),
  slotInstanceController.update
);

// ============================================
// Sale Mode (경매/즉시구매 설정)
// ============================================

/**
 * @route PATCH /slots/instances/:id/sale-mode
 * @desc Update slot sale mode (auction/direct buy settings) - Athlete or Admin
 */
router.patch(
  '/instances/:id/sale-mode',
  authenticate,
  authorize('ATHLETE', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { saleMode, directBuyPrice, auctionMinBid, auctionEndAt, isPublic } = req.body;
      // 판매 방식 3종 — saleMode가 오면 플래그를 파생시킴 (구버전 클라이언트는 기존 플래그 그대로 사용)
      const ALLOWED = ['AUCTION', 'DIRECT', 'INQUIRY'];
      if (saleMode !== undefined && !ALLOWED.includes(saleMode)) {
        res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: '지원하지 않는 판매 방식입니다' } });
        return;
      }
      const enableAuction = saleMode !== undefined ? saleMode === 'AUCTION' : req.body.enableAuction;
      const enableDirectBuy = saleMode !== undefined ? saleMode === 'DIRECT' : req.body.enableDirectBuy;

      let athleteId: string;

      if (userRole === 'ADMIN') {
        // Admin: 슬롯에서 직접 athleteId 가져오기
        const slot = await slotInstanceService.findById(id);
        athleteId = slot.athleteId;
      } else {
        // Athlete: 본인 athleteId 사용
        const athlete = await athleteService.findByUserId(userId);
        athleteId = athlete.id;
      }

      const slot = await slotInstanceService.updateSaleMode(id, athleteId, {
        enableAuction,
        enableDirectBuy,
        directBuyPrice: directBuyPrice ? Number(directBuyPrice) : null,
        auctionMinBid: auctionMinBid ? Number(auctionMinBid) : null,
        auctionEndAt: auctionEndAt ? new Date(auctionEndAt) : null,
        isPublic,
        ...(saleMode !== undefined && { saleMode }),
      });

      res.json({
        success: true,
        data: slot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /slots/instances/:id/buy-now
 * @desc Direct buy a slot - Brand only
 * - 브랜드 잔액 검증 후 계약 생성 (브랜드 선서명)
 * - 선수 서명 후 에스크로 HOLD
 */
router.post(
  '/instances/:id/buy-now',
  authenticate,
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Get brand ID from user
      const brand = await brandService.findByUserId(userId);

      const contract = await slotInstanceService.processBuyNow(id, brand.id, userId);

      res.json({
        success: true,
        data: contract,
        message: 'Slot purchased successfully. Contract created. Waiting for athlete signature.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 개편 Phase 3 (BUY-02, §13.2) — 슬롯 임시예약 15분
 * @route POST /slots/instances/:id/hold
 */
router.post(
  '/instances/:id/hold',
  authenticate,
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await brandService.findByUserId(req.user!.id);
      const { inventoryService } = await import('../services/inventory.service');
      await slotInstanceService.assertDirectBuyEligible(req.params.id, brand.id);
      const hold = await inventoryService.hold(req.params.id, brand.id);
      res.json({ success: true, data: hold, error: null });
    } catch (error) {
      next(error);
    }
  }
);

/** @route GET /slots/instances/:id/hold — 현재 내 예약 상태(타이머 UI) */
router.get(
  '/instances/:id/hold',
  authenticate,
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await brandService.findByUserId(req.user!.id);
      const { inventoryService } = await import('../services/inventory.service');
      res.json({ success: true, data: await inventoryService.getHold(req.params.id, brand.id), error: null });
    } catch (error) {
      next(error);
    }
  }
);

/** @route DELETE /slots/instances/:id/hold — 예약 해제(주문 취소) */
router.delete(
  '/instances/:id/hold',
  authenticate,
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await brandService.findByUserId(req.user!.id);
      const { inventoryService } = await import('../services/inventory.service');
      res.json({ success: true, data: await inventoryService.release(req.params.id, brand.id), error: null });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 개편 Phase 3 (BUY-05/06) — 주문확인용 견적
 * 가격정책(부가세·플랫폼 이용료) 확정 전이므로 표시 금액 = 실제 결제 금액을 보장한다.
 * @route GET /slots/instances/:id/quote
 */
router.get('/instances/:id/quote', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await slotInstanceService.getQuote(req.params.id), error: null });
  } catch (error) {
    next(error);
  }
});

export default router;

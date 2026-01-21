import { Router, Response, NextFunction } from 'express';
import { slotTemplateController, slotInstanceController } from '../controllers/slot.controller';
import { authenticate, authorize } from '../middleware/auth';
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
 * @desc List slot instances with filters
 */
router.get('/instances', authenticate, slotInstanceController.list);

/**
 * @route GET /slots/instances/available
 * @desc Get available slots for bidding
 */
router.get('/instances/available', authenticate, slotInstanceController.getAvailable);

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
      const { enableAuction, enableDirectBuy, directBuyPrice, auctionMinBid, auctionEndAt } = req.body;

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

export default router;

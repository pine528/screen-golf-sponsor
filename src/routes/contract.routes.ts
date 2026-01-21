import { Router, Response, NextFunction } from 'express';
import { contractController, settlementController } from '../controllers/contract.controller';
import { authenticate, authorize, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadAssetSchema, submitVerificationSchema } from '../utils/validation';
import { fulfillmentService } from '../services/fulfillment.service';
import { AuthRequest } from '../types';
import { z } from 'zod';

// FulfillmentStatus type (will be available after prisma generate)
type FulfillmentStatus =
  | 'NOT_STARTED'
  | 'DESIGNING'
  | 'PRODUCING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'ATTACHED';

const router = Router();

// ============================================
// Contracts
// ============================================

/**
 * @route GET /contracts
 * @desc List contracts with filters
 */
router.get('/', authenticate, contractController.list);

/**
 * @route GET /contracts/my
 * @desc Get current user's contracts
 */
router.get('/my', authenticate, contractController.getMyContracts);

/**
 * @route POST /contracts
 * @desc Create contract from auction (admin/system)
 */
router.post('/', authenticate, authorize('ADMIN'), contractController.createFromAuction);

/**
 * @route GET /contracts/settlements
 * @desc List all settlements (admin)
 * 주의: /:id 보다 먼저 선언해야 함
 */
router.get('/settlements', authenticate, authorize('ADMIN'), settlementController.list);

/**
 * @route GET /contracts/:id
 * @desc Get contract by ID
 */
router.get('/:id', authenticate, contractController.getById);

/**
 * @route POST /contracts/:id/sign
 * @desc Sign contract
 */
router.post('/:id/sign', authenticate, authorize('BRAND', 'ATHLETE'), contractController.sign);

/**
 * @route POST /contracts/:id/cancel
 * @desc Cancel contract (admin)
 */
router.post('/:id/cancel', authenticate, authorize('ADMIN'), contractController.cancel);

/**
 * @route GET /contracts/:id/report
 * @desc Get contract fulfillment report
 */
router.get('/:id/report', authenticate, contractController.getReport);

// ============================================
// Creative Assets
// ============================================

/**
 * @route POST /contracts/:id/assets
 * @desc Upload creative asset
 */
router.post(
  '/:id/assets',
  authenticate,
  authorize('BRAND'),
  validate(uploadAssetSchema),
  contractController.uploadAsset
);

/**
 * @route GET /contracts/:id/assets
 * @desc Get contract assets
 */
router.get('/:id/assets', authenticate, contractController.getAssets);

/**
 * @route POST /contracts/assets/:assetId/review
 * @desc Review creative asset (admin)
 */
router.post(
  '/assets/:assetId/review',
  authenticate,
  authorize('ADMIN'),
  contractController.reviewAsset
);

// ============================================
// Verification
// ============================================

/**
 * @route POST /contracts/:id/verification
 * @desc Submit attachment verification
 */
router.post(
  '/:id/verification',
  authenticate,
  authorize('ATHLETE'),
  validate(submitVerificationSchema),
  contractController.submitVerification
);

/**
 * @route GET /contracts/:id/verification
 * @desc Get contract verification
 */
router.get('/:id/verification', authenticate, contractController.getVerification);

/**
 * @route POST /contracts/verifications/:verificationId/review
 * @desc Review verification (admin)
 */
router.post(
  '/verifications/:verificationId/review',
  authenticate,
  authorize('ADMIN'),
  contractController.reviewVerification
);

// ============================================
// Settlements
// ============================================

/**
 * @route GET /contracts/settlements/my
 * @desc Get athlete's settlements
 */
router.get(
  '/settlements/my',
  authenticate,
  authorize('ATHLETE'),
  settlementController.getMySettlements
);

/**
 * @route GET /contracts/settlements/my/stats
 * @desc Get athlete's settlement stats
 */
router.get(
  '/settlements/my/stats',
  authenticate,
  authorize('ATHLETE'),
  settlementController.getMyStats
);

/**
 * @route GET /contracts/settlements/my/monthly
 * @desc Get athlete's monthly settlements
 */
router.get(
  '/settlements/my/monthly',
  authenticate,
  authorize('ATHLETE'),
  settlementController.getMonthlySettlements
);

/**
 * @route GET /contracts/settlements/my/report
 * @desc Download settlement report for a month
 */
router.get(
  '/settlements/my/report',
  authenticate,
  authorize('ATHLETE'),
  settlementController.downloadReport
);

/**
 * @route GET /contracts/settlements/:id
 * @desc Get settlement by ID
 */
router.get('/settlements/:id', authenticate, settlementController.getById);

/**
 * @route POST /contracts/settlements/:id/process
 * @desc Process settlement payment (admin)
 */
router.post(
  '/settlements/:id/process',
  authenticate,
  authorize('ADMIN'),
  settlementController.processPayment
);

// ============================================
// Fulfillment (이행 추적)
// ============================================

const fulfillmentStatusEnum = z.enum([
  'NOT_STARTED',
  'DESIGNING',
  'PRODUCING',
  'SHIPPING',
  'DELIVERED',
  'ATTACHED',
]);

const updateStatusSchema = z.object({
  status: fulfillmentStatusEnum,
  notes: z.string().optional(),
});

const updateShippingSchema = z.object({
  carrier: z.string().min(1, '택배사를 입력하세요'),
  trackingNumber: z.string().min(1, '운송장 번호를 입력하세요'),
});

const addAttachmentSchema = z.object({
  photoUrls: z.array(z.string().url()).min(1, '사진 URL을 입력하세요'),
  notes: z.string().optional(),
});

const updateNotesSchema = z.object({
  notes: z.string(),
});

/**
 * GET /contracts/:id/fulfillment
 * 계약 이행 상태 조회
 */
router.get(
  '/:id/fulfillment',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.getOrCreateFulfillment(req.params.id);
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /contracts/:id/fulfillment/status
 * 이행 상태 업데이트 (Brand/Admin)
 */
router.patch(
  '/:id/fulfillment/status',
  authenticate,
  authorize('BRAND', 'ADMIN'),
  validate(updateStatusSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.updateStatus(
        req.params.id,
        req.body.status as FulfillmentStatus,
        req.user!.id,
        req.body.notes
      );
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /contracts/:id/fulfillment/shipping
 * 배송 정보 업데이트 (Brand)
 */
router.patch(
  '/:id/fulfillment/shipping',
  authenticate,
  authorize('BRAND', 'ADMIN'),
  validate(updateShippingSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.updateShipping(
        req.params.id,
        {
          carrier: req.body.carrier,
          trackingNumber: req.body.trackingNumber,
        },
        req.user!.id
      );
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /contracts/:id/fulfillment/delivered
 * 배송 완료 처리 (Athlete/Admin)
 */
router.post(
  '/:id/fulfillment/delivered',
  authenticate,
  authorize('ATHLETE', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.markDelivered(
        req.params.id,
        req.user!.id
      );
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /contracts/:id/fulfillment/attachment
 * 부착 사진 등록 (Athlete)
 */
router.post(
  '/:id/fulfillment/attachment',
  authenticate,
  authorize('ATHLETE', 'ADMIN'),
  validate(addAttachmentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.addAttachmentPhotos(
        req.params.id,
        req.body.photoUrls,
        req.user!.id,
        req.body.notes
      );
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /contracts/:id/fulfillment/notes
 * 메모 업데이트 (Brand/Admin)
 */
router.patch(
  '/:id/fulfillment/notes',
  authenticate,
  authorize('BRAND', 'ADMIN'),
  validate(updateNotesSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const fulfillment = await fulfillmentService.updateNotes(
        req.params.id,
        req.body.notes,
        req.user!.id
      );
      res.json({ success: true, data: fulfillment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /contracts/:id/fulfillment/history
 * 이행 이력 조회
 */
router.get(
  '/:id/fulfillment/history',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const history = await fulfillmentService.getHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin Fulfillment Routes
// ============================================

/**
 * GET /contracts/fulfillments/list
 * Admin: 이행 현황 목록 조회
 */
router.get(
  '/fulfillments/list',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as FulfillmentStatus | undefined,
        brandId: req.query.brandId as string | undefined,
        athleteId: req.query.athleteId as string | undefined,
      };
      const fulfillments = await fulfillmentService.getFulfillments(filters);
      res.json({ success: true, data: fulfillments });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /contracts/fulfillments/stats
 * Admin: 이행 통계 조회
 */
router.get(
  '/fulfillments/stats',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await fulfillmentService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

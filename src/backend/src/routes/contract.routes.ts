import { Router } from 'express';
import { contractController, settlementController } from '../controllers/contract.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadAssetSchema, submitVerificationSchema } from '../utils/validation';

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
 * @route GET /contracts/settlements
 * @desc List all settlements (admin)
 */
router.get('/settlements', authenticate, authorize('ADMIN'), settlementController.list);

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

export default router;

import { Router } from 'express';
import { brandController } from '../controllers/brand.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route GET /brands
 * @desc List all brands (admin only)
 */
router.get('/', authenticate, authorize('ADMIN'), brandController.list);

/**
 * @route GET /brands/me
 * @desc Get current brand profile
 */
router.get('/me', authenticate, authorize('BRAND'), brandController.getMe);

/**
 * @route GET /brands/me/stats
 * @desc Get brand statistics
 */
router.get('/me/stats', authenticate, authorize('BRAND'), brandController.getStats);

/**
 * @route PATCH /brands/me
 * @desc Update current brand profile
 */
router.patch('/me', authenticate, authorize('BRAND'), brandController.update);

/**
 * @route POST /brands/me/kyc
 * @desc Submit KYC documents
 */
router.post('/me/kyc', authenticate, authorize('BRAND'), brandController.submitKyc);

/**
 * @route GET /brands/:id
 * @desc Get brand by ID
 */
router.get('/:id', authenticate, brandController.getById);

export default router;

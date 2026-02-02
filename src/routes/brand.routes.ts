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
 * ★ Phase 9-3: Brand Dashboard APIs
 */

/**
 * @route GET /brands/me/reservations
 * @desc Get brand's reservations (Direct Buy + Auction wins pending athlete signature)
 */
router.get('/me/reservations', authenticate, authorize('BRAND'), brandController.getMyReservations);

/**
 * @route GET /brands/me/bids
 * @desc Get brand's auction bids
 */
router.get('/me/bids', authenticate, authorize('BRAND'), brandController.getMyBids);

/**
 * @route GET /brands/me/wins
 * @desc Get brand's won contracts (all statuses)
 */
router.get('/me/wins', authenticate, authorize('BRAND'), brandController.getMyWins);

/**
 * ★ Phase 10-1: Brand Wallet
 */

/**
 * @route GET /brands/me/wallet
 * @desc Get brand's wallet and recent transactions
 */
router.get('/me/wallet', authenticate, authorize('BRAND'), brandController.getMyWallet);

/**
 * @route GET /brands/:id
 * @desc Get brand by ID
 */
router.get('/:id', authenticate, brandController.getById);

export default router;

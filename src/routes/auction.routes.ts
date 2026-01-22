import { Router } from 'express';
import { auctionController } from '../controllers/auction.controller';
import { authenticate, authorize, requireKycApproved, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAuctionSchema, placeBidSchema } from '../utils/validation';

const router = Router();

/**
 * @route GET /auctions
 * @desc List auctions with filters
 */
router.get('/', authenticate, auctionController.list);

/**
 * @route GET /auctions/featured
 * @desc Get featured/recommended auctions (최근 7일 내 생성된 경매)
 */
router.get('/featured', optionalAuth, auctionController.getFeatured);

/**
 * @route GET /auctions/live
 * @desc Get all live auctions
 */
router.get('/live', authenticate, auctionController.getLive);

/**
 * @route GET /auctions/ending-soon
 * @desc Get auctions ending soon
 */
router.get('/ending-soon', authenticate, auctionController.getEndingSoon);

/**
 * @route GET /auctions/my-bids
 * @desc Get current user's bids (brand)
 */
router.get('/my-bids', authenticate, authorize('BRAND'), auctionController.getMyBids);

/**
 * @route GET /auctions/my-winning-bids
 * @desc Get current user's winning bids (brand)
 */
router.get('/my-winning-bids', authenticate, authorize('BRAND'), auctionController.getMyWinningBids);

/**
 * @route POST /auctions
 * @desc Create new auction (admin only)
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createAuctionSchema),
  auctionController.create
);

/**
 * @route GET /auctions/:id
 * @desc Get auction by ID
 */
router.get('/:id', authenticate, auctionController.getById);

/**
 * ★ Phase 9-3: Auction summary API (polling)
 * @route GET /auctions/:id/summary
 * @desc Get auction summary for polling (optional auth)
 */
router.get('/:id/summary', optionalAuth, auctionController.getSummary);

/**
 * @route POST /auctions/:id/bids
 * @desc Place a bid on an auction (brand, requires KYC)
 */
router.post(
  '/:id/bids',
  authenticate,
  authorize('BRAND'),
  requireKycApproved,
  validate(placeBidSchema),
  auctionController.placeBid
);

/**
 * @route GET /auctions/:id/bids
 * @desc Get all bids for an auction
 */
router.get('/:id/bids', authenticate, auctionController.getBids);

/**
 * @route DELETE /auctions/:auctionId/bids/:bidId
 * @desc Delete/withdraw a bid (brand)
 */
router.delete(
  '/:auctionId/bids/:bidId',
  authenticate,
  authorize('BRAND'),
  auctionController.deleteBid
);

/**
 * @route POST /auctions/:id/cancel
 * @desc Cancel an auction (admin only)
 */
router.post('/:id/cancel', authenticate, authorize('ADMIN'), auctionController.cancelAuction);

export default router;

import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// 모든 라우트는 인증 필요
router.use(authenticate);

/**
 * @route GET /campaigns
 * @desc Get all campaigns (Admin sees all, Brand sees own)
 */
router.get('/', campaignController.list);

/**
 * @route GET /campaigns/my
 * @desc Get my campaigns (Brand only)
 */
router.get('/my', authorize('BRAND'), campaignController.getMyCampaigns);

/**
 * @route GET /campaigns/stats
 * @desc Get campaign stats for brand
 */
router.get('/stats', authorize('BRAND'), campaignController.getStats);

/**
 * @route POST /campaigns
 * @desc Create new campaign (Brand only)
 */
router.post('/', authorize('BRAND'), campaignController.create);

/**
 * @route GET /campaigns/:id
 * @desc Get campaign by ID
 */
router.get('/:id', campaignController.getById);

/**
 * @route PATCH /campaigns/:id
 * @desc Update campaign (Brand only)
 */
router.patch('/:id', authorize('BRAND'), campaignController.update);

/**
 * @route DELETE /campaigns/:id
 * @desc Delete campaign (Brand only)
 */
router.delete('/:id', authorize('BRAND'), campaignController.delete);

/**
 * @route POST /campaigns/:id/activate
 * @desc Activate campaign (Brand only)
 */
router.post('/:id/activate', authorize('BRAND'), campaignController.activate);

/**
 * @route POST /campaigns/:id/pause
 * @desc Pause campaign (Brand only)
 */
router.post('/:id/pause', authorize('BRAND'), campaignController.pause);

export default router;

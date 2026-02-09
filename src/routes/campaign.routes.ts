import { Router, Response, NextFunction } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middleware/auth';
import { campaignService } from '../services/campaign.service';
import { AuthRequest } from '../types';

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
 * @desc Create new campaign (Brand or Admin)
 */
router.post('/', authorize('BRAND', 'ADMIN'), campaignController.create);

/**
 * GET /campaigns/recommended-athletes
 * 추천 선수 조회 (주의: /:id 보다 먼저 선언해야 함)
 */
router.get(
  '/recommended-athletes',
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await import('../models/prisma').then(m =>
        m.default.brand.findUnique({ where: { userId: req.user!.id } })
      );
      if (!brand) {
        return res.status(403).json({ success: false, message: 'Brand not found' });
      }

      const tours = req.query.tours
        ? (req.query.tours as string).split(',')
        : undefined;
      const minRating = req.query.minRating
        ? parseFloat(req.query.minRating as string)
        : undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 10;

      const athletes = await campaignService.getRecommendedAthletes(brand.id, {
        tours,
        minRating,
        limit,
      });
      res.json({ success: true, data: athletes });
    } catch (error) {
      next(error);
    }
  }
);

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

// ====================================
// Phase E: Enhanced Campaign Features
// ====================================

/**
 * GET /campaigns/:id/performance
 * 캠페인 성과 조회
 */
router.get(
  '/:id/performance',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const performance = await campaignService.getPerformance(req.params.id);
      res.json({ success: true, data: performance });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /campaigns/:id/kpi
 * KPI/예산 설정 업데이트
 */
router.patch(
  '/:id/kpi',
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await import('../models/prisma').then(m =>
        m.default.brand.findUnique({ where: { userId: req.user!.id } })
      );
      if (!brand) {
        return res.status(403).json({ success: false, message: 'Brand not found' });
      }

      const campaign = await campaignService.updateKpiAndBudget(
        req.params.id,
        brand.id,
        req.body
      );
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /campaigns/:id/contracts
 * 캠페인에 계약 연결
 */
router.post(
  '/:id/contracts',
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await import('../models/prisma').then(m =>
        m.default.brand.findUnique({ where: { userId: req.user!.id } })
      );
      if (!brand) {
        return res.status(403).json({ success: false, message: 'Brand not found' });
      }

      const { contractId, allocatedBudget } = req.body;
      const campaignContract = await campaignService.addContract(
        req.params.id,
        brand.id,
        contractId,
        allocatedBudget
      );
      res.status(201).json({ success: true, data: campaignContract });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /campaigns/:id/contracts/:contractId
 * 캠페인에서 계약 제거
 */
router.delete(
  '/:id/contracts/:contractId',
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const brand = await import('../models/prisma').then(m =>
        m.default.brand.findUnique({ where: { userId: req.user!.id } })
      );
      if (!brand) {
        return res.status(403).json({ success: false, message: 'Brand not found' });
      }

      await campaignService.removeContract(
        req.params.id,
        brand.id,
        req.params.contractId
      );
      res.json({ success: true, message: 'Contract removed from campaign' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

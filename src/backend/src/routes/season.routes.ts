import { Router, Response, NextFunction } from 'express';
import { seasonService } from '../services/season.service';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 현재 시즌 조회
router.get('/current', async (req, res: Response, next: NextFunction) => {
  try {
    const season = await seasonService.getCurrentSeason();
    res.json({ success: true, data: season });
  } catch (error) {
    next(error);
  }
});

// 시즌 목록 조회
router.get('/', async (req, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
    const status = req.query.status as string | undefined;

    const result = await seasonService.listSeasons({ page, pageSize, status: status as any });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 시즌 상세 조회
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const season = await seasonService.getSeason(req.params.id);
    res.json({ success: true, data: season });
  } catch (error) {
    next(error);
  }
});

// 시즌 리더보드
router.get('/:id/leaderboard', async (req, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 50;

    const result = await seasonService.getLeaderboard(req.params.id, { page, pageSize });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Authenticated User Routes
// ============================================

// 내 시즌 참여 현황
router.get(
  '/my/participation',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const seasonId = req.query.seasonId as string | undefined;

      const result = await seasonService.getMyParticipation(userId, seasonId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// 내 뱃지 목록
router.get(
  '/my/badges',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const badges = await seasonService.getMyBadges(userId);
      res.json({ success: true, data: badges });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin Routes
// ============================================

// 시즌 생성
const createSeasonSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  rewardTiers: z
    .array(
      z.object({
        rankFrom: z.number().int().min(1),
        rankTo: z.number().int().min(1),
        rewardPoints: z.number().int().min(0),
      })
    )
    .optional(),
  participationBonus: z.number().int().min(0).optional(),
});

router.post(
  '/admin',
  authenticate,
  requireRole('ADMIN'),
  validate(createSeasonSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const season = await seasonService.createSeason({
        ...req.body,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
      });
      res.status(201).json({ success: true, data: season });
    } catch (error) {
      next(error);
    }
  }
);

// 시즌 수정
const updateSeasonSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  rewardTiers: z
    .array(
      z.object({
        rankFrom: z.number().int().min(1),
        rankTo: z.number().int().min(1),
        rewardPoints: z.number().int().min(0),
      })
    )
    .optional(),
  participationBonus: z.number().int().min(0).optional(),
  status: z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'ENDED', 'REWARDS_DISTRIBUTED']).optional(),
});

router.patch(
  '/admin/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateSeasonSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = {
        ...req.body,
        ...(req.body.startsAt && { startsAt: new Date(req.body.startsAt) }),
        ...(req.body.endsAt && { endsAt: new Date(req.body.endsAt) }),
      };
      const season = await seasonService.updateSeason(req.params.id, data);
      res.json({ success: true, data: season });
    } catch (error) {
      next(error);
    }
  }
);

// 시즌 활성화
router.post(
  '/admin/:id/activate',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const season = await seasonService.activateSeason(req.params.id);
      res.json({ success: true, data: season });
    } catch (error) {
      next(error);
    }
  }
);

// 시즌 종료
router.post(
  '/admin/:id/end',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const season = await seasonService.endSeason(req.params.id);
      res.json({ success: true, data: season });
    } catch (error) {
      next(error);
    }
  }
);

// 보상 배포
router.post(
  '/admin/:id/distribute-rewards',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user!.id;
      const result = await seasonService.distributeRewards(req.params.id, adminId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// 랭킹 수동 업데이트
router.post(
  '/admin/:id/update-rankings',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await seasonService.updateRankings(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

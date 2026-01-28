import { Router } from 'express';
import { donationController } from '../controllers/donation.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 후원 가능한 선수 목록 조회
router.get(
  '/athletes',
  donationController.getAthleteList.bind(donationController)
);

// ============================================
// FAN Routes (FAN 권한 필요)
// ============================================

// 후원 생성
const createDonationSchema = z.object({
  athleteId: z.string().uuid('유효한 선수 ID가 아닙니다'),
  amount: z.number().int().min(100, '최소 후원 금액은 100P입니다'),
  message: z.string().max(200, '메시지는 최대 200자입니다').optional(),
  isAnonymous: z.boolean().optional(),
});

router.post(
  '/',
  authenticate,
  authorize('FAN'),
  validate(createDonationSchema),
  donationController.createDonation.bind(donationController)
);

// 내 후원 내역 조회
router.get(
  '/my',
  authenticate,
  authorize('FAN'),
  donationController.getMyDonations.bind(donationController)
);

// ============================================
// ATHLETE Routes (ATHLETE 권한 필요)
// ============================================

// 내가 받은 후원 목록 조회
router.get(
  '/received',
  authenticate,
  authorize('ATHLETE'),
  donationController.getMyReceivedDonations.bind(donationController)
);

// 특정 선수의 후원자 목록 조회 (본인만 가능)
router.get(
  '/athlete/:athleteId',
  authenticate,
  authorize('ATHLETE'),
  donationController.getAthleteDonations.bind(donationController)
);

export default router;

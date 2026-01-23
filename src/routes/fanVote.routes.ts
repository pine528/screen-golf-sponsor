import { Router, Response, NextFunction } from 'express';
import { fanVoteController } from '../controllers/fanVote.controller';
import { authenticate, optionalAuth, requireRole, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { AuthRequest } from '../types';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 활성화된 팬 투표 목록
router.get('/active', fanVoteController.listActive.bind(fanVoteController));

// 종료된 팬 투표 목록
router.get('/ended', fanVoteController.listEnded.bind(fanVoteController));

// ============================================
// User Routes (FAN, ATHLETE, BRAND 모두 사용 가능)
// ============================================

// 투표 생성 (FAN, ATHLETE, BRAND)
const createByUserSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  question: z.string().min(1, '질문을 입력하세요').max(500),
  options: z.array(z.string()).min(2, '최소 2개 옵션').max(6, '최대 6개 옵션'),
  entryFeePoints: z.number().int().min(0, '참가비는 0 이상'),
  winnersCount: z.number().int().min(1, '당첨자 수는 1명 이상'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  creatorPrizePool: z.number().int().min(0).optional(), // Seed 포인트
});

router.post(
  '/create',
  authenticate,
  authorize('FAN', 'ATHLETE', 'BRAND'),
  validate(createByUserSchema),
  fanVoteController.createByFan.bind(fanVoteController)
);

// 내가 만든 투표 목록 (FAN, ATHLETE, BRAND)
router.get(
  '/my/events',
  authenticate,
  authorize('FAN', 'ATHLETE', 'BRAND'),
  fanVoteController.getMyCreatedEvents.bind(fanVoteController)
);

// 내 참여 내역 (FAN, ATHLETE, BRAND)
router.get(
  '/my/entries',
  authenticate,
  authorize('FAN', 'ATHLETE', 'BRAND'),
  fanVoteController.getMyEntries.bind(fanVoteController)
);

// 투표 제출 (FAN, ATHLETE, BRAND)
router.post(
  '/:id/submit',
  authenticate,
  authorize('FAN', 'ATHLETE', 'BRAND'),
  fanVoteController.submitFanVote.bind(fanVoteController)
);

// 투표 참여 (FAN, ATHLETE, BRAND)
const enterVoteSchema = z.object({
  optionIndex: z.number().int().min(0, '옵션 인덱스는 0 이상이어야 합니다'),
});

router.post(
  '/:id/enter',
  authenticate,
  authorize('FAN', 'ATHLETE', 'BRAND'),
  validate(enterVoteSchema),
  fanVoteController.enterVote.bind(fanVoteController)
);

// 투표 결과 조회 (로그인 선택)
router.get(
  '/:id/result',
  optionalAuth,
  fanVoteController.getEventResult.bind(fanVoteController)
);

// 팬 투표 상세 조회 (로그인 선택, 로그인 시 참여 여부 포함)
router.get('/:id', optionalAuth, fanVoteController.getEvent.bind(fanVoteController));

// ============================================
// Admin Routes (ADMIN 권한 필요)
// ============================================

// 승인 대기 투표 목록
router.get(
  '/admin/pending',
  authenticate,
  requireRole('ADMIN'),
  fanVoteController.listPendingApproval.bind(fanVoteController)
);

// 팬 투표 생성 (ADMIN)
const createEventSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  question: z.string().min(1, '질문을 입력하세요').max(500),
  options: z.array(z.string()).min(2, '최소 2개 이상의 옵션이 필요합니다'),
  entryFeePoints: z.number().int().min(0, '참가비는 0 이상이어야 합니다'),
  winnersCount: z.number().int().min(1, '당첨자 수는 1명 이상이어야 합니다'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

router.post(
  '/admin/create',
  authenticate,
  requireRole('ADMIN'),
  validate(createEventSchema),
  fanVoteController.createEvent.bind(fanVoteController)
);

// 승인 및 활성화
router.post(
  '/admin/:id/approve-and-activate',
  authenticate,
  requireRole('ADMIN'),
  fanVoteController.approveAndActivate.bind(fanVoteController)
);

// 팬 투표 활성화 (기존)
router.post(
  '/admin/:id/activate',
  authenticate,
  requireRole('ADMIN'),
  fanVoteController.activateEvent.bind(fanVoteController)
);

// 팬 투표 종료
router.post(
  '/admin/:id/close',
  authenticate,
  requireRole('ADMIN'),
  fanVoteController.closeEvent.bind(fanVoteController)
);

// 정산 실행
const settleSchema = z.object({
  resultOptionIndex: z.number().int().min(0, '결과 옵션 인덱스는 0 이상'),
});

router.post(
  '/admin/:id/settle',
  authenticate,
  requireRole('ADMIN'),
  validate(settleSchema),
  fanVoteController.settleEvent.bind(fanVoteController)
);

// 정산 완료된 투표 삭제
router.delete(
  '/admin/:id',
  authenticate,
  requireRole('ADMIN'),
  fanVoteController.deleteSettledEvent.bind(fanVoteController)
);

// ============================================
// Brand Vote Creation Routes (BRAND 권한 필요)
// ============================================

// 브랜드 투표 생성
// URL 필드: 빈 문자열, undefined, 또는 유효한 URL 모두 허용
const optionalUrl = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().url().optional()
);

const createByBrandSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  question: z.string().min(1, '질문을 입력하세요').max(500),
  options: z.array(z.string()).min(2, '최소 2개 옵션').max(6, '최대 6개 옵션'),
  entryFeePoints: z.number().int().min(0, '참가비는 0 이상'),
  winnersCount: z.number().int().min(1, '당첨자 수는 1명 이상'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  sponsorContribution: z.number().int().min(0).optional(),
  sponsorBannerUrl: optionalUrl,
  sponsorLogoUrl: optionalUrl,
  sponsorMessage: z.string().max(200).optional(),
  sponsorLinkUrl: optionalUrl,
});

router.post(
  '/brand/create',
  authenticate,
  authorize('BRAND'),
  validate(createByBrandSchema),
  fanVoteController.createByBrand.bind(fanVoteController)
);

// 브랜드가 만든 투표 목록
router.get(
  '/brand/my/events',
  authenticate,
  authorize('BRAND'),
  fanVoteController.getBrandCreatedEvents.bind(fanVoteController)
);

// 브랜드 투표 제출 (DRAFT -> SUBMITTED)
router.post(
  '/brand/:id/submit',
  authenticate,
  authorize('BRAND'),
  fanVoteController.submitBrandVote.bind(fanVoteController)
);

// ============================================
// Brand Sponsor Routes (BRAND 권한 필요)
// ============================================

// 투표 후원
const sponsorSchema = z.object({
  contributionAmount: z.number().int().min(1, '후원 금액은 1 이상이어야 합니다'),
  bannerUrl: optionalUrl,
  logoUrl: optionalUrl,
  message: z.string().max(200).optional(),
  linkUrl: optionalUrl,
});

router.post(
  '/:id/sponsor',
  authenticate,
  authorize('BRAND'),
  validate(sponsorSchema),
  fanVoteController.sponsorVote.bind(fanVoteController)
);

// 스폰서 노출/클릭 추적 (Public - 인증 불필요)
const trackEngagementSchema = z.object({
  type: z.enum(['banner_impression', 'banner_click', 'link_click']),
});

router.post(
  '/:id/track-engagement',
  validate(trackEngagementSchema),
  fanVoteController.trackEngagement.bind(fanVoteController)
);

export default router;

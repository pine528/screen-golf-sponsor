import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import * as voteV2Controller from '../controllers/voteV2.controller';

const router = Router();

// ============================================
// 리워드풀 (Reward Pool)
// ============================================

/**
 * @route GET /votes-v2/reward-pool/status
 * @desc 리워드풀 상태 조회 (공개)
 */
router.get('/reward-pool/status', optionalAuth, voteV2Controller.getRewardPoolStatus);

/**
 * @route POST /votes-v2/reward-pool/deposit
 * @desc 리워드풀 충전 (관리자)
 */
router.post(
  '/reward-pool/deposit',
  authenticate,
  authorize('ADMIN'),
  voteV2Controller.depositToRewardPool
);

/**
 * @route POST /votes-v2/reward-pool/reset-daily
 * @desc 일일 가용액 리셋 (관리자/크론)
 */
router.post(
  '/reward-pool/reset-daily',
  authenticate,
  authorize('ADMIN'),
  voteV2Controller.resetDailyAvailable
);

/**
 * @route POST /votes-v2/reward-pool/recalculate-multiplier
 * @desc 배수 M 재계산 (관리자/크론)
 */
router.post(
  '/reward-pool/recalculate-multiplier',
  authenticate,
  authorize('ADMIN'),
  voteV2Controller.recalculateMultiplier
);

// ============================================
// 투표 템플릿
// ============================================

/**
 * @route GET /votes-v2/templates
 * @desc 투표 템플릿 목록 조회
 */
router.get('/templates', optionalAuth, voteV2Controller.getTemplates);

// ============================================
// 투표 CRUD
// ============================================

/**
 * @route GET /votes-v2
 * @desc 투표 목록 조회 (공개)
 */
router.get('/', optionalAuth, voteV2Controller.listVotes);

/**
 * @route GET /votes-v2/my-participations
 * @desc 내 참여 목록 조회
 */
router.get('/my-participations', authenticate, voteV2Controller.getMyParticipations);

/**
 * @route GET /votes-v2/stats
 * @desc 투표 통계 (관리자)
 */
router.get('/stats', authenticate, authorize('ADMIN'), voteV2Controller.getVoteStats);

// ============================================
// 사용자 투표 생성 (본인 포인트 사용)
// 주의: /:id 라우트보다 먼저 정의해야 함
// ============================================

/**
 * @route GET /votes-v2/user/limits
 * @desc 사용자 투표 생성 제한 정보 조회
 */
router.get('/user/limits', authenticate, voteV2Controller.getUserVoteLimits);

/**
 * @route GET /votes-v2/user/my-votes
 * @desc 내가 생성한 투표 목록 조회
 */
router.get('/user/my-votes', authenticate, voteV2Controller.getMyCreatedVotes);

/**
 * @route POST /votes-v2/user/create
 * @desc 사용자 투표 생성 (본인 포인트 사용)
 */
router.post('/user/create', authenticate, voteV2Controller.createUserVote);

/**
 * @route POST /votes-v2/user/:id/cancel
 * @desc 사용자 투표 취소 (생성자만, 참여자 없을 때)
 */
router.post('/user/:id/cancel', authenticate, voteV2Controller.cancelUserVote);

/**
 * @route POST /votes-v2/user/:id/settle
 * @desc 사용자 투표 정산 (생성자)
 */
router.post('/user/:id/settle', authenticate, voteV2Controller.settleUserVote);

// ============================================
// 투표 상세 (/:id 라우트는 마지막에 정의)
// ============================================

/**
 * @route GET /votes-v2/:id
 * @desc 투표 상세 조회
 */
router.get('/:id', optionalAuth, voteV2Controller.getVoteById);

/**
 * @route POST /votes-v2
 * @desc 투표 생성 (관리자)
 */
router.post('/', authenticate, authorize('ADMIN'), voteV2Controller.createVote);

/**
 * @route POST /votes-v2/:id/participate
 * @desc 투표 참여 (무료, 로그인 필요)
 */
router.post('/:id/participate', authenticate, voteV2Controller.participateVote);

/**
 * @route POST /votes-v2/:id/settle
 * @desc 투표 정산 (관리자)
 */
router.post('/:id/settle', authenticate, authorize('ADMIN'), voteV2Controller.settleVote);

/**
 * @route POST /votes-v2/:id/cancel
 * @desc 투표 취소 (관리자)
 */
router.post('/:id/cancel', authenticate, authorize('ADMIN'), voteV2Controller.cancelVote);

/**
 * @route POST /votes-v2/cron/close-expired
 * @desc 만료된 투표 마감 (관리자/크론)
 */
router.post(
  '/cron/close-expired',
  authenticate,
  authorize('ADMIN'),
  voteV2Controller.closeExpiredVotes
);

export default router;

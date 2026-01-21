import { Router } from 'express';
import { voteController } from '../controllers/vote.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 활성화된 투표 이벤트 목록 (누구나 조회 가능)
router.get('/active', voteController.listActiveVoteEvents.bind(voteController));

// 종료된 투표 이벤트 목록 (누구나 조회 가능)
router.get('/ended', voteController.listEndedVoteEvents.bind(voteController));

// 투표 이벤트 상세 조회
router.get('/events/:id', voteController.getVoteEvent.bind(voteController));

// 투표 이벤트 통계
router.get('/events/:id/stats', voteController.getVoteEventStats.bind(voteController));

// 선수 랭킹
router.get('/ranking/athletes', voteController.getAthleteRanking.bind(voteController));

// ============================================
// Authenticated Routes
// ============================================

// 투표하기 (FAN 권한만 허용)
router.post(
  '/events/:voteEventId/vote',
  authenticate,
  requireRole('FAN'),
  voteController.submitVote.bind(voteController)
);

// 내 투표 내역 (FAN 권한만 허용)
router.get(
  '/my/votes',
  authenticate,
  requireRole('FAN'),
  voteController.getMyVotes.bind(voteController)
);

// 내 포인트 조회 (FAN 권한만 허용)
router.get(
  '/my/points',
  authenticate,
  requireRole('FAN'),
  voteController.getMyPoints.bind(voteController)
);

// 내 포인트 내역 (FAN 권한만 허용)
router.get(
  '/my/points/history',
  authenticate,
  requireRole('FAN'),
  voteController.getMyPointHistory.bind(voteController)
);

// 포인트 사용 (FAN 권한만 허용)
router.post(
  '/my/points/redeem',
  authenticate,
  requireRole('FAN'),
  voteController.redeemPoints.bind(voteController)
);

// ============================================
// Admin Routes
// ============================================

// 투표 이벤트 목록 (관리자용 - 모든 상태 조회)
router.get(
  '/events',
  authenticate,
  requireRole('ADMIN'),
  voteController.listVoteEvents.bind(voteController)
);

// 투표 이벤트 생성
router.post(
  '/events',
  authenticate,
  requireRole('ADMIN'),
  voteController.createVoteEvent.bind(voteController)
);

// 투표 이벤트 수정
router.patch(
  '/events/:id',
  authenticate,
  requireRole('ADMIN'),
  voteController.updateVoteEvent.bind(voteController)
);

// 투표 이벤트 활성화
router.post(
  '/events/:id/activate',
  authenticate,
  requireRole('ADMIN'),
  voteController.activateVoteEvent.bind(voteController)
);

// 투표 이벤트 마감
router.post(
  '/events/:id/close',
  authenticate,
  requireRole('ADMIN'),
  voteController.closeVoteEvent.bind(voteController)
);

// 투표 이벤트 정산 (정답 설정 및 포인트 지급)
router.post(
  '/events/:id/settle',
  authenticate,
  requireRole('ADMIN'),
  voteController.settleVoteEvent.bind(voteController)
);

// 투표 이벤트 삭제
router.delete(
  '/events/:id',
  authenticate,
  requireRole('ADMIN'),
  voteController.deleteVoteEvent.bind(voteController)
);

export default router;

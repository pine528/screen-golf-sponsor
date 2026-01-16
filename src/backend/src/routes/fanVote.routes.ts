import { Router } from 'express';
import { fanVoteController } from '../controllers/fanVote.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// Public Routes
// ============================================

// 활성화된 팬 투표 목록
router.get('/active', fanVoteController.listActive.bind(fanVoteController));

// 종료된 팬 투표 목록
router.get('/ended', fanVoteController.listEnded.bind(fanVoteController));

// 팬 투표 상세 조회 (로그인 선택, 로그인 시 참여 여부 포함)
router.get('/:id', fanVoteController.getEvent.bind(fanVoteController));

// ============================================
// Fan Routes (FAN 권한 필요)
// ============================================

// 팬 투표 참여
const enterVoteSchema = z.object({
  optionIndex: z.number().int().min(0, '옵션 인덱스는 0 이상이어야 합니다'),
});

router.post(
  '/:id/enter',
  authenticate,
  requireRole('FAN'),
  validate(enterVoteSchema),
  fanVoteController.enterVote.bind(fanVoteController)
);

// 내 참여 내역
router.get(
  '/my/entries',
  authenticate,
  requireRole('FAN'),
  fanVoteController.getMyEntries.bind(fanVoteController)
);

// ============================================
// Admin Routes (ADMIN 권한 필요)
// ============================================

// 팬 투표 생성
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

// 팬 투표 활성화
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

export default router;

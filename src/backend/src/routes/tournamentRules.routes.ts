/**
 * Tournament Rules Routes
 * 대회 규칙 및 Phase 2 관리 라우트
 */

import { Router } from 'express';
import { authenticate, requireAdminRole } from '../middleware/auth';
import {
  getTournamentRules,
  updateTournamentRules,
  getSlotAvailability,
  approvePhase2Slots,
  getSlotTemplates,
  getEventSlotSummary,
} from '../controllers/tournamentRules.controller';

const router = Router();

// Public: 슬롯 템플릿 목록 (v2 필드 포함)
router.get('/slot-templates', getSlotTemplates);

// Public: 대회 규칙 조회
router.get('/events/:eventId/tournament-rules', getTournamentRules);

// Authenticated: 슬롯 가용성 조회 (선수/브랜드/에이전시)
router.get(
  '/events/:eventId/athletes/:athleteId/slot-availability',
  authenticate,
  getSlotAvailability
);

// Admin only: 대회 규칙 업데이트
router.put(
  '/admin/events/:eventId/tournament-rules',
  authenticate,
  requireAdminRole,
  updateTournamentRules
);

// Admin only: Phase 2 수동 승인
router.post(
  '/admin/events/:eventId/athletes/:athleteId/approve-phase2',
  authenticate,
  requireAdminRole,
  approvePhase2Slots
);

// Admin only: 대회별 슬롯 상태 요약
router.get(
  '/admin/events/:eventId/slot-summary',
  authenticate,
  requireAdminRole,
  getEventSlotSummary
);

export default router;

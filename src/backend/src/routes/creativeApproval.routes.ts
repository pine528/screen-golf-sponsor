/**
 * Creative Approval Routes
 * 브랜드의 대회별 사전 크리에이티브 승인 API
 */

import { Router } from 'express';
import { authenticate, requireAdminRole, authorize } from '../middleware/auth';
import {
  submitCreativeApproval,
  getMyCreativeApproval,
  listMyCreativeApprovals,
  listEventCreativeApprovals,
  listAllCreativeApprovals,
  getCreativeApprovalStats,
  startReview,
  approveCreativeApproval,
  rejectCreativeApproval,
} from '../controllers/creativeApproval.controller';

// Brand routes
export const brandCreativeApprovalRoutes = Router();

const requireBrand = authorize('BRAND');

// 브랜드: 크리에이티브 승인 요청 제출
brandCreativeApprovalRoutes.post('/', authenticate, requireBrand, submitCreativeApproval);

// 브랜드: 내 모든 크리에이티브 승인 요청 목록
brandCreativeApprovalRoutes.get('/', authenticate, requireBrand, listMyCreativeApprovals);

// 브랜드: 특정 대회의 내 크리에이티브 승인 상태 조회
brandCreativeApprovalRoutes.get('/events/:eventId', authenticate, requireBrand, getMyCreativeApproval);

// Admin routes
export const adminCreativeApprovalRoutes = Router();

// Admin: 전체 크리에이티브 승인 요청 목록
adminCreativeApprovalRoutes.get('/', authenticate, requireAdminRole, listAllCreativeApprovals);

// Admin: 통계
adminCreativeApprovalRoutes.get('/stats', authenticate, requireAdminRole, getCreativeApprovalStats);

// Admin: 대회별 크리에이티브 승인 요청 목록
adminCreativeApprovalRoutes.get('/events/:eventId', authenticate, requireAdminRole, listEventCreativeApprovals);

// Admin: 검토 시작
adminCreativeApprovalRoutes.post('/:id/start-review', authenticate, requireAdminRole, startReview);

// Admin: 승인
adminCreativeApprovalRoutes.post('/:id/approve', authenticate, requireAdminRole, approveCreativeApproval);

// Admin: 거부
adminCreativeApprovalRoutes.post('/:id/reject', authenticate, requireAdminRole, rejectCreativeApproval);

import { Router, Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { ReportType, ReportStatus, ReportPriority } from '@prisma/client';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const reportTypeEnum = z.enum([
  'CONTRACT_DISPUTE',
  'INAPPROPRIATE_CONTENT',
  'FRAUD_SUSPICION',
  'SERVICE_ISSUE',
  'OTHER',
]);

const reportStatusEnum = z.enum([
  'OPEN',
  'IN_REVIEW',
  'PENDING_INFO',
  'ESCALATED',
  'RESOLVED',
  'DISMISSED',
]);

const reportPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const createReportSchema = z.object({
  type: reportTypeEnum,
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  title: z.string().min(1, '제목을 입력하세요').max(200),
  description: z.string().min(10, '설명을 최소 10자 이상 입력하세요').max(5000),
  evidenceUrls: z.array(z.string().url()).optional(),
  priority: reportPriorityEnum.optional(),
});

const updateStatusSchema = z.object({
  status: reportStatusEnum,
});

const updatePrioritySchema = z.object({
  priority: reportPriorityEnum,
});

const assignSchema = z.object({
  assignedTo: z.string().uuid(),
});

const resolveSchema = z.object({
  resolution: z.string().min(1, '해결 내용을 입력하세요').max(5000),
  status: z.enum(['RESOLVED', 'DISMISSED']).optional().default('RESOLVED'),
});

const addCommentSchema = z.object({
  content: z.string().min(1, '댓글 내용을 입력하세요').max(2000),
  isInternal: z.boolean().optional().default(false),
});

// ============================================
// User Routes
// ============================================

/**
 * POST /api/reports
 * 신고 접수
 */
router.post(
  '/',
  authenticate,
  validate(createReportSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.createReport({
        reporterUserId: req.user!.id,
        ...req.body,
      });
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/my
 * 내 신고 목록
 */
router.get(
  '/my',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const reports = await reportService.getMyReports(req.user!.id);
      res.json({ success: true, data: reports });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/my/:id
 * 내 신고 상세
 */
router.get(
  '/my/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.getMyReport(req.user!.id, req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: '신고를 찾을 수 없습니다' });
      }
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/reports/my/:id/comments
 * 내 신고에 댓글 추가 (사용자용 - 내부 댓글 불가)
 */
router.post(
  '/my/:id/comments',
  authenticate,
  validate(addCommentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.getMyReport(req.user!.id, req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: '신고를 찾을 수 없습니다' });
      }

      const comment = await reportService.addComment(
        req.params.id,
        req.user!.id,
        req.body.content,
        false // 사용자는 내부 댓글 불가
      );
      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/reports/admin
 * Admin: 전체 신고 목록
 */
router.get(
  '/admin',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as ReportStatus | undefined,
        priority: req.query.priority as ReportPriority | undefined,
        type: req.query.type as ReportType | undefined,
        assignedTo: req.query.assignedTo as string | undefined,
        targetType: req.query.targetType as string | undefined,
        q: req.query.q as string | undefined,
      };
      const reports = await reportService.getReports(filters);
      res.json({ success: true, data: reports });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/admin/stats
 * Admin: 신고 통계
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await reportService.getReportStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/admin/:id
 * Admin: 신고 상세
 */
router.get(
  '/admin/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: '신고를 찾을 수 없습니다' });
      }
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/reports/admin/:id/status
 * Admin: 상태 변경
 */
router.patch(
  '/admin/:id/status',
  authenticate,
  requireRole('ADMIN'),
  validate(updateStatusSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.updateStatus(
        req.params.id,
        req.user!.id,
        req.body.status
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/reports/admin/:id/priority
 * Admin: 우선순위 변경
 */
router.patch(
  '/admin/:id/priority',
  authenticate,
  requireRole('ADMIN'),
  validate(updatePrioritySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.updatePriority(
        req.params.id,
        req.user!.id,
        req.body.priority
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/reports/admin/:id/assign
 * Admin: 담당자 지정
 */
router.patch(
  '/admin/:id/assign',
  authenticate,
  requireRole('ADMIN'),
  validate(assignSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.assignReport(
        req.params.id,
        req.user!.id,
        req.body.assignedTo
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/reports/admin/:id/resolve
 * Admin: 해결
 */
router.post(
  '/admin/:id/resolve',
  authenticate,
  requireRole('ADMIN'),
  validate(resolveSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.resolveReport(
        req.params.id,
        req.user!.id,
        req.body.resolution,
        req.body.status
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/reports/admin/:id/comments
 * Admin: 댓글 추가 (내부 댓글 가능)
 */
router.post(
  '/admin/:id/comments',
  authenticate,
  requireRole('ADMIN'),
  validate(addCommentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const comment = await reportService.addComment(
        req.params.id,
        req.user!.id,
        req.body.content,
        req.body.isInternal
      );
      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

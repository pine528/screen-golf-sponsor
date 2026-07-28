/**
 * Creative Approval Controller
 * 브랜드의 대회별 사전 크리에이티브 승인 API
 */

import { Request, Response, NextFunction } from 'express';
import { creativeApprovalService } from '../services/creativeApproval.service';
import { sendSuccess } from '../utils/response';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    brandId?: string;
  };
}

/**
 * 브랜드: 크리에이티브 승인 요청 제출
 * POST /api/brand/creative-approvals
 */
export const submitCreativeApproval = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brandId = req.user?.brandId;
    if (!brandId) {
      return res.status(403).json({ error: '브랜드 계정이 필요합니다.' });
    }

    const { eventId, fileUrl, fileName, fileType, fileSizeBytes } = req.body;

    if (!eventId || !fileUrl) {
      return res.status(400).json({ error: 'eventId와 fileUrl은 필수입니다.' });
    }

    const result = await creativeApprovalService.submit({
      brandId,
      eventId,
      fileUrl,
      fileName,
      fileType,
      fileSizeBytes,
    });

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 브랜드: 특정 대회의 내 크리에이티브 승인 상태 조회
 * GET /api/brand/creative-approvals/events/:eventId
 */
export const getMyCreativeApproval = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brandId = req.user?.brandId;
    if (!brandId) {
      return res.status(403).json({ error: '브랜드 계정이 필요합니다.' });
    }

    const { eventId } = req.params;
    const result = await creativeApprovalService.getByBrandAndEvent(brandId, eventId);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * 브랜드: 내 모든 크리에이티브 승인 요청 목록
 * GET /api/brand/creative-approvals
 */
export const listMyCreativeApprovals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brandId = req.user?.brandId;
    if (!brandId) {
      return res.status(403).json({ error: '브랜드 계정이 필요합니다.' });
    }

    const result = await creativeApprovalService.listByBrand(brandId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 대회별 크리에이티브 승인 요청 목록
 * GET /api/admin/creative-approvals/events/:eventId
 */
export const listEventCreativeApprovals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { status } = req.query;

    const result = await creativeApprovalService.listByEvent(eventId, status as string);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 전체 크리에이티브 승인 요청 목록
 * GET /api/admin/creative-approvals
 */
export const listAllCreativeApprovals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, eventId, brandId, skip, take } = req.query;

    const result = await creativeApprovalService.listAll({
      status: status as string,
      eventId: eventId as string,
      brandId: brandId as string,
      skip: skip ? parseInt(skip as string) : undefined,
      take: take ? parseInt(take as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 크리에이티브 승인 통계
 * GET /api/admin/creative-approvals/stats
 */
export const getCreativeApprovalStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.query;
    const result = await creativeApprovalService.getStats(eventId as string);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 검토 시작
 * POST /api/admin/creative-approvals/:id/start-review
 */
export const startReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user?.id;

    if (!adminUserId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const result = await creativeApprovalService.startReview(id, adminUserId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 크리에이티브 승인
 * POST /api/admin/creative-approvals/:id/approve
 */
export const approveCreativeApproval = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;
    const adminUserId = req.user?.id;

    if (!adminUserId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const result = await creativeApprovalService.approve(id, adminUserId, reviewNotes);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: 크리에이티브 거부
 * POST /api/admin/creative-approvals/:id/reject
 */
export const rejectCreativeApproval = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;
    const adminUserId = req.user?.id;

    if (!adminUserId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    if (!reviewNotes || reviewNotes.length < 10) {
      return res.status(400).json({ error: '거부 사유는 최소 10자 이상 입력해주세요.' });
    }

    const result = await creativeApprovalService.reject(id, adminUserId, reviewNotes);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

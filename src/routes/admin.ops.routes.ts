/**
 * ★ Phase 9-3: Admin Operations Routes
 * 운영자 강제 처리 API - 예약 해제, 경매 강제 종료
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { opsService } from '../services/ops.service';
import { logAudit } from '../lib/logger';
import rateLimit from 'express-rate-limit';

const router = Router();

// 모든 라우트에 ADMIN 인증 필요
router.use(authenticate, authorize('ADMIN'));

// WRITE 액션용 Rate Limiter (분당 10회)
const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many write actions. Please wait.' } },
  keyGenerator: (req) => (req as any).user?.id || req.ip,
});

// 확인 텍스트 검증 헬퍼
function validateConfirmText(expected: string, actual: string): boolean {
  return expected.toUpperCase() === actual.toUpperCase();
}

// AdminActionLog 저장 헬퍼
async function saveActionLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  requestBody: any,
  result: any,
  reason: string,
  idempotencyKey?: string,
  ipAddress?: string
) {
  return prisma.adminActionLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      idempotencyKey,
      requestBody,
      result,
      reason,
      ipAddress,
    },
  });
}

// Idempotency Key 체크
async function checkIdempotency(
  idempotencyKey: string | undefined,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string
): Promise<{ alreadyProcessed: boolean; existingResult?: any }> {
  if (!idempotencyKey) return { alreadyProcessed: false };

  const existing = await prisma.adminActionLog.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return { alreadyProcessed: true, existingResult: existing.result };
  }

  return { alreadyProcessed: false };
}

// =========================================
// GET /admin/ops/contracts/:id - 계약 조회 (Ops용)
// =========================================
router.get('/contracts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const contract = await opsService.getContractForOps(id);
    sendSuccess(res, contract);
  } catch (error) {
    next(error);
  }
});

// =========================================
// POST /admin/ops/contracts/:id/release-reservation
// 예약 강제 해제
// =========================================
router.post('/contracts/:id/release-reservation', writeRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason, confirmText } = req.body;
    const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] as string;
    const user = (req as any).user;
    const actorId = user?.id;

    // 1. 기본 검증
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REASON', message: 'Reason must be at least 10 characters' },
      });
    }

    if (!confirmText) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIRM_REQUIRED', message: 'Confirmation text is required' },
      });
    }

    // 2. confirmText 검증: "RELEASE" 또는 contractId 마지막 6자리
    const validConfirms = ['RELEASE', id.slice(-6).toUpperCase()];
    if (!validConfirms.some(v => validateConfirmText(v, confirmText))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFIRM_MISMATCH',
          message: `Confirmation text must be "RELEASE" or "${id.slice(-6).toUpperCase()}"`,
        },
      });
    }

    // 3. 멱등성 체크
    const idempCheck = await checkIdempotency(idempotencyKey, actorId, 'RELEASE_RESERVATION', 'CONTRACT', id);
    if (idempCheck.alreadyProcessed) {
      return sendSuccess(res, { ok: true, alreadyProcessed: true, ...idempCheck.existingResult });
    }

    // 4. 예약 해제 실행
    const result = await opsService.releaseReservation(id, actorId, reason);

    // 5. AuditLog 기록
    logAudit('RELEASE_RESERVATION', {
      contractId: id,
      reason,
      idempotencyKey,
    }, {
      requestId: (req as any).requestId,
      userId: actorId,
      userRole: 'ADMIN',
    });

    // 6. AdminActionLog 저장
    await saveActionLog(
      actorId,
      'RELEASE_RESERVATION',
      'CONTRACT',
      id,
      { reason, confirmText },
      { ok: true, alreadyProcessed: result.alreadyProcessed },
      reason,
      idempotencyKey,
      req.ip || undefined
    );

    sendSuccess(res, {
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      contract: result.contract,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================
// GET /admin/ops/auctions/:id - 경매 조회 (Ops용)
// =========================================
router.get('/auctions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const auction = await opsService.getAuctionForOps(id);
    sendSuccess(res, auction);
  } catch (error) {
    next(error);
  }
});

// =========================================
// POST /admin/ops/auctions/:id/force-close
// 경매 강제 종료
// =========================================
router.post('/auctions/:id/force-close', writeRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason, confirmText } = req.body;
    const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] as string;
    const user = (req as any).user;
    const actorId = user?.id;

    // 1. 기본 검증
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REASON', message: 'Reason must be at least 10 characters' },
      });
    }

    if (!confirmText) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIRM_REQUIRED', message: 'Confirmation text is required' },
      });
    }

    // 2. confirmText 검증: "CLOSE" 또는 auctionId 마지막 6자리
    const validConfirms = ['CLOSE', id.slice(-6).toUpperCase()];
    if (!validConfirms.some(v => validateConfirmText(v, confirmText))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFIRM_MISMATCH',
          message: `Confirmation text must be "CLOSE" or "${id.slice(-6).toUpperCase()}"`,
        },
      });
    }

    // 3. 멱등성 체크
    const idempCheck = await checkIdempotency(idempotencyKey, actorId, 'FORCE_CLOSE_AUCTION', 'AUCTION', id);
    if (idempCheck.alreadyProcessed) {
      return sendSuccess(res, { ok: true, alreadyProcessed: true, ...idempCheck.existingResult });
    }

    // 4. 경매 강제 종료 실행
    const result = await opsService.forceCloseAuction(id, actorId, reason);

    // 5. AuditLog 기록
    logAudit('FORCE_CLOSE_AUCTION', {
      auctionId: id,
      finalStatus: result.auction?.status,
      reason,
      idempotencyKey,
    }, {
      requestId: (req as any).requestId,
      userId: actorId,
      userRole: 'ADMIN',
    });

    // 6. AdminActionLog 저장
    await saveActionLog(
      actorId,
      'FORCE_CLOSE_AUCTION',
      'AUCTION',
      id,
      { reason, confirmText },
      { ok: true, alreadyProcessed: result.alreadyProcessed, finalStatus: result.auction?.status },
      reason,
      idempotencyKey,
      req.ip || undefined
    );

    sendSuccess(res, {
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      auction: result.auction,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

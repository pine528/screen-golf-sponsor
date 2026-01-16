/**
 * Admin Finance Routes
 * 관리자 재무 콘솔 API - 읽기 + 쓰기(WRITE) 액션
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/response';
import { Prisma } from '@prisma/client';
import { escrowService } from '../services/escrow.service';
import { notificationService } from '../services/notification.service';
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

// Idempotency Key 체크 & 저장 헬퍼
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

/**
 * CSV 이스케이프 헬퍼
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: any[]): string {
  return fields.map(escapeCsvField).join(',');
}

// =========================================
// A) GET /admin/finance/escrows - 에스크로 목록
// =========================================
router.get('/escrows', async (req: Request, res: Response) => {
  const {
    status,
    q,
    from,
    to,
    page = '1',
    pageSize = '20',
    sort = 'createdAt',
    order = 'desc',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limit = Math.min(parseInt(pageSize as string, 10), 100);
  const skip = (pageNum - 1) * limit;

  // Where 조건 구성
  const where: Prisma.EscrowWhereInput = {};

  if (status) {
    where.status = status as any;
  }

  if (q) {
    const searchTerm = q as string;
    where.OR = [
      { contractId: { contains: searchTerm } },
      { brandId: { contains: searchTerm } },
      { contract: { athleteId: { contains: searchTerm } } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  // 정렬
  const orderBy: any = {};
  const sortField = ['createdAt', 'grossAmount', 'status'].includes(sort as string) ? sort : 'createdAt';
  orderBy[sortField as string] = order === 'asc' ? 'asc' : 'desc';

  const [escrows, total] = await Promise.all([
    prisma.escrow.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            brand: {
              select: { id: true, name: true },
            },
            athlete: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.escrow.count({ where }),
  ]);

  sendPaginated(res, escrows, pageNum, limit, total);
});

// =========================================
// G) GET /admin/finance/escrows.csv - CSV 내보내기
// =========================================
router.get('/escrows.csv', async (req: Request, res: Response) => {
  const { status, q, from, to } = req.query;

  const where: Prisma.EscrowWhereInput = {};

  if (status) where.status = status as any;

  if (q) {
    const searchTerm = q as string;
    where.OR = [
      { contractId: { contains: searchTerm } },
      { brandId: { contains: searchTerm } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  const escrows = await prisma.escrow.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000, // 최대 1만건
    include: {
      contract: {
        select: {
          brand: { select: { name: true } },
          athlete: { select: { name: true } },
        },
      },
    },
  });

  // CSV 헤더
  const headers = [
    'ID', 'Contract ID', 'Status', 'Brand ID', 'Brand Name',
    'Athlete Name', 'Gross Amount', 'Platform Fee', 'Platform Fee Rate',
    'Athlete Payout', 'Created At', 'Released At', 'Refunded At', 'Refund Reason',
  ];

  const rows = escrows.map(e => toCsvRow([
    e.id,
    e.contractId,
    e.status,
    e.brandId,
    e.contract?.brand?.name || '',
    e.contract?.athlete?.name || '',
    e.grossAmount.toString(),
    e.platformFee.toString(),
    e.platformFeeRate.toString(),
    e.athletePayout.toString(),
    e.createdAt.toISOString(),
    e.releasedAt?.toISOString() || '',
    e.refundedAt?.toISOString() || '',
    e.refundReason || '',
  ]));

  const csv = [toCsvRow(headers), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=escrows_${new Date().toISOString().slice(0, 10)}.csv`);
  // BOM for Excel UTF-8
  res.send('\uFEFF' + csv);
});

// =========================================
// B) GET /admin/finance/escrows/:id - 에스크로 상세
// =========================================
router.get('/escrows/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      contract: {
        select: {
          id: true,
          status: true,
          priceFinal: true,
          createdAt: true,
          signedAt: true,
          brand: {
            select: { id: true, name: true, category: true },
          },
          athlete: {
            select: { id: true, name: true, tour: true },
          },
          verification: {
            select: { id: true, status: true, verifiedAt: true },
          },
        },
      },
    },
  });

  if (!escrow) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Escrow not found' },
    });
  }

  // 관련 LedgerTx 조회
  const brandWallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: 'BRAND', ownerId: escrow.brandId } },
  });

  const relatedLedgerTx = brandWallet
    ? await prisma.ledgerTx.findMany({
        where: {
          refId: escrow.id,
          refType: { in: ['ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'ESCROW_FEE'] },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          walletId: true,
          type: true,
          refType: true,
          amount: true,
          createdAt: true,
        },
      })
    : [];

  sendSuccess(res, {
    escrow,
    relatedLedgerTx,
  });
});

// =========================================
// C) GET /admin/finance/wallets - 지갑 목록
// =========================================
router.get('/wallets', async (req: Request, res: Response) => {
  const {
    ownerType,
    q,
    page = '1',
    pageSize = '20',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limit = Math.min(parseInt(pageSize as string, 10), 100);
  const skip = (pageNum - 1) * limit;

  const where: Prisma.WalletWhereInput = {};

  if (ownerType) {
    where.ownerType = ownerType as any;
  }

  if (q) {
    where.ownerId = { contains: q as string };
  }

  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        athlete: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.wallet.count({ where }),
  ]);

  sendPaginated(res, wallets, pageNum, limit, total);
});

// =========================================
// D) GET /admin/finance/wallets/:id/ledger - 원장 조회
// =========================================
router.get('/wallets/:id/ledger', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    type,
    refType,
    refId,
    page = '1',
    pageSize = '20',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limit = Math.min(parseInt(pageSize as string, 10), 100);
  const skip = (pageNum - 1) * limit;

  const where: Prisma.LedgerTxWhereInput = { walletId: id };

  if (type) where.type = type as any;
  if (refType) where.refType = refType as string;
  if (refId) where.refId = refId as string;

  const [transactions, total, wallet] = await Promise.all([
    prisma.ledgerTx.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ledgerTx.count({ where }),
    prisma.wallet.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        athlete: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Wallet not found' },
    });
  }

  sendSuccess(res, {
    wallet,
    transactions,
    pagination: {
      page: pageNum,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// =========================================
// H) GET /admin/finance/wallets/:id/ledger.csv - 원장 CSV
// =========================================
router.get('/wallets/:id/ledger.csv', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, refType, refId } = req.query;

  const where: Prisma.LedgerTxWhereInput = { walletId: id };

  if (type) where.type = type as any;
  if (refType) where.refType = refType as string;
  if (refId) where.refId = refId as string;

  const [transactions, wallet] = await Promise.all([
    prisma.ledgerTx.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    }),
    prisma.wallet.findUnique({ where: { id } }),
  ]);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Wallet not found' },
    });
  }

  const headers = [
    'ID', 'Type', 'Amount', 'Balance After', 'Ref Type', 'Ref ID', 'Description', 'Created At',
  ];

  const rows = transactions.map(tx => toCsvRow([
    tx.id,
    tx.type,
    tx.amount.toString(),
    tx.balanceAfter.toString(),
    tx.refType || '',
    tx.refId || '',
    tx.description || '',
    tx.createdAt.toISOString(),
  ]));

  const csv = [toCsvRow(headers), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=ledger_${wallet.ownerType}_${wallet.ownerId}_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send('\uFEFF' + csv);
});

// =========================================
// E) GET /admin/finance/payout-batches - 정산 배치 목록
// =========================================
router.get('/payout-batches', async (req: Request, res: Response) => {
  const {
    status,
    page = '1',
    pageSize = '20',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limit = Math.min(parseInt(pageSize as string, 10), 100);
  const skip = (pageNum - 1) * limit;

  const where: Prisma.PayoutBatchWhereInput = {};
  if (status) where.status = status as any;

  const [batches, total] = await Promise.all([
    prisma.payoutBatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.payoutBatch.count({ where }),
  ]);

  // 각 배치의 총액 계산
  const batchesWithTotals = await Promise.all(
    batches.map(async (batch) => {
      const totals = await prisma.payoutItem.aggregate({
        where: { batchId: batch.id },
        _sum: { amount: true },
        _count: true,
      });
      return {
        ...batch,
        itemCount: totals._count,
        totalAmount: totals._sum.amount?.toString() || '0',
      };
    })
  );

  sendPaginated(res, batchesWithTotals, pageNum, limit, total);
});

// =========================================
// F) GET /admin/finance/payout-batches/:id - 배치 상세
// =========================================
router.get('/payout-batches/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const batch = await prisma.payoutBatch.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          escrow: {
            select: {
              id: true,
              contractId: true,
              athletePayout: true,
              status: true,
            },
          },
          athlete: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!batch) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Payout batch not found' },
    });
  }

  // 총액 계산
  const totals = await prisma.payoutItem.aggregate({
    where: { batchId: id },
    _sum: { amount: true },
  });

  sendSuccess(res, {
    batch,
    totalAmount: totals._sum.amount?.toString() || '0',
  });
});

// =========================================
// 대시보드 요약 (선택적)
// =========================================
router.get('/summary', async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    escrowStats,
    todayEscrows,
    pendingPayouts,
    walletTotals,
  ] = await Promise.all([
    // 전체 에스크로 상태별 통계
    prisma.escrow.groupBy({
      by: ['status'],
      _count: true,
      _sum: { grossAmount: true },
    }),
    // 오늘 생성된 에스크로
    prisma.escrow.count({
      where: { createdAt: { gte: today } },
    }),
    // 대기 중인 정산
    prisma.payoutBatch.count({
      where: { status: 'PENDING' },
    }),
    // 지갑 유형별 총액
    prisma.wallet.groupBy({
      by: ['ownerType'],
      _sum: { balance: true, frozenAmount: true },
      _count: true,
    }),
  ]);

  // 오늘 수동 처리 건수 추가
  const todayManualActions = await prisma.adminActionLog.count({
    where: {
      createdAt: { gte: today },
      action: { in: ['ESCROW_RELEASE_MANUAL', 'ESCROW_REFUND_MANUAL', 'CONTRACT_CANCEL_MANUAL'] },
    },
  });

  sendSuccess(res, {
    escrows: {
      byStatus: escrowStats.map(s => ({
        status: s.status,
        count: s._count,
        totalAmount: s._sum.grossAmount?.toString() || '0',
      })),
      todayCount: todayEscrows,
    },
    payouts: {
      pendingBatches: pendingPayouts,
    },
    wallets: walletTotals.map(w => ({
      ownerType: w.ownerType,
      count: w._count,
      totalBalance: w._sum.balance?.toString() || '0',
      totalFrozen: w._sum.frozenAmount?.toString() || '0',
    })),
    manualActions: {
      todayCount: todayManualActions,
    },
  });
});

// =========================================
// =========================================
// WRITE ACTIONS (운영자 액션)
// =========================================
// =========================================

/**
 * POST /admin/finance/escrows/:id/release
 * 에스크로 강제 릴리즈 (선수 지급)
 */
router.post('/escrows/:id/release', writeRateLimiter, async (req: Request, res: Response) => {
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

  // 2. 에스크로 조회
  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          brand: { select: { id: true, name: true, userId: true } },
          athlete: { select: { id: true, name: true, userId: true } },
        },
      },
    },
  });

  if (!escrow) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Escrow not found' },
    });
  }

  // 3. confirmText 검증: "RELEASE" 또는 escrowId 마지막 6자리
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

  // 4. 멱등성 체크
  const idempCheck = await checkIdempotency(idempotencyKey, actorId, 'ESCROW_RELEASE_MANUAL', 'ESCROW', id);
  if (idempCheck.alreadyProcessed) {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, ...idempCheck.existingResult });
  }

  // 5. 이미 처리된 상태 체크
  if (escrow.status === 'RELEASED') {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, escrow });
  }

  if (escrow.status !== 'HELD') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: `Cannot release escrow with status: ${escrow.status}` },
    });
  }

  // 6. 릴리즈 실행
  try {
    const result = await escrowService.releaseToAthlete(escrow.contractId);

    // 7. AuditLog 기록
    logAudit('ESCROW_RELEASE_MANUAL', {
      escrowId: id,
      contractId: escrow.contractId,
      grossAmount: escrow.grossAmount.toString(),
      athletePayout: escrow.athletePayout.toString(),
      platformFee: escrow.platformFee.toString(),
      reason,
      idempotencyKey,
    }, {
      requestId: req.requestId,
      userId: actorId,
      userRole: 'ADMIN',
    });

    // 8. AdminActionLog 저장
    await saveActionLog(
      actorId,
      'ESCROW_RELEASE_MANUAL',
      'ESCROW',
      id,
      { reason, confirmText },
      { ok: true, alreadyProcessed: result.alreadyProcessed },
      reason,
      idempotencyKey,
      req.ip
    );

    // 9. Notifications
    if (!result.alreadyProcessed) {
      // 브랜드에게 알림
      if (escrow.contract?.brand?.userId) {
        await notificationService.create({
          userId: escrow.contract.brand.userId,
          type: 'SETTLEMENT_COMPLETED',
          title: '정산 처리 완료',
          message: `계약 ${escrow.contractId}의 정산이 운영자에 의해 처리되었습니다. 사유: ${reason}`,
          data: { contractId: escrow.contractId, escrowId: id, action: 'RELEASE' },
        });
      }

      // 선수에게 알림
      if (escrow.contract?.athlete?.userId) {
        await notificationService.create({
          userId: escrow.contract.athlete.userId,
          type: 'SETTLEMENT_COMPLETED',
          title: '정산금 지급 완료',
          message: `계약 ${escrow.contractId}의 정산금이 지급되었습니다. 금액: ${escrow.athletePayout.toString()}원`,
          data: { contractId: escrow.contractId, escrowId: id, action: 'RELEASE', amount: escrow.athletePayout.toString() },
        });
      }
    }

    sendSuccess(res, { ok: true, alreadyProcessed: result.alreadyProcessed, escrow: result.data });
  } catch (error: any) {
    console.error('[AdminFinance] Release error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'RELEASE_FAILED', message: error.message || 'Release failed' },
    });
  }
});

/**
 * POST /admin/finance/escrows/:id/refund
 * 에스크로 강제 환불 (브랜드 환불)
 */
router.post('/escrows/:id/refund', writeRateLimiter, async (req: Request, res: Response) => {
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

  // 2. 에스크로 조회
  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          brand: { select: { id: true, name: true, userId: true } },
          athlete: { select: { id: true, name: true, userId: true } },
        },
      },
    },
  });

  if (!escrow) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Escrow not found' },
    });
  }

  // 3. confirmText 검증: "REFUND" 또는 escrowId 마지막 6자리
  const validConfirms = ['REFUND', id.slice(-6).toUpperCase()];
  if (!validConfirms.some(v => validateConfirmText(v, confirmText))) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CONFIRM_MISMATCH',
        message: `Confirmation text must be "REFUND" or "${id.slice(-6).toUpperCase()}"`,
      },
    });
  }

  // 4. 멱등성 체크
  const idempCheck = await checkIdempotency(idempotencyKey, actorId, 'ESCROW_REFUND_MANUAL', 'ESCROW', id);
  if (idempCheck.alreadyProcessed) {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, ...idempCheck.existingResult });
  }

  // 5. 이미 처리된 상태 체크
  if (escrow.status === 'REFUNDED') {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, escrow });
  }

  if (escrow.status !== 'HELD') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: `Cannot refund escrow with status: ${escrow.status}` },
    });
  }

  // 6. 환불 실행
  try {
    const result = await escrowService.refundToBrand(escrow.contractId, `[운영자 환불] ${reason}`);

    // 7. AuditLog 기록
    logAudit('ESCROW_REFUND_MANUAL', {
      escrowId: id,
      contractId: escrow.contractId,
      grossAmount: escrow.grossAmount.toString(),
      reason,
      idempotencyKey,
    }, {
      requestId: req.requestId,
      userId: actorId,
      userRole: 'ADMIN',
    });

    // 8. AdminActionLog 저장
    await saveActionLog(
      actorId,
      'ESCROW_REFUND_MANUAL',
      'ESCROW',
      id,
      { reason, confirmText },
      { ok: true, alreadyProcessed: result.alreadyProcessed },
      reason,
      idempotencyKey,
      req.ip
    );

    // 9. Notifications
    if (!result.alreadyProcessed) {
      // 브랜드에게 알림
      if (escrow.contract?.brand?.userId) {
        await notificationService.create({
          userId: escrow.contract.brand.userId,
          type: 'SETTLEMENT_COMPLETED',
          title: '환불 처리 완료',
          message: `계약 ${escrow.contractId}의 결제금이 환불되었습니다. 금액: ${escrow.grossAmount.toString()}원. 사유: ${reason}`,
          data: { contractId: escrow.contractId, escrowId: id, action: 'REFUND', amount: escrow.grossAmount.toString() },
        });
      }

      // 선수에게 알림
      if (escrow.contract?.athlete?.userId) {
        await notificationService.create({
          userId: escrow.contract.athlete.userId,
          type: 'SETTLEMENT_COMPLETED',
          title: '계약 환불 안내',
          message: `계약 ${escrow.contractId}이(가) 환불 처리되었습니다. 사유: ${reason}`,
          data: { contractId: escrow.contractId, escrowId: id, action: 'REFUND' },
        });
      }
    }

    sendSuccess(res, { ok: true, alreadyProcessed: result.alreadyProcessed, escrow: result.data });
  } catch (error: any) {
    console.error('[AdminFinance] Refund error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'REFUND_FAILED', message: error.message || 'Refund failed' },
    });
  }
});

/**
 * POST /admin/finance/contracts/:id/cancel
 * 계약 강제 취소 (에스크로 있으면 환불 포함)
 */
router.post('/contracts/:id/cancel', writeRateLimiter, async (req: Request, res: Response) => {
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

  // 2. 계약 조회
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, userId: true } },
      athlete: { select: { id: true, name: true, userId: true } },
    },
  });

  if (!contract) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Contract not found' },
    });
  }

  // 3. confirmText 검증: "CANCEL" 또는 contractId 마지막 6자리
  const validConfirms = ['CANCEL', id.slice(-6).toUpperCase()];
  if (!validConfirms.some(v => validateConfirmText(v, confirmText))) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CONFIRM_MISMATCH',
        message: `Confirmation text must be "CANCEL" or "${id.slice(-6).toUpperCase()}"`,
      },
    });
  }

  // 4. 멱등성 체크
  const idempCheck = await checkIdempotency(idempotencyKey, actorId, 'CONTRACT_CANCEL_MANUAL', 'CONTRACT', id);
  if (idempCheck.alreadyProcessed) {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, ...idempCheck.existingResult });
  }

  // 5. 이미 취소/완료 상태 체크
  if (contract.status === 'CANCELLED') {
    return sendSuccess(res, { ok: true, alreadyProcessed: true, contract });
  }

  if (contract.status === 'COMPLETED') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Cannot cancel completed contract' },
    });
  }

  // 6. 취소 처리
  try {
    // 계약 취소
    const updatedContract = await prisma.contract.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        terms: {
          ...(contract.terms as object || {}),
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'ADMIN',
          cancelReason: reason,
        },
      },
    });

    // HELD 에스크로가 있으면 환불
    const escrow = await prisma.escrow.findUnique({
      where: { contractId: id },
    });

    let escrowRefundResult = null;
    if (escrow && escrow.status === 'HELD') {
      escrowRefundResult = await escrowService.refundToBrand(id, `[계약 강제 취소] ${reason}`);
    }

    // 7. AuditLog 기록
    logAudit('CONTRACT_CANCEL_MANUAL', {
      contractId: id,
      previousStatus: contract.status,
      escrowId: escrow?.id,
      escrowRefunded: escrowRefundResult ? !escrowRefundResult.alreadyProcessed : false,
      reason,
      idempotencyKey,
    }, {
      requestId: req.requestId,
      userId: actorId,
      userRole: 'ADMIN',
    });

    // 8. AdminActionLog 저장
    await saveActionLog(
      actorId,
      'CONTRACT_CANCEL_MANUAL',
      'CONTRACT',
      id,
      { reason, confirmText },
      {
        ok: true,
        alreadyProcessed: false,
        escrowRefunded: escrowRefundResult ? !escrowRefundResult.alreadyProcessed : null,
      },
      reason,
      idempotencyKey,
      req.ip
    );

    // 9. Notifications
    // 브랜드에게 알림
    if (contract.brand?.userId) {
      await notificationService.create({
        userId: contract.brand.userId,
        type: 'CONTRACT_CREATED', // 적절한 타입이 없어서 재사용
        title: '계약 취소 안내',
        message: `계약 ${id}이(가) 운영자에 의해 취소되었습니다. 사유: ${reason}${escrowRefundResult && !escrowRefundResult.alreadyProcessed ? '. 결제금이 환불되었습니다.' : ''}`,
        data: { contractId: id, action: 'CANCEL' },
      });
    }

    // 선수에게 알림
    if (contract.athlete?.userId) {
      await notificationService.create({
        userId: contract.athlete.userId,
        type: 'CONTRACT_CREATED',
        title: '계약 취소 안내',
        message: `계약 ${id}이(가) 운영자에 의해 취소되었습니다. 사유: ${reason}`,
        data: { contractId: id, action: 'CANCEL' },
      });
    }

    sendSuccess(res, {
      ok: true,
      alreadyProcessed: false,
      contract: updatedContract,
      escrowRefunded: escrowRefundResult ? !escrowRefundResult.alreadyProcessed : null,
    });
  } catch (error: any) {
    console.error('[AdminFinance] Contract cancel error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CANCEL_FAILED', message: error.message || 'Cancel failed' },
    });
  }
});

/**
 * GET /admin/finance/action-logs
 * 운영자 액션 로그 조회
 */
router.get('/action-logs', async (req: Request, res: Response) => {
  const {
    action,
    targetType,
    page = '1',
    pageSize = '20',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limit = Math.min(parseInt(pageSize as string, 10), 100);
  const skip = (pageNum - 1) * limit;

  const where: Prisma.AdminActionLogWhereInput = {};
  if (action) where.action = action as string;
  if (targetType) where.targetType = targetType as string;

  const [logs, total] = await Promise.all([
    prisma.adminActionLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.adminActionLog.count({ where }),
  ]);

  sendPaginated(res, logs, pageNum, limit, total);
});

export default router;

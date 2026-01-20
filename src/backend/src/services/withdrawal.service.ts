import { Prisma, WithdrawalStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';
import { notificationService } from './notification.service';
import { encryptAccountNumber } from '../utils/crypto';

// Decimal 변환 헬퍼
const toDecimal = (value: number | string | Prisma.Decimal): Prisma.Decimal => {
  return new Prisma.Decimal(value.toString());
};

const toNumber = (value: Prisma.Decimal | number | null): number => {
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

// 계좌번호 마스킹 함수
const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber || accountNumber.length < 4) {
    return '****';
  }
  const visibleEnd = accountNumber.slice(-4);
  const maskedPart = '*'.repeat(Math.max(0, accountNumber.length - 4));
  return maskedPart + visibleEnd;
};

export interface IdempotentResult<T> {
  data: T;
  alreadyProcessed: boolean;
}

export class WithdrawalService {
  /**
   * 출금 요청 생성 (선수용)
   * 멱등성: idempotencyKey unique + P2002 처리
   */
  async createRequest(
    athleteId: string,
    userId: string,
    data: {
      amount: number;
      bankName: string;
      bankAccountNumber: string;
      accountHolder: string;
      reason?: string;
      idempotencyKey?: string;
    }
  ): Promise<IdempotentResult<any>> {
    const { amount, bankName, bankAccountNumber, accountHolder, reason, idempotencyKey } = data;

    // 1. 기본 검증
    if (amount <= 0) {
      throw new BadRequestError('출금 금액은 0보다 커야 합니다');
    }

    // 2. 멱등성 체크 (idempotencyKey로 기존 요청 조회)
    if (idempotencyKey) {
      const existing = await prisma.withdrawalRequest.findUnique({
        where: { idempotencyKey },
        include: { wallet: true, athlete: true },
      });

      if (existing) {
        return { data: existing, alreadyProcessed: true };
      }
    }

    // 3. 선수 지갑 조회
    const wallet = await prisma.wallet.findFirst({
      where: {
        ownerType: 'ATHLETE',
        ownerId: athleteId,
      },
    });

    if (!wallet) {
      throw new NotFoundError('지갑을 찾을 수 없습니다');
    }

    // 4. 가용 잔액 검증
    const balance = toNumber(wallet.balance);
    const frozenAmount = toNumber(wallet.frozenAmount);
    const available = balance - frozenAmount;

    if (amount > available) {
      throw new BadRequestError(`출금 가능 금액을 초과했습니다. 가용 잔액: ${available}원`);
    }

    // 5. 계좌번호 암호화 + 마스킹
    // 암호화 키가 설정되어 있으면 암호화, 없으면 마스킹만
    let bankAccountMasked: string;
    let bankAccountEncrypted: string | null = null;
    let bankAccountIv: string | null = null;
    let bankAccountTag: string | null = null;
    let bankAccountLast4: string | null = null;

    try {
      const encryptedData = encryptAccountNumber(bankAccountNumber);
      bankAccountMasked = encryptedData.masked;
      bankAccountEncrypted = encryptedData.encrypted;
      bankAccountIv = encryptedData.iv;
      bankAccountTag = encryptedData.tag;
      bankAccountLast4 = encryptedData.last4;
    } catch (error: any) {
      // 암호화 실패 시 (키 없음 등) 마스킹만 적용
      console.warn(`[Withdrawal] 계좌 암호화 실패, 마스킹만 적용: ${error.message}`);
      bankAccountMasked = maskAccountNumber(bankAccountNumber);
      bankAccountLast4 = bankAccountNumber.slice(-4);
    }

    // 6. 트랜잭션: frozenAmount 증가 + 요청 생성
    try {
      const request = await prisma.$transaction(async (tx) => {
        // 6-1. 낙관적 락으로 지갑 업데이트 (frozenAmount 증가)
        const updated = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            version: wallet.version,
          },
          data: {
            frozenAmount: { increment: amount },
            version: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          throw new ConflictError('지갑 업데이트 중 충돌이 발생했습니다. 다시 시도해주세요');
        }

        // 6-2. 출금 요청 생성 (암호화된 계좌 정보 포함)
        const newRequest = await tx.withdrawalRequest.create({
          data: {
            walletId: wallet.id,
            athleteId,
            amount: toDecimal(amount),
            status: 'REQUESTED',
            bankName,
            bankAccountMasked,
            bankAccountEncrypted,
            bankAccountIv,
            bankAccountTag,
            bankAccountLast4,
            accountHolder,
            requestedReason: reason,
            idempotencyKey,
          },
          include: { wallet: true, athlete: true },
        });

        return newRequest;
      });

      // 7. 관리자에게 알림 (트랜잭션 외부)
      // 관리자 목록 조회하여 알림 전송
      const admins = await prisma.admin.findMany({
        include: { user: true },
      });

      for (const admin of admins) {
        await notificationService.create({
          userId: admin.userId,
          type: 'ADMIN_ALERT',
          title: '새 출금 요청',
          message: `선수 출금 요청: ${amount.toLocaleString()}원`,
          data: { withdrawalId: request.id, athleteId },
        });
      }

      return { data: request, alreadyProcessed: false };
    } catch (error: any) {
      // P2002: idempotencyKey 중복
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        const existing = await prisma.withdrawalRequest.findUnique({
          where: { idempotencyKey: idempotencyKey! },
          include: { wallet: true, athlete: true },
        });

        return { data: existing, alreadyProcessed: true };
      }

      throw error;
    }
  }

  /**
   * 출금 요청 조회
   */
  async getById(id: string) {
    const request = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        wallet: true,
        athlete: {
          include: { user: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('출금 요청을 찾을 수 없습니다');
    }

    return request;
  }

  /**
   * 선수의 출금 요청 목록
   */
  async getByAthlete(
    athleteId: string,
    options: { status?: WithdrawalStatus; page?: number; pageSize?: number } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WithdrawalRequestWhereInput = {
      athleteId,
      ...(options.status && { status: options.status }),
    };

    const [requests, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 선수의 출금 가능 잔액 조회
   */
  async getAvailableBalance(athleteId: string) {
    const wallet = await prisma.wallet.findFirst({
      where: {
        ownerType: 'ATHLETE',
        ownerId: athleteId,
      },
    });

    if (!wallet) {
      return { balance: 0, frozenAmount: 0, available: 0 };
    }

    const balance = toNumber(wallet.balance);
    const frozenAmount = toNumber(wallet.frozenAmount);

    return {
      balance,
      frozenAmount,
      available: balance - frozenAmount,
    };
  }

  /**
   * 관리자: 출금 요청 목록
   */
  async adminList(options: {
    status?: WithdrawalStatus;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WithdrawalRequestWhereInput = {
      ...(options.status && { status: options.status }),
      ...(options.q && {
        OR: [
          { athlete: { name: { contains: options.q, mode: 'insensitive' } } },
          { bankName: { contains: options.q, mode: 'insensitive' } },
          { accountHolder: { contains: options.q, mode: 'insensitive' } },
        ],
      }),
      ...((options.from || options.to) && {
        createdAt: {
          ...(options.from && { gte: new Date(options.from) }),
          ...(options.to && { lte: new Date(options.to) }),
        },
      }),
    };

    const [requests, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          athlete: {
            include: { user: true },
          },
          wallet: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 관리자: 출금 승인
   * REQUESTED → APPROVED
   */
  async adminApprove(
    withdrawalId: string,
    adminId: string,
    note?: string
  ): Promise<IdempotentResult<any>> {
    const request = await this.getById(withdrawalId);

    // 이미 APPROVED면 멱등성 반환
    if (request.status === 'APPROVED') {
      return { data: request, alreadyProcessed: true };
    }

    // REQUESTED가 아니면 에러
    if (request.status !== 'REQUESTED') {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 승인할 수 없습니다`);
    }

    // 조건부 업데이트 (상태 기반 멱등성)
    const updateResult = await prisma.withdrawalRequest.updateMany({
      where: {
        id: withdrawalId,
        status: 'REQUESTED',
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByAdminId: adminId,
        processedBy: adminId,
        ...(note && { adminNote: note }),
      },
    });

    if (updateResult.count === 0) {
      // 다른 요청이 먼저 처리
      const current = await this.getById(withdrawalId);
      return { data: current, alreadyProcessed: true };
    }

    // 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_APPROVE',
        entityType: 'WITHDRAWAL_REQUEST',
        entityId: withdrawalId,
        newValue: { status: 'APPROVED', note },
      },
    });

    // 선수에게 알림
    const athlete = await prisma.athlete.findUnique({
      where: { id: request.athleteId },
    });

    if (athlete) {
      await notificationService.create({
        userId: athlete.userId,
        type: 'WITHDRAWAL_APPROVED',
        title: '출금 요청 승인',
        message: `${toNumber(request.amount).toLocaleString()}원 출금 요청이 승인되었습니다. 곧 입금될 예정입니다.`,
        data: { withdrawalId },
      });
    }

    const updated = await this.getById(withdrawalId);
    return { data: updated, alreadyProcessed: false };
  }

  /**
   * 관리자: 출금 거부
   * REQUESTED → REJECTED + frozenAmount 해제
   */
  async adminReject(
    withdrawalId: string,
    adminId: string,
    reason: string
  ): Promise<IdempotentResult<any>> {
    if (!reason || reason.length < 10) {
      throw new BadRequestError('거부 사유는 10자 이상 입력해주세요');
    }

    const request = await this.getById(withdrawalId);

    // 이미 REJECTED면 멱등성 반환
    if (request.status === 'REJECTED') {
      return { data: request, alreadyProcessed: true };
    }

    // REQUESTED가 아니면 에러
    if (request.status !== 'REQUESTED') {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 거부할 수 없습니다`);
    }

    const amount = toNumber(request.amount);

    // 트랜잭션: 상태 변경 + frozenAmount 해제
    const result = await prisma.$transaction(async (tx) => {
      // 조건부 업데이트
      const updateResult = await tx.withdrawalRequest.updateMany({
        where: {
          id: withdrawalId,
          status: 'REQUESTED',
        },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedByAdminId: adminId,
          processedBy: adminId,
          adminNote: reason,
        },
      });

      if (updateResult.count === 0) {
        return { alreadyProcessed: true };
      }

      // frozenAmount 해제
      const wallet = await tx.wallet.findUnique({
        where: { id: request.walletId },
      });

      if (wallet) {
        await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            version: wallet.version,
          },
          data: {
            frozenAmount: { decrement: amount },
            version: { increment: 1 },
          },
        });
      }

      return { alreadyProcessed: false };
    });

    if (result.alreadyProcessed) {
      const current = await this.getById(withdrawalId);
      return { data: current, alreadyProcessed: true };
    }

    // 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_REJECT',
        entityType: 'WITHDRAWAL_REQUEST',
        entityId: withdrawalId,
        newValue: { status: 'REJECTED', reason },
      },
    });

    // 선수에게 알림
    const athlete = await prisma.athlete.findUnique({
      where: { id: request.athleteId },
    });

    if (athlete) {
      await notificationService.create({
        userId: athlete.userId,
        type: 'WITHDRAWAL_REJECTED',
        title: '출금 요청 거부',
        message: `${amount.toLocaleString()}원 출금 요청이 거부되었습니다. 사유: ${reason}`,
        data: { withdrawalId, reason },
      });
    }

    const updated = await this.getById(withdrawalId);
    return { data: updated, alreadyProcessed: false };
  }

  /**
   * 관리자: 지급 완료 처리
   * APPROVED → PAID + balance 감소 + frozenAmount 감소 + LedgerTx 생성
   */
  async adminMarkPaid(
    withdrawalId: string,
    adminId: string,
    payoutReference: string,
    note?: string,
    proofUrl?: string
  ): Promise<IdempotentResult<any>> {
    if (!payoutReference || payoutReference.trim() === '') {
      throw new BadRequestError('이체 참조번호(증빙)를 입력해주세요');
    }

    const request = await this.getById(withdrawalId);

    // 이미 PAID면 멱등성 반환
    if (request.status === 'PAID') {
      return { data: request, alreadyProcessed: true };
    }

    // APPROVED가 아니면 에러
    if (request.status !== 'APPROVED') {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 지급 완료 처리할 수 없습니다`);
    }

    const amount = toNumber(request.amount);

    // 트랜잭션: 상태 변경 + balance 감소 + frozenAmount 감소 + LedgerTx
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 조건부 업데이트
        const updateResult = await tx.withdrawalRequest.updateMany({
          where: {
            id: withdrawalId,
            status: 'APPROVED',
          },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            payoutReference,
            paidByAdminId: adminId,
            processedBy: adminId,
            ...(note && { adminNote: note }),
            ...(proofUrl && { proofUrl, proofUploadedAt: new Date() }),
          },
        });

        if (updateResult.count === 0) {
          return { alreadyProcessed: true, data: null };
        }

        // 2. 지갑 조회
        const wallet = await tx.wallet.findUnique({
          where: { id: request.walletId },
        });

        if (!wallet) {
          throw new NotFoundError('지갑을 찾을 수 없습니다');
        }

        // 3. 지갑 업데이트 (balance 감소, frozenAmount 감소)
        const newBalance = toDecimal(toNumber(wallet.balance) - amount);
        const newFrozen = toDecimal(toNumber(wallet.frozenAmount) - amount);

        const walletUpdate = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            version: wallet.version,
          },
          data: {
            balance: newBalance,
            frozenAmount: newFrozen,
            version: { increment: 1 },
          },
        });

        if (walletUpdate.count === 0) {
          throw new ConflictError('지갑 업데이트 중 충돌이 발생했습니다');
        }

        // 4. LedgerTx 생성 (유니크 제약으로 중복 방지)
        await tx.ledgerTx.create({
          data: {
            walletId: wallet.id,
            type: 'WITHDRAW',
            amount: toDecimal(-amount), // 음수
            balanceAfter: newBalance,
            status: 'COMPLETED',
            refType: 'WITHDRAWAL',
            refId: withdrawalId,
            description: `출금: ${amount.toLocaleString()}원 (${request.bankName} ${request.bankAccountMasked})`,
          },
        });

        return { alreadyProcessed: false, data: null };
      });

      if (result.alreadyProcessed) {
        const current = await this.getById(withdrawalId);
        return { data: current, alreadyProcessed: true };
      }
    } catch (error: any) {
      // LedgerTx 중복 (유니크 제약)
      if (error.code === 'P2002') {
        const current = await this.getById(withdrawalId);
        return { data: current, alreadyProcessed: true };
      }
      throw error;
    }

    // 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_PAID',
        entityType: 'WITHDRAWAL_REQUEST',
        entityId: withdrawalId,
        newValue: { status: 'PAID', payoutReference, note },
      },
    });

    // 선수에게 알림
    const athlete = await prisma.athlete.findUnique({
      where: { id: request.athleteId },
    });

    if (athlete) {
      await notificationService.create({
        userId: athlete.userId,
        type: 'WITHDRAWAL_PAID',
        title: '출금 지급 완료',
        message: `${amount.toLocaleString()}원이 ${request.bankName} ${request.bankAccountMasked} 계좌로 입금되었습니다.`,
        data: { withdrawalId, payoutReference },
      });
    }

    const updated = await this.getById(withdrawalId);
    return { data: updated, alreadyProcessed: false };
  }

  /**
   * 통계: 상태별 요약
   */
  async getStatusSummary() {
    const [requested, approved, rejected, paid] = await Promise.all([
      prisma.withdrawalRequest.aggregate({
        where: { status: 'REQUESTED' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: 'APPROVED' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: 'REJECTED' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: 'PAID' },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      requested: { count: requested._count, amount: toNumber(requested._sum.amount) },
      approved: { count: approved._count, amount: toNumber(approved._sum.amount) },
      rejected: { count: rejected._count, amount: toNumber(rejected._sum.amount) },
      paid: { count: paid._count, amount: toNumber(paid._sum.amount) },
    };
  }

  /**
   * 메트릭: 오늘 통계 + 대기 건수 + 배치 통계 + 실패 건수
   * KST(한국 표준시) 기준으로 "오늘"을 계산
   */
  async getMetrics() {
    // KST 기준 오늘 00:00:00 계산 (UTC + 9시간)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // 9시간 in milliseconds
    const kstNow = new Date(now.getTime() + kstOffset);
    const kstStartOfDay = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate())
    );
    // UTC로 변환 (KST 00:00:00 = UTC 15:00:00 전날)
    const today = new Date(kstStartOfDay.getTime() - kstOffset);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayRequested,
      todayApproved,
      todayPaid,
      todayRejected,
      pendingRequested,
      pendingApproved,
      totalFrozenAmount,
      // 배치 통계
      batchTodayCreated,
      batchTodayCompleted,
      batchPendingExport,
      batchPendingComplete,
      // 실패 건수 (최근 24시간)
      failedLast24h,
      // 평균 승인 소요일 (최근 30일 승인 건)
      avgApprovalData,
    ] = await Promise.all([
      // 오늘 요청된 건
      prisma.withdrawalRequest.aggregate({
        where: {
          createdAt: { gte: today },
        },
        _count: true,
        _sum: { amount: true },
      }),
      // 오늘 승인된 건
      prisma.withdrawalRequest.aggregate({
        where: {
          approvedAt: { gte: today },
        },
        _count: true,
        _sum: { amount: true },
      }),
      // 오늘 지급된 건
      prisma.withdrawalRequest.aggregate({
        where: {
          paidAt: { gte: today },
        },
        _count: true,
        _sum: { amount: true },
      }),
      // 오늘 거부된 건
      prisma.withdrawalRequest.aggregate({
        where: {
          status: 'REJECTED',
          updatedAt: { gte: today },
        },
        _count: true,
        _sum: { amount: true },
      }),
      // 대기 중인 REQUESTED
      prisma.withdrawalRequest.aggregate({
        where: { status: 'REQUESTED' },
        _count: true,
        _sum: { amount: true },
      }),
      // 대기 중인 APPROVED (지급 대기)
      prisma.withdrawalRequest.aggregate({
        where: { status: 'APPROVED' },
        _count: true,
        _sum: { amount: true },
      }),
      // 전체 frozenAmount (선수 지갑)
      prisma.wallet.aggregate({
        where: { ownerType: 'ATHLETE' },
        _sum: { frozenAmount: true },
      }),
      // 오늘 생성된 배치
      prisma.withdrawalBatch.count({
        where: { createdAt: { gte: today } },
      }),
      // 오늘 완료된 배치
      prisma.withdrawalBatch.count({
        where: { completedAt: { gte: today } },
      }),
      // CREATED 상태 배치 (CSV 내보내기 대기)
      prisma.withdrawalBatch.count({
        where: { status: 'CREATED' },
      }),
      // EXPORTED 상태 배치 (지급 완료 대기)
      prisma.withdrawalBatch.count({
        where: { status: 'EXPORTED' },
      }),
      // 최근 24시간 내 실패한 출금 (배치 완료 시도 후 여전히 APPROVED인 건)
      // 참고: completeBatch에서 adminMarkPaid 실패한 건은 APPROVED 유지
      prisma.withdrawalRequest.count({
        where: {
          status: 'APPROVED',
          batchId: { not: null },
          updatedAt: { gte: last24h },
        },
      }),
      // 평균 승인 소요일 계산용 데이터 (최근 30일 승인 건)
      prisma.withdrawalRequest.findMany({
        where: {
          approvedAt: { gte: last30d, not: null },
        },
        select: {
          createdAt: true,
          approvedAt: true,
        },
      }),
    ]);

    // 평균 승인 소요일 계산
    let avgApprovalDays = 0;
    if (avgApprovalData.length > 0) {
      const totalDays = avgApprovalData.reduce((sum, w) => {
        if (w.approvedAt) {
          const days = (w.approvedAt.getTime() - w.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }
        return sum;
      }, 0);
      avgApprovalDays = Math.round((totalDays / avgApprovalData.length) * 10) / 10; // 소수점 1자리
    }

    return {
      today: {
        requested: { count: todayRequested._count, amount: toNumber(todayRequested._sum.amount) },
        approved: { count: todayApproved._count, amount: toNumber(todayApproved._sum.amount) },
        paid: { count: todayPaid._count, amount: toNumber(todayPaid._sum.amount) },
        rejected: { count: todayRejected._count, amount: toNumber(todayRejected._sum.amount) },
      },
      pending: {
        requested: { count: pendingRequested._count, amount: toNumber(pendingRequested._sum.amount) },
        approved: { count: pendingApproved._count, amount: toNumber(pendingApproved._sum.amount) },
      },
      batch: {
        todayCreated: batchTodayCreated,
        todayCompleted: batchTodayCompleted,
        pendingExport: batchPendingExport,
        pendingComplete: batchPendingComplete,
      },
      failed: {
        last24h: failedLast24h,
      },
      totalFrozenAmount: toNumber(totalFrozenAmount._sum.frozenAmount),
      avgApprovalDays,
    };
  }

  /**
   * 최근 7일 일평균 지급 건수 (정합성 검사용)
   */
  async getAvgPaidLast7Days(): Promise<number> {
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.withdrawalRequest.count({
      where: {
        paidAt: { gte: last7d },
      },
    });
    return result / 7;
  }

  /**
   * 장기 미승인 건수 (N일 이상 REQUESTED 상태)
   */
  async getLongPendingCount(days: number): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return prisma.withdrawalRequest.count({
      where: {
        status: 'REQUESTED',
        createdAt: { lt: threshold },
      },
    });
  }

  /**
   * 동결금액 정합성 오류 지갑 조회
   * - frozen < 0
   * - frozen > balance
   */
  async checkFrozenIntegrity(): Promise<Array<{ walletId: string; ownerId: string; balance: number; frozen: number; issue: string }>> {
    const wallets = await prisma.wallet.findMany({
      where: { ownerType: 'ATHLETE' },
      select: {
        id: true,
        ownerId: true,
        balance: true,
        frozenAmount: true,
      },
    });

    const anomalies: Array<{ walletId: string; ownerId: string; balance: number; frozen: number; issue: string }> = [];

    for (const w of wallets) {
      const balance = toNumber(w.balance);
      const frozen = toNumber(w.frozenAmount);

      if (frozen < 0) {
        anomalies.push({
          walletId: w.id,
          ownerId: w.ownerId,
          balance,
          frozen,
          issue: 'NEGATIVE_FROZEN',
        });
      } else if (frozen > balance) {
        anomalies.push({
          walletId: w.id,
          ownerId: w.ownerId,
          balance,
          frozen,
          issue: 'FROZEN_EXCEEDS_BALANCE',
        });
      }
    }

    return anomalies;
  }
}

export const withdrawalService = new WithdrawalService();

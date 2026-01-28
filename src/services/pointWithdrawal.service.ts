import { Prisma, PointWithdrawalStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';
import { pointService } from './point.service';

const MIN_WITHDRAWAL_AMOUNT = 1000; // 최소 출금 금액

export class PointWithdrawalService {
  /**
   * 계좌번호 마스킹
   */
  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    const visible = accountNumber.slice(-4);
    const masked = '*'.repeat(accountNumber.length - 4);
    return masked + visible;
  }

  /**
   * 포인트 출금 요청 생성
   */
  async createWithdrawalRequest(
    userId: string,
    data: {
      amount: number;
      bankName: string;
      bankAccountNumber: string;
      accountHolder: string;
      reason?: string;
    },
    idempotencyKey?: string
  ) {
    const { amount, bankName, bankAccountNumber, accountHolder, reason } = data;

    // 1. 유효성 검증
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestError(`최소 출금 금액은 ${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}P입니다`);
    }

    // 2. 잔액 확인
    const balance = await pointService.getBalance(userId);
    if (Number(balance.balance) < amount) {
      throw new BadRequestError('포인트 잔액이 부족합니다');
    }

    // 3. 계좌번호 마스킹
    const bankAccountMasked = this.maskAccountNumber(bankAccountNumber);

    // 4. 트랜잭션으로 처리 (포인트 차감 + 출금 요청 생성)
    const withdrawal = await prisma.$transaction(async (tx) => {
      // 4.1 출금 요청 생성
      const newWithdrawal = await tx.pointWithdrawal.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          bankName,
          bankAccountNumber,
          bankAccountMasked,
          accountHolder,
          requestedReason: reason,
          status: 'REQUESTED',
        },
      });

      // 4.2 포인트 차감 (출금 요청 시점에 동결)
      await pointService.adjustPointsWithTx(
        tx,
        userId,
        -amount,
        'POINT_WITHDRAWAL',
        'POINT_WITHDRAWAL',
        newWithdrawal.id,
        `포인트 출금 요청: ${amount.toLocaleString()}P`
      );

      return newWithdrawal;
    });

    return {
      id: withdrawal.id,
      amount: withdrawal.amount,
      bankName: withdrawal.bankName,
      bankAccountMasked: withdrawal.bankAccountMasked,
      accountHolder: withdrawal.accountHolder,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    };
  }

  /**
   * 내 출금 요청 목록 조회
   */
  async getMyWithdrawals(
    userId: string,
    options: { status?: PointWithdrawalStatus; page?: number; limit?: number } = {}
  ) {
    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PointWithdrawalWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [withdrawals, total] = await Promise.all([
      prisma.pointWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          bankName: true,
          bankAccountMasked: true,
          accountHolder: true,
          status: true,
          requestedReason: true,
          adminNote: true,
          payoutReference: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
          paidAt: true,
        },
      }),
      prisma.pointWithdrawal.count({ where }),
    ]);

    return {
      requests: withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 포인트 잔액 조회 (출금 가능 금액)
   */
  async getWithdrawableBalance(userId: string) {
    const balance = await pointService.getBalance(userId);
    return {
      balance: Number(balance.balance),
      available: Number(balance.balance), // 현재는 전액 출금 가능
    };
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * 모든 출금 요청 목록 조회 (관리자용)
   */
  async getAllWithdrawals(
    options: { status?: PointWithdrawalStatus; page?: number; limit?: number } = {}
  ) {
    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PointWithdrawalWhereInput = status ? { status } : {};

    const [withdrawals, total] = await Promise.all([
      prisma.pointWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              athlete: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.pointWithdrawal.count({ where }),
    ]);

    return {
      requests: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        bankName: w.bankName,
        bankAccountMasked: w.bankAccountMasked,
        accountHolder: w.accountHolder,
        status: w.status,
        requestedReason: w.requestedReason,
        adminNote: w.adminNote,
        payoutReference: w.payoutReference,
        createdAt: w.createdAt,
        approvedAt: w.approvedAt,
        rejectedAt: w.rejectedAt,
        paidAt: w.paidAt,
        user: {
          id: w.user.id,
          email: w.user.email,
          role: w.user.role,
          name: w.user.athlete?.name || w.user.email,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 출금 요청 승인
   */
  async approveWithdrawal(withdrawalId: string, adminUserId: string) {
    const withdrawal = await prisma.pointWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundError('출금 요청을 찾을 수 없습니다');
    }

    if (withdrawal.status !== 'REQUESTED') {
      throw new ConflictError('이미 처리된 출금 요청입니다');
    }

    const updated = await prisma.pointWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        processedBy: adminUserId,
        approvedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * 출금 요청 거부 (포인트 환불)
   */
  async rejectWithdrawal(withdrawalId: string, adminUserId: string, reason?: string) {
    const withdrawal = await prisma.pointWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundError('출금 요청을 찾을 수 없습니다');
    }

    if (withdrawal.status !== 'REQUESTED') {
      throw new ConflictError('이미 처리된 출금 요청입니다');
    }

    // 트랜잭션: 상태 업데이트 + 포인트 환불
    const updated = await prisma.$transaction(async (tx) => {
      // 1. 상태 업데이트
      const result = await tx.pointWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          processedBy: adminUserId,
          adminNote: reason,
          rejectedAt: new Date(),
        },
      });

      // 2. 포인트 환불
      await pointService.adjustPointsWithTx(
        tx,
        withdrawal.userId,
        Number(withdrawal.amount),
        'POINT_WITHDRAWAL',
        'POINT_WITHDRAWAL_REFUND',
        withdrawalId,
        `포인트 출금 거부로 환불: ${Number(withdrawal.amount).toLocaleString()}P`
      );

      return result;
    });

    return updated;
  }

  /**
   * 출금 지급 완료 처리
   */
  async completeWithdrawal(withdrawalId: string, adminUserId: string, payoutReference?: string) {
    const withdrawal = await prisma.pointWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundError('출금 요청을 찾을 수 없습니다');
    }

    if (withdrawal.status !== 'APPROVED') {
      throw new ConflictError('승인된 출금 요청만 지급 완료할 수 있습니다');
    }

    const updated = await prisma.pointWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PAID',
        processedBy: adminUserId,
        payoutReference,
        paidAt: new Date(),
      },
    });

    return updated;
  }
}

export const pointWithdrawalService = new PointWithdrawalService();

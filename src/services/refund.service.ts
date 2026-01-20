/**
 * Phase 10-2: Refund Service
 * 환불/차지백 비즈니스 로직
 */

import prisma from '../models/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import {
  RefundRequestStatus,
  RefundStatus,
  TopupPaymentStatus,
  LedgerTxType,
  Prisma,
} from '@prisma/client';
import { notificationService } from './notification.service';
import { toNumber, toDecimal, IdempotentResult } from './escrow.service';
import {
  getPaymentProvider,
  autoInitializeProviders,
} from '../payments/providers';
import { v4 as uuidv4 } from 'uuid';

export interface CreateRefundRequestInput {
  topupPaymentId: string;
  amount: number;
  reason: string;
  requestedBy: string;  // admin user id
  idempotencyKey?: string;
}

export class RefundService {
  /**
   * 환불 요청 생성 (Admin)
   * REQUESTED 상태로 생성
   */
  async createRefundRequest(input: CreateRefundRequestInput): Promise<IdempotentResult<any>> {
    const { topupPaymentId, amount, reason, requestedBy, idempotencyKey } = input;

    // 1. TopupPayment 조회
    const topup = await prisma.topupPayment.findUnique({
      where: { id: topupPaymentId },
      include: { wallet: true },
    });

    if (!topup) {
      throw new NotFoundError('충전 내역을 찾을 수 없습니다');
    }

    // 2. 상태 검증: PAID 상태만 환불 가능
    if (topup.status !== TopupPaymentStatus.PAID) {
      throw new BadRequestError(`환불 불가: 충전 상태가 '${topup.status}'입니다`);
    }

    // 3. 이미 전액 환불된 경우
    if (topup.refundStatus === RefundStatus.FULL) {
      throw new BadRequestError('이미 전액 환불된 충전입니다');
    }

    // 4. 환불 가능 금액 검증
    const topupAmount = toNumber(topup.amount);
    const refundedAmount = toNumber(topup.refundedAmount);
    const remainingRefundable = topupAmount - refundedAmount;

    if (amount <= 0) {
      throw new BadRequestError('환불 금액은 0보다 커야 합니다');
    }

    if (amount > remainingRefundable) {
      throw new BadRequestError(
        `환불 가능 금액을 초과했습니다. 남은 환불 가능 금액: ${remainingRefundable.toLocaleString()}원`
      );
    }

    // 5. 지갑 가용 잔액 검증
    const balance = toNumber(topup.wallet.balance);
    const frozenAmount = toNumber(topup.wallet.frozenAmount);
    const available = balance - frozenAmount;

    if (amount > available) {
      throw new BadRequestError(
        `지갑 잔액이 부족합니다. 가용 잔액: ${available.toLocaleString()}원`
      );
    }

    // 6. 멱등성 체크
    const key = idempotencyKey || uuidv4();

    try {
      const refundRequest = await prisma.refundRequest.create({
        data: {
          topupPaymentId,
          walletId: topup.walletId,
          amount: toDecimal(amount),
          reason,
          status: RefundRequestStatus.REQUESTED,
          requestedBy,
          requestedAt: new Date(),
          idempotencyKey: key,
        },
        include: { topupPayment: true },
      });

      // 감사 로그
      await prisma.auditLog.create({
        data: {
          userId: requestedBy,
          action: 'REFUND_REQUEST_CREATE',
          entityType: 'REFUND_REQUEST',
          entityId: refundRequest.id,
          newValue: { amount, reason, topupPaymentId },
        },
      });

      return { data: refundRequest, alreadyProcessed: false };
    } catch (e: any) {
      if (e.code === 'P2002') {
        // 이미 생성됨
        const existing = await prisma.refundRequest.findFirst({
          where: {
            topupPaymentId,
            idempotencyKey: key,
          },
          include: { topupPayment: true },
        });
        return { data: existing, alreadyProcessed: true };
      }
      throw e;
    }
  }

  /**
   * 환불 요청 승인 (Admin)
   * REQUESTED → APPROVED
   */
  async approveRefundRequest(
    refundRequestId: string,
    adminId: string
  ): Promise<IdempotentResult<any>> {
    const request = await this.getById(refundRequestId);

    // 이미 APPROVED면 멱등성 반환
    if (request.status === RefundRequestStatus.APPROVED) {
      return { data: request, alreadyProcessed: true };
    }

    // REQUESTED가 아니면 에러
    if (request.status !== RefundRequestStatus.REQUESTED) {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 승인할 수 없습니다`);
    }

    // 조건부 업데이트
    const updateResult = await prisma.refundRequest.updateMany({
      where: {
        id: refundRequestId,
        status: RefundRequestStatus.REQUESTED,
      },
      data: {
        status: RefundRequestStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      const current = await this.getById(refundRequestId);
      return { data: current, alreadyProcessed: true };
    }

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REFUND_REQUEST_APPROVE',
        entityType: 'REFUND_REQUEST',
        entityId: refundRequestId,
        newValue: { status: 'APPROVED' },
      },
    });

    const updated = await this.getById(refundRequestId);
    return { data: updated, alreadyProcessed: false };
  }

  /**
   * 환불 요청 거절 (Admin)
   * REQUESTED → REJECTED
   */
  async rejectRefundRequest(
    refundRequestId: string,
    adminId: string,
    rejectionReason: string
  ): Promise<IdempotentResult<any>> {
    if (!rejectionReason || rejectionReason.length < 5) {
      throw new BadRequestError('거절 사유는 5자 이상 입력해주세요');
    }

    const request = await this.getById(refundRequestId);

    // 이미 REJECTED면 멱등성 반환
    if (request.status === RefundRequestStatus.REJECTED) {
      return { data: request, alreadyProcessed: true };
    }

    // REQUESTED가 아니면 에러
    if (request.status !== RefundRequestStatus.REQUESTED) {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 거절할 수 없습니다`);
    }

    // 조건부 업데이트
    const updateResult = await prisma.refundRequest.updateMany({
      where: {
        id: refundRequestId,
        status: RefundRequestStatus.REQUESTED,
      },
      data: {
        status: RefundRequestStatus.REJECTED,
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    if (updateResult.count === 0) {
      const current = await this.getById(refundRequestId);
      return { data: current, alreadyProcessed: true };
    }

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REFUND_REQUEST_REJECT',
        entityType: 'REFUND_REQUEST',
        entityId: refundRequestId,
        newValue: { status: 'REJECTED', rejectionReason },
      },
    });

    const updated = await this.getById(refundRequestId);
    return { data: updated, alreadyProcessed: false };
  }

  /**
   * 환불 처리 (PG API 호출)
   * APPROVED → PROCESSING → REFUNDED/FAILED
   */
  async processRefund(
    refundRequestId: string,
    adminId: string
  ): Promise<IdempotentResult<any>> {
    const request = await this.getById(refundRequestId);

    // 이미 REFUNDED면 멱등성 반환
    if (request.status === RefundRequestStatus.REFUNDED) {
      return { data: request, alreadyProcessed: true };
    }

    // APPROVED가 아니면 에러 (PROCESSING도 재시도 가능)
    if (request.status !== RefundRequestStatus.APPROVED &&
        request.status !== RefundRequestStatus.FAILED) {
      throw new BadRequestError(`상태가 '${request.status}'인 요청은 처리할 수 없습니다`);
    }

    const topup = await prisma.topupPayment.findUnique({
      where: { id: request.topupPaymentId },
    });

    if (!topup) {
      throw new NotFoundError('충전 내역을 찾을 수 없습니다');
    }

    if (!topup.providerPaymentKey) {
      throw new BadRequestError('PG 결제 키가 없습니다');
    }

    // PROCESSING 상태로 변경
    const processingResult = await prisma.refundRequest.updateMany({
      where: {
        id: refundRequestId,
        status: { in: [RefundRequestStatus.APPROVED, RefundRequestStatus.FAILED] },
      },
      data: {
        status: RefundRequestStatus.PROCESSING,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });

    if (processingResult.count === 0) {
      const current = await this.getById(refundRequestId);
      if (current.status === RefundRequestStatus.REFUNDED) {
        return { data: current, alreadyProcessed: true };
      }
      throw new ConflictError('다른 요청이 먼저 처리되었습니다');
    }

    // PG API 호출
    try {
      autoInitializeProviders();
      const adapter = getPaymentProvider(topup.provider);
      const amount = toNumber(request.amount);

      const refundResult = await adapter.refundPayment(
        topup.providerPaymentKey,
        amount,
        request.reason
      );

      if (refundResult.status === 'SUCCESS') {
        // 환불 완료 처리
        return this.completeRefund(refundRequestId, {
          providerRefundId: refundResult.providerRefundId,
          rawPayload: refundResult.rawPayload,
        });
      } else if (refundResult.status === 'PENDING') {
        // PENDING 상태 (비동기 환불) - webhook에서 완료 처리
        await prisma.refundRequest.update({
          where: { id: refundRequestId },
          data: {
            providerRefundId: refundResult.providerRefundId,
            rawPayload: refundResult.rawPayload,
          },
        });

        const updated = await this.getById(refundRequestId);
        return { data: updated, alreadyProcessed: false };
      } else {
        // 실패
        await prisma.refundRequest.update({
          where: { id: refundRequestId },
          data: {
            status: RefundRequestStatus.FAILED,
            failureReason: refundResult.failureReason,
            rawPayload: refundResult.rawPayload,
          },
        });

        const updated = await this.getById(refundRequestId);
        throw new BadRequestError(`환불 실패: ${refundResult.failureReason}`);
      }
    } catch (e: any) {
      // PG API 호출 실패
      await prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: RefundRequestStatus.FAILED,
          failureReason: e.message,
        },
      });
      throw e;
    }
  }

  /**
   * 환불 완료 처리 (Wallet DEBIT + LedgerTx)
   * PROCESSING → REFUNDED
   */
  async completeRefund(
    refundRequestId: string,
    data: {
      providerRefundId: string;
      rawPayload: any;
    }
  ): Promise<IdempotentResult<any>> {
    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트 (멱등성)
      const updateResult = await tx.refundRequest.updateMany({
        where: {
          id: refundRequestId,
          status: RefundRequestStatus.PROCESSING,
        },
        data: {
          status: RefundRequestStatus.REFUNDED,
          providerRefundId: data.providerRefundId,
          rawPayload: data.rawPayload,
        },
      });

      // 이미 처리된 경우
      if (updateResult.count === 0) {
        const existing = await tx.refundRequest.findUnique({
          where: { id: refundRequestId },
        });
        return { data: existing, alreadyProcessed: true };
      }

      const refundRequest = await tx.refundRequest.findUniqueOrThrow({
        where: { id: refundRequestId },
        include: { topupPayment: true },
      });

      const amount = toNumber(refundRequest.amount);
      const amountDecimal = toDecimal(amount);

      // Wallet 잔액 차감
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { id: refundRequest.walletId },
      });

      const newBalance = toDecimal(toNumber(wallet.balance)).sub(amountDecimal);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      // LedgerTx 생성 (멱등성: unique constraint)
      try {
        await tx.ledgerTx.create({
          data: {
            walletId: wallet.id,
            type: LedgerTxType.TOPUP_REFUND,
            amount: amountDecimal.negated(), // 음수
            balanceAfter: newBalance,
            status: 'COMPLETED',
            refType: 'REFUND_REQUEST',
            refId: refundRequest.id,
            description: `충전 환불`,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          const existing = await tx.refundRequest.findUnique({
            where: { id: refundRequestId },
          });
          return { data: existing, alreadyProcessed: true };
        }
        throw e;
      }

      // TopupPayment 환불 금액 업데이트
      const topup = refundRequest.topupPayment;
      const topupAmount = toNumber(topup.amount);
      const newRefundedAmount = toNumber(topup.refundedAmount) + amount;
      const newRefundStatus = newRefundedAmount >= topupAmount
        ? RefundStatus.FULL
        : RefundStatus.PARTIAL;

      await tx.topupPayment.update({
        where: { id: topup.id },
        data: {
          refundedAmount: toDecimal(newRefundedAmount),
          refundStatus: newRefundStatus,
          lastRefundAt: new Date(),
          // 전액 환불 시 status도 변경
          ...(newRefundStatus === RefundStatus.FULL && {
            status: TopupPaymentStatus.REFUNDED,
          }),
        },
      });

      return { data: refundRequest, alreadyProcessed: false };
    });
  }

  /**
   * 차지백 처리 (Webhook에서 호출)
   * 강제 DEBIT (잔액 부족해도 진행, 음수 허용)
   */
  async processChargeback(
    providerPaymentKey: string,
    data: {
      chargebackId?: string;
      amount: number;
      rawPayload: any;
    }
  ): Promise<IdempotentResult<any>> {
    // providerPaymentKey로 TopupPayment 찾기
    const topup = await prisma.topupPayment.findUnique({
      where: { providerPaymentKey },
    });

    if (!topup) {
      // Topup 관련이 아닐 수 있음
      return { data: null, alreadyProcessed: true };
    }

    // 이미 CHARGEBACK 처리됨
    if (topup.status === TopupPaymentStatus.CHARGEBACK) {
      return { data: topup, alreadyProcessed: true };
    }

    // PAID 상태만 차지백 처리 가능
    if (topup.status !== TopupPaymentStatus.PAID) {
      return { data: topup, alreadyProcessed: true };
    }

    const amount = data.amount || toNumber(topup.amount);

    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트
      const updateResult = await tx.topupPayment.updateMany({
        where: {
          id: topup.id,
          status: TopupPaymentStatus.PAID,
        },
        data: {
          status: TopupPaymentStatus.CHARGEBACK,
          chargebackAt: new Date(),
          rawPayload: data.rawPayload,
        },
      });

      if (updateResult.count === 0) {
        const existing = await tx.topupPayment.findUnique({
          where: { id: topup.id },
        });
        return { data: existing, alreadyProcessed: true };
      }

      // Wallet 강제 차감 (음수 허용)
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { id: topup.walletId },
      });

      const amountDecimal = toDecimal(amount);
      const newBalance = toDecimal(toNumber(wallet.balance)).sub(amountDecimal);
      // 음수 허용 - 차지백은 강제 처리

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      // LedgerTx 생성
      try {
        await tx.ledgerTx.create({
          data: {
            walletId: wallet.id,
            type: LedgerTxType.TOPUP_REFUND,
            amount: amountDecimal.negated(),
            balanceAfter: newBalance,
            status: 'COMPLETED',
            refType: 'CHARGEBACK',
            refId: topup.id,
            description: `차지백 (${data.chargebackId || 'unknown'})`,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          const existing = await tx.topupPayment.findUnique({
            where: { id: topup.id },
          });
          return { data: existing, alreadyProcessed: true };
        }
        throw e;
      }

      // 관리자 알림
      const admins = await tx.admin.findMany({
        include: { user: true },
      });

      for (const admin of admins) {
        await notificationService.create({
          userId: admin.userId,
          type: 'ADMIN_ALERT',
          title: '차지백 발생',
          message: `차지백이 발생했습니다. 금액: ${amount.toLocaleString()}원`,
          data: { topupPaymentId: topup.id, chargebackId: data.chargebackId },
        });
      }

      const updated = await tx.topupPayment.findUnique({
        where: { id: topup.id },
      });

      // 감사 로그 (트랜잭션 외부에서 처리)
      await prisma.auditLog.create({
        data: {
          action: 'CHARGEBACK_PROCESSED',
          entityType: 'TOPUP_PAYMENT',
          entityId: topup.id,
          newValue: { amount, chargebackId: data.chargebackId, newBalance: newBalance.toString() },
        },
      });

      return { data: updated, alreadyProcessed: false };
    });
  }

  /**
   * 환불 요청 단건 조회
   */
  async getById(id: string) {
    const request = await prisma.refundRequest.findUnique({
      where: { id },
      include: {
        topupPayment: true,
        wallet: true,
      },
    });

    if (!request) {
      throw new NotFoundError('환불 요청을 찾을 수 없습니다');
    }

    return request;
  }

  /**
   * 환불 요청 목록 (Admin)
   */
  async getRefundRequests(options: {
    status?: RefundRequestStatus;
    topupPaymentId?: string;
    walletId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, topupPaymentId, walletId, startDate, endDate, limit = 50, offset = 0 } = options;

    const where: Prisma.RefundRequestWhereInput = {
      ...(status && { status }),
      ...(topupPaymentId && { topupPaymentId }),
      ...(walletId && { walletId }),
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const [items, total] = await Promise.all([
      prisma.refundRequest.findMany({
        where,
        include: {
          topupPayment: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.refundRequest.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 환불 통계 (Admin)
   */
  async getRefundStats(options: {
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    const { startDate, endDate } = options;

    const where: Prisma.RefundRequestWhereInput = {
      status: RefundRequestStatus.REFUNDED,
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const result = await prisma.refundRequest.aggregate({
      where,
      _count: true,
      _sum: { amount: true },
    });

    const byStatus = await prisma.refundRequest.groupBy({
      by: ['status'],
      _count: true,
      _sum: { amount: true },
    });

    return {
      totalRefundedCount: result._count,
      totalRefundedAmount: toNumber(result._sum.amount),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count,
        amount: toNumber(s._sum.amount),
      })),
    };
  }
}

export const refundService = new RefundService();

/**
 * Phase 10-1: Topup Service
 * 브랜드 지갑 충전 비즈니스 로직
 */

import prisma from '../models/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import {
  PaymentProvider,
  TopupPaymentStatus,
  LedgerTxType,
  WalletOwnerType,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notification.service';
import { WalletService, toNumber, toDecimal, IdempotentResult } from './escrow.service';
import {
  getPaymentProvider,
  autoInitializeProviders,
  WebhookEvent,
} from '../payments/providers';
import { refundService } from './refund.service';
import { v4 as uuidv4 } from 'uuid';

// 충전 금액 제한
const MIN_TOPUP_AMOUNT = 1000;       // 최소 1,000원
const MAX_TOPUP_AMOUNT = 100000000;  // 최대 1억원

const walletService = new WalletService();

export interface CreateTopupInput {
  brandUserId: string;
  brandId: string;
  amount: number;
  provider: PaymentProvider;
  idempotencyKey?: string;
  successUrl?: string;
  failUrl?: string;
}

export interface TopupResult {
  topupPayment: any;
  checkoutUrl: string;
  alreadyCreated?: boolean;
}

export class TopupService {
  /**
   * 충전 생성 (Checkout 세션)
   */
  async createTopup(input: CreateTopupInput): Promise<TopupResult> {
    // 금액 검증
    if (input.amount < MIN_TOPUP_AMOUNT) {
      throw new BadRequestError(`최소 충전 금액은 ${MIN_TOPUP_AMOUNT.toLocaleString()}원입니다`);
    }
    if (input.amount > MAX_TOPUP_AMOUNT) {
      throw new BadRequestError(`최대 충전 금액은 ${MAX_TOPUP_AMOUNT.toLocaleString()}원입니다`);
    }

    // Provider 초기화
    autoInitializeProviders();
    const adapter = getPaymentProvider(input.provider);

    // 지갑 준비
    const wallet = await walletService.getOrCreateWallet(
      WalletOwnerType.BRAND,
      input.brandId
    );

    // 멱등성 키 생성
    const idempotencyKey = input.idempotencyKey || uuidv4();

    // 기존 TopupPayment 확인 (idempotency)
    const existing = await prisma.topupPayment.findUnique({
      where: {
        walletId_idempotencyKey: {
          walletId: wallet.id,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      // 이미 생성된 경우
      if (existing.status === TopupPaymentStatus.CREATED ||
          existing.status === TopupPaymentStatus.PENDING) {
        return {
          topupPayment: existing,
          checkoutUrl: existing.checkoutUrl || '',
          alreadyCreated: true,
        };
      }
      // Terminal 상태면 새로 생성 불가
      throw new ConflictError('이미 처리된 충전 요청입니다. 새로운 충전을 시작해주세요.');
    }

    // Checkout 세션 생성
    const orderId = uuidv4();
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = input.successUrl || `${baseUrl}/brand/wallet?topup=success`;
    const failUrl = input.failUrl || `${baseUrl}/brand/wallet?topup=fail`;

    const checkout = await adapter.createCheckout({
      orderId,
      amount: input.amount,
      successUrl,
      failUrl,
      metadata: {
        brandId: input.brandId,
        brandUserId: input.brandUserId,
        walletId: wallet.id,
      },
    });

    // TopupPayment 생성
    const topupPayment = await prisma.topupPayment.create({
      data: {
        walletId: wallet.id,
        brandUserId: input.brandUserId,
        brandId: input.brandId,
        amount: input.amount,
        currency: 'KRW',
        status: TopupPaymentStatus.CREATED,
        provider: input.provider,
        providerOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutExpiresAt: checkout.expiresAt,
        idempotencyKey,
      },
    });

    return {
      topupPayment,
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  /**
   * 결제 확인 (Redirect 방식에서 successUrl 도착 후)
   */
  async confirmTopup(
    topupId: string,
    paymentKey: string,
    brandUserId: string
  ): Promise<IdempotentResult<any>> {
    const topup = await prisma.topupPayment.findUnique({
      where: { id: topupId },
    });

    if (!topup) {
      throw new NotFoundError('충전 요청을 찾을 수 없습니다');
    }

    if (topup.brandUserId !== brandUserId) {
      throw new BadRequestError('권한이 없습니다');
    }

    // 이미 처리된 경우
    if (topup.status === TopupPaymentStatus.PAID) {
      return { data: topup, alreadyProcessed: true };
    }

    if (topup.status !== TopupPaymentStatus.CREATED &&
        topup.status !== TopupPaymentStatus.PENDING) {
      throw new BadRequestError('처리할 수 없는 상태입니다');
    }

    // Provider 확인
    autoInitializeProviders();
    const adapter = getPaymentProvider(topup.provider);

    // 결제 확인
    const confirmation = await adapter.confirmPayment(
      paymentKey,
      topup.providerOrderId || '',
      toNumber(topup.amount)
    );

    // 결제 완료 처리
    return this.processPaymentSuccess(topup.id, {
      providerPaymentKey: confirmation.providerPaymentKey,
      paidAt: confirmation.paidAt,
      rawPayload: confirmation.rawPayload,
    });
  }

  /**
   * Webhook 처리: 결제 성공
   */
  async processPaymentSuccess(
    topupId: string,
    data: {
      providerPaymentKey: string;
      paidAt: Date;
      rawPayload: any;
    }
  ): Promise<IdempotentResult<any>> {
    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트 (멱등성)
      const updateResult = await tx.topupPayment.updateMany({
        where: {
          id: topupId,
          status: { in: [TopupPaymentStatus.CREATED, TopupPaymentStatus.PENDING] },
        },
        data: {
          status: TopupPaymentStatus.PAID,
          providerPaymentKey: data.providerPaymentKey,
          paidAt: data.paidAt,
          rawPayload: data.rawPayload,
        },
      });

      // 이미 처리된 경우
      if (updateResult.count === 0) {
        const existing = await tx.topupPayment.findUnique({
          where: { id: topupId },
        });
        return { data: existing, alreadyProcessed: true };
      }

      const topup = await tx.topupPayment.findUniqueOrThrow({
        where: { id: topupId },
      });

      // Wallet 잔액 증가
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { id: topup.walletId },
      });

      const amountDecimal = toDecimal(toNumber(topup.amount));
      const newBalance = toDecimal(toNumber(wallet.balance)).add(amountDecimal);

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
            type: LedgerTxType.TOPUP_DEPOSIT,
            amount: amountDecimal,
            balanceAfter: newBalance,
            status: 'COMPLETED',
            refType: 'TOPUP_PAYMENT',
            refId: topup.id,
            description: `충전 완료 (${topup.provider})`,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          // 이미 LedgerTx 생성됨 - 멱등
          const existing = await tx.topupPayment.findUnique({
            where: { id: topupId },
          });
          return { data: existing, alreadyProcessed: true };
        }
        throw e;
      }

      return { data: topup, alreadyProcessed: false };
    });
  }

  /**
   * Webhook 처리: 결제 실패
   */
  async processPaymentFailed(
    providerOrderId: string,
    data: {
      failureCode?: string;
      failureReason?: string;
      rawPayload: any;
    }
  ): Promise<IdempotentResult<any>> {
    const updateResult = await prisma.topupPayment.updateMany({
      where: {
        providerOrderId,
        status: { in: [TopupPaymentStatus.CREATED, TopupPaymentStatus.PENDING] },
      },
      data: {
        status: TopupPaymentStatus.FAILED,
        failedAt: new Date(),
        failureCode: data.failureCode,
        failureReason: data.failureReason,
        rawPayload: data.rawPayload,
      },
    });

    if (updateResult.count === 0) {
      const existing = await prisma.topupPayment.findUnique({
        where: { providerOrderId },
      });
      return { data: existing, alreadyProcessed: true };
    }

    const topup = await prisma.topupPayment.findUnique({
      where: { providerOrderId },
    });

    return { data: topup, alreadyProcessed: false };
  }

  /**
   * Webhook 처리: 결제 취소
   */
  async processPaymentCanceled(
    providerOrderId: string,
    rawPayload: any
  ): Promise<IdempotentResult<any>> {
    const updateResult = await prisma.topupPayment.updateMany({
      where: {
        providerOrderId,
        status: { in: [TopupPaymentStatus.CREATED, TopupPaymentStatus.PENDING] },
      },
      data: {
        status: TopupPaymentStatus.CANCELED,
        canceledAt: new Date(),
        rawPayload,
      },
    });

    if (updateResult.count === 0) {
      const existing = await prisma.topupPayment.findUnique({
        where: { providerOrderId },
      });
      return { data: existing, alreadyProcessed: true };
    }

    const topup = await prisma.topupPayment.findUnique({
      where: { providerOrderId },
    });

    return { data: topup, alreadyProcessed: false };
  }

  /**
   * Webhook 이벤트 라우팅
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<IdempotentResult<any>> {
    // REFUND_COMPLETED와 CHARGEBACK은 providerPaymentKey로 찾기
    if (event.eventType === 'REFUND_COMPLETED') {
      return this.processRefundWebhook(event);
    }

    if (event.eventType === 'CHARGEBACK') {
      return refundService.processChargeback(event.providerPaymentKey, {
        chargebackId: event.chargebackId,
        amount: event.amount,
        rawPayload: event.rawPayload,
      });
    }

    // providerOrderId로 TopupPayment 찾기
    const topup = await prisma.topupPayment.findUnique({
      where: { providerOrderId: event.providerOrderId },
    });

    if (!topup) {
      // Topup 관련 webhook이 아닐 수 있음 (다른 결제)
      return { data: null, alreadyProcessed: true };
    }

    switch (event.eventType) {
      case 'PAYMENT_CONFIRMED':
        return this.processPaymentSuccess(topup.id, {
          providerPaymentKey: event.providerPaymentKey,
          paidAt: event.paidAt || new Date(),
          rawPayload: event.rawPayload,
        });

      case 'PAYMENT_FAILED':
        return this.processPaymentFailed(event.providerOrderId, {
          failureCode: event.failureCode,
          failureReason: event.failureReason,
          rawPayload: event.rawPayload,
        });

      case 'PAYMENT_CANCELED':
        return this.processPaymentCanceled(event.providerOrderId, event.rawPayload);

      default:
        return { data: topup, alreadyProcessed: true };
    }
  }

  /**
   * Phase 10-2: Webhook에서 환불 완료 처리
   * PG에서 비동기 환불 완료 알림을 받았을 때
   */
  async processRefundWebhook(event: WebhookEvent): Promise<IdempotentResult<any>> {
    // providerRefundId로 RefundRequest 찾기
    if (event.refundId) {
      const refundRequest = await prisma.refundRequest.findUnique({
        where: { providerRefundId: event.refundId },
      });

      if (refundRequest && refundRequest.status === 'PROCESSING') {
        return refundService.completeRefund(refundRequest.id, {
          providerRefundId: event.refundId,
          rawPayload: event.rawPayload,
        });
      }
    }

    // providerPaymentKey로 pending 상태 RefundRequest 찾기
    const topup = await prisma.topupPayment.findUnique({
      where: { providerPaymentKey: event.providerPaymentKey },
    });

    if (topup) {
      const pendingRefund = await prisma.refundRequest.findFirst({
        where: {
          topupPaymentId: topup.id,
          status: 'PROCESSING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingRefund) {
        return refundService.completeRefund(pendingRefund.id, {
          providerRefundId: event.refundId || '',
          rawPayload: event.rawPayload,
        });
      }
    }

    return { data: null, alreadyProcessed: true };
  }

  /**
   * 내 충전 내역 조회
   */
  async getMyTopups(
    brandUserId: string,
    options: {
      status?: TopupPaymentStatus;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Prisma.TopupPaymentWhereInput = {
      brandUserId,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.topupPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.topupPayment.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 단일 충전 조회
   */
  async getTopupById(topupId: string, brandUserId?: string) {
    const topup = await prisma.topupPayment.findUnique({
      where: { id: topupId },
    });

    if (!topup) {
      throw new NotFoundError('충전 요청을 찾을 수 없습니다');
    }

    if (brandUserId && topup.brandUserId !== brandUserId) {
      throw new BadRequestError('권한이 없습니다');
    }

    return topup;
  }

  /**
   * [Admin] 전체 충전 목록
   */
  async getAllTopups(options: {
    status?: TopupPaymentStatus;
    provider?: PaymentProvider;
    brandId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, provider, brandId, startDate, endDate, limit = 50, offset = 0 } = options;

    const where: Prisma.TopupPaymentWhereInput = {
      ...(status && { status }),
      ...(provider && { provider }),
      ...(brandId && { brandId }),
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const [items, total] = await Promise.all([
      prisma.topupPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.topupPayment.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * [Admin] 통계 조회
   */
  async getTopupStats(options: {
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    const { startDate, endDate } = options;

    const where: Prisma.TopupPaymentWhereInput = {
      status: TopupPaymentStatus.PAID,
      ...(startDate || endDate) && {
        paidAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const result = await prisma.topupPayment.aggregate({
      where,
      _count: true,
      _sum: { amount: true },
    });

    const byProvider = await prisma.topupPayment.groupBy({
      by: ['provider'],
      where,
      _count: true,
      _sum: { amount: true },
    });

    return {
      totalCount: result._count,
      totalAmount: toNumber(result._sum.amount),
      byProvider: byProvider.map(p => ({
        provider: p.provider,
        count: p._count,
        amount: toNumber(p._sum.amount),
      })),
    };
  }
}

export const topupService = new TopupService();

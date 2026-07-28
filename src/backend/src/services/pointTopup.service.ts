/**
 * Point Topup Service
 * 모든 사용자(FAN, ATHLETE, BRAND)가 현금으로 포인트를 충전하는 서비스
 */

import prisma from '../models/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import {
  PaymentProvider,
  PointTopupStatus,
  PointTxReason,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getPaymentProvider,
  autoInitializeProviders,
  WebhookEvent,
} from '../payments/providers';
import { pointService } from './point.service';
import { v4 as uuidv4 } from 'uuid';

// 충전 금액 제한
const MIN_TOPUP_AMOUNT = 1000;       // 최소 1,000원
const MAX_TOPUP_AMOUNT = 10000000;   // 최대 1,000만원

// 포인트 환율 (1원 = 1포인트)
const POINTS_PER_KRW = 1;

export interface CreatePointTopupInput {
  userId: string;
  amount: number;            // 결제 금액 (원)
  provider?: PaymentProvider;
  successUrl?: string;
  failUrl?: string;
}

export interface PointTopupResult {
  topup: any;
  checkoutUrl: string;
  alreadyCreated?: boolean;
}

export interface IdempotentResult<T> {
  data: T;
  alreadyProcessed: boolean;
}

const toNumber = (value: Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

const toDecimal = (value: number): Decimal => {
  return new Decimal(value);
};

export class PointTopupService {
  /**
   * 포인트 충전 생성 (Checkout 세션)
   */
  async createTopup(input: CreatePointTopupInput): Promise<PointTopupResult> {
    // 금액 검증
    if (input.amount < MIN_TOPUP_AMOUNT) {
      throw new BadRequestError(`최소 충전 금액은 ${MIN_TOPUP_AMOUNT.toLocaleString()}원입니다`);
    }
    if (input.amount > MAX_TOPUP_AMOUNT) {
      throw new BadRequestError(`최대 충전 금액은 ${MAX_TOPUP_AMOUNT.toLocaleString()}원입니다`);
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundError('사용자를 찾을 수 없습니다');
    }

    // Provider 초기화
    autoInitializeProviders();
    const provider = input.provider || PaymentProvider.TOSS;
    const adapter = getPaymentProvider(provider);

    // 지급할 포인트 계산
    const pointsToGrant = input.amount * POINTS_PER_KRW;

    // Checkout 세션 생성
    const orderId = `pt_${uuidv4()}`;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = input.successUrl || `${baseUrl}/points/topup/success`;
    const failUrl = input.failUrl || `${baseUrl}/points/topup/fail`;

    const checkout = await adapter.createCheckout({
      orderId,
      amount: input.amount,
      successUrl,
      failUrl,
      metadata: {
        userId: input.userId,
        pointsToGrant: String(pointsToGrant),
        type: 'POINT_TOPUP',
      },
    });

    // PointTopup 생성
    const topup = await prisma.pointTopup.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        pointsToGrant,
        currency: 'KRW',
        status: PointTopupStatus.CREATED,
        provider,
        providerOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutExpiresAt: checkout.expiresAt,
      },
    });

    return {
      topup,
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  /**
   * 결제 확인 (Redirect 방식에서 successUrl 도착 후)
   */
  async confirmTopup(
    topupId: string,
    paymentKey: string,
    userId: string
  ): Promise<IdempotentResult<any>> {
    const topup = await prisma.pointTopup.findUnique({
      where: { id: topupId },
    });

    if (!topup) {
      throw new NotFoundError('충전 요청을 찾을 수 없습니다');
    }

    if (topup.userId !== userId) {
      throw new BadRequestError('권한이 없습니다');
    }

    // 이미 처리된 경우
    if (topup.status === PointTopupStatus.PAID) {
      return { data: topup, alreadyProcessed: true };
    }

    if (topup.status !== PointTopupStatus.CREATED &&
        topup.status !== PointTopupStatus.PENDING) {
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
    });
  }

  /**
   * 결제 성공 처리 (포인트 지급)
   */
  async processPaymentSuccess(
    topupId: string,
    data: {
      providerPaymentKey: string;
      paidAt: Date;
    }
  ): Promise<IdempotentResult<any>> {
    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트 (멱등성)
      const updateResult = await tx.pointTopup.updateMany({
        where: {
          id: topupId,
          status: { in: [PointTopupStatus.CREATED, PointTopupStatus.PENDING] },
        },
        data: {
          status: PointTopupStatus.PAID,
          providerPaymentKey: data.providerPaymentKey,
          paidAt: data.paidAt,
        },
      });

      // 이미 처리된 경우
      if (updateResult.count === 0) {
        const existing = await tx.pointTopup.findUnique({
          where: { id: topupId },
        });
        return { data: existing, alreadyProcessed: true };
      }

      const topup = await tx.pointTopup.findUniqueOrThrow({
        where: { id: topupId },
      });

      // 포인트 지급
      const pointsToGrant = toNumber(topup.pointsToGrant);
      await pointService.adjustPointsWithTx(
        tx,
        topup.userId,
        pointsToGrant,
        PointTxReason.POINT_TOPUP,
        'POINT_TOPUP',
        topup.id,
        `포인트 충전: ${pointsToGrant.toLocaleString()}P (${toNumber(topup.amount).toLocaleString()}원)`
      );

      return { data: topup, alreadyProcessed: false };
    });
  }

  /**
   * 결제 실패 처리
   */
  async processPaymentFailed(
    providerOrderId: string,
    data: {
      failureCode?: string;
      failureReason?: string;
    }
  ): Promise<IdempotentResult<any>> {
    const updateResult = await prisma.pointTopup.updateMany({
      where: {
        providerOrderId,
        status: { in: [PointTopupStatus.CREATED, PointTopupStatus.PENDING] },
      },
      data: {
        status: PointTopupStatus.FAILED,
        failedAt: new Date(),
        failReason: data.failureReason || data.failureCode,
      },
    });

    if (updateResult.count === 0) {
      const existing = await prisma.pointTopup.findUnique({
        where: { providerOrderId },
      });
      return { data: existing, alreadyProcessed: true };
    }

    const topup = await prisma.pointTopup.findUnique({
      where: { providerOrderId },
    });

    return { data: topup, alreadyProcessed: false };
  }

  /**
   * 결제 취소 처리
   */
  async processPaymentCanceled(
    providerOrderId: string
  ): Promise<IdempotentResult<any>> {
    const updateResult = await prisma.pointTopup.updateMany({
      where: {
        providerOrderId,
        status: { in: [PointTopupStatus.CREATED, PointTopupStatus.PENDING] },
      },
      data: {
        status: PointTopupStatus.CANCELED,
      },
    });

    if (updateResult.count === 0) {
      const existing = await prisma.pointTopup.findUnique({
        where: { providerOrderId },
      });
      return { data: existing, alreadyProcessed: true };
    }

    const topup = await prisma.pointTopup.findUnique({
      where: { providerOrderId },
    });

    return { data: topup, alreadyProcessed: false };
  }

  /**
   * 환불 처리 (Admin)
   */
  async processRefund(
    topupId: string,
    adminUserId: string,
    reason?: string
  ): Promise<IdempotentResult<any>> {
    const topup = await prisma.pointTopup.findUnique({
      where: { id: topupId },
    });

    if (!topup) {
      throw new NotFoundError('충전 내역을 찾을 수 없습니다');
    }

    // 이미 환불된 경우
    if (topup.status === PointTopupStatus.REFUNDED) {
      return { data: topup, alreadyProcessed: true };
    }

    if (topup.status !== PointTopupStatus.PAID) {
      throw new BadRequestError('결제 완료 상태에서만 환불할 수 있습니다');
    }

    const pointsToDeduct = toNumber(topup.pointsToGrant);

    // 트랜잭션으로 환불 처리
    return prisma.$transaction(async (tx) => {
      // 포인트 차감
      await pointService.adjustPointsWithTx(
        tx,
        topup.userId,
        -pointsToDeduct,
        PointTxReason.POINT_TOPUP_REFUND,
        'POINT_TOPUP_REFUND',
        topup.id,
        `포인트 충전 환불: -${pointsToDeduct.toLocaleString()}P`
      );

      // 상태 업데이트
      const updated = await tx.pointTopup.update({
        where: { id: topupId },
        data: {
          status: PointTopupStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: reason || '관리자 환불',
        },
      });

      // TODO: PG사 환불 API 호출 (실제 결제금 환불)

      return { data: updated, alreadyProcessed: false };
    });
  }

  /**
   * Webhook 이벤트 라우팅
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<IdempotentResult<any>> {
    // providerOrderId로 PointTopup 찾기 (pt_ 접두사로 구분)
    if (!event.providerOrderId?.startsWith('pt_')) {
      return { data: null, alreadyProcessed: true };
    }

    const topup = await prisma.pointTopup.findUnique({
      where: { providerOrderId: event.providerOrderId },
    });

    if (!topup) {
      return { data: null, alreadyProcessed: true };
    }

    switch (event.eventType) {
      case 'PAYMENT_CONFIRMED':
        return this.processPaymentSuccess(topup.id, {
          providerPaymentKey: event.providerPaymentKey,
          paidAt: event.paidAt || new Date(),
        });

      case 'PAYMENT_FAILED':
        return this.processPaymentFailed(event.providerOrderId, {
          failureCode: event.failureCode,
          failureReason: event.failureReason,
        });

      case 'PAYMENT_CANCELED':
        return this.processPaymentCanceled(event.providerOrderId);

      default:
        return { data: topup, alreadyProcessed: true };
    }
  }

  /**
   * 내 충전 내역 조회
   */
  async getMyTopups(
    userId: string,
    options: {
      status?: PointTopupStatus;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Prisma.PointTopupWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.pointTopup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pointTopup.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 단일 충전 조회
   */
  async getTopupById(topupId: string, userId?: string) {
    const topup = await prisma.pointTopup.findUnique({
      where: { id: topupId },
    });

    if (!topup) {
      throw new NotFoundError('충전 요청을 찾을 수 없습니다');
    }

    if (userId && topup.userId !== userId) {
      throw new BadRequestError('권한이 없습니다');
    }

    return topup;
  }

  /**
   * providerOrderId로 조회
   */
  async getTopupByOrderId(providerOrderId: string) {
    const topup = await prisma.pointTopup.findUnique({
      where: { providerOrderId },
    });

    if (!topup) {
      throw new NotFoundError('충전 요청을 찾을 수 없습니다');
    }

    return topup;
  }

  /**
   * [Admin] 전체 충전 목록
   */
  async getAllTopups(options: {
    status?: PointTopupStatus;
    provider?: PaymentProvider;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, provider, userId, startDate, endDate, limit = 50, offset = 0 } = options;

    const where: Prisma.PointTopupWhereInput = {
      ...(status && { status }),
      ...(provider && { provider }),
      ...(userId && { userId }),
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const [items, total] = await Promise.all([
      prisma.pointTopup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.pointTopup.count({ where }),
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

    const where: Prisma.PointTopupWhereInput = {
      status: PointTopupStatus.PAID,
      ...(startDate || endDate) && {
        paidAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    };

    const result = await prisma.pointTopup.aggregate({
      where,
      _count: true,
      _sum: { amount: true, pointsToGrant: true },
    });

    const byProvider = await prisma.pointTopup.groupBy({
      by: ['provider'],
      where,
      _count: true,
      _sum: { amount: true },
    });

    return {
      totalCount: result._count,
      totalAmount: toNumber(result._sum.amount),
      totalPointsGranted: toNumber(result._sum.pointsToGrant),
      byProvider: byProvider.map(p => ({
        provider: p.provider,
        count: p._count,
        amount: toNumber(p._sum.amount),
      })),
    };
  }
}

export const pointTopupService = new PointTopupService();

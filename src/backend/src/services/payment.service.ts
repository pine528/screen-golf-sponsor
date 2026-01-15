import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

// PG 응답 타입 (향후 실제 PG사 연동 시 확장)
interface PGResponse {
  success: boolean;
  transactionId?: string;
  message?: string;
  errorCode?: string;
}

export class PaymentService {
  // ============================================
  // Payment CRUD
  // ============================================

  async createPayment(brandId: string, data: {
    contractId?: string;
    amount: number;
    method: PaymentMethod;
  }) {
    // 브랜드 검증
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // 계약이 지정된 경우 검증
    if (data.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: data.contractId },
      });
      if (!contract) {
        throw new NotFoundError('Contract not found');
      }
      if (contract.brandId !== brandId) {
        throw new ForbiddenError('Contract does not belong to this brand');
      }
    }

    return prisma.payment.create({
      data: {
        brandId,
        contractId: data.contractId,
        amount: data.amount,
        method: data.method,
        status: 'PENDING',
      },
      include: {
        brand: { select: { id: true, name: true } },
        contract: true,
      },
    });
  }

  async findById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, contactEmail: true } },
        contract: {
          include: {
            auction: {
              include: {
                slotInstance: {
                  include: {
                    athlete: { select: { id: true, name: true } },
                    event: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return payment;
  }

  async list(page: number = 1, limit: number = 20, filters?: {
    brandId?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
  }) {
    const where: any = {};
    if (filters?.brandId) where.brandId = filters.brandId;
    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.method = filters.method;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: { select: { id: true, name: true } },
          contract: { select: { id: true, priceFinal: true, status: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  async getMyPayments(brandId: string, page: number = 1, limit: number = 20) {
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { brandId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            include: {
              auction: {
                include: {
                  slotInstance: {
                    include: {
                      athlete: { select: { id: true, name: true } },
                      event: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where: { brandId } }),
    ]);

    return { payments, total };
  }

  // ============================================
  // PG 연동 (기반 구조)
  // ============================================

  // 결제 요청 (PG사 연동 준비)
  async initiatePayment(paymentId: string, pgProvider: string = 'toss') {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestError('Payment is not in pending status');
    }

    // PG사별 결제 요청 로직 (향후 구현)
    // 현재는 결제 준비 상태만 저장
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        pgProvider,
      },
    });
  }

  // 결제 완료 처리 (PG 웹훅 또는 클라이언트 콜백에서 호출)
  async completePayment(paymentId: string, pgResponse: PGResponse) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestError('Payment is not in pending status');
    }

    if (pgResponse.success) {
      return prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          pgTransactionId: pgResponse.transactionId,
          pgResponse: pgResponse as any,
          paidAt: new Date(),
        },
      });
    } else {
      return prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          pgResponse: pgResponse as any,
          failedAt: new Date(),
          failReason: pgResponse.message || pgResponse.errorCode,
        },
      });
    }
  }

  // 결제 실패 처리
  async failPayment(paymentId: string, reason: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failReason: reason,
      },
    });
  }

  // 환불 처리
  async refundPayment(paymentId: string, refundAmount?: number) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestError('Can only refund completed payments');
    }

    const actualRefundAmount = refundAmount || payment.amount;

    if (actualRefundAmount > payment.amount) {
      throw new BadRequestError('Refund amount cannot exceed payment amount');
    }

    // PG사 환불 API 호출 (향후 구현)
    // 현재는 상태만 업데이트

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundAmount: actualRefundAmount,
      },
    });
  }

  // 결제 취소 (완료 전 취소)
  async cancelPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestError('Can only cancel pending payments');
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  // ============================================
  // 통계
  // ============================================

  async getPaymentStats(filters?: { brandId?: string; startDate?: Date; endDate?: Date }) {
    const where: any = { status: 'COMPLETED' };
    if (filters?.brandId) where.brandId = filters.brandId;
    if (filters?.startDate || filters?.endDate) {
      where.paidAt = {};
      if (filters.startDate) where.paidAt.gte = filters.startDate;
      if (filters.endDate) where.paidAt.lte = filters.endDate;
    }

    const [totalAmount, count, byMethod] = await Promise.all([
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({
        by: ['method'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalAmount: totalAmount._sum.amount || 0,
      totalCount: count,
      byMethod: byMethod.map(m => ({
        method: m.method,
        amount: m._sum.amount || 0,
        count: m._count,
      })),
    };
  }

  async getDailyPaymentStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        paidAt: { gte: startDate },
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    // 일별 집계
    const dailyStats = new Map<string, { amount: number; count: number }>();

    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const dateKey = payment.paidAt.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) || { amount: 0, count: 0 };
      dailyStats.set(dateKey, {
        amount: current.amount + payment.amount,
        count: current.count + 1,
      });
    }

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }
}

export const paymentService = new PaymentService();

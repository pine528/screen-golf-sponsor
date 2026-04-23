/**
 * Funnel Order Service
 *
 * - 구매 주문 생성/환불 (트랜잭션 + 멱등성)
 * - CLAUDE.md 불변식: orders + funnel_events 원자적 처리
 * - 멱등성: brandId+externalOrderId unique 제약 + P2002 graceful
 * - 환불 시 promoCode usage 차감 + 리포트 즉시 보정
 *
 * Refs:
 * - api_spec.docx > 6. 주문·환불 API
 * - api_spec.docx > 9. 구현 메모: purchase 호출 시 주문 저장과 이벤트 저장을 하나의 트랜잭션으로
 * - handoff.docx > QA 체크포인트 > 정산 반영
 * - CLAUDE.md > 불변식 > 잔액 변동 = 원장 기록 + 트랜잭션
 */

import prisma from '../models/prisma';
import { Prisma, FunnelOrderStatus, AttributionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';
import { funnelEventService } from './funnelEvent.service';
import { funnelAttributionService } from './funnelAttribution.service';
import { promoCodeService } from './promoCode.service';
import { miniStoreService } from './miniStore.service';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';

export interface PurchaseItem {
  product_id: string;
  qty: number;
  unit_price: number;
}

export interface CreatePurchasePayload {
  externalOrderId?: string;          // 외부몰 또는 클라이언트 주문번호 (멱등성 키)
  campaignId?: string;
  brandId?: string;
  athleteId?: string;
  contentId?: string;
  promoCode?: string;
  grossAmount: number;
  discountAmount?: number;
  netAmount: number;
  isNewCustomer?: boolean;
  items: PurchaseItem[];

  // 어트리뷰션
  sessionId?: string;
  anonymousId?: string;
  userId?: string;

  // 메타
  customerEmail?: string;             // hash로만 저장
  ipAddress?: string;
  userAgent?: string;
  occurredAt?: Date;
}

export interface RefundPayload {
  orderId?: string;                   // FunnelOrder.id 또는
  externalOrderId?: string;           // 외부 주문번호 (브랜드 ID 함께 필요)
  brandId?: string;
  refundAmount?: number;              // 부분 환불 시
  reason?: string;
  occurredAt?: Date;
}

export class FunnelOrderService {
  /**
   * 개인정보 해시 (이메일/전화번호 등을 SHA256으로 변환)
   */
  private hashPersonalInfo(info?: string): string | null {
    if (!info) return null;
    return crypto.createHash('sha256').update(info.toLowerCase().trim()).digest('hex');
  }

  /**
   * 구매 처리 (orders + funnel_events 원자적 트랜잭션)
   */
  async createPurchase(payload: CreatePurchasePayload) {
    return prisma.$transaction(async (tx) => {
      // 1) 어트리뷰션 결정
      const attribution = await funnelEventService.attribute(
        {
          campaignId: payload.campaignId,
          brandId: payload.brandId,
          athleteId: payload.athleteId,
          promoCode: payload.promoCode,
          sessionId: payload.sessionId,
        },
        tx
      );

      // 2) FunnelOrder 생성 (멱등: brandId+externalOrderId unique)
      let order;
      try {
        order = await tx.funnelOrder.create({
          data: {
            externalOrderId: payload.externalOrderId,
            campaignId: attribution.campaignId,
            brandId: attribution.brandId,
            athleteId: attribution.athleteId,
            promoCode: attribution.promoCode || payload.promoCode,
            grossAmount: new Decimal(payload.grossAmount),
            discountAmount: new Decimal(payload.discountAmount ?? 0),
            netAmount: new Decimal(payload.netAmount),
            isNewCustomer: payload.isNewCustomer ?? false,
            attributionStatus: attribution.status,
            attributionReason: attribution.reason,
            status: 'PAID',
            items: payload.items as unknown as Prisma.InputJsonValue,
            customerHash: this.hashPersonalInfo(payload.customerEmail),
            paidAt: payload.occurredAt || new Date(),
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          // 멱등 - 이미 처리됨
          const existing = await tx.funnelOrder.findUnique({
            where: {
              brandId_externalOrderId: {
                brandId: attribution.brandId,
                externalOrderId: payload.externalOrderId!,
              },
            },
          });
          return {
            order: existing,
            attribution,
            alreadyProcessed: true,
          };
        }
        throw e;
      }

      // 3) FunnelEvent (PURCHASE) 적재
      await tx.funnelEvent.create({
        data: {
          eventName: 'PURCHASE',
          campaignId: attribution.campaignId,
          brandId: attribution.brandId,
          athleteId: attribution.athleteId,
          contentId: payload.contentId,
          sessionId: payload.sessionId,
          anonymousId: payload.anonymousId,
          userId: payload.userId,
          promoCode: attribution.promoCode,
          payload: {
            order_id: order.id,
            external_order_id: payload.externalOrderId,
            gross_amount: payload.grossAmount,
            net_amount: payload.netAmount,
            items: payload.items as unknown as Prisma.JsonObject,
            attribution_reason: attribution.reason,
          },
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          occurredAt: payload.occurredAt || new Date(),
        },
      });

      // 4) PromoCode usageCount 증가
      if (attribution.promoCode) {
        await promoCodeService.incrementUsage(attribution.promoCode, tx);
      }

      // 5) (선택) 재고 차감 - 내부 미니스토어 상품인 경우
      for (const item of payload.items) {
        const product = await tx.storeProduct.findUnique({ where: { id: item.product_id } });
        if (product) {
          await miniStoreService.decrementStock(item.product_id, item.qty, tx);
        }
      }

      // 6) Phase 3: AttributionTouch에 conversion 연결
      if (payload.sessionId) {
        try {
          await funnelAttributionService.linkConversion(payload.sessionId, order.id, tx);
        } catch (e) {
          console.error('[FunnelOrder] Attribution conversion link failed:', e);
        }
      }

      return {
        order,
        attribution,
        alreadyProcessed: false,
      };
    });
  }

  /**
   * 환불 처리 (FunnelOrder + FunnelEvent + PromoCode + 리포트 보정)
   */
  async refundOrder(payload: RefundPayload) {
    return prisma.$transaction(async (tx) => {
      // 주문 조회
      let order;
      if (payload.orderId) {
        order = await tx.funnelOrder.findUnique({ where: { id: payload.orderId } });
      } else if (payload.externalOrderId && payload.brandId) {
        order = await tx.funnelOrder.findUnique({
          where: {
            brandId_externalOrderId: {
              brandId: payload.brandId,
              externalOrderId: payload.externalOrderId,
            },
          },
        });
      }

      if (!order) throw new NotFoundError('Order not found');
      if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
        return { order, alreadyProcessed: true, adjustedNetRevenue: 0 };
      }

      const refundAmount = new Decimal(payload.refundAmount ?? order.netAmount.toNumber());
      const totalRefunded = order.refundedAmount.add(refundAmount);
      const isFullRefund = totalRefunded.gte(order.netAmount);

      // 주문 상태 업데이트
      const updated = await tx.funnelOrder.update({
        where: { id: order.id },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
          refundedAmount: totalRefunded,
          refundedAt: new Date(),
        },
      });

      // FunnelEvent (REFUND) 적재
      await tx.funnelEvent.create({
        data: {
          eventName: 'REFUND',
          campaignId: order.campaignId,
          brandId: order.brandId,
          athleteId: order.athleteId,
          payload: {
            order_id: order.id,
            external_order_id: order.externalOrderId,
            refund_amount: refundAmount.toNumber(),
            reason: payload.reason,
          },
          occurredAt: payload.occurredAt || new Date(),
        },
      });

      // PromoCode usage 차감 (전액 환불 시)
      if (isFullRefund && order.promoCode) {
        await promoCodeService.decrementUsage(order.promoCode, tx);
      }

      const adjustedNetRevenue = order.netAmount.sub(totalRefunded).toNumber();

      return {
        order: updated,
        alreadyProcessed: false,
        adjustedNetRevenue,
      };
    });
  }

  /**
   * 주문 취소 (PAID 직후 결제 취소)
   */
  async cancelOrder(payload: RefundPayload) {
    return prisma.$transaction(async (tx) => {
      let order;
      if (payload.orderId) {
        order = await tx.funnelOrder.findUnique({ where: { id: payload.orderId } });
      } else if (payload.externalOrderId && payload.brandId) {
        order = await tx.funnelOrder.findUnique({
          where: {
            brandId_externalOrderId: {
              brandId: payload.brandId,
              externalOrderId: payload.externalOrderId,
            },
          },
        });
      }

      if (!order) throw new NotFoundError('Order not found');
      if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
        return { order, alreadyProcessed: true };
      }

      const updated = await tx.funnelOrder.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          refundedAmount: order.netAmount,
          refundedAt: new Date(),
        },
      });

      await tx.funnelEvent.create({
        data: {
          eventName: 'CANCEL',
          campaignId: order.campaignId,
          brandId: order.brandId,
          athleteId: order.athleteId,
          payload: {
            order_id: order.id,
            external_order_id: order.externalOrderId,
            reason: payload.reason,
          },
          occurredAt: payload.occurredAt || new Date(),
        },
      });

      if (order.promoCode) {
        await promoCodeService.decrementUsage(order.promoCode, tx);
      }

      return { order: updated, alreadyProcessed: false };
    });
  }

  /**
   * 주문 상세 조회 (개인정보 해시만 노출)
   */
  async getOrderDetail(id: string, requesterBrandId?: string) {
    const order = await prisma.funnelOrder.findUnique({
      where: { id },
      include: {
        campaign: { select: { name: true } },
        athlete: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundError('Order not found');

    // RBAC: BRAND는 자사 주문만 접근
    if (requesterBrandId && order.brandId !== requesterBrandId) {
      throw new BadRequestError('Forbidden access', 'FORBIDDEN');
    }

    return order;
  }

  /**
   * 브랜드 주문 목록 (개인정보 비노출)
   */
  async listByBrand(brandId: string, params: { from?: Date; to?: Date; status?: FunnelOrderStatus; limit?: number; offset?: number }) {
    const where: Prisma.FunnelOrderWhereInput = { brandId };
    if (params.status) where.status = params.status;
    if (params.from || params.to) {
      where.paidAt = {};
      if (params.from) where.paidAt.gte = params.from;
      if (params.to) where.paidAt.lte = params.to;
    }

    return prisma.funnelOrder.findMany({
      where,
      include: {
        campaign: { select: { name: true } },
        athlete: { select: { name: true, profileImageUrl: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });
  }
}

export const funnelOrderService = new FunnelOrderService();

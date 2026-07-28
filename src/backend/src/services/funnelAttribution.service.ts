/**
 * Multi-touch Attribution Service (Phase 3)
 *
 * - 여러 터치 포인트에 가중치 분배
 * - 모델별:
 *   - FIRST_TOUCH: 첫 터치 100%
 *   - LAST_TOUCH: 마지막 터치 100%
 *   - LINEAR: 모든 터치 균등 분배
 *   - TIME_DECAY: 최근 터치일수록 가중치 ↑ (반감기 7일)
 *   - POSITION_BASED: 첫/마지막 40%, 중간 20% 분배
 */

import prisma from '../models/prisma';
import { Prisma } from '@prisma/client';

// AttributionModel: Prisma enum이 unused이면 export되지 않으므로 string union 사용
export type AttributionModel = 'FIRST_TOUCH' | 'LAST_TOUCH' | 'LINEAR' | 'TIME_DECAY' | 'POSITION_BASED';

export interface TouchInput {
  sessionId: string;
  campaignId: string;
  athleteId: string;
  brandId: string;
  contentId?: string;
  touchType: string;
  touchAt: Date;
  anonymousId?: string;
  userId?: string;
}

export interface AttributedRevenue {
  campaignId: string;
  athleteId: string;
  brandId: string;
  weight: number;
  attributedRevenue: number;
}

export class FunnelAttributionService {
  /**
   * 터치 기록 (랜딩, 클릭, engagement)
   */
  async recordTouch(input: TouchInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;

    const lastTouch = await client.attributionTouch.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { touchOrder: 'desc' },
    });

    return client.attributionTouch.create({
      data: {
        sessionId: input.sessionId,
        anonymousId: input.anonymousId,
        userId: input.userId,
        campaignId: input.campaignId,
        athleteId: input.athleteId,
        brandId: input.brandId,
        contentId: input.contentId,
        touchOrder: (lastTouch?.touchOrder ?? 0) + 1,
        touchType: input.touchType,
        touchAt: input.touchAt,
      },
    });
  }

  /**
   * 구매 발생 시 세션의 모든 터치를 conversion에 연결
   */
  async linkConversion(sessionId: string, orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.attributionTouch.updateMany({
      where: { sessionId, conversionOrderId: null },
      data: { conversionOrderId: orderId },
    });
  }

  /**
   * 모델별 가중치 계산
   */
  private computeWeights(touches: { touchAt: Date }[], model: AttributionModel): number[] {
    const n = touches.length;
    if (n === 0) return [];
    if (n === 1) return [1];

    if (model === 'FIRST_TOUCH') return touches.map((_, i) => (i === 0 ? 1 : 0));
    if (model === 'LAST_TOUCH') return touches.map((_, i) => (i === n - 1 ? 1 : 0));
    if (model === 'LINEAR') return touches.map(() => 1 / n);

    if (model === 'POSITION_BASED') {
      // 40-20-40
      if (n === 2) return [0.5, 0.5];
      const middle = (1 - 0.4 - 0.4) / (n - 2);
      return touches.map((_, i) => {
        if (i === 0 || i === n - 1) return 0.4;
        return middle;
      });
    }

    // TIME_DECAY: 반감기 7일
    const halfLifeDays = 7;
    const lambda = Math.log(2) / (halfLifeDays * 86400 * 1000);
    const lastT = touches[n - 1].touchAt.getTime();
    const raw = touches.map((t) => Math.exp(-lambda * (lastT - t.touchAt.getTime())));
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((w) => w / sum);
  }

  /**
   * 모델별 매출 분배 결과
   */
  async getAttributionByModel(params: { brandId?: string; campaignId?: string; from?: Date; to?: Date; model: AttributionModel }) {
    const orderWhere: Prisma.FunnelOrderWhereInput = { status: { in: ['PAID', 'PARTIAL_REFUND'] } };
    if (params.brandId) orderWhere.brandId = params.brandId;
    if (params.campaignId) orderWhere.campaignId = params.campaignId;
    if (params.from || params.to) {
      orderWhere.paidAt = {};
      if (params.from) orderWhere.paidAt.gte = params.from;
      if (params.to) orderWhere.paidAt.lte = params.to;
    }

    const orders = await prisma.funnelOrder.findMany({
      where: orderWhere,
      select: { id: true, netAmount: true, refundedAmount: true },
    });

    const distribution: Record<string, AttributedRevenue> = {};

    for (const order of orders) {
      const touches = await prisma.attributionTouch.findMany({
        where: { conversionOrderId: order.id },
        orderBy: { touchOrder: 'asc' },
      });
      if (touches.length === 0) continue;

      const weights = this.computeWeights(touches, params.model);
      const orderRevenue = (order.netAmount as any).toNumber() - (order.refundedAmount as any).toNumber();

      touches.forEach((t, i) => {
        const key = `${t.campaignId}_${t.athleteId}_${t.brandId}`;
        if (!distribution[key]) {
          distribution[key] = {
            campaignId: t.campaignId,
            athleteId: t.athleteId,
            brandId: t.brandId,
            weight: 0,
            attributedRevenue: 0,
          };
        }
        distribution[key].weight += weights[i];
        distribution[key].attributedRevenue += orderRevenue * weights[i];
      });
    }

    return Object.values(distribution).sort((a, b) => b.attributedRevenue - a.attributedRevenue);
  }
}

export const funnelAttributionService = new FunnelAttributionService();

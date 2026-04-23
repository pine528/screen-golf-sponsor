/**
 * Funnel Event Service
 *
 * - 모든 풀 퍼널 이벤트 적재 (LANDING_VIEW ~ PURCHASE)
 * - 어트리뷰션 우선순위 적용:
 *   1순위: 주문 시 사용된 promo_code
 *   2순위: 최근 클릭된 트래킹 링크 (sessionRollup.lastClickAt)
 *   3순위: 최근 방문 세션의 campaign_id
 *
 * Refs:
 * - api_spec.docx > 5. 트래킹 이벤트 API
 * - handoff.docx > 6-1. 구매 귀속 우선순위
 * - handoff.docx > 5. 이벤트 수집 표준
 */

import prisma from '../models/prisma';
import { Prisma, FunnelEventType, AttributionStatus } from '@prisma/client';
import { promoCodeService } from './promoCode.service';

export interface BaseEventPayload {
  campaignId?: string;
  brandId?: string;
  athleteId?: string;
  contentId?: string;
  sessionId?: string;
  anonymousId?: string;
  userId?: string;
  promoCode?: string;
  occurredAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  deviceType?: string;
  payload?: Record<string, any>;
}

export interface AttributionResult {
  campaignId: string;
  athleteId: string;
  brandId: string;
  reason: 'promo_code' | 'link_click' | 'session' | 'manual';
  status: AttributionStatus;
  promoCode?: string;
}

export class FunnelEventService {
  /**
   * 일반 이벤트 적재 (PURCHASE 제외 - 별도 트랜잭션)
   */
  async record(eventName: FunnelEventType, payload: BaseEventPayload, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;

    // campaign/brand/athlete 누락 시 sessionRollup에서 폴백
    let { campaignId, brandId, athleteId } = payload;
    if ((!campaignId || !brandId || !athleteId) && payload.sessionId) {
      const rollup = await client.sessionRollup.findUnique({ where: { sessionId: payload.sessionId } });
      campaignId = campaignId || rollup?.lastCampaignId || undefined;
      brandId = brandId || rollup?.lastBrandId || undefined;
      athleteId = athleteId || rollup?.lastAthleteId || undefined;
    }

    if (!campaignId || !brandId || !athleteId) {
      throw new Error(`Missing required attribution fields for event ${eventName}`);
    }

    const event = await client.funnelEvent.create({
      data: {
        eventName,
        campaignId, brandId, athleteId,
        contentId: payload.contentId,
        sessionId: payload.sessionId,
        anonymousId: payload.anonymousId,
        userId: payload.userId,
        promoCode: payload.promoCode,
        payload: payload.payload || {},
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        referrer: payload.referrer,
        deviceType: payload.deviceType,
        occurredAt: payload.occurredAt || new Date(),
      },
    });

    // session rollup 업데이트 (랜딩 진입 시에도)
    if (payload.sessionId && (eventName === 'LANDING_VIEW' || eventName === 'PROMO_APPLY')) {
      await client.sessionRollup.upsert({
        where: { sessionId: payload.sessionId },
        create: {
          sessionId: payload.sessionId,
          anonymousId: payload.anonymousId,
          userId: payload.userId,
          lastCampaignId: campaignId,
          lastAthleteId: athleteId,
          lastBrandId: brandId,
          lastPromoCode: payload.promoCode || null,
          lastClickAt: new Date(),
        },
        update: {
          anonymousId: payload.anonymousId,
          userId: payload.userId,
          lastCampaignId: campaignId,
          lastAthleteId: athleteId,
          lastBrandId: brandId,
          lastPromoCode: payload.promoCode || undefined,
          lastClickAt: new Date(),
        },
      });
    }

    return event;
  }

  /**
   * 어트리뷰션 우선순위 적용 (구매 시 호출)
   *
   * 1순위: 주문 시 사용된 promo_code (코드 직접 입력 포함)
   * 2순위: 최근 클릭된 트래킹 링크
   * 3순위: 최근 방문 세션의 campaign
   */
  async attribute(payload: BaseEventPayload, tx: Prisma.TransactionClient): Promise<AttributionResult> {
    // 1순위: promo code
    if (payload.promoCode) {
      const code = await tx.promoCode.findUnique({
        where: { code: payload.promoCode },
      });
      if (code) {
        return {
          campaignId: code.campaignId,
          athleteId: code.athleteId,
          brandId: code.brandId,
          promoCode: code.code,
          reason: 'promo_code',
          status: 'ATTRIBUTED',
        };
      }
    }

    // 2순위 & 3순위: sessionRollup
    if (payload.sessionId) {
      const rollup = await tx.sessionRollup.findUnique({ where: { sessionId: payload.sessionId } });
      if (rollup?.lastCampaignId && rollup.lastAthleteId && rollup.lastBrandId) {
        return {
          campaignId: rollup.lastCampaignId,
          athleteId: rollup.lastAthleteId,
          brandId: rollup.lastBrandId,
          reason: rollup.lastClickId ? 'link_click' : 'session',
          status: 'ATTRIBUTED',
        };
      }
    }

    // 명시적으로 전달된 값이 있으면 manual
    if (payload.campaignId && payload.athleteId && payload.brandId) {
      return {
        campaignId: payload.campaignId,
        athleteId: payload.athleteId,
        brandId: payload.brandId,
        reason: 'manual',
        status: 'ATTRIBUTED',
      };
    }

    // 귀속 실패
    throw new Error('Attribution failed: no promo_code, session, or explicit IDs provided');
  }

  /**
   * 캠페인별 이벤트 카운트 (퍼널 집계용)
   */
  async countByCampaign(campaignId: string, from?: Date, to?: Date) {
    const where: Prisma.FunnelEventWhereInput = { campaignId };
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = from;
      if (to) where.occurredAt.lte = to;
    }

    const grouped = await prisma.funnelEvent.groupBy({
      by: ['eventName'],
      where,
      _count: { _all: true },
    });

    const result: Record<string, number> = {};
    grouped.forEach((g) => {
      result[g.eventName] = g._count._all;
    });
    return result;
  }
}

export const funnelEventService = new FunnelEventService();

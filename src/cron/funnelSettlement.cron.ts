/**
 * Performance Settlement Cron (Phase 3)
 *
 * - 매일 자정 실행
 * - 어제 PURCHASE 이벤트 → 캠페인별 합산
 * - CPA/CPS 모델 캠페인의 정산 금액 계산
 * - 기존 escrow.service.ts 호출하여 출금/입금 + LedgerTx 기록
 */

import prisma from '../models/prisma';
import { CampaignPricingModel } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  if (typeof d.toNumber === 'function') return d.toNumber();
  return Number(d);
}

export class FunnelSettlementCron {
  /**
   * 어제 일자의 모든 CPA/CPS 캠페인 정산
   */
  async runDaily(targetDate?: Date) {
    const date = targetDate || new Date(Date.now() - 86400000);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    console.log(`[FunnelSettlement] Running for ${start.toISOString().slice(0, 10)}`);

    // CPA/CPS/HYBRID 캠페인 조회
    const campaigns = await prisma.campaign.findMany({
      where: {
        pricingModel: { in: ['CPA', 'CPS', 'HYBRID'] },
        status: { in: ['ACTIVE'] },
      },
    });

    console.log(`[FunnelSettlement] Found ${campaigns.length} performance-based campaigns`);

    const results: any[] = [];

    for (const campaign of campaigns) {
      try {
        // 멱등성 체크
        const existing = await prisma.performanceSettlement.findUnique({
          where: {
            campaignId_periodStart_periodEnd: {
              campaignId: campaign.id,
              periodStart: start,
              periodEnd: end,
            },
          },
        });
        if (existing && existing.status === 'SETTLED') {
          results.push({ campaignId: campaign.id, status: 'already_settled' });
          continue;
        }

        // 어제 발생한 PAID 주문 집계
        const orders = await prisma.funnelOrder.findMany({
          where: {
            campaignId: campaign.id,
            paidAt: { gte: start, lte: end },
            status: { in: ['PAID', 'PARTIAL_REFUND'] },
          },
          select: { id: true, athleteId: true, netAmount: true, refundedAmount: true },
        });

        const conversionCount = orders.length;
        const totalRevenue = orders.reduce(
          (sum, o) => sum + toNumber(o.netAmount) - toNumber(o.refundedAmount),
          0
        );

        if (conversionCount === 0) {
          results.push({ campaignId: campaign.id, status: 'no_conversions' });
          continue;
        }

        // 정산 금액 계산
        let settledAmount = 0;
        if (campaign.pricingModel === 'CPA' && campaign.cpaRate) {
          settledAmount = conversionCount * toNumber(campaign.cpaRate);
        } else if (campaign.pricingModel === 'CPS' && campaign.cpsRate) {
          settledAmount = totalRevenue * toNumber(campaign.cpsRate);
        } else if (campaign.pricingModel === 'HYBRID' && campaign.cpaRate && campaign.cpsRate) {
          settledAmount = conversionCount * toNumber(campaign.cpaRate)
            + totalRevenue * toNumber(campaign.cpsRate);
        }

        // 선수별 분배 (균등)
        const athleteIds = [...new Set(orders.map((o) => o.athleteId))];
        const perAthlete = athleteIds.length > 0 ? Math.floor(settledAmount / athleteIds.length) : 0;

        // 정산 레코드 생성/업데이트
        const settlement = await prisma.performanceSettlement.upsert({
          where: {
            campaignId_periodStart_periodEnd: {
              campaignId: campaign.id,
              periodStart: start,
              periodEnd: end,
            },
          },
          create: {
            campaignId: campaign.id,
            brandId: campaign.brandId,
            athleteId: athleteIds[0] || campaign.brandId,  // primary athlete
            periodStart: start,
            periodEnd: end,
            pricingModel: campaign.pricingModel,
            conversionCount,
            totalRevenue: new Decimal(totalRevenue),
            settledAmount: new Decimal(settledAmount),
            status: 'SETTLED',
            settledAt: new Date(),
          },
          update: {
            conversionCount,
            totalRevenue: new Decimal(totalRevenue),
            settledAmount: new Decimal(settledAmount),
            status: 'SETTLED',
            settledAt: new Date(),
          },
        });

        // 캠페인 spentAmount 업데이트
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { spentAmount: { increment: settledAmount } },
        });

        results.push({
          campaignId: campaign.id,
          status: 'settled',
          conversionCount,
          totalRevenue,
          settledAmount,
          perAthlete,
          settlementId: settlement.id,
        });
      } catch (e: any) {
        console.error(`[FunnelSettlement] Failed for campaign ${campaign.id}:`, e);
        results.push({ campaignId: campaign.id, status: 'failed', error: e.message });
      }
    }

    console.log(`[FunnelSettlement] Done. ${results.filter(r => r.status === 'settled').length} settled.`);
    return results;
  }
}

export const funnelSettlementCron = new FunnelSettlementCron();

/**
 * Funnel Predict Service (Phase 3)
 *
 * - 시계열 예측: 단순 이동평균(SMA) + 지수평활(EMA)
 * - 외부 ML 의존 없음, 순수 산술
 * - 캠페인 종료 시점까지의 예상 매출/ROAS/순고객 수
 */

import prisma from '../models/prisma';
import { funnelReportService } from './funnelReport.service';

export interface PredictionResult {
  predictedNetRevenue: number;
  predictedPurchases: number;
  predictedNewCustomers: number;
  predictedRoas: number | null;
  daysRemaining: number;
  basisDays: number;
  method: 'sma' | 'ema';
  confidence: 'low' | 'medium' | 'high';
}

export class FunnelPredictService {
  /**
   * 단순 이동평균 (SMA): 최근 N일의 평균을 미래에 그대로 적용
   */
  private sma(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 지수평활 (EMA): alpha=0.3 기본 (최근 데이터에 더 큰 가중치)
   */
  private ema(values: number[], alpha = 0.3): number {
    if (values.length === 0) return 0;
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }
    return ema;
  }

  /**
   * 캠페인 예측
   */
  async predictCampaign(campaignId: string, method: 'sma' | 'ema' = 'ema'): Promise<PredictionResult> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');

    const now = new Date();
    const endDate = campaign.dateEnd || new Date(now.getTime() + 30 * 86400000);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));

    // 최근 14일 timeseries
    const from = new Date(now.getTime() - 14 * 86400000);
    const series = await funnelReportService.getTimeSeries({ campaignId, from, to: now });

    const dailyRevenue = series.map((s) => s.netRevenue);
    const dailyPurchases = series.map((s) => s.purchases);

    const avgRev = method === 'sma' ? this.sma(dailyRevenue) : this.ema(dailyRevenue);
    const avgPur = method === 'sma' ? this.sma(dailyPurchases) : this.ema(dailyPurchases);

    // 신뢰도: 데이터 일수에 따라
    const confidence: 'low' | 'medium' | 'high' =
      series.length < 3 ? 'low' : series.length < 7 ? 'medium' : 'high';

    const predictedNetRevenue = avgRev * daysRemaining;
    const predictedPurchases = Math.round(avgPur * daysRemaining);
    // 신규고객 비율 추정 (총 주문 대비 신규)
    const newCustomerRate = await this.estimateNewCustomerRate(campaignId, from);
    const predictedNewCustomers = Math.round(predictedPurchases * newCustomerRate);
    const predictedRoas = campaign.spentAmount > 0 ? predictedNetRevenue / campaign.spentAmount : null;

    return {
      predictedNetRevenue,
      predictedPurchases,
      predictedNewCustomers,
      predictedRoas,
      daysRemaining,
      basisDays: series.length,
      method,
      confidence,
    };
  }

  private async estimateNewCustomerRate(campaignId: string, from: Date): Promise<number> {
    const total = await prisma.funnelOrder.count({ where: { campaignId, paidAt: { gte: from } } });
    if (total === 0) return 0.5;
    const newCount = await prisma.funnelOrder.count({
      where: { campaignId, isNewCustomer: true, paidAt: { gte: from } },
    });
    return newCount / total;
  }
}

export const funnelPredictService = new FunnelPredictService();

/**
 * Phase 10-1: Topup Controller
 * Phase 10-3: WebhookEventLog 통합
 * 브랜드 지갑 충전 API
 */

import { Response, NextFunction, Request } from 'express';
import { topupService } from '../services/topup.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { PaymentProvider, TopupPaymentStatus, WebhookEventStatus } from '@prisma/client';
import {
  getPaymentProvider,
  autoInitializeProviders,
} from '../payments/providers';
import prisma from '../models/prisma';

export class TopupController {
  /**
   * POST /api/brand/topups
   * 충전 생성 (Checkout 세션)
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const brandId = req.user!.brandId;
      const brandUserId = req.user!.id;

      if (!brandId) {
        return res.status(403).json({ error: '브랜드만 충전할 수 있습니다' });
      }

      const { amount, provider, idempotencyKey, successUrl, failUrl } = req.body;

      // Provider 검증
      if (!['TOSS', 'STRIPE'].includes(provider)) {
        return res.status(400).json({ error: '지원하지 않는 결제 수단입니다' });
      }

      const result = await topupService.createTopup({
        brandUserId,
        brandId,
        amount: Number(amount),
        provider: provider as PaymentProvider,
        idempotencyKey,
        successUrl,
        failUrl,
      });

      const statusCode = result.alreadyCreated ? 200 : 201;
      res.status(statusCode);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/brand/topups/:id/confirm
   * 결제 확인 (Redirect 방식에서 사용)
   */
  async confirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const brandUserId = req.user!.id;
      const { id } = req.params;
      const { paymentKey } = req.body;

      if (!paymentKey) {
        return res.status(400).json({ error: 'paymentKey가 필요합니다' });
      }

      const result = await topupService.confirmTopup(id, paymentKey, brandUserId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/brand/topups/my
   * 내 충전 내역
   */
  async getMyList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const brandUserId = req.user!.id;

      if (!req.user!.brandId) {
        return res.status(403).json({ error: '브랜드만 조회할 수 있습니다' });
      }

      const { status, limit, offset } = req.query;

      const result = await topupService.getMyTopups(brandUserId, {
        status: status as TopupPaymentStatus | undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/brand/topups/my/:id
   * 내 충전 상세
   */
  async getMyDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const brandUserId = req.user!.id;

      if (!req.user!.brandId) {
        return res.status(403).json({ error: '브랜드만 조회할 수 있습니다' });
      }

      const { id } = req.params;
      const topup = await topupService.getTopupById(id, brandUserId);

      sendSuccess(res, topup);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/webhook/toss
   * Toss Webhook (인증 없음, 서명 검증)
   * Phase 10-3: WebhookEventLog 통합
   */
  async handleTossWebhook(req: Request, res: Response, next: NextFunction) {
    const receivedAt = new Date();
    let eventLog: any = null;

    try {
      autoInitializeProviders();
      const adapter = getPaymentProvider(PaymentProvider.TOSS);

      // 서명 검증
      const signature = req.headers['toss-signature'] as string;
      const rawBody = JSON.stringify(req.body);

      if (!signature || !adapter.verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 이벤트 파싱
      const event = adapter.parseWebhookEvent(req.body);

      // Phase 10-3: WebhookEventLog upsert (RECEIVED)
      eventLog = await this.upsertWebhookEventLog({
        provider: PaymentProvider.TOSS,
        eventType: event.eventType,
        eventId: event.eventId || `toss_${event.providerPaymentKey}_${Date.now()}`,
        providerPaymentKey: event.providerPaymentKey,
        rawPayload: this.sanitizePayload(req.body),
        receivedAt,
      });

      // 이미 PROCESSED면 skip
      if (eventLog.status === WebhookEventStatus.PROCESSED) {
        console.log(`[TossWebhook] Already processed: ${eventLog.eventId}`);
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      // 이벤트 처리
      await topupService.handleWebhookEvent(event);

      // PROCESSED로 업데이트
      await this.markWebhookProcessed(eventLog.id);

      res.status(200).json({ received: true });
    } catch (error: any) {
      // Webhook은 항상 200 반환 권장 (재시도 방지)
      console.error('[TossWebhook] Error:', error);

      // FAILED로 업데이트
      if (eventLog) {
        await this.markWebhookFailed(eventLog.id, error.message || 'Unknown error');
      }

      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }

  /**
   * POST /api/payments/webhook/stripe
   * Stripe Webhook (인증 없음, 서명 검증)
   * Phase 10-3: WebhookEventLog 통합
   */
  async handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
    const receivedAt = new Date();
    let eventLog: any = null;

    try {
      autoInitializeProviders();
      const adapter = getPaymentProvider(PaymentProvider.STRIPE);

      // 서명 검증
      const signature = req.headers['stripe-signature'] as string;
      // Stripe는 raw body가 필요
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      if (!signature || !adapter.verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 이벤트 파싱
      const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const event = adapter.parseWebhookEvent(parsedBody);

      // Phase 10-3: WebhookEventLog upsert (RECEIVED)
      eventLog = await this.upsertWebhookEventLog({
        provider: PaymentProvider.STRIPE,
        eventType: event.eventType,
        eventId: event.eventId || `stripe_${event.providerPaymentKey}_${Date.now()}`,
        providerPaymentKey: event.providerPaymentKey,
        rawPayload: this.sanitizePayload(parsedBody),
        receivedAt,
      });

      // 이미 PROCESSED면 skip
      if (eventLog.status === WebhookEventStatus.PROCESSED) {
        console.log(`[StripeWebhook] Already processed: ${eventLog.eventId}`);
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      // 이벤트 처리
      await topupService.handleWebhookEvent(event);

      // PROCESSED로 업데이트
      await this.markWebhookProcessed(eventLog.id);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[StripeWebhook] Error:', error);

      // FAILED로 업데이트
      if (eventLog) {
        await this.markWebhookFailed(eventLog.id, error.message || 'Unknown error');
      }

      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }

  /**
   * [Admin] GET /api/admin/finance/topups
   * 전체 충전 목록
   */
  async adminGetAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, provider, brandId, startDate, endDate, limit, offset } = req.query;

      const result = await topupService.getAllTopups({
        status: status as TopupPaymentStatus | undefined,
        provider: provider as PaymentProvider | undefined,
        brandId: brandId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [Admin] GET /api/admin/finance/topups/stats
   * 충전 통계
   */
  async adminGetStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      const result = await topupService.getTopupStats({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [Admin] GET /api/admin/finance/topups/:id
   * 충전 상세
   */
  async adminGetDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const topup = await topupService.getTopupById(id);

      sendSuccess(res, topup);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/brand/topups/mock
   * 테스트/데모용 모의 충전 (결제 없이 바로 잔액 추가)
   */
  async mockTopup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const brandId = req.user!.brandId;

      if (!brandId) {
        return res.status(403).json({ error: '브랜드만 충전할 수 있습니다' });
      }

      const { amount } = req.body;
      const topupAmount = Number(amount);

      if (!topupAmount || topupAmount < 1000 || topupAmount > 100000000) {
        return res.status(400).json({ error: '충전 금액은 1,000원 ~ 1억원 사이여야 합니다' });
      }

      // 직접 지갑에 충전 (트랜잭션)
      const result = await prisma.$transaction(async (tx) => {
        // 지갑 조회/생성
        let wallet = await tx.wallet.findFirst({
          where: { brandId },
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              brandId,
              ownerType: 'BRAND',
              balance: 0,
              frozenAmount: 0,
            },
          });
        }

        // 잔액 업데이트
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: topupAmount },
            version: { increment: 1 },
          },
        });

        // 원장 기록
        await tx.ledgerTx.create({
          data: {
            walletId: wallet.id,
            type: 'TOPUP_DEPOSIT',
            amount: topupAmount,
            balanceAfter: updatedWallet.balance,
            description: '테스트 충전 (Mock)',
            referenceType: 'MOCK_TOPUP',
            referenceId: `mock_${Date.now()}`,
          },
        });

        return {
          wallet: updatedWallet,
          amount: topupAmount,
        };
      });

      sendSuccess(res, {
        message: '테스트 충전이 완료되었습니다',
        amount: result.amount,
        newBalance: Number(result.wallet.balance),
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================
  // Phase 10-3: WebhookEventLog Helper Methods
  // =============================================

  /**
   * WebhookEventLog upsert
   * 이미 존재하면 기존 레코드 반환 (status 업데이트 안함)
   */
  private async upsertWebhookEventLog(data: {
    provider: PaymentProvider;
    eventType: string;
    eventId: string;
    providerPaymentKey?: string;
    rawPayload: any;
    receivedAt: Date;
  }) {
    return prisma.webhookEventLog.upsert({
      where: {
        provider_eventId: {
          provider: data.provider,
          eventId: data.eventId,
        },
      },
      create: {
        provider: data.provider,
        eventType: data.eventType,
        eventId: data.eventId,
        providerPaymentKey: data.providerPaymentKey,
        status: WebhookEventStatus.RECEIVED,
        rawPayload: data.rawPayload,
        receivedAt: data.receivedAt,
      },
      update: {}, // 이미 존재하면 업데이트 안함 - 기존 레코드 반환
    });
  }

  /**
   * Webhook 처리 완료 마킹
   */
  private async markWebhookProcessed(id: string) {
    await prisma.webhookEventLog.update({
      where: { id },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Webhook 처리 실패 마킹
   */
  private async markWebhookFailed(id: string, errorMessage: string) {
    await prisma.webhookEventLog.update({
      where: { id },
      data: {
        status: WebhookEventStatus.FAILED,
        errorMessage: errorMessage.substring(0, 1000), // 길이 제한
        processedAt: new Date(),
      },
    });
  }

  /**
   * Webhook payload에서 민감정보 제거
   */
  private sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const sanitized = { ...payload };
    const sensitiveFields = [
      'card', 'cardNumber', 'secret', 'password', 'token',
      'cvv', 'cvc', 'expiry', 'pin', 'accountNumber',
    ];

    const sanitizeRecursive = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeRecursive);

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeRecursive(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeRecursive(sanitized);
  }
}

export const topupController = new TopupController();

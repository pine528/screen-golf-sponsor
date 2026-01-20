/**
 * Phase 10-1: Toss Payments Adapter
 * https://docs.tosspayments.com/reference
 */

import { PaymentProvider } from '@prisma/client';
import crypto from 'crypto';
import {
  PaymentProviderAdapter,
  CheckoutRequest,
  CheckoutResponse,
  PaymentConfirmation,
  WebhookEvent,
  TossPaymentsConfig,
  RefundResult,
} from './types';

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

export class TossPaymentsAdapter implements PaymentProviderAdapter {
  readonly providerName = PaymentProvider.TOSS;

  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(config: TossPaymentsConfig, frontendUrl: string) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.frontendUrl = frontendUrl;
  }

  /**
   * Toss Checkout 세션 생성
   * 실제로는 Toss SDK를 사용하여 클라이언트에서 결제 위젯을 띄우는 방식 권장
   * 여기서는 서버에서 결제 URL을 생성하는 간단한 방식 구현
   */
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    // Toss는 클라이언트 SDK 방식이 권장되므로,
    // 서버에서는 결제 정보를 저장하고 클라이언트에서 SDK로 결제 진행
    // 여기서는 Checkout URL 형태로 반환 (실제로는 프론트엔드에서 SDK 호출)

    const orderId = `topup_${request.orderId}`;

    // Toss 결제 페이지로 리다이렉트할 URL 구성
    // 실제 프로덕션에서는 Toss Checkout SDK를 사용
    const checkoutUrl = `${this.frontendUrl}/brand/wallet/checkout?` +
      `orderId=${encodeURIComponent(orderId)}&` +
      `amount=${request.amount}&` +
      `provider=toss`;

    return {
      checkoutUrl,
      providerOrderId: orderId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30분
    };
  }

  /**
   * 결제 승인 (Confirm Payment)
   * 클라이언트에서 결제 완료 후 paymentKey를 받아 서버에서 승인 API 호출
   */
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<PaymentConfirmation> {
    const authHeader = Buffer.from(`${this.secretKey}:`).toString('base64');

    const response = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { code?: string; message?: string };
      throw new Error(`Toss confirm failed: ${error.code} - ${error.message}`);
    }

    const data = await response.json() as {
      paymentKey: string;
      orderId: string;
      totalAmount: number;
      approvedAt: string;
    };

    return {
      providerPaymentKey: data.paymentKey,
      providerOrderId: data.orderId,
      amount: data.totalAmount,
      paidAt: new Date(data.approvedAt),
      rawPayload: data,
    };
  }

  /**
   * Webhook 서명 검증
   * Toss는 HMAC-SHA256으로 서명
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Webhook 이벤트 파싱
   */
  parseWebhookEvent(payload: any): WebhookEvent {
    const { eventType, data } = payload;

    let mappedEventType: WebhookEvent['eventType'];
    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        if (data.status === 'DONE') {
          mappedEventType = 'PAYMENT_CONFIRMED';
        } else if (data.status === 'CANCELED') {
          mappedEventType = 'PAYMENT_CANCELED';
        } else if (data.status === 'ABORTED' || data.status === 'EXPIRED') {
          mappedEventType = 'PAYMENT_FAILED';
        } else {
          mappedEventType = 'PAYMENT_FAILED';
        }
        break;
      case 'REFUND_STATUS_CHANGED':
        mappedEventType = 'REFUND_COMPLETED';
        break;
      default:
        mappedEventType = 'PAYMENT_FAILED';
    }

    return {
      eventType: mappedEventType,
      eventId: payload.createdAt ? `toss_${data.paymentKey}_${payload.createdAt}` : undefined, // Phase 10-3: 이벤트 ID
      providerPaymentKey: data.paymentKey,
      providerOrderId: data.orderId,
      amount: data.totalAmount || data.amount || 0,
      paidAt: data.approvedAt ? new Date(data.approvedAt) : undefined,
      failureCode: data.failure?.code,
      failureReason: data.failure?.message,
      rawPayload: payload,
    };
  }

  /**
   * Phase 10-2: 결제 환불
   * TODO: 추후 구현 예정
   */
  async refundPayment(_paymentKey: string, _amount: number, _reason: string): Promise<RefundResult> {
    // Toss 환불 API는 추후 구현 예정
    throw new Error('Toss refund not implemented yet. Use Stripe for refunds.');
  }
}

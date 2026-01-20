/**
 * Phase 10-1: Stripe Adapter
 * https://docs.stripe.com/api
 */

import { PaymentProvider } from '@prisma/client';
import crypto from 'crypto';
import {
  PaymentProviderAdapter,
  CheckoutRequest,
  CheckoutResponse,
  PaymentConfirmation,
  WebhookEvent,
  StripeConfig,
  RefundResult,
} from './types';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export class StripeAdapter implements PaymentProviderAdapter {
  readonly providerName = PaymentProvider.STRIPE;

  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(config: StripeConfig, frontendUrl: string) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.frontendUrl = frontendUrl;
  }

  /**
   * Stripe Checkout Session 생성
   */
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${request.successUrl}?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', request.failUrl);
    params.append('line_items[0][price_data][currency]', 'krw');
    params.append('line_items[0][price_data][product_data][name]', '지갑 충전');
    params.append('line_items[0][price_data][unit_amount]', String(request.amount));
    params.append('line_items[0][quantity]', '1');
    params.append('client_reference_id', request.orderId);

    if (request.customerEmail) {
      params.append('customer_email', request.customerEmail);
    }

    if (request.metadata) {
      Object.entries(request.metadata).forEach(([key, value]) => {
        params.append(`metadata[${key}]`, value);
      });
    }

    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(`Stripe checkout failed: ${error.error?.message || 'Unknown error'}`);
    }

    const session = await response.json() as {
      url: string;
      id: string;
      expires_at?: number;
    };

    return {
      checkoutUrl: session.url,
      providerOrderId: session.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  /**
   * 결제 확인 (Checkout Session 조회)
   */
  async confirmPayment(
    sessionId: string,
    _orderId: string,
    _amount: number
  ): Promise<PaymentConfirmation> {
    const response = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${sessionId}?expand[]=payment_intent`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(`Stripe session retrieve failed: ${error.error?.message || 'Unknown error'}`);
    }

    const session = await response.json() as {
      id: string;
      payment_status: string;
      payment_intent?: { id: string };
      amount_total: number;
      created: number;
    };

    if (session.payment_status !== 'paid') {
      throw new Error(`Payment not completed: status=${session.payment_status}`);
    }

    return {
      providerPaymentKey: session.payment_intent?.id || session.id,
      providerOrderId: session.id,
      amount: session.amount_total,
      paidAt: new Date(session.created * 1000),
      rawPayload: session,
    };
  }

  /**
   * Webhook 서명 검증 (Stripe signature scheme)
   * https://docs.stripe.com/webhooks/signatures
   */
  verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
    const parts = signatureHeader.split(',');
    let timestamp: string | undefined;
    let signature: string | undefined;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signature = value;
    }

    if (!timestamp || !signature) {
      return false;
    }

    // Check timestamp (5분 이내)
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Webhook 이벤트 파싱
   */
  parseWebhookEvent(payload: any): WebhookEvent {
    const { type, data } = payload;
    const object = data.object;

    let eventType: WebhookEvent['eventType'];
    let amount = 0;
    let providerPaymentKey = '';
    let providerOrderId = '';
    let paidAt: Date | undefined;
    let failureCode: string | undefined;
    let failureReason: string | undefined;
    let refundId: string | undefined;
    let chargebackId: string | undefined;

    switch (type) {
      case 'checkout.session.completed':
        eventType = 'PAYMENT_CONFIRMED';
        amount = object.amount_total;
        providerPaymentKey = object.payment_intent || object.id;
        providerOrderId = object.id;
        paidAt = new Date(object.created * 1000);
        break;

      case 'checkout.session.expired':
        eventType = 'PAYMENT_FAILED';
        providerOrderId = object.id;
        failureCode = 'SESSION_EXPIRED';
        failureReason = 'Checkout session expired';
        break;

      case 'payment_intent.payment_failed':
        eventType = 'PAYMENT_FAILED';
        amount = object.amount;
        providerPaymentKey = object.id;
        failureCode = object.last_payment_error?.code;
        failureReason = object.last_payment_error?.message;
        break;

      case 'payment_intent.canceled':
        eventType = 'PAYMENT_CANCELED';
        amount = object.amount;
        providerPaymentKey = object.id;
        break;

      case 'charge.refunded':
        eventType = 'REFUND_COMPLETED';
        amount = object.amount_refunded;
        providerPaymentKey = object.payment_intent;
        // Get the latest refund ID from the refunds array
        if (object.refunds?.data?.length > 0) {
          const latestRefund = object.refunds.data[0];
          refundId = latestRefund.id;
        }
        break;

      case 'charge.dispute.created':
        eventType = 'CHARGEBACK';
        amount = object.amount;
        providerPaymentKey = object.payment_intent;
        chargebackId = object.id;
        break;

      default:
        eventType = 'PAYMENT_FAILED';
        failureCode = 'UNKNOWN_EVENT';
        failureReason = `Unknown event type: ${type}`;
    }

    return {
      eventType,
      eventId: payload.id, // Phase 10-3: Stripe 이벤트 ID
      providerPaymentKey,
      providerOrderId,
      amount,
      paidAt,
      failureCode,
      failureReason,
      refundId,
      chargebackId,
      rawPayload: payload,
    };
  }

  /**
   * Phase 10-2: 결제 환불
   * https://docs.stripe.com/api/refunds/create
   */
  async refundPayment(paymentKey: string, amount: number, reason: string): Promise<RefundResult> {
    const params = new URLSearchParams();
    params.append('payment_intent', paymentKey);
    params.append('amount', String(amount)); // Stripe는 smallest unit (원)
    params.append('reason', 'requested_by_customer');
    params.append('metadata[reason]', reason);

    const response = await fetch(`${STRIPE_API_BASE}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const refund = await response.json() as {
      id: string;
      amount: number;
      status: string;
      failure_reason?: string;
    };

    if (!response.ok) {
      const error = refund as unknown as { error?: { message?: string } };
      return {
        providerRefundId: '',
        amount: amount,
        status: 'FAILED',
        failureReason: error.error?.message || 'Unknown error',
        rawPayload: refund,
      };
    }

    return {
      providerRefundId: refund.id,
      amount: refund.amount,
      status: refund.status === 'succeeded' ? 'SUCCESS' : refund.status === 'pending' ? 'PENDING' : 'FAILED',
      failureReason: refund.failure_reason,
      rawPayload: refund,
    };
  }
}

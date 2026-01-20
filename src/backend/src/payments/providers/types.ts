/**
 * Phase 10-1: Payment Provider Adapter Types
 * Toss Payments / Stripe 공통 인터페이스
 */

import { PaymentProvider } from '@prisma/client';

// ==========================================
// Checkout (결제 생성)
// ==========================================

export interface CheckoutRequest {
  orderId: string;       // 내부 주문 ID (TopupPayment.id 또는 UUID)
  amount: number;        // 결제 금액 (원 단위)
  successUrl: string;    // 결제 성공 시 리다이렉트 URL
  failUrl: string;       // 결제 실패 시 리다이렉트 URL
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  checkoutUrl: string;         // PG 결제 페이지 URL
  providerOrderId: string;     // PG에서 사용하는 주문 ID
  expiresAt?: Date;            // 체크아웃 세션 만료 시간
}

// ==========================================
// Payment Confirmation (결제 확인)
// ==========================================

export interface PaymentConfirmation {
  providerPaymentKey: string;  // PG 결제 키 (Toss paymentKey, Stripe paymentIntentId)
  providerOrderId: string;
  amount: number;
  paidAt: Date;
  rawPayload: any;
}

// ==========================================
// Webhook Event
// ==========================================

export type WebhookEventType =
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELED'
  | 'REFUND_COMPLETED'
  | 'CHARGEBACK';

export interface WebhookEvent {
  eventType: WebhookEventType;
  eventId?: string;            // Phase 10-3: 이벤트 고유 ID (멱등성 키)
  providerPaymentKey: string;
  providerOrderId: string;
  amount: number;
  paidAt?: Date;
  failureCode?: string;
  failureReason?: string;
  refundId?: string;         // Phase 10-2: 환불 ID (REFUND_COMPLETED 이벤트에서 사용)
  chargebackId?: string;     // Phase 10-2: 차지백 ID (CHARGEBACK 이벤트에서 사용)
  rawPayload: any;
}

// ==========================================
// Phase 10-2: Refund
// ==========================================

export type RefundResultStatus = 'SUCCESS' | 'PENDING' | 'FAILED';

export interface RefundResult {
  providerRefundId: string;
  amount: number;
  status: RefundResultStatus;
  failureReason?: string;
  rawPayload: any;
}

// ==========================================
// Provider Adapter Interface
// ==========================================

export interface PaymentProviderAdapter {
  readonly providerName: PaymentProvider;

  /**
   * Checkout 세션 생성 (결제 페이지 URL 반환)
   */
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;

  /**
   * 결제 확인 (Redirect 방식에서 성공 URL 도착 후 호출)
   * Toss: confirmPayment API 호출
   * Stripe: PaymentIntent retrieve
   */
  confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<PaymentConfirmation>;

  /**
   * Webhook 서명 검증
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Webhook 페이로드 파싱
   */
  parseWebhookEvent(payload: any): WebhookEvent;

  /**
   * Phase 10-2: 결제 환불
   * @param paymentKey - PG 결제 키 (providerPaymentKey)
   * @param amount - 환불 금액 (원 단위)
   * @param reason - 환불 사유
   */
  refundPayment(paymentKey: string, amount: number, reason: string): Promise<RefundResult>;
}

// ==========================================
// Provider Config
// ==========================================

export interface TossPaymentsConfig {
  secretKey: string;
  webhookSecret: string;
  clientKey?: string;  // Frontend용
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;  // Frontend용
}

export interface PaymentProvidersConfig {
  toss?: TossPaymentsConfig;
  stripe?: StripeConfig;
  frontendUrl: string;
}

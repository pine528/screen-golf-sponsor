/**
 * Phase 10-1: Payment Provider Factory
 */

import { PaymentProvider } from '@prisma/client';
import { TossPaymentsAdapter } from './toss';
import { StripeAdapter } from './stripe';
import { PaymentProviderAdapter, PaymentProvidersConfig } from './types';

export * from './types';

let providersConfig: PaymentProvidersConfig | null = null;
const adapters = new Map<PaymentProvider, PaymentProviderAdapter>();

/**
 * Provider 설정 초기화
 */
export function initializePaymentProviders(config: PaymentProvidersConfig): void {
  providersConfig = config;
  adapters.clear();

  if (config.toss?.secretKey) {
    adapters.set(
      PaymentProvider.TOSS,
      new TossPaymentsAdapter(config.toss, config.frontendUrl)
    );
  }

  if (config.stripe?.secretKey) {
    adapters.set(
      PaymentProvider.STRIPE,
      new StripeAdapter(config.stripe, config.frontendUrl)
    );
  }
}

/**
 * Provider Adapter 반환
 */
export function getPaymentProvider(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(`Payment provider ${provider} is not configured`);
  }
  return adapter;
}

/**
 * 지원하는 Provider 목록 반환
 */
export function getAvailableProviders(): PaymentProvider[] {
  return Array.from(adapters.keys());
}

/**
 * Provider 설정 여부 확인
 */
export function isProviderConfigured(provider: PaymentProvider): boolean {
  return adapters.has(provider);
}

/**
 * 환경변수에서 설정 로드
 */
export function loadPaymentProvidersFromEnv(): PaymentProvidersConfig {
  return {
    toss: process.env.TOSS_SECRET_KEY ? {
      secretKey: process.env.TOSS_SECRET_KEY,
      webhookSecret: process.env.TOSS_WEBHOOK_SECRET || '',
      clientKey: process.env.TOSS_CLIENT_KEY,
    } : undefined,
    stripe: process.env.STRIPE_SECRET_KEY ? {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    } : undefined,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  };
}

/**
 * 환경변수로 자동 초기화
 */
export function autoInitializeProviders(): void {
  if (providersConfig === null) {
    const config = loadPaymentProvidersFromEnv();
    initializePaymentProviders(config);
  }
}

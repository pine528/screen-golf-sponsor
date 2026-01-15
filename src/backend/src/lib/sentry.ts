/**
 * Sentry 초기화 및 설정
 * 에러 트래킹 및 성능 모니터링
 */

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || 'unknown';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // 민감한 정보 필터링
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  initialized = true;
  console.log(`[Sentry] Initialized (env: ${SENTRY_ENVIRONMENT}, release: ${SENTRY_RELEASE})`);
}

/**
 * 에러 캡처 (requestId 태깅 포함)
 */
export function captureError(error: Error, extras?: Record<string, any>): void {
  if (!SENTRY_DSN) {
    console.error('[Error]', error.message, extras);
    return;
  }

  Sentry.withScope((scope) => {
    if (extras) {
      Object.entries(extras).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * 커스텀 이벤트 캡처 (에스크로 이벤트 등)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', extras?: Record<string, any>): void {
  if (!SENTRY_DSN) {
    console.log(`[${level.toUpperCase()}] ${message}`, extras);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (extras) {
      Object.entries(extras).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

/**
 * 사용자 컨텍스트 설정
 */
export function setUser(user: { id: string; email?: string; role?: string }): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(user);
}

/**
 * 태그 설정
 */
export function setTag(key: string, value: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setTag(key, value);
}

export { Sentry };

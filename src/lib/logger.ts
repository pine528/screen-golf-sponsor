/**
 * 구조화된 로깅 유틸리티
 * 에스크로/정산 이벤트 로그 표준화
 */

import { captureMessage } from './sentry';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  userRole?: string;
  [key: string]: any;
}

interface EscrowLogEvent {
  action: 'ESCROW_HOLD' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'ESCROW_EXPIRED';
  contractId: string;
  escrowId?: string;
  brandId?: string;
  athleteId?: string;
  grossAmount?: string | number;
  platformFee?: string | number;
  athletePayout?: string | number;
  reason?: string;
  requestId?: string;
  actorType?: string;
  actorId?: string;
}

interface WalletLogEvent {
  action: 'WALLET_CREDIT' | 'WALLET_DEBIT' | 'WALLET_FREEZE' | 'WALLET_UNFREEZE';
  walletId: string;
  ownerType: string;
  ownerId: string;
  amount: string | number;
  balanceAfter: string | number;
  refType?: string;
  refId?: string;
  requestId?: string;
}

/**
 * 기본 로거
 */
export function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context,
  };

  const logLine = JSON.stringify(logData);

  switch (level) {
    case 'error':
      console.error(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    case 'debug':
      if (process.env.NODE_ENV !== 'production') {
        console.debug(logLine);
      }
      break;
    default:
      console.log(logLine);
  }
}

/**
 * 에스크로 이벤트 로그 (표준화)
 */
export function logEscrowEvent(event: EscrowLogEvent): void {
  const {
    action,
    contractId,
    escrowId,
    brandId,
    athleteId,
    grossAmount,
    platformFee,
    athletePayout,
    reason,
    requestId,
    actorType,
    actorId,
  } = event;

  const message = `[ESCROW] ${action} contract=${contractId}`;
  const context: LogContext = {
    category: 'escrow',
    action,
    contractId,
    escrowId,
    brandId,
    athleteId,
    grossAmount: grossAmount?.toString(),
    platformFee: platformFee?.toString(),
    athletePayout: athletePayout?.toString(),
    reason,
    requestId,
    actorType,
    actorId,
  };

  log('info', message, context);

  // Sentry에도 이벤트 전송 (운영 추적용)
  if (process.env.NODE_ENV === 'production') {
    captureMessage(message, 'info', context);
  }
}

/**
 * 지갑 이벤트 로그 (표준화)
 */
export function logWalletEvent(event: WalletLogEvent): void {
  const {
    action,
    walletId,
    ownerType,
    ownerId,
    amount,
    balanceAfter,
    refType,
    refId,
    requestId,
  } = event;

  const message = `[WALLET] ${action} wallet=${walletId} owner=${ownerType}:${ownerId}`;
  const context: LogContext = {
    category: 'wallet',
    action,
    walletId,
    ownerType,
    ownerId,
    amount: amount?.toString(),
    balanceAfter: balanceAfter?.toString(),
    refType,
    refId,
    requestId,
  };

  log('info', message, context);
}

/**
 * 에러 로그 (Sentry 연동)
 */
export function logError(error: Error, context?: LogContext): void {
  log('error', error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
  });
}

/**
 * 감사 로그 (중요 액션 기록)
 */
export function logAudit(action: string, details: Record<string, any>, context?: LogContext): void {
  log('info', `[AUDIT] ${action}`, {
    category: 'audit',
    action,
    details,
    ...context,
  });
}

export default {
  log,
  logEscrowEvent,
  logWalletEvent,
  logError,
  logAudit,
};

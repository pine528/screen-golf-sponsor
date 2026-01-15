/**
 * Request ID 미들웨어
 * 모든 요청에 고유 ID를 부여하여 로그 추적 가능하게 함
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { setTag } from '../lib/sentry';

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Request ID 생성 및 전파 미들웨어
 * - 클라이언트가 x-request-id 헤더를 보내면 그대로 사용
 * - 없으면 새로 생성
 * - 응답 헤더에도 포함
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 기존 request-id 사용 또는 새로 생성
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  // Request 객체에 저장
  req.requestId = requestId;

  // 응답 헤더에 포함
  res.setHeader('x-request-id', requestId);

  // Sentry 태그 설정
  setTag('requestId', requestId);

  next();
}

/**
 * 현재 요청의 Request ID 가져오기 (로그용)
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}

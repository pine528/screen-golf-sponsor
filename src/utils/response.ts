import { Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { ApiResponse } from '../types';

/**
 * Prisma Decimal을 JSON 직렬화 가능한 형태로 변환
 * - Decimal → string (정밀도 유지)
 * - 중첩 객체/배열 재귀 처리
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Decimal 타입 체크 (Prisma Decimal)
  if (obj instanceof Decimal || (typeof obj === 'object' && obj !== null && 'toFixed' in obj && 'd' in obj)) {
    return (obj as any).toString() as unknown as T;
  }

  // 배열 처리
  if (Array.isArray(obj)) {
    return obj.map(item => serializeDecimals(item)) as unknown as T;
  }

  // 일반 객체 처리
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDecimals(value);
    }
    return result as T;
  }

  return obj;
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data: serializeDecimals(data),
  };
  res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200
): void {
  const response: ApiResponse<T[]> = {
    success: true,
    data: serializeDecimals(data),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  res.status(statusCode).json(response);
}

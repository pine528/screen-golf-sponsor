import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

interface AuditLogOptions {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    method?: string;
    path?: string;
    statusCode?: number;
    duration?: number;
    reason?: string;
    [key: string]: any;
  };
}

export const createAuditLog = async (
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: any,
  newValue?: any,
  ipAddress?: string,
  userAgent?: string,
  metadata?: any
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        ipAddress,
        userAgent,
        metadata,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

export const createAuditLogWithOptions = async (options: AuditLogOptions): Promise<void> => {
  return createAuditLog(
    options.userId,
    options.action,
    options.entityType,
    options.entityId,
    options.oldValue,
    options.newValue,
    options.ipAddress,
    options.userAgent,
    options.metadata
  );
};

export const auditMiddleware = (action: string, entityType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const duration = Date.now() - startTime;

      if (res.statusCode >= 200 && res.statusCode < 300 && body?.data?.id) {
        createAuditLog(
          req.user?.id,
          action,
          entityType,
          body.data.id,
          undefined,
          body.data,
          req.ip,
          req.headers['user-agent'] as string,
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
          }
        );
      }
      return originalJson(body);
    };

    next();
  };
};

// Critical actions that should always be audited
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Contract
  CONTRACT_SIGN: 'CONTRACT_SIGN',
  CONTRACT_CANCEL: 'CONTRACT_CANCEL',

  // Escrow
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  ESCROW_REFUND: 'ESCROW_REFUND',

  // Reviews
  ASSET_APPROVE: 'ASSET_APPROVE',
  ASSET_REJECT: 'ASSET_REJECT',
  VERIFICATION_APPROVE: 'VERIFICATION_APPROVE',
  VERIFICATION_REJECT: 'VERIFICATION_REJECT',

  // KYC
  KYC_APPROVE: 'KYC_APPROVE',
  KYC_REJECT: 'KYC_REJECT',

  // Admin
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  USER_SUSPEND: 'USER_SUSPEND',
};

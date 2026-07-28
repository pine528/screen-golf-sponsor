import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import config from '../config';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        brand: true,
        athlete: true,
        admin: true,
        fan: true,
        agency: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      brandId: user.brand?.id,
      athleteId: user.athlete?.id,
      adminId: user.admin?.id,
      fanId: user.fan?.id,
      agencyId: user.agency?.id,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

// Alias for single role (string) authorization
export const requireRole = (role: UserRole) => authorize(role);

/**
 * 선택적 인증: 토큰이 있으면 인증, 없어도 통과
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 토큰 없으면 그냥 통과
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        brand: true,
        athlete: true,
        admin: true,
        fan: true,
        agency: true,
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        brandId: user.brand?.id,
        athleteId: user.athlete?.id,
        adminId: user.admin?.id,
        fanId: user.fan?.id,
        agencyId: user.agency?.id,
      };
    }

    next();
  } catch (error) {
    // 토큰 검증 실패해도 그냥 통과 (로그인 안 한 것으로 처리)
    next();
  }
};

/**
 * 역할별 기본 권한 매핑
 * - '*' 는 모든 권한을 의미
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'],  // 전체 권한
  FINANCE: [
    'refund.approve',
    'settlement.execute',
    'reconciliation.run',
    'withdrawal.approve',
    'report.view',
    'user.view',
    'transaction.view',
  ],
  SUPPORT: [
    'user.view',
    'transaction.view',
    'issue.view',
    'report.view',
  ],
  AUDITOR: [
    'audit.view',
    'report.view',
    'reconciliation.view',
    'user.view',
    'transaction.view',
  ],
};

/**
 * 사용자가 특정 권한을 가지고 있는지 확인
 */
export const hasPermission = (role: UserRole, permission: string): boolean => {
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  return rolePerms.includes('*') || rolePerms.includes(permission);
};

/**
 * 권한 기반 인가 미들웨어
 * - 역할에 매핑된 권한 확인
 * - Admin.permissions 필드도 확인 (있을 경우)
 */
export const authorizePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      // 역할 기반 권한 확인
      if (hasPermission(req.user.role, permission)) {
        return next();
      }

      // Admin 테이블의 permissions 필드 확인 (JSON 배열)
      if (req.user.adminId) {
        const admin = await prisma.admin.findUnique({
          where: { id: req.user.adminId },
        });
        const customPerms = (admin?.permissions as string[]) || [];
        if (customPerms.includes(permission) || customPerms.includes('*')) {
          return next();
        }
      }

      throw new ForbiddenError(`권한이 없습니다: ${permission}`);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 관리자 역할 전용 미들웨어 (ADMIN, FINANCE, SUPPORT, AUDITOR)
 */
export const requireAdminRole = authorize('ADMIN', 'FINANCE', 'SUPPORT', 'AUDITOR');

/**
 * 읽기 권한이 있는 관리자 역할 (조회만 가능)
 */
export const authorizeReadOnly = authorize('ADMIN', 'FINANCE', 'SUPPORT', 'AUDITOR');

/**
 * 쓰기 권한이 있는 관리자 역할 (ADMIN, FINANCE만)
 */
export const authorizeWrite = authorize('ADMIN', 'FINANCE');

export const requireKycApproved = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    if (req.user.role === 'BRAND' && req.user.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: req.user.brandId },
      });
      if (brand?.kycStatus !== 'APPROVED') {
        throw new ForbiddenError('KYC approval required');
      }
    } else if (req.user.role === 'ATHLETE' && req.user.athleteId) {
      const athlete = await prisma.athlete.findUnique({
        where: { id: req.user.athleteId },
      });
      if (athlete?.kycStatus !== 'APPROVED') {
        throw new ForbiddenError('KYC approval required');
      }
    } else if (req.user.role === 'AGENCY' && req.user.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: req.user.agencyId },
      });
      if (agency?.kycStatus !== 'APPROVED') {
        throw new ForbiddenError('KYC approval required');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

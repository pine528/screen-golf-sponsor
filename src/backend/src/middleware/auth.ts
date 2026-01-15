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
    }

    next();
  } catch (error) {
    next(error);
  }
};

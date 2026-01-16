import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@prisma/client';
import prisma from '../models/prisma';
import config from '../config';
import { UnauthorizedError, BadRequestError, ConflictError } from '../utils/errors';
import { TokenResponse, RegisterRequest } from '../types';

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class AuthService {
  async register(data: RegisterRequest): Promise<TokenResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
      },
    });

    // Create role-specific profile
    if (data.role === 'BRAND') {
      await prisma.brand.create({
        data: {
          userId: user.id,
          name: data.name,
          category: data.category || 'General',
          contactEmail: data.email,
          bizNo: data.bizNo,
        },
      });
    } else if (data.role === 'ATHLETE') {
      await prisma.athlete.create({
        data: {
          userId: user.id,
          name: data.name,
          tour: data.tour || 'GTOUR',
        },
      });
    } else if (data.role === 'ADMIN') {
      await prisma.admin.create({
        data: {
          userId: user.id,
          name: data.name,
        },
      });
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refreshToken(refreshTokenStr: string): Promise<TokenResponse> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  // Fan Registration
  async registerFan(data: { email: string; password: string; nickname?: string }): Promise<TokenResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('이미 등록된 이메일입니다');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'FAN',
      },
    });

    // Create Fan profile
    await prisma.fan.create({
      data: {
        userId: user.id,
        nickname: data.nickname || null,
      },
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  // Fan Login (same as regular login but only allows FAN role)
  async loginFan(email: string, password: string): Promise<TokenResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // Only allow FAN role to login through fan login endpoint
    if (user.role !== 'FAN') {
      throw new UnauthorizedError('팬 계정이 아닙니다. 다른 로그인 페이지를 이용해주세요');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('비활성화된 계정입니다');
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestError('현재 비밀번호가 일치하지 않습니다.');
    }

    if (newPassword.length < 8) {
      throw new BadRequestError('새 비밀번호는 8자 이상이어야 합니다.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole
  ): Promise<TokenResponse> {
    const payload: JwtPayload = { userId, email, role };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string,
    } as jwt.SignOptions);

    const refreshToken = uuidv4();
    const refreshExpiresIn = this.parseExpiry(config.jwt.refreshExpiresIn);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + refreshExpiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(config.jwt.expiresIn) / 1000,
      user: { id: userId, email, role },
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }
}

export const authService = new AuthService();

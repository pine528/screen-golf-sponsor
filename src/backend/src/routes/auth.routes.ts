import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../utils/validation';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

/**
 * @route POST /auth/register
 * @desc Register a new user
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @route POST /auth/login
 * @desc Login user and get tokens
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @route POST /auth/refresh
 * @desc Refresh access token
 */
router.post(
  '/refresh',
  validate(z.object({ refreshToken: z.string() })),
  authController.refresh
);

/**
 * @route POST /auth/logout
 * @desc Logout user (invalidate refresh tokens)
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route GET /auth/me
 * @desc Get current user info
 */
router.get('/me', authenticate, authController.me);

/**
 * @route POST /auth/change-password
 * @desc Change user password
 */
router.post(
  '/change-password',
  authenticate,
  validate(z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  })),
  authController.changePassword
);

export default router;

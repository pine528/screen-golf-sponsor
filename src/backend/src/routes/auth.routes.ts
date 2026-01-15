import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, fanRegisterSchema, fanLoginSchema } from '../utils/validation';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for fan auth endpoints (10 requests per minute)
const fanAuthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// ============================================
// Fan Auth Routes
// ============================================

/**
 * @route POST /auth/fan/register
 * @desc Register a new fan account
 */
router.post(
  '/fan/register',
  fanAuthLimiter,
  validate(fanRegisterSchema),
  authController.registerFan
);

/**
 * @route POST /auth/fan/login
 * @desc Login fan and get tokens
 */
router.post(
  '/fan/login',
  fanAuthLimiter,
  validate(fanLoginSchema),
  authController.loginFan
);

export default router;

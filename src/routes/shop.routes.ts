import { Router } from 'express';
import { redemptionController } from '../controllers/redemption.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// ============================================
// Validation Schemas (Zod)
// ============================================

const createOrderSchema = z.object({
  itemId: z.string().uuid('유효한 상품 ID를 입력하세요'),
  quantity: z.number().int().min(1).default(1),
  shipping: z.object({
    name: z.string().min(1, '이름을 입력하세요'),
    phone: z.string().min(1, '연락처를 입력하세요'),
    address1: z.string().min(1, '주소를 입력하세요'),
    address2: z.string().optional().nullable(),
  }).optional(),
  memo: z.string().max(500).optional().nullable(),
});

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  pricePoints: z.number().int().min(0),
  stock: z.number().int().min(0),
  requiresShipping: z.boolean().default(false),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  pricePoints: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'SOLDOUT']).optional(),
  requiresShipping: z.boolean().optional(),
});

const fulfillOrderSchema = z.object({
  memo: z.string().max(500).optional().nullable(),
});

// ============================================
// Public Routes
// ============================================

// 상품 목록 조회
router.get('/items', redemptionController.listItems);

// 상품 상세 조회
router.get('/items/:id', redemptionController.getItem);

// ============================================
// Fan Routes (로그인 필요)
// ============================================

// 교환 주문 생성
router.post(
  '/orders',
  authenticate,
  requireRole('FAN'),
  validate(createOrderSchema),
  redemptionController.createOrder
);

// 내 주문 목록 조회
router.get('/orders/my', authenticate, requireRole('FAN'), redemptionController.getMyOrders);

// 주문 취소
router.post('/orders/:id/cancel', authenticate, requireRole('FAN'), redemptionController.cancelOrder);

// ============================================
// Admin Routes
// ============================================

// 상품 생성
router.post(
  '/admin/items',
  authenticate,
  requireRole('ADMIN'),
  validate(createItemSchema),
  redemptionController.createItem
);

// 상품 목록 (모든 상태)
router.get('/admin/items', authenticate, requireRole('ADMIN'), redemptionController.adminListItems);

// 상품 수정
router.patch(
  '/admin/items/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateItemSchema),
  redemptionController.updateItem
);

// 주문 목록
router.get('/admin/orders', authenticate, requireRole('ADMIN'), redemptionController.adminListOrders);

// 주문 처리 완료
router.post(
  '/admin/orders/:id/fulfill',
  authenticate,
  requireRole('ADMIN'),
  validate(fulfillOrderSchema),
  redemptionController.adminFulfillOrder
);

export default router;

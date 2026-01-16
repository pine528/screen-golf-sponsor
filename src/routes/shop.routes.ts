import { Router } from 'express';
import { redemptionController } from '../controllers/redemption.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import Joi from 'joi';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const createOrderSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).default(1),
  shipping: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    address1: Joi.string().required(),
    address2: Joi.string().allow('', null),
  }).optional(),
  memo: Joi.string().max(500).allow('', null),
});

const createItemSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).allow('', null),
  imageUrl: Joi.string().uri().allow('', null),
  pricePoints: Joi.number().integer().min(0).required(),
  stock: Joi.number().integer().min(0).required(),
  requiresShipping: Joi.boolean().default(false),
});

const updateItemSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(2000).allow('', null),
  imageUrl: Joi.string().uri().allow('', null),
  pricePoints: Joi.number().integer().min(0),
  stock: Joi.number().integer().min(0),
  status: Joi.string().valid('ACTIVE', 'PAUSED', 'SOLDOUT'),
  requiresShipping: Joi.boolean(),
});

const fulfillOrderSchema = Joi.object({
  memo: Joi.string().max(500).allow('', null),
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

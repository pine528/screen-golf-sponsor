import { Router, Request, Response, NextFunction } from 'express';
import { faqService } from '../services/faq.service';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { FaqCategory } from '@prisma/client';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Validation Schemas (Zod)
// ============================================

const faqCategoryEnum = z.enum([
  'GENERAL', 'ACCOUNT', 'BIDDING', 'CONTRACT',
  'PAYMENT', 'POINTS', 'SHOP', 'ATHLETE', 'BRAND'
]);

const createFaqSchema = z.object({
  category: faqCategoryEnum,
  question: z.string().min(1, '질문을 입력하세요').max(500),
  answer: z.string().min(1, '답변을 입력하세요').max(10000),
  orderIndex: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const updateFaqSchema = z.object({
  category: faqCategoryEnum.optional(),
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(10000).optional(),
  orderIndex: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const reorderSchema = z.object({
  category: faqCategoryEnum,
  orderedIds: z.array(z.string().uuid()),
});

// ============================================
// Public Routes (인증 불필요)
// ============================================

/**
 * GET /api/faq
 * 공개 FAQ 목록 조회
 * ?category=GENERAL
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as FaqCategory | undefined;
    const faqs = await faqService.getPublishedFaqs(category);
    res.json(faqs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/faq/categories
 * 카테고리별 개수 조회
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await faqService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/faq/search
 * FAQ 검색
 * ?q=검색어
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    const faqs = await faqService.searchFaqs(q);
    res.json(faqs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/faq/:id
 * FAQ 상세 조회 (viewCount 증가)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faq = await faqService.getFaq(req.params.id, true);
    if (!faq) {
      return res.status(404).json({ message: 'FAQ를 찾을 수 없습니다' });
    }
    // 비발행 상태는 공개 API에서 접근 불가
    if (!faq.isPublished) {
      return res.status(404).json({ message: 'FAQ를 찾을 수 없습니다' });
    }
    res.json(faq);
  } catch (error) {
    next(error);
  }
});

// ============================================
// Admin Routes (ADMIN 권한 필요)
// ============================================

/**
 * GET /api/faq/admin
 * Admin: 전체 FAQ 목록 (비발행 포함)
 * ?category=GENERAL&isPublished=true&q=검색어
 */
router.get('/admin/all', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      category: req.query.category as FaqCategory | undefined,
      isPublished: req.query.isPublished === 'true' ? true : req.query.isPublished === 'false' ? false : undefined,
      q: req.query.q as string | undefined,
    };
    const faqs = await faqService.getAllFaqs(filters);
    res.json(faqs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/faq/admin/:id
 * Admin: FAQ 상세 조회 (viewCount 증가 없음)
 */
router.get('/admin/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faq = await faqService.getFaq(req.params.id, false);
    if (!faq) {
      return res.status(404).json({ message: 'FAQ를 찾을 수 없습니다' });
    }
    res.json(faq);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/faq/admin
 * Admin: FAQ 생성
 */
router.post(
  '/admin',
  authenticate,
  requireRole('ADMIN'),
  validate(createFaqSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const faq = await faqService.createFaq(req.user!.id, req.body);
      res.status(201).json(faq);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/faq/admin/:id
 * Admin: FAQ 수정
 */
router.patch(
  '/admin/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateFaqSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const faq = await faqService.updateFaq(req.params.id, req.user!.id, req.body);
      res.json(faq);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/faq/admin/:id
 * Admin: FAQ 삭제
 */
router.delete('/admin/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await faqService.deleteFaq(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/faq/admin/:id/toggle-publish
 * Admin: 발행 상태 토글
 */
router.post('/admin/:id/toggle-publish', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const faq = await faqService.togglePublish(req.params.id, req.user!.id);
    res.json(faq);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/faq/admin/reorder
 * Admin: FAQ 순서 재정렬
 */
router.post(
  '/admin/reorder',
  authenticate,
  requireRole('ADMIN'),
  validate(reorderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await faqService.reorderFaqs(req.body.category, req.body.orderedIds);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

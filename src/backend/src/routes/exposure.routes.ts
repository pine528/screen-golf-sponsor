import { Router, Response, NextFunction } from 'express';
import { exposureService } from '../services/exposure.service';
import { authenticate, requireRole, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { AuthRequest } from '../types';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const exposureTypeEnum = z.enum([
  'BROADCAST',
  'EVENT_LIVE',
  'SOCIAL_MEDIA',
  'PHOTO_PRESS',
  'OTHER',
]);

const bodyPartEnum = z.enum([
  'SHIRT_CHEST_LEFT',
  'SHIRT_CHEST_RIGHT',
  'SHIRT_SLEEVE_LEFT',
  'SHIRT_SLEEVE_RIGHT',
  'CAP_SIDE_LEFT',
  'CAP_BACK',
  'PANTS_BELT',
  'SHIRT_BACK',
]);

const createExposureSchema = z.object({
  contractId: z.string().uuid(),
  exposureType: exposureTypeEnum,
  impressions: z.number().int().min(0),
  viewDurationSec: z.number().int().min(0).optional(),
  reachCount: z.number().int().min(0).optional(),
  sourceUrl: z.string().url().optional(),
  description: z.string().max(500).optional(),
  recordedAt: z.string().datetime(),
});

const createRateSchema = z.object({
  exposureType: exposureTypeEnum,
  bodyPart: bodyPartEnum.optional(),
  ratePerImpression: z.number().positive(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
});

// ============================================
// Brand Routes
// ============================================

/**
 * GET /api/exposure/brand/report
 * 브랜드 노출 리포트
 */
router.get(
  '/brand/report',
  authenticate,
  authorize('BRAND'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const prisma = (await import('../models/prisma')).default;
      const brand = await prisma.brand.findUnique({
        where: { userId: req.user!.id },
      });

      if (!brand) {
        return res.status(403).json({ success: false, message: 'Brand not found' });
      }

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      const report = await exposureService.getBrandExposureReport(brand.id, {
        startDate,
        endDate,
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/exposure/contract/:contractId
 * 계약별 노출 기록 조회
 */
router.get(
  '/contract/:contractId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await exposureService.getContractExposures(req.params.contractId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin Routes
// ============================================

/**
 * POST /api/exposure/admin/records
 * Admin: 노출 기록 생성
 */
router.post(
  '/admin/records',
  authenticate,
  requireRole('ADMIN'),
  validate(createExposureSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const record = await exposureService.createExposureRecord({
        ...req.body,
        recordedAt: new Date(req.body.recordedAt),
        recordedBy: req.user!.id,
      });
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/exposure/admin/records
 * Admin: 노출 기록 목록
 */
router.get(
  '/admin/records',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        contractId: req.query.contractId as string | undefined,
        brandId: req.query.brandId as string | undefined,
        athleteId: req.query.athleteId as string | undefined,
        exposureType: req.query.exposureType as any,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
      };

      const records = await exposureService.getExposureRecords(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/exposure/admin/records/:id
 * Admin: 노출 기록 삭제
 */
router.delete(
  '/admin/records/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await exposureService.deleteExposureRecord(req.params.id);
      res.json({ success: true, message: 'Record deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/exposure/admin/report
 * Admin: 미디어밸류 리포트
 */
router.get(
  '/admin/report',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const options = {
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        groupBy: req.query.groupBy as 'day' | 'week' | 'month' | undefined,
      };

      const report = await exposureService.getMediaValueReport(options);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/exposure/admin/rates
 * Admin: 미디어밸류 요율 목록
 */
router.get(
  '/admin/rates',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rates = await exposureService.getRates();
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/exposure/admin/rates
 * Admin: 미디어밸류 요율 생성
 */
router.post(
  '/admin/rates',
  authenticate,
  requireRole('ADMIN'),
  validate(createRateSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rate = await exposureService.createRate({
        ...req.body,
        effectiveFrom: new Date(req.body.effectiveFrom),
        effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : undefined,
      });
      res.status(201).json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

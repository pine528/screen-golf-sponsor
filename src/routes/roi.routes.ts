import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { vodService } from '../services/vod.service';
import { frameExtractService } from '../services/frameExtract.service';
import { logoDetectService } from '../services/logoDetect.service';
import { roiExposureService } from '../services/roiExposure.service';
import { roiEvidenceService } from '../services/roiEvidence.service';
import { roiReportService } from '../services/roiReport.service';
import { AuthRequest } from '../types';
import { uploadAsset } from '../services/upload.service';
import { VodStatus, ReviewStatus, RoiReportType } from '@prisma/client';

const router = Router();

// 모든 라우트는 인증 필요
router.use(authenticate);

// ============================================
// Campaign ROI Dashboard (Brand/Admin)
// ============================================

/**
 * @route GET /roi/campaigns/:campaignId/summary
 * @desc Get ROI metrics summary for a campaign
 */
router.get(
  '/campaigns/:campaignId/summary',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { startDate, endDate } = req.query;

      const metrics = await roiReportService.calculateMetrics(campaignId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/campaigns/:campaignId/dashboard
 * @desc Get full dashboard data for a campaign
 */
router.get(
  '/campaigns/:campaignId/dashboard',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const data = await roiReportService.getDashboardSummary(campaignId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/campaigns/:campaignId/exposures
 * @desc Get exposure list for a campaign
 */
router.get(
  '/campaigns/:campaignId/exposures',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { page, limit, isValid, reviewStatus } = req.query;

      const data = await roiExposureService.listExposures({
        campaignId,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        isValid: isValid === 'true' ? true : isValid === 'false' ? false : undefined,
        reviewStatus: reviewStatus as ReviewStatus | undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/campaigns/:campaignId/evidence
 * @desc Get evidence list for a campaign
 */
router.get(
  '/campaigns/:campaignId/evidence',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { page, limit, type } = req.query;

      const data = await roiEvidenceService.listEvidence({
        campaignId,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as any,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/campaigns/:campaignId/evidence/download
 * @desc Download Proof Pack (ZIP) for a campaign
 */
router.get(
  '/campaigns/:campaignId/evidence/download',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const result = await roiEvidenceService.createProofPack(campaignId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/campaigns/:campaignId/reports
 * @desc Get reports list for a campaign
 */
router.get(
  '/campaigns/:campaignId/reports',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { page, limit, type, status } = req.query;

      const data = await roiReportService.listReports({
        campaignId,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as RoiReportType | undefined,
        status: status as any,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/campaigns/:campaignId/reports
 * @desc Generate a new report for a campaign
 */
router.post(
  '/campaigns/:campaignId/reports',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { type, periodStart, periodEnd, title } = req.body;

      const result = await roiReportService.generatePdfReport(campaignId, {
        type: type as RoiReportType,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        title,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/reports/:reportId
 * @desc Get report details
 */
router.get(
  '/reports/:reportId',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const report = await roiReportService.getReportById(reportId);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin: VOD Management
// ============================================

/**
 * @route GET /roi/admin/vod
 * @desc List VOD assets (Admin only)
 */
router.get(
  '/admin/vod',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId, eventId, status, page, limit } = req.query;

      const data = await vodService.listVods({
        campaignId: campaignId as string,
        eventId: eventId as string,
        status: status as VodStatus,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/vod/ingest
 * @desc Ingest VOD from YouTube URL
 */
router.post(
  '/admin/vod/ingest',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { youtubeUrl, campaignId, eventId } = req.body;

      if (!youtubeUrl || !campaignId) {
        return res.status(400).json({
          success: false,
          message: 'youtubeUrl과 campaignId가 필요합니다.',
        });
      }

      const result = await vodService.ingestFromYoutube(youtubeUrl, campaignId, eventId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/vod/upload
 * @desc Upload VOD file directly
 */
router.post(
  '/admin/vod/upload',
  authorize('ADMIN'),
  uploadAsset.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId, eventId } = req.body;

      if (!req.file || !campaignId) {
        return res.status(400).json({
          success: false,
          message: '파일과 campaignId가 필요합니다.',
        });
      }

      const result = await vodService.uploadVod(req.file, campaignId, eventId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/admin/vod/:vodId
 * @desc Get VOD details
 */
router.get(
  '/admin/vod/:vodId',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const vod = await vodService.getVodById(vodId);
      res.json({ success: true, data: vod });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/admin/vod/:vodId/status
 * @desc Get VOD processing status
 */
router.get(
  '/admin/vod/:vodId/status',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const status = await vodService.getVodStatus(vodId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /roi/admin/vod/:vodId
 * @desc Delete VOD
 */
router.delete(
  '/admin/vod/:vodId',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      await vodService.deleteVod(vodId);
      res.json({ success: true, message: 'VOD가 삭제되었습니다.' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin: Frame & Detection Processing
// ============================================

/**
 * @route POST /roi/admin/vod/:vodId/extract-frames
 * @desc Extract frames from VOD
 */
router.post(
  '/admin/vod/:vodId/extract-frames',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const { fps, quality, maxWidth } = req.body;

      const result = await frameExtractService.extractFrames(vodId, {
        fps,
        quality,
        maxWidth,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/admin/vod/:vodId/frames
 * @desc List frames of a VOD
 */
router.get(
  '/admin/vod/:vodId/frames',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const { page, limit } = req.query;

      const data = await frameExtractService.listFrames(
        vodId,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/vod/:vodId/detect-logos
 * @desc Run logo detection on VOD frames
 */
router.post(
  '/admin/vod/:vodId/detect-logos',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const { brandIds, batchSize, skipExisting } = req.body;

      const result = await logoDetectService.detectLogosInVod(vodId, {
        brandIds,
        batchSize,
        skipExisting,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/vod/:vodId/merge-exposures
 * @desc Merge detections into exposures
 */
router.post(
  '/admin/vod/:vodId/merge-exposures',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { vodId } = req.params;
      const { maxGapSeconds, minConfidence, minAreaRatio, minDuration } = req.body;

      const mergeResult = await roiExposureService.mergeDetections(vodId, {
        maxGapSeconds,
        minConfidence,
        minAreaRatio,
        minDuration,
      });

      // 유효성 판정도 자동 실행
      const validationResult = await roiExposureService.validateExposures(vodId);

      res.json({
        success: true,
        data: {
          ...mergeResult,
          ...validationResult,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin: QA Review
// ============================================

/**
 * @route GET /roi/admin/exposures
 * @desc Get all exposures for QA (with filters)
 */
router.get(
  '/admin/exposures',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId, reviewStatus, page, limit } = req.query;

      const data = await roiExposureService.listExposures({
        campaignId: campaignId as string,
        reviewStatus: reviewStatus as ReviewStatus | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/admin/exposures/pending
 * @desc Get pending review exposures
 */
router.get(
  '/admin/exposures/pending',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query;

      const data = await roiExposureService.getPendingReviews(
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /roi/admin/exposures/:exposureId
 * @desc Get exposure details for review
 */
router.get(
  '/admin/exposures/:exposureId',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { exposureId } = req.params;
      const exposure = await roiExposureService.getExposureById(exposureId);
      res.json({ success: true, data: exposure });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /roi/admin/exposures/:exposureId/review
 * @desc Review an exposure (approve/reject/modify)
 */
router.put(
  '/admin/exposures/:exposureId/review',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { exposureId } = req.params;
      const { status, isValid, slotType, notes } = req.body;

      if (!status || !['APPROVED', 'REJECTED', 'MODIFIED'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '유효한 status가 필요합니다 (APPROVED, REJECTED, MODIFIED)',
        });
      }

      const result = await roiExposureService.reviewExposure(
        exposureId,
        { status, isValid, slotType, notes },
        req.user!.id
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Admin: Evidence Generation
// ============================================

/**
 * @route POST /roi/admin/exposures/:exposureId/screenshot
 * @desc Generate screenshot for an exposure
 */
router.post(
  '/admin/exposures/:exposureId/screenshot',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { exposureId } = req.params;
      const result = await roiEvidenceService.generateScreenshot(exposureId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/exposures/:exposureId/clip
 * @desc Generate clip for an exposure
 */
router.post(
  '/admin/exposures/:exposureId/clip',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { exposureId } = req.params;
      const { paddingBefore, paddingAfter, maxDuration } = req.body;

      const result = await roiEvidenceService.generateClip(exposureId, {
        paddingBefore,
        paddingAfter,
        maxDuration,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/admin/campaigns/:campaignId/generate-evidence
 * @desc Generate all evidence for a campaign
 */
router.post(
  '/admin/campaigns/:campaignId/generate-evidence',
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { includeClips, skipExisting } = req.body;

      const result = await roiEvidenceService.generateAllEvidence(campaignId, {
        includeClips,
        skipExisting,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Logo Template Management
// ============================================

/**
 * @route GET /roi/brands/:brandId/logo-templates
 * @desc List logo templates for a brand
 */
router.get(
  '/brands/:brandId/logo-templates',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { brandId } = req.params;
      const templates = await logoDetectService.listLogoTemplates(brandId);
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /roi/brands/:brandId/logo-templates
 * @desc Create a logo template
 */
router.post(
  '/brands/:brandId/logo-templates',
  authorize('BRAND', 'ADMIN'),
  uploadAsset.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { brandId } = req.params;
      const { name, variant } = req.body;

      if (!req.file || !name) {
        return res.status(400).json({
          success: false,
          message: '파일과 name이 필요합니다.',
        });
      }

      // Cloudinary에 업로드
      const { cloudinaryService } = await import('../services/cloudinary.service');
      const uploadResult = await cloudinaryService.uploadFile(req.file, 'assets');

      const template = await logoDetectService.createLogoTemplate(brandId, {
        name,
        fileKey: uploadResult.publicId,
        fileUrl: uploadResult.url,
        variant,
      });

      res.json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /roi/brands/:brandId/logo-templates/:templateId
 * @desc Delete a logo template
 */
router.delete(
  '/brands/:brandId/logo-templates/:templateId',
  authorize('BRAND', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      await logoDetectService.deleteLogoTemplate(templateId);
      res.json({ success: true, message: '로고 템플릿이 삭제되었습니다.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

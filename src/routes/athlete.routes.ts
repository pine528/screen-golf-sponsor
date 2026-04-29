import { Router, Request, Response, NextFunction } from 'express';
import { athleteController } from '../controllers/athlete.controller';
import { agencyAthleteRequestController } from '../controllers/agencyAthleteRequest.controller';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../models/prisma';

const router = Router();

/**
 * @route GET /athletes/public
 * @desc 공개 선수 목록 (회원가입 + KYC 통과 ATHLETE만, 비회원 접근 가능)
 */
router.get('/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, tour, page = '1', limit = '24' } = req.query as any;
    const where: any = {};
    if (tour) where.tour = tour;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { realName: { contains: q, mode: 'insensitive' } },
        { tour: { contains: q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(50, Number(limit) || 24);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const [total, items] = await Promise.all([
      prisma.athlete.count({ where }),
      prisma.athlete.findMany({
        where,
        select: {
          id: true, name: true, tour: true, profileImageUrl: true, bio: true,
          socialLinks: true, primarySponsors: true,
        },
        orderBy: { createdAt: 'desc' },
        take, skip,
      }),
    ]);
    res.json({ success: true, data: { items, total, page: Number(page), limit: take }, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes/public/:id
 * @desc 공개 선수 상세 (비회원 접근)
 */
router.get('/public/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, realName: true, tour: true,
        profileImageUrl: true, bio: true, socialLinks: true, primarySponsors: true,
        createdAt: true,
      },
    });
    if (!athlete) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Athlete not found' } });
      return;
    }

    // 활성 슬롯 + 지난 노출 통계 함께 (있으면)
    const [slotInstances, exposureCount] = await Promise.all([
      prisma.slotInstance.findMany({
        where: { athleteId: req.params.id },
        select: { id: true, status: true, slotTemplate: { select: { name: true, bodyPart: true } }, currentBid: true } as any,
        take: 6,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),
      prisma.roiExposure.count({ where: { athleteId: req.params.id } as any }).catch(() => 0),
    ]);

    res.json({
      success: true,
      data: { athlete, slotInstances, exposureCount },
      error: null,
      request_id: (req as any).requestId,
    });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes
 * @desc List all athletes (legacy, 인증 필요)
 */
router.get('/', authenticate, athleteController.list);

/**
 * @route GET /athletes/me
 * @desc Get current athlete profile
 */
router.get('/me', authenticate, authorize('ATHLETE'), athleteController.getMe);

/**
 * @route GET /athletes/me/stats
 * @desc Get athlete statistics
 */
router.get('/me/stats', authenticate, authorize('ATHLETE'), athleteController.getStats);

/**
 * @route GET /athletes/me/slots
 * @desc Get athlete's available slots
 */
router.get('/me/slots', authenticate, authorize('ATHLETE'), athleteController.getAvailableSlots);

/**
 * @route PATCH /athletes/me
 * @desc Update current athlete profile
 */
router.patch('/me', authenticate, authorize('ATHLETE'), athleteController.update);

/**
 * @route PATCH /athletes/me/bank
 * @desc Update bank information
 */
router.patch('/me/bank', authenticate, authorize('ATHLETE'), athleteController.updateBankInfo);

/**
 * @route PATCH /athletes/me/bank-account
 * @desc Update bank account (simplified)
 */
router.patch('/me/bank-account', authenticate, authorize('ATHLETE'), athleteController.updateBankAccount);

/**
 * @route PATCH /athletes/me/slots
 * @desc Update slot availability (blocked categories)
 */
router.patch('/me/slots', authenticate, authorize('ATHLETE'), athleteController.updateSlotAvailability);

/**
 * @route POST /athletes/me/kyc
 * @desc Submit KYC documents
 */
router.post('/me/kyc', authenticate, authorize('ATHLETE'), athleteController.submitKyc);

/**
 * ★ Phase 9-3: Athlete pending signatures API
 */

/**
 * @route GET /athletes/me/pending-signatures
 * @desc Get athlete's contracts pending signature
 */
router.get('/me/pending-signatures', authenticate, authorize('ATHLETE'), athleteController.getPendingSignatures);

/**
 * ★ 에이전시 연결 요청 관리 (선수용)
 */

/**
 * @route GET /athletes/agency-requests
 * @desc Get agency connection requests received by athlete
 */
router.get('/agency-requests', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.getReceivedRequests);

/**
 * @route POST /athletes/agency-requests/:requestId/approve
 * @desc Approve an agency connection request
 */
router.post('/agency-requests/:requestId/approve', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.approveRequest);

/**
 * @route POST /athletes/agency-requests/:requestId/reject
 * @desc Reject an agency connection request
 */
router.post('/agency-requests/:requestId/reject', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.rejectRequest);

/**
 * @route GET /athletes/:id
 * @desc Get athlete by ID
 */
router.get('/:id', authenticate, athleteController.getById);

export default router;

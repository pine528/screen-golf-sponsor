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
 * @desc 공개 선수 상세 (비회원 접근) — docx 3-9 구조
 *  - 상단: 기본 프로필 + 진행 중 슬롯
 *  - 중단: 슬롯별 실시간 경매 현황 (각 슬롯의 auction + 최근 입찰 N건)
 *  - 하단: ROI/경기기록 (값 없으면 - 처리)
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

    // 활성 슬롯 + 각 슬롯의 경매 + 최근 입찰 5건 (실데이터) + GTOUR 경기결과
    const [slotInstances, exposureCount, athleteEvents, eventResults] = await Promise.all([
      prisma.slotInstance.findMany({
        where: { athleteId: req.params.id },
        include: {
          slotTemplate: { select: { name: true, code: true, bodyPart: true, category: true, grade: true } },
          auction: {
            select: {
              id: true, status: true, currentPrice: true, minBidIncrement: true,
              startAt: true, endAt: true,
              bids: {
                select: {
                  id: true, maxBid: true, currentProxy: true, isWinning: true, createdAt: true,
                  brand: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
              },
            },
          },
          event: { select: { id: true, name: true, dateStart: true, dateEnd: true, status: true, venue: true } },
        },
        orderBy: [
          { status: 'asc' }, // OPEN, IN_AUCTION 우선
          { createdAt: 'asc' }, // 등록 순
        ],
      }).catch((e) => { console.error('[athlete public] slot fetch error', e); return []; }),
      prisma.roiExposure.count({ where: { athleteId: req.params.id } as any }).catch(() => 0),
      // 최근 참가 경기 (이미 끝난 것 포함, 최근 5개)
      prisma.event.findMany({
        where: { slotInstances: { some: { athleteId: req.params.id } } },
        select: { id: true, name: true, tour: true, dateStart: true, dateEnd: true, status: true, venue: true, multiplier: true },
        orderBy: { dateStart: 'desc' },
        take: 5,
      }).catch((e) => { console.error('[athlete public] events error', e); return []; }),
      // GTOUR 등 경기결과 (docx 3-6, 최신순)
      prisma.athleteEventResult.findMany({
        where: { athleteId: req.params.id },
        orderBy: { eventDate: 'desc' },
        take: 30,
      }).catch((e) => { console.error('[athlete public] eventResults error', e); return []; }),
    ]);

    res.json({
      success: true,
      data: { athlete, slotInstances, exposureCount, recentEvents: athleteEvents, eventResults },
      error: null,
      request_id: (req as any).requestId,
    });
  } catch (e) { next(e); }
});

// ============================================
// 관리자: 선수 경기결과 CRUD (docx 3-6)
// ============================================

/** GET /athletes/:id/event-results — 운영자 또는 본인 */
router.get('/:id/event-results', authenticate, async (req: any, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN') {
      const a = await prisma.athlete.findUnique({ where: { id }, select: { userId: true } });
      if (!a || a.userId !== req.user.id) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
        return;
      }
    }
    const items = await prisma.athleteEventResult.findMany({
      where: { athleteId: id },
      orderBy: { eventDate: 'desc' },
    });
    res.json({ success: true, data: items, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /athletes/:id/event-results — 관리자만 (수기 등록) */
router.post('/:id/event-results', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const { eventName, eventDate, category, rank, score, totalRounds, summary, source } = req.body;
    if (!eventName || !eventDate) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'eventName, eventDate 필수' } });
      return;
    }
    const created = await prisma.athleteEventResult.create({
      data: {
        athleteId: id,
        eventName,
        eventDate: new Date(eventDate),
        category: category || null,
        rank: rank ?? null,
        score: score || null,
        totalRounds: totalRounds ?? null,
        summary: summary || null,
        source: source || 'MANUAL',
      },
    });
    res.json({ success: true, data: created, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** PATCH /athletes/event-results/:resultId */
router.patch('/event-results/:resultId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const updated = await prisma.athleteEventResult.update({
      where: { id: req.params.resultId },
      data: {
        ...(req.body.eventName != null && { eventName: req.body.eventName }),
        ...(req.body.eventDate && { eventDate: new Date(req.body.eventDate) }),
        ...(req.body.category !== undefined && { category: req.body.category }),
        ...(req.body.rank !== undefined && { rank: req.body.rank }),
        ...(req.body.score !== undefined && { score: req.body.score }),
        ...(req.body.totalRounds !== undefined && { totalRounds: req.body.totalRounds }),
        ...(req.body.summary !== undefined && { summary: req.body.summary }),
        ...(req.body.source && { source: req.body.source }),
        sourceUpdatedAt: new Date(),
      },
    });
    res.json({ success: true, data: updated, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** DELETE /athletes/event-results/:resultId */
router.delete('/event-results/:resultId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    await prisma.athleteEventResult.delete({ where: { id: req.params.resultId } });
    res.json({ success: true, data: { deleted: true }, error: null, request_id: (req as any).requestId });
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

import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEventSchema } from '../utils/validation';
import prisma from '../models/prisma';

const router = Router();

/**
 * @route GET /events
 * @desc List events with filters (public - non-logged-in users can view)
 */
router.get('/', optionalAuth, eventController.list);

/**
 * @route GET /events/upcoming
 * @desc Get upcoming events (public - non-logged-in users can view)
 */
router.get('/upcoming', optionalAuth, eventController.getUpcoming);

/**
 * @route GET /events/active
 * @desc 공개: 활성화 정책에 따른 진행/임박 대회만 (docx 3-7)
 *   - 결선일 N일 전 ~ 종료일까지가 활성 (기본 N=14)
 *   - ?days=14 로 조정 가능
 */
router.get('/active', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(60, Number(req.query.days) || 14));
    const now = new Date();
    const futureCap = new Date(now.getTime() + days * 86400000);

    const items = await prisma.event.findMany({
      where: {
        OR: [
          { status: 'UPCOMING', dateEnd: { gte: now }, dateStart: { lte: futureCap } },
          { status: 'LIVE' },
        ],
      },
      orderBy: { dateStart: 'asc' },
      take: 30,
    });

    const safe = items.map((e) => ({
      ...e,
      isActive: ['LIVE', 'UPCOMING'].includes(e.status as any) && new Date(e.dateEnd) >= now,
      isImminent: new Date(e.dateStart).getTime() - now.getTime() <= days * 86400000,
    }));
    res.json({ success: true, data: safe, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /events/default
 * @desc 공개: 가장 가까운 활성 대회 1개 (기본값 세팅용)
 */
router.get('/default', async (req, res, next) => {
  try {
    const now = new Date();
    const event = await prisma.event.findFirst({
      where: {
        OR: [
          { status: 'LIVE' },
          { status: 'UPCOMING', dateStart: { gte: now } },
        ],
      },
      orderBy: { dateStart: 'asc' },
    });
    res.json({ success: true, data: event || null, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route POST /events
 * @desc Create new event (admin only)
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createEventSchema),
  eventController.create
);

/**
 * @route GET /events/:id
 * @desc Get event by ID (public - non-logged-in users can view)
 */
router.get('/:id', optionalAuth, eventController.getById);

/**
 * @route PATCH /events/:id
 * @desc Update event (admin only)
 */
router.patch('/:id', authenticate, authorize('ADMIN'), eventController.update);

/**
 * @route DELETE /events/:id
 * @desc Delete event (admin only)
 */
router.delete('/:id', authenticate, authorize('ADMIN'), eventController.delete);

/**
 * @route POST /events/:id/participants
 * @desc Add participant to event (admin only)
 */
router.post(
  '/:id/participants',
  authenticate,
  authorize('ADMIN'),
  eventController.addParticipant
);

/**
 * @route POST /events/:id/confirm
 * @desc Confirm participation (athlete)
 */
router.post(
  '/:id/confirm',
  authenticate,
  authorize('ATHLETE'),
  eventController.confirmParticipation
);

export default router;

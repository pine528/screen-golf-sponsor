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
 *   - ?days=N 로 시스템 기본값 조정 가능
 *   - 관리자 우선 정책: Event.activeDays(이벤트별) > query.days(시스템) > 14(기본)
 *   - Event.isActive=false 인 대회는 제외 (관리자 운영 토글)
 */
router.get('/active', async (req, res, next) => {
  try {
    const fallbackDays = Math.max(1, Math.min(60, Number(req.query.days) || 14));
    const now = new Date();
    // 일단 넉넉히 60일까지 후보 수집 후, 이벤트별 activeDays 우선 적용
    const cap60 = new Date(now.getTime() + 60 * 86400000);

    const candidates = await prisma.event.findMany({
      where: {
        isActive: true, // 관리자 비활성화 토글 존중
        OR: [
          { status: 'UPCOMING', dateEnd: { gte: now }, dateStart: { lte: cap60 } },
          { status: 'LIVE' },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { dateStart: 'asc' }],
      take: 60,
    });

    // 관리자 우선 N값 적용 (activeDays > query.days > 14)
    const items = candidates.filter((e) => {
      const effectiveDays = e.activeDays ?? fallbackDays;
      const cap = new Date(now.getTime() + effectiveDays * 86400000);
      return e.status === 'LIVE' || (new Date(e.dateStart) <= cap && new Date(e.dateEnd) >= now);
    });

    const safe = items.slice(0, 30).map((e) => {
      const effectiveDays = e.activeDays ?? fallbackDays;
      return {
        ...e,
        isActive: ['LIVE', 'UPCOMING'].includes(e.status as any) && new Date(e.dateEnd) >= now,
        isImminent: new Date(e.dateStart).getTime() - now.getTime() <= effectiveDays * 86400000,
        effectiveActiveDays: effectiveDays,
        activeDaysSource: e.activeDays != null ? 'admin' : 'system',
      };
    });
    res.json({ success: true, data: safe, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route PATCH /events/:id/activation
 * @desc 관리자: 대회 활성화 토글 (isActive) + 표시 순서(displayOrder) + N일(activeDays) 일괄 갱신
 *   body: { isActive?, displayOrder?, activeDays? }
 *   관리자 세팅 우선 — 외부 연동/시스템 기본값보다 우선합니다.
 */
router.patch('/:id/activation', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { isActive, displayOrder, activeDays, category, qualifyingDate } = req.body || {};
    const data: any = {};
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof displayOrder === 'number') data.displayOrder = displayOrder;
    if (activeDays === null) data.activeDays = null; // 명시적 해제 → 시스템 기본값으로
    else if (typeof activeDays === 'number') data.activeDays = Math.max(1, Math.min(60, activeDays));
    if (typeof category === 'string') data.category = category || null;
    if (qualifyingDate !== undefined) data.qualifyingDate = qualifyingDate ? new Date(qualifyingDate) : null;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '변경할 필드가 없습니다.' } });
      return;
    }
    const updated = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /events/admin/list
 * @desc 관리자: 활성화 토글/N값/카테고리 관리용 전체 목록
 */
router.get('/admin/list', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    const items = await prisma.event.findMany({
      orderBy: [{ displayOrder: 'asc' }, { dateStart: 'asc' }],
      take: 200,
      select: {
        id: true, tour: true, name: true, category: true, dateStart: true, dateEnd: true,
        qualifyingDate: true, displayOrder: true, isActive: true, activeDays: true,
        status: true, multiplier: true, venue: true,
      },
    });
    res.json({ success: true, data: items, error: null });
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

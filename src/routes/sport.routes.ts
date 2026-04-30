/**
 * Sport (종목 카테고리) API
 * - SPONPIK 1차: 골프/스크린골프 + 향후 확장 (야구/축구/배구/농구)
 * - 공개: 활성 종목 목록
 * - 관리자: 활성화 토글 + 표시 순서 갱신
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../models/prisma';

const router = Router();

/**
 * @route GET /sports
 * @desc 공개: 활성화된 종목 목록 (트리 구조)
 */
router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.sport.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: items, error: null });
  } catch (e) { next(e); }
});

/**
 * @route GET /sports/admin/all
 * @desc 관리자: 전체 종목 (비활성 포함)
 */
router.get('/admin/all', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    const items = await prisma.sport.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: items, error: null });
  } catch (e) { next(e); }
});

/**
 * @route PATCH /sports/:id
 * @desc 관리자: 종목 활성화/표시 순서 변경
 */
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { isActive, displayOrder, name, description, iconUrl } = req.body || {};
    const data: any = {};
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof displayOrder === 'number') data.displayOrder = displayOrder;
    if (typeof name === 'string') data.name = name;
    if (typeof description === 'string') data.description = description;
    if (typeof iconUrl === 'string') data.iconUrl = iconUrl;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '변경할 필드가 없습니다.' } });
      return;
    }
    const updated = await prisma.sport.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

/**
 * @route POST /sports
 * @desc 관리자: 신규 종목 등록 (확장용)
 */
router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { code, name, parentCode, description, iconUrl, displayOrder } = req.body || {};
    if (!code || !name) {
      res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'code, name 필수' } });
      return;
    }
    const created = await prisma.sport.create({
      data: {
        code, name,
        parentCode: parentCode || null,
        description: description || null,
        iconUrl: iconUrl || null,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 999,
      },
    });
    res.status(201).json({ success: true, data: created, error: null });
  } catch (e) { next(e); }
});

export default router;

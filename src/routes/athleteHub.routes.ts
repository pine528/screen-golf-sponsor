/**
 * 선수 메뉴 API — 선수 메뉴 상세 핸드오프 v1.0 §9.3
 *  GET/PUT/DELETE /me/favorite-athletes(/:id)  관심 선수(계정 단위, 멱등)
 *  GET            /me/favorite-athletes/ids     카드 하트 초기 상태용
 *  POST           /athlete-match                나에게 맞는 선수 (athlete-only)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  addFavoriteAthlete, listFavoriteAthletes, listFavoriteIds, matchAthletes, removeFavoriteAthlete,
} from '../services/athleteHub.service';

const ok = (res: Response, data: any, status = 200) => res.status(status).json({ success: true, data, error: null, serverTime: new Date().toISOString() });

export const favoriteAthleteRoutes = Router();
favoriteAthleteRoutes.use(authenticate);

favoriteAthleteRoutes.get('/', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await listFavoriteAthletes(req.user.id)); } catch (e) { next(e); }
});
favoriteAthleteRoutes.get('/ids', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, { ids: await listFavoriteIds(req.user.id) }); } catch (e) { next(e); }
});
favoriteAthleteRoutes.put('/:athleteId', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await addFavoriteAthlete(req.user.id, req.params.athleteId, req.user.fanId)); }
  catch (e: any) { if (e?.status) return res.status(e.status).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: e.message } }); next(e); }
});
favoriteAthleteRoutes.delete('/:athleteId', async (req: any, res: Response, next: NextFunction) => {
  try { ok(res, await removeFavoriteAthlete(req.user.id, req.params.athleteId, req.user.fanId)); } catch (e) { next(e); }
});

export const athleteMatchRoutes = Router();
athleteMatchRoutes.post('/', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    const arr = (v: any, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n) : undefined);
    if (!arr(b.objectives, 2)?.length) {
      return res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '목표를 1개 이상 선택해주세요' } });
    }
    ok(res, await matchAthletes({
      objectives: arr(b.objectives, 2),
      targets: arr(b.targets, 2),
      budgetBand: typeof b.budgetBand === 'string' ? b.budgetBand : undefined,
      sports: arr(b.sports, 3),
      activities: arr(b.activities, 2),
      regions: arr(b.regions, 2),
      excludedAthleteIds: arr(b.excludedAthleteIds, 20),
    }, req.user?.id));
  } catch (e) { next(e); }
});

void Request;

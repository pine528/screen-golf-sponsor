/**
 * YouTube API 연동 엔드포인트 (SPONPIK Phase 2 SNS)
 *
 * 공개:
 *   GET  /api/youtube/athletes/:athleteId  — 선수 채널 메타+최근 영상 (RoiDashboard용)
 * 선수:
 *   POST /api/youtube/me/connect  { channelInput }  — 본인 채널 연결
 *   DELETE /api/youtube/me  — 본인 채널 해제
 *   POST /api/youtube/me/sync  — 본인 채널 수동 재동기화
 * 관리자:
 *   POST /api/youtube/admin/athletes/:athleteId/connect  { channelInput }
 *   POST /api/youtube/admin/athletes/:athleteId/sync
 *   GET  /api/youtube/admin/channels  — 전체 연결된 채널 목록
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { youtubeService } from '../services/youtube.service';
import prisma from '../models/prisma';

const router = Router();

/** 공개: 선수의 YouTube 채널 + 최근 영상 (RoiDashboard 콘텐츠 반응 카테고리에 사용) */
router.get('/athletes/:athleteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await youtubeService.getAthleteAggregate(req.params.athleteId);
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 채널 연결 */
router.post('/me/connect', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    const { channelInput } = req.body || {};
    if (!channelInput || typeof channelInput !== 'string') {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'YouTube URL/핸들/Channel ID를 입력해주세요' } });
      return;
    }
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const channel = await youtubeService.connectAthleteChannel(req.user.athleteId, channelInput);
    res.json({ success: true, data: channel, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 채널 해제 */
router.delete('/me', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    await youtubeService.disconnectAthleteChannel(req.user.athleteId);
    res.json({ success: true, data: { message: '연결 해제 완료' }, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 수동 재동기화 */
router.post('/me/sync', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const refreshed = await youtubeService.refreshChannel(req.user.athleteId);
    res.json({ success: true, data: refreshed, error: null });
  } catch (e) { next(e); }
});

/** 관리자: 임의 선수 채널 연결 */
router.post('/admin/athletes/:athleteId/connect', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { channelInput } = req.body || {};
    if (!channelInput) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'channelInput 필수' } });
      return;
    }
    const channel = await youtubeService.connectAthleteChannel(req.params.athleteId, channelInput);
    res.json({ success: true, data: channel, error: null });
  } catch (e) { next(e); }
});

/** 관리자: 임의 선수 채널 수동 동기화 */
router.post('/admin/athletes/:athleteId/sync', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const refreshed = await youtubeService.refreshChannel(req.params.athleteId);
    res.json({ success: true, data: refreshed, error: null });
  } catch (e) { next(e); }
});

/** 관리자: 전체 연결된 YouTube 채널 목록 */
router.get('/admin/channels', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    const channels = await prisma.youtubeChannel.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      include: { athlete: { select: { id: true, name: true, profileImageUrl: true } } },
    });
    res.json({
      success: true,
      data: {
        enabled: youtubeService.isEnabled(),
        items: channels.map(c => ({
          ...c,
          totalViews: c.totalViews ? Number(c.totalViews) : null, // BigInt → number
        })),
      },
      error: null,
    });
  } catch (e) { next(e); }
});

/** 관리자: API 키 활성화 여부 확인 */
router.get('/admin/status', authenticate, authorize('ADMIN'), async (_req, res) => {
  res.json({
    success: true,
    data: {
      enabled: youtubeService.isEnabled(),
      message: youtubeService.isEnabled()
        ? 'YouTube Data API 활성화됨'
        : '환경변수 YOUTUBE_API_KEY 미설정 — Google Cloud Console에서 발급 후 Render 환경변수에 등록 필요',
    },
    error: null,
  });
});

export default router;

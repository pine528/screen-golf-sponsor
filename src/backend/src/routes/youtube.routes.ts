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
import { athleteMentionService } from '../services/athleteMention.service';
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

// ============================================
// 출연 영상 (3rd-party YouTube mention) — Phase 2 SNS 옵션 B
// ============================================

/** 공개: 선수의 APPROVED 출연 영상 집계 (RoiDashboard 콘텐츠 반응용) */
router.get('/mentions/athletes/:athleteId', async (req, res, next) => {
  try {
    const data = await athleteMentionService.getApprovedAggregate(req.params.athleteId);
    res.json({ success: true, data, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 출연 영상 전체 목록 (status 필터 가능) */
router.get('/mentions/me', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const status = req.query.status as any;
    const items = await athleteMentionService.listForAthlete(req.user.athleteId, { status });
    res.json({ success: true, data: items, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 내 이름으로 YouTube 검색 → PENDING 후보 등록 */
router.post('/mentions/me/search', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const customQuery = req.body?.query;
    const result = await athleteMentionService.searchCandidates(req.user.athleteId, customQuery);
    res.json({ success: true, data: result, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: URL 직접 등록 (즉시 APPROVED) */
router.post('/mentions/me', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const { videoUrl } = req.body || {};
    if (!videoUrl) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'videoUrl 필수' } });
      return;
    }
    const m = await athleteMentionService.addByVideoUrl(req.user.athleteId, videoUrl, 'SELF_REPORTED', req.user.id);
    res.json({ success: true, data: m, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: PENDING 후보 승인 */
router.post('/mentions/me/:mentionId/approve', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const m = await prisma.athleteMention.findUnique({ where: { id: req.params.mentionId } });
    if (!m || m.athleteId !== req.user.athleteId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '본인 멘션이 아닙니다' } });
      return;
    }
    const updated = await athleteMentionService.approve(m.id, req.user.id);
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 후보 거절 */
router.post('/mentions/me/:mentionId/reject', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const m = await prisma.athleteMention.findUnique({ where: { id: req.params.mentionId } });
    if (!m || m.athleteId !== req.user.athleteId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '본인 멘션이 아닙니다' } });
      return;
    }
    const updated = await athleteMentionService.reject(m.id, req.body?.reason);
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

/** 선수 본인: 멘션 완전 삭제 */
router.delete('/mentions/me/:mentionId', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    if (!req.user.athleteId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정만 가능합니다' } });
      return;
    }
    const m = await prisma.athleteMention.findUnique({ where: { id: req.params.mentionId } });
    if (!m || m.athleteId !== req.user.athleteId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '본인 멘션이 아닙니다' } });
      return;
    }
    await athleteMentionService.remove(m.id);
    res.json({ success: true, data: { id: m.id }, error: null });
  } catch (e) { next(e); }
});

/** 관리자: 임의 선수 멘션 검색 / 추가 / 승인 / 거절 / 삭제 */
router.get('/mentions/admin/athletes/:athleteId', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const items = await athleteMentionService.listForAthlete(req.params.athleteId, { status: req.query.status as any });
    res.json({ success: true, data: items, error: null });
  } catch (e) { next(e); }
});

router.post('/mentions/admin/athletes/:athleteId/search', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const result = await athleteMentionService.searchCandidates(req.params.athleteId, req.body?.query);
    res.json({ success: true, data: result, error: null });
  } catch (e) { next(e); }
});

router.post('/mentions/admin/athletes/:athleteId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const { videoUrl } = req.body || {};
    if (!videoUrl) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'videoUrl 필수' } });
      return;
    }
    const m = await athleteMentionService.addByVideoUrl(req.params.athleteId, videoUrl, 'MANUAL', req.user.id);
    res.json({ success: true, data: m, error: null });
  } catch (e) { next(e); }
});

router.post('/mentions/admin/:mentionId/approve', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const updated = await athleteMentionService.approve(req.params.mentionId, req.user.id);
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

router.post('/mentions/admin/:mentionId/reject', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const updated = await athleteMentionService.reject(req.params.mentionId, req.body?.reason);
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

router.delete('/mentions/admin/:mentionId', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await athleteMentionService.remove(req.params.mentionId);
    res.json({ success: true, data: { id: req.params.mentionId }, error: null });
  } catch (e) { next(e); }
});

/** 관리자: 통계 갱신 수동 트리거 (cron 외) */
router.post('/mentions/admin/refresh-stats', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const max = Number(req.body?.maxBatch) || 100;
    const result = await athleteMentionService.refreshApprovedStats(max);
    res.json({ success: true, data: result, error: null });
  } catch (e) { next(e); }
});

export default router;

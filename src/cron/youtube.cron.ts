/**
 * YouTube Data API 동기화 Cron (SPONPIK Phase 2 SNS)
 *
 * 매일 03:00 KST: 모든 연결된 YouTube 채널의 메타+영상 갱신
 * - 채널 통계 (구독자/총조회수/영상수)
 * - 최근 20개 영상의 조회/좋아요/댓글 수
 *
 * Quota 사용량 (참고):
 * - channels.list: 1 unit
 * - search.list: 100 unit
 * - videos.list: 1 unit
 * - 채널 1개 = 약 102 unit/일
 * - 일일 무료 quota 10,000 → 약 98개 채널까지 무료
 */
import prisma from '../models/prisma';
import { youtubeService } from '../services/youtube.service';

export class YoutubeSyncCron {
  /** 모든 연결된 채널 동기화 */
  async runDaily() {
    if (!youtubeService.isEnabled()) {
      console.log('[youtube-cron] YOUTUBE_API_KEY 미설정 — 스킵');
      return { synced: 0, skipped: true };
    }
    const channels = await prisma.youtubeChannel.findMany({
      select: { id: true, athleteId: true, channelId: true, title: true },
    });
    console.log(`[youtube-cron] ${channels.length}개 채널 동기화 시작`);

    let success = 0;
    let failed = 0;
    for (const c of channels) {
      try {
        // 1) 채널 메타 갱신
        const meta = await youtubeService.fetchChannelById(c.channelId);
        if (meta) {
          await prisma.youtubeChannel.update({
            where: { id: c.id },
            data: {
              title: meta.title,
              description: meta.description,
              thumbnailUrl: meta.thumbnailUrl,
              subscriberCount: meta.subscriberCount,
              videoCount: meta.videoCount,
              totalViews: meta.totalViews ? BigInt(meta.totalViews) : null,
              lastSyncedAt: new Date(),
              syncStatus: 'OK',
              syncError: null,
            },
          });
        }
        // 2) 영상 갱신
        await youtubeService.syncChannelVideos(c.id);
        success++;
        console.log(`[youtube-cron]  ✅ ${c.title} (${c.channelId})`);
      } catch (e: any) {
        failed++;
        console.error(`[youtube-cron]  ❌ ${c.title}:`, e?.message);
        await prisma.youtubeChannel.update({
          where: { id: c.id },
          data: { syncStatus: 'FAILED', syncError: String(e?.message || e).slice(0, 500) },
        }).catch(() => {});
      }
    }
    console.log(`[youtube-cron] 완료 — success=${success}, failed=${failed}`);
    return { synced: success, failed, total: channels.length };
  }
}

export const youtubeSyncCron = new YoutubeSyncCron();

/**
 * YouTube Data API v3 연동 서비스
 *
 * SPONPIK Phase 2 — SNS·콘텐츠 자동 분석
 * (ROI 자동화 docx §4.3 유튜브 항목)
 *
 * 기능:
 * - 채널 메타데이터 조회 (구독자수/총 조회수/영상수)
 * - 채널 최신 영상 목록 조회 (조회수/좋아요/댓글)
 * - 일일 동기화 (cron)
 *
 * 환경변수:
 *   YOUTUBE_API_KEY=AIza... (Google Cloud Console > YouTube Data API v3)
 *
 * 키 미설정 시: 모든 메서드가 graceful 실패 → null 반환 (서비스 다운 X)
 */
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface ChannelMeta {
  channelId: string;
  channelHandle: string | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  totalViews: number | null;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSec: number | null;
}

class YoutubeService {
  private get apiKey(): string | undefined {
    return process.env.YOUTUBE_API_KEY;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * URL/handle/channel ID 입력으로 채널 메타데이터 조회
   * 입력 형식 모두 수용:
   *   - https://www.youtube.com/@username
   *   - https://www.youtube.com/channel/UCxxxx
   *   - @username
   *   - UCxxxxx (24자 채널 ID)
   */
  async resolveChannel(input: string): Promise<ChannelMeta | null> {
    if (!this.isEnabled()) return null;
    const trimmed = input.trim();

    // Channel ID (UCxxxxx, 24자)
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
      return this.fetchChannelById(trimmed);
    }
    // URL에서 handle/channelId 추출
    let handle: string | null = null;
    const urlHandleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
    const urlChannelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    const handleMatch = trimmed.match(/^@([\w.-]+)$/);
    if (urlChannelMatch) return this.fetchChannelById(urlChannelMatch[1]);
    if (urlHandleMatch) handle = urlHandleMatch[1];
    else if (handleMatch) handle = handleMatch[1];
    if (handle) return this.fetchChannelByHandle(handle);

    return null;
  }

  /** YouTube API: channels.list?id= */
  async fetchChannelById(channelId: string): Promise<ChannelMeta | null> {
    if (!this.isEnabled()) return null;
    const url = `${YT_API_BASE}/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${this.apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new BadRequestError(`YouTube API error: ${r.status} ${await r.text()}`);
    const j: any = await r.json();
    const item = j?.items?.[0];
    if (!item) return null;
    return {
      channelId: item.id,
      channelHandle: item.snippet?.customUrl || null,
      title: item.snippet?.title || '',
      description: item.snippet?.description || null,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
      subscriberCount: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : null,
      videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
      totalViews: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    };
  }

  /** YouTube API: channels.list?forHandle= */
  async fetchChannelByHandle(handle: string): Promise<ChannelMeta | null> {
    if (!this.isEnabled()) return null;
    const url = `${YT_API_BASE}/channels?part=snippet,statistics&forHandle=@${encodeURIComponent(handle)}&key=${this.apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new BadRequestError(`YouTube API error: ${r.status}`);
    const j: any = await r.json();
    const item = j?.items?.[0];
    if (!item) return null;
    return {
      channelId: item.id,
      channelHandle: item.snippet?.customUrl || `@${handle}`,
      title: item.snippet?.title || '',
      description: item.snippet?.description || null,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
      subscriberCount: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : null,
      videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
      totalViews: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    };
  }

  /** 채널의 최근 영상 N개 (search.list + videos.list) */
  async fetchChannelVideos(channelId: string, max = 20): Promise<VideoMeta[]> {
    if (!this.isEnabled()) return [];
    // 1) search.list 로 최신 영상 ID 추출
    const searchUrl = `${YT_API_BASE}/search?part=id&channelId=${encodeURIComponent(channelId)}&type=video&order=date&maxResults=${max}&key=${this.apiKey}`;
    const sr = await fetch(searchUrl);
    if (!sr.ok) throw new BadRequestError(`YouTube search error: ${sr.status}`);
    const sj: any = await sr.json();
    const ids: string[] = (sj?.items || []).map((i: any) => i?.id?.videoId).filter(Boolean);
    if (ids.length === 0) return [];

    // 2) videos.list 로 통계 조회
    const videoUrl = `${YT_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${this.apiKey}`;
    const vr = await fetch(videoUrl);
    if (!vr.ok) throw new BadRequestError(`YouTube videos error: ${vr.status}`);
    const vj: any = await vr.json();
    return (vj?.items || []).map((v: any): VideoMeta => ({
      videoId: v.id,
      title: v.snippet?.title || '',
      description: v.snippet?.description || null,
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null,
      publishedAt: new Date(v.snippet?.publishedAt || Date.now()),
      viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : 0,
      likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : 0,
      commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : 0,
      durationSec: parseDurationSec(v.contentDetails?.duration),
    }));
  }

  /**
   * 선수에게 채널 연결 + 즉시 1회 동기화
   */
  async connectAthleteChannel(athleteId: string, channelInput: string) {
    if (!this.isEnabled()) {
      // API 키 미설정 시 메타 없이 URL만 저장 (운영자가 키 등록 후 sync 트리거)
      return prisma.youtubeChannel.upsert({
        where: { athleteId },
        update: { channelId: channelInput, syncStatus: 'PENDING', syncError: 'YOUTUBE_API_KEY 미설정' },
        create: { athleteId, channelId: channelInput, title: channelInput, syncStatus: 'PENDING', syncError: 'YOUTUBE_API_KEY 미설정' },
      });
    }
    const meta = await this.resolveChannel(channelInput);
    if (!meta) throw new NotFoundError('YouTube 채널을 찾을 수 없습니다 (URL/핸들/Channel ID 확인)');

    const channel = await prisma.youtubeChannel.upsert({
      where: { athleteId },
      update: {
        channelId: meta.channelId,
        channelHandle: meta.channelHandle,
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
      create: {
        athleteId,
        channelId: meta.channelId,
        channelHandle: meta.channelHandle,
        title: meta.title,
        description: meta.description,
        thumbnailUrl: meta.thumbnailUrl,
        subscriberCount: meta.subscriberCount,
        videoCount: meta.videoCount,
        totalViews: meta.totalViews ? BigInt(meta.totalViews) : null,
        lastSyncedAt: new Date(),
        syncStatus: 'OK',
      },
    });

    // 영상도 함께 동기화 (background, await 안 해도 무방)
    this.syncChannelVideos(channel.id).catch((e) => console.error('[youtube] video sync failed', e));

    return channel;
  }

  /** 채널 연결 해제 */
  async disconnectAthleteChannel(athleteId: string) {
    return prisma.youtubeChannel.deleteMany({ where: { athleteId } });
  }

  /** 채널의 영상 동기화 (upsert 20개) */
  async syncChannelVideos(channelDbId: string) {
    if (!this.isEnabled()) return { synced: 0, skipped: true };
    const channel = await prisma.youtubeChannel.findUnique({ where: { id: channelDbId } });
    if (!channel) return { synced: 0, skipped: true };
    const videos = await this.fetchChannelVideos(channel.channelId, 20);
    let synced = 0;
    for (const v of videos) {
      await prisma.youtubeVideo.upsert({
        where: { videoId: v.videoId },
        update: {
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          durationSec: v.durationSec,
          lastSyncedAt: new Date(),
        },
        create: {
          channelDbId,
          videoId: v.videoId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          durationSec: v.durationSec,
        },
      });
      synced++;
    }
    return { synced, skipped: false };
  }

  /** 채널 메타 + 영상 통합 재동기화 */
  async refreshChannel(athleteId: string) {
    const existing = await prisma.youtubeChannel.findUnique({ where: { athleteId } });
    if (!existing) throw new NotFoundError('연결된 YouTube 채널이 없습니다');
    if (!this.isEnabled()) {
      await prisma.youtubeChannel.update({
        where: { id: existing.id },
        data: { syncStatus: 'FAILED', syncError: 'YOUTUBE_API_KEY 미설정' },
      });
      return existing;
    }
    return this.connectAthleteChannel(athleteId, existing.channelId);
  }

  /**
   * 선수 ROI 대시보드용 집계
   * - totalViews: 채널 총 조회수
   * - subscriberCount: 구독자수
   * - recentVideoStats: 최근 20개 영상의 합계 (조회/좋아요/댓글)
   */
  async getAthleteAggregate(athleteId: string) {
    const channel = await prisma.youtubeChannel.findUnique({
      where: { athleteId },
      include: {
        videos: {
          orderBy: { publishedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!channel) return null;
    const recent = channel.videos;
    const recentViews = recent.reduce((s, v) => s + v.viewCount, 0);
    const recentLikes = recent.reduce((s, v) => s + v.likeCount, 0);
    const recentComments = recent.reduce((s, v) => s + v.commentCount, 0);
    return {
      channelId: channel.channelId,
      channelHandle: channel.channelHandle,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
      subscriberCount: channel.subscriberCount,
      totalViews: channel.totalViews ? Number(channel.totalViews) : null,
      videoCount: channel.videoCount,
      lastSyncedAt: channel.lastSyncedAt,
      syncStatus: channel.syncStatus,
      syncError: channel.syncError,
      recent: {
        count: recent.length,
        viewSum: recentViews,
        likeSum: recentLikes,
        commentSum: recentComments,
        videos: recent.slice(0, 5).map((v) => ({
          videoId: v.videoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
        })),
      },
    };
  }
}

/** ISO 8601 duration (PT4M13S) → 초 */
function parseDurationSec(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

export const youtubeService = new YoutubeService();

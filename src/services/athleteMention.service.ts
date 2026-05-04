/**
 * 선수 출연 영상 (3rd-party YouTube mention) 큐레이션 서비스
 *
 * SPONPIK Phase 2 SNS — 옵션 B (검색 + 수동 확인 하이브리드)
 *
 * 흐름:
 *   1. searchCandidates(athleteId)      — YouTube 검색 → PENDING 후보 N개 등록
 *   2. addByVideoUrl(athleteId, url)    — 본인/관리자가 URL 직접 등록 (즉시 APPROVED)
 *   3. approve(mentionId, approverId)   — PENDING → APPROVED
 *   4. reject(mentionId, reason?)       — PENDING/APPROVED → REJECTED
 *   5. cron: refreshApprovedStats()     — APPROVED 영상의 조회수/좋아요/댓글 갱신
 *   6. getApprovedAggregate(athleteId)  — RoiDashboard 콘텐츠 반응 카테고리용 집계
 */
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { MentionStatus, MentionSource } from '@prisma/client';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YoutubeSearchItem {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

interface VideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

class AthleteMentionService {
  private get apiKey(): string | undefined {
    return process.env.YOUTUBE_API_KEY;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /** YouTube videoId 추출 (URL 또는 video ID 모두 수용) */
  private extractVideoId(input: string): string | null {
    const trimmed = input.trim();
    // raw video ID (11자, [A-Za-z0-9_-])
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
    // youtube.com/watch?v=
    const m1 = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m1) return m1[1];
    // youtu.be/xxx
    const m2 = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m2) return m2[1];
    // youtube.com/shorts/xxx
    const m3 = trimmed.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
    if (m3) return m3[1];
    // youtube.com/embed/xxx
    const m4 = trimmed.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (m4) return m4[1];
    return null;
  }

  /** YouTube search.list 로 후보 영상 검색 (quota 100 unit) */
  async searchYoutubeCandidates(query: string, max: number = 10): Promise<YoutubeSearchItem[]> {
    if (!this.isEnabled()) return [];
    const url = `${YT_API_BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${max}&relevanceLanguage=ko&key=${this.apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new BadRequestError(`YouTube search error: ${r.status} ${await r.text()}`);
    const j: any = await r.json();
    return (j?.items || []).map((it: any): YoutubeSearchItem => ({
      videoId: it.id?.videoId,
      channelId: it.snippet?.channelId,
      channelTitle: it.snippet?.channelTitle || '',
      title: it.snippet?.title || '',
      description: it.snippet?.description || '',
      thumbnailUrl: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
      publishedAt: new Date(it.snippet?.publishedAt || Date.now()),
    })).filter((x: YoutubeSearchItem) => !!x.videoId);
  }

  /** videos.list 로 단일/다수 영상의 메타+통계 조회 (quota 1 unit, 50개까지 batch) */
  async fetchVideoMeta(videoIds: string[]): Promise<Array<YoutubeSearchItem & VideoStats>> {
    if (!this.isEnabled() || videoIds.length === 0) return [];
    const ids = videoIds.slice(0, 50).join(',');
    const url = `${YT_API_BASE}/videos?part=snippet,statistics&id=${ids}&key=${this.apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new BadRequestError(`YouTube videos error: ${r.status}`);
    const j: any = await r.json();
    return (j?.items || []).map((v: any) => ({
      videoId: v.id,
      channelId: v.snippet?.channelId,
      channelTitle: v.snippet?.channelTitle || '',
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null,
      publishedAt: new Date(v.snippet?.publishedAt || Date.now()),
      viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : 0,
      likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : 0,
      commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : 0,
    }));
  }

  /**
   * 선수명으로 검색 → PENDING 후보 등록 (이미 등록된 영상은 스킵)
   * @returns 새로 추가된 후보 + 기존 항목 목록
   */
  async searchCandidates(athleteId: string, customQuery?: string): Promise<any> {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, name: true, realName: true },
    });
    if (!athlete) throw new NotFoundError('선수를 찾을 수 없습니다');

    const query = customQuery?.trim() || athlete.name;

    if (!this.isEnabled()) {
      return {
        enabled: false,
        message: 'YOUTUBE_API_KEY 미설정 (검색 불가). 수동 URL 입력은 가능합니다.',
        items: [],
      };
    }

    const candidates = await this.searchYoutubeCandidates(query, 15);

    // 이미 등록된 videoId 제외
    const existing = await prisma.athleteMention.findMany({
      where: { athleteId, videoId: { in: candidates.map((c) => c.videoId) } },
      select: { videoId: true, status: true },
    });
    const existingMap = new Map(existing.map((e) => [e.videoId, e.status]));

    // 새 항목만 통계까지 조회
    const newCandidates = candidates.filter((c) => !existingMap.has(c.videoId));
    const withStats = newCandidates.length > 0
      ? await this.fetchVideoMeta(newCandidates.map((c) => c.videoId))
      : [];
    const statsMap = new Map(withStats.map((v) => [v.videoId, v]));

    // PENDING으로 일괄 등록
    let added = 0;
    for (const c of newCandidates) {
      const stats = statsMap.get(c.videoId);
      try {
        await prisma.athleteMention.create({
          data: {
            athleteId,
            videoId: c.videoId,
            channelId: c.channelId,
            channelTitle: c.channelTitle,
            videoTitle: c.title,
            videoThumbnail: c.thumbnailUrl,
            publishedAt: c.publishedAt,
            viewCount: stats?.viewCount ?? 0,
            likeCount: stats?.likeCount ?? 0,
            commentCount: stats?.commentCount ?? 0,
            status: 'PENDING',
            source: 'AUTO_SEARCH',
          },
        });
        added++;
      } catch (e) {
        // unique 제약 — race condition 무시
      }
    }

    return {
      enabled: true,
      query,
      added,
      totalCandidates: candidates.length,
      items: candidates.map((c) => ({
        ...c,
        stats: statsMap.get(c.videoId),
        existingStatus: existingMap.get(c.videoId) || null,
        isNew: !existingMap.has(c.videoId),
      })),
    };
  }

  /**
   * URL/videoId 직접 추가 (즉시 APPROVED)
   */
  async addByVideoUrl(athleteId: string, input: string, source: MentionSource = 'SELF_REPORTED', approverId?: string) {
    const videoId = this.extractVideoId(input);
    if (!videoId) throw new BadRequestError('올바른 YouTube URL 또는 video ID가 아닙니다');

    // 이미 등록된 경우: APPROVED로 승격
    const existing = await prisma.athleteMention.findUnique({
      where: { athleteId_videoId: { athleteId, videoId } },
    });
    if (existing) {
      if (existing.status === 'APPROVED') return existing;
      return prisma.athleteMention.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          source,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });
    }

    // YouTube 메타 + 통계 조회
    if (!this.isEnabled()) {
      // 키 없으면 메타 없이 등록 (cron이 나중에 채움)
      return prisma.athleteMention.create({
        data: {
          athleteId,
          videoId,
          videoTitle: '제목 미동기화 (YOUTUBE_API_KEY 필요)',
          publishedAt: new Date(),
          status: 'APPROVED',
          source,
          approvedBy: approverId,
          approvedAt: new Date(),
          syncStatus: 'FAILED',
          syncError: 'YOUTUBE_API_KEY 미설정',
        },
      });
    }
    const metas = await this.fetchVideoMeta([videoId]);
    const m = metas[0];
    if (!m) throw new NotFoundError('YouTube에서 해당 영상을 찾을 수 없습니다');

    return prisma.athleteMention.create({
      data: {
        athleteId,
        videoId,
        channelId: m.channelId,
        channelTitle: m.channelTitle,
        videoTitle: m.title,
        videoThumbnail: m.thumbnailUrl,
        publishedAt: m.publishedAt,
        viewCount: m.viewCount,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
        status: 'APPROVED',
        source,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });
  }

  async approve(mentionId: string, approverId: string) {
    return prisma.athleteMention.update({
      where: { id: mentionId },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() },
    });
  }

  async reject(mentionId: string, reason?: string) {
    return prisma.athleteMention.update({
      where: { id: mentionId },
      data: { status: 'REJECTED', rejectedReason: reason || null },
    });
  }

  async remove(mentionId: string) {
    return prisma.athleteMention.delete({ where: { id: mentionId } });
  }

  /** 선수의 멘션 전체 조회 (관리자/본인용) — status 필터 가능 */
  async listForAthlete(athleteId: string, opts?: { status?: MentionStatus }) {
    return prisma.athleteMention.findMany({
      where: { athleteId, ...(opts?.status ? { status: opts.status } : {}) },
      orderBy: [{ status: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  /**
   * APPROVED 멘션의 통계만 갱신 (cron용)
   * - quota: 50개 영상당 1 unit
   */
  async refreshApprovedStats(maxBatch: number = 100): Promise<{ refreshed: number; failed: number }> {
    if (!this.isEnabled()) return { refreshed: 0, failed: 0 };

    const all = await prisma.athleteMention.findMany({
      where: { status: 'APPROVED' },
      orderBy: { lastSyncedAt: 'asc' },
      take: maxBatch,
      select: { id: true, videoId: true },
    });
    if (all.length === 0) return { refreshed: 0, failed: 0 };

    let refreshed = 0;
    let failed = 0;
    // 50개씩 batch
    for (let i = 0; i < all.length; i += 50) {
      const batch = all.slice(i, i + 50);
      try {
        const metas = await this.fetchVideoMeta(batch.map((b) => b.videoId));
        const metaMap = new Map(metas.map((m) => [m.videoId, m]));
        for (const b of batch) {
          const m = metaMap.get(b.videoId);
          if (m) {
            await prisma.athleteMention.update({
              where: { id: b.id },
              data: {
                videoTitle: m.title,
                videoThumbnail: m.thumbnailUrl,
                viewCount: m.viewCount,
                likeCount: m.likeCount,
                commentCount: m.commentCount,
                lastSyncedAt: new Date(),
                syncStatus: 'OK',
                syncError: null,
              },
            });
            refreshed++;
          } else {
            // 영상이 삭제된 경우
            await prisma.athleteMention.update({
              where: { id: b.id },
              data: { syncStatus: 'FAILED', syncError: '영상이 삭제되었거나 접근 불가', lastSyncedAt: new Date() },
            });
            failed++;
          }
        }
      } catch (e: any) {
        for (const b of batch) {
          await prisma.athleteMention.update({
            where: { id: b.id },
            data: { syncStatus: 'FAILED', syncError: String(e?.message || e).slice(0, 500) },
          }).catch(() => {});
        }
        failed += batch.length;
      }
    }
    return { refreshed, failed };
  }

  /**
   * 공개 ROI Dashboard 콘텐츠 반응 카테고리용 집계
   */
  async getApprovedAggregate(athleteId: string) {
    const approved = await prisma.athleteMention.findMany({
      where: { athleteId, status: 'APPROVED' },
      orderBy: { publishedAt: 'desc' },
    });
    const viewSum = approved.reduce((s, m) => s + m.viewCount, 0);
    const likeSum = approved.reduce((s, m) => s + m.likeCount, 0);
    const commentSum = approved.reduce((s, m) => s + m.commentCount, 0);

    return {
      count: approved.length,
      viewSum,
      likeSum,
      commentSum,
      videos: approved.slice(0, 5).map((m) => ({
        id: m.id,
        videoId: m.videoId,
        url: `https://www.youtube.com/watch?v=${m.videoId}`,
        title: m.videoTitle,
        thumbnail: m.videoThumbnail,
        channelTitle: m.channelTitle,
        publishedAt: m.publishedAt,
        viewCount: m.viewCount,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
      })),
    };
  }
}

export const athleteMentionService = new AthleteMentionService();

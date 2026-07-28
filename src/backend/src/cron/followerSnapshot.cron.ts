/**
 * 팔로워 스냅샷 + 뉴스 크롤러 Cron (docx §6 C-1, C-3 자동 수집)
 *
 * - 매일 04:30 KST: 모든 active 선수의 YouTube 구독자 수 스냅샷 (증가율 계산용)
 * - 매일 05:00 KST: 모든 active 선수의 네이버 뉴스 검색 + 저장
 *
 * YouTube 동기화(03:30) → mention 통계(04:00) → 팔로워 스냅샷(04:30) → 뉴스(05:00)
 * 순서로 의존성 정리.
 */
import { captureAllAthleteFollowers } from '../services/followerSnapshot.service';
import { syncAllAthleteNews } from '../services/naverNews.service';

export class RoiAutoSyncCron {
  /** 일별 팔로워 스냅샷 */
  async runFollowerSnapshot() {
    console.log('[follower-cron] 시작');
    const r = await captureAllAthleteFollowers();
    console.log('[follower-cron] 완료:', r);
    return r;
  }

  /** 일별 네이버 뉴스 동기화 */
  async runNewsSync() {
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      console.log('[news-cron] NAVER_CLIENT_ID/SECRET 미설정 — 스킵');
      return { skipped: true };
    }
    console.log('[news-cron] 시작');
    const saved = await syncAllAthleteNews();
    console.log('[news-cron] 완료, 신규/갱신:', saved);
    return { saved, skipped: false };
  }
}

export const roiAutoSyncCron = new RoiAutoSyncCron();

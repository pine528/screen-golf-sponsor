/**
 * 네이버 뉴스 검색 API 서비스 (docx §6 C-1 기사/외부 언급 자동 수집)
 *
 * - https://developers.naver.com/docs/serviceapi/search/news/news.md
 * - 무료, 일 25,000건 호출 가능
 * - 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *
 * 동작:
 *   1) 선수명으로 네이버 뉴스 검색
 *   2) 결과 상위 N개를 AthleteNewsArticle 테이블에 upsert (URL unique)
 *   3) ROI 대시보드는 publishedAt >= 90일 이내 기사를 articleMentions 로 카운트
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const NAVER_NEWS_URL = 'https://openapi.naver.com/v1/search/news.json';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '');

const extractPublisher = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return null;
  }
};

/**
 * 네이버 뉴스 API 호출 (선수명 검색)
 * @param query 검색어 (보통 선수명 + 추가 키워드)
 * @param display 결과 개수 (1~100)
 * @param sort 'sim' (정확도) | 'date' (최신순)
 */
export async function searchNaverNews(query: string, display = 30, sort: 'sim' | 'date' = 'date'): Promise<NaverNewsItem[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[naverNews] NAVER_CLIENT_ID/SECRET 미설정 — 빈 결과 반환');
    return [];
  }

  try {
    const res = await axios.get<NaverNewsResponse>(NAVER_NEWS_URL, {
      params: { query, display: Math.min(100, display), sort },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      timeout: 10000,
    });
    return res.data.items || [];
  } catch (e: any) {
    console.error('[naverNews] API 호출 실패:', e?.response?.data || e?.message);
    return [];
  }
}

/**
 * 한 선수에 대해 뉴스 검색 + DB 저장
 * - URL unique → 중복 자동 회피
 * - title 에 선수명이 정확히 포함된 경우만 저장 (검색 정확도 보강)
 */
export async function syncAthleteNews(athleteId: string, athleteName: string, options?: { extraKeyword?: string; display?: number }) {
  const query = options?.extraKeyword ? `${athleteName} ${options.extraKeyword}` : athleteName;
  const items = await searchNaverNews(query, options?.display ?? 30, 'date');

  let saved = 0;
  let skipped = 0;

  for (const item of items) {
    const cleanTitle = stripHtml(item.title);
    // 정확도 필터: 제목에 선수명 포함되어야 함
    if (!cleanTitle.includes(athleteName)) {
      skipped++;
      continue;
    }
    try {
      await prisma.athleteNewsArticle.upsert({
        where: { athleteId_url: { athleteId, url: item.link } },
        update: {
          title: cleanTitle,
          publisher: extractPublisher(item.link),
          publishedAt: new Date(item.pubDate),
          description: stripHtml(item.description),
        },
        create: {
          athleteId,
          title: cleanTitle,
          url: item.link,
          publisher: extractPublisher(item.link),
          publishedAt: new Date(item.pubDate),
          description: stripHtml(item.description),
          source: 'NAVER_NEWS',
          language: 'ko',
        },
      });
      saved++;
    } catch (e) {
      console.error(`[naverNews] ${athleteId} 저장 실패 url=${item.link}:`, e);
      skipped++;
    }
  }

  return { saved, skipped, total: items.length };
}

/**
 * 모든 active 선수에 대해 뉴스 동기화 (cron 용)
 */
export async function syncAllAthleteNews() {
  const athletes = await prisma.athlete.findMany({
    where: { isActive: true, kycStatus: 'APPROVED' },
    select: { id: true, name: true },
  });

  let totalSaved = 0;
  for (const a of athletes) {
    const r = await syncAthleteNews(a.id, a.name, { extraKeyword: '골프' });
    totalSaved += r.saved;
    // API 부하 방지 — 호출 사이 짧은 딜레이
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log(`[naverNews] 전체 동기화 완료 — 신규/갱신 ${totalSaved}건`);
  return totalSaved;
}

/**
 * 최근 N일 기사 카운트 (ROI 대시보드 articleMentions 용)
 */
export async function countRecentArticles(athleteId: string, days = 90): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.athleteNewsArticle.count({
    where: { athleteId, publishedAt: { gte: since } },
  });
}

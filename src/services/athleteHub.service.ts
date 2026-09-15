/**
 * 선수 메뉴(Discovery Hub) 서비스 — 선수 메뉴 상세 핸드오프 v1.0 (2026-09-07, 리디자인/8)
 *
 *  - 관심 선수(Watchlist): 계정 단위 저장(UserFavoriteAthlete). 팬 계정은 기존 FavoriteAthlete에도 반영해
 *    팬 기여도·응원 기능과 어긋나지 않게 한다. 업데이트 신호(§7.3)는 저장된 공통 데이터에서 계산하고
 *    임계값은 WATCHLIST_CONFIG 한 곳에서 관리한다 (UI 하드코딩 금지).
 *  - 나에게 맞는 선수(Match): 기존 심층매칭 엔진(aiMatch.service)을 athlete-only 모드로 써서 선수 후보만 돌려준다.
 *    후원안/가격을 만들지 않는다 (§5 역할 경계). 근거·버전·데이터 기준일을 함께 준다.
 */
import { PrismaClient } from '@prisma/client';
import { createMatchRequest, RULE_VERSION } from './aiMatch.service';
import { getTemperatureView } from './fanTemperature.service';
import { listPickAthletes } from './directPick.service';

const prisma = new PrismaClient();

/* ── Watchlist 설정 (서버 config — §7.4) ── */
export const WATCHLIST_CONFIG = {
  updateWindowDays: 30,
  fanTempUpThreshold: 1.0, // 30일 창 대비 팬온도 상승폭(℃)
  performanceUpThreshold: 2, // 최근 5경기 평균순위 개선(위)
};

export type FavoriteUpdate = { type: string; summary: string; observedAt: string };

const UPDATE_COPY: Record<string, string> = {
  NEW_AVAILABILITY: '새로운 후원 가능 슬롯이 등록되었습니다.',
  FAN_TEMPERATURE_UP: '최근 팬 활동 신호가 상승했습니다.',
  PERFORMANCE_UP: '최근 5경기 평균순위가 상승했습니다.',
  PROFILE_REFRESH: '선수 프로필/활동 정보가 업데이트되었습니다.',
};

/** 한 선수의 업데이트 신호 — 확인된 것만 (LEG-06) */
async function detectUpdates(athleteId: string, card: any): Promise<FavoriteUpdate[]> {
  const now = Date.now();
  const since = new Date(now - WATCHLIST_CONFIG.updateWindowDays * 86400_000);
  const out: FavoriteUpdate[] = [];

  const [athlete, newInv, results, temp] = await Promise.all([
    prisma.athlete.findUnique({ where: { id: athleteId }, select: { profileUpdatedAt: true } }),
    prisma.slotInventory.findFirst({
      where: { athleteSlot: { athleteId, saleEnabled: true }, status: 'AVAILABLE', createdAt: { gte: since }, endDate: { gte: new Date(now) } },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true },
    }),
    prisma.athleteEventResult.findMany({
      where: { athleteId, status: 'APPROVED', rank: { not: null } },
      orderBy: { eventDate: 'desc' }, take: 10, select: { rank: true, eventDate: true },
    }),
    getTemperatureView(athleteId).catch(() => null),
  ]);

  if (newInv) out.push({ type: 'NEW_AVAILABILITY', summary: UPDATE_COPY.NEW_AVAILABILITY, observedAt: newInv.createdAt.toISOString() });

  const delta = Number((temp as any)?.windowDelta ?? NaN);
  if (!Number.isNaN(delta) && delta >= WATCHLIST_CONFIG.fanTempUpThreshold && !(temp as any)?.lowSample) {
    out.push({ type: 'FAN_TEMPERATURE_UP', summary: `${UPDATE_COPY.FAN_TEMPERATURE_UP} (+${delta.toFixed(1)}℃)`, observedAt: new Date(now).toISOString() });
  }

  if (results.length >= 10) {
    const avg = (xs: any[]) => xs.reduce((s, r) => s + Number(r.rank), 0) / xs.length;
    const recent = avg(results.slice(0, 5));
    const prev = avg(results.slice(5, 10));
    const gain = Math.round(prev - recent);
    if (gain >= WATCHLIST_CONFIG.performanceUpThreshold && new Date(results[0].eventDate) >= since) {
      out.push({ type: 'PERFORMANCE_UP', summary: `${UPDATE_COPY.PERFORMANCE_UP} (+${gain})`, observedAt: new Date(results[0].eventDate).toISOString() });
    }
  }

  if (athlete?.profileUpdatedAt && athlete.profileUpdatedAt >= since) {
    out.push({ type: 'PROFILE_REFRESH', summary: UPDATE_COPY.PROFILE_REFRESH, observedAt: athlete.profileUpdatedAt.toISOString() });
  }

  void card;
  return out.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
}

/* ── 관심 선수 ── */

export async function listFavoriteAthletes(userId: string) {
  const rows = await prisma.userFavoriteAthlete.findMany({
    where: { userId }, orderBy: { createdAt: 'desc' }, select: { athleteId: true, createdAt: true },
  });
  if (!rows.length) return { athletes: [], summary: { total: 0, updated: 0, sponsorable: 0 }, config: WATCHLIST_CONFIG };

  const ids = rows.map((r) => r.athleteId);
  const { athletes } = await listPickAthletes({ ids, limit: 120, includeClosed: true });
  const byId = new Map(athletes.map((a: any) => [a.id, a]));

  const list = await Promise.all(rows.map(async (r) => {
    const card = byId.get(r.athleteId);
    if (!card) return null; // 비활성/비공개 선수는 목록에서 뺀다 (서버 검증)
    const updates = await detectUpdates(r.athleteId, card);
    return { ...card, savedAt: r.createdAt, updates, sponsorAvailable: card.slotOpen > 0 || card.offerCount > 0 };
  }));
  const athletesOut = list.filter(Boolean) as any[];

  return {
    athletes: athletesOut,
    summary: {
      total: athletesOut.length,
      updated: athletesOut.filter((a) => a.updates.length > 0).length,
      sponsorable: athletesOut.filter((a) => a.sponsorAvailable).length,
    },
    config: WATCHLIST_CONFIG,
    asOf: new Date().toISOString(),
  };
}

export async function listFavoriteIds(userId: string) {
  const rows = await prisma.userFavoriteAthlete.findMany({ where: { userId }, select: { athleteId: true } });
  return rows.map((r) => r.athleteId);
}

/** 멱등 — 이미 있으면 그대로. 팬 계정은 기존 팬 즐겨찾기에도 반영 */
export async function addFavoriteAthlete(userId: string, athleteId: string, fanId?: string | null) {
  const athlete = await prisma.athlete.findFirst({ where: { id: athleteId, isActive: true }, select: { id: true } });
  if (!athlete) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });
  await prisma.userFavoriteAthlete.upsert({
    where: { userId_athleteId: { userId, athleteId } },
    update: {},
    create: { userId, athleteId },
  });
  if (fanId) {
    await prisma.favoriteAthlete.upsert({
      where: { fanId_athleteId: { fanId, athleteId } },
      update: {},
      create: { fanId, athleteId },
    }).catch(() => null);
  }
  return { athleteId, favorite: true };
}

export async function removeFavoriteAthlete(userId: string, athleteId: string, fanId?: string | null) {
  await prisma.userFavoriteAthlete.deleteMany({ where: { userId, athleteId } });
  if (fanId) await prisma.favoriteAthlete.deleteMany({ where: { fanId, athleteId } }).catch(() => null);
  return { athleteId, favorite: false };
}

/* ── 나에게 맞는 선수 (athlete-only match) ── */

export const ATHLETE_MATCH_VERSION = 'athlete-match-v1-2026-09-15';

export interface AthleteMatchInput {
  objectives?: string[]; // AWARENESS | FAN_RESPONSE | LOCAL | SNS | GROWTH | PERFORMANCE
  targets?: string[];    // F2030 | M2030 | FAMILY | GOLF_FAN | LOCAL_CONSUMER | NEW_CUSTOMER
  budgetBand?: string;   // UNDER_30 | M30_50 | M50_100 | OVER_100
  sports?: string[];     // GOLF | ...
  activities?: string[]; // OFFLINE | ONLINE | FAN_STORE | EVENT | LESSON | PRO_AM
  regions?: string[];    // 서울 | 경기 | 부산 | 제주 | 전국
  excludedAthleteIds?: string[];
}

const OBJ_GOALS: Record<string, string[]> = {
  AWARENESS: ['BRAND_AWARENESS'],
  FAN_RESPONSE: ['FAN_STORE'],
  LOCAL: ['BRAND_AWARENESS'],
  SNS: ['SNS_CONTENT'],
  GROWTH: ['LONG_TERM'],
  PERFORMANCE: ['EVENT_TEST'],
};
const OBJ_LABEL: Record<string, string> = {
  AWARENESS: '인지도 확대', FAN_RESPONSE: '팬 반응', LOCAL: '지역 연계', SNS: 'SNS 확산', GROWTH: '성장 가능성', PERFORMANCE: '경기력 중심',
};
const TARGET_LABEL: Record<string, string> = {
  F2030: '여성 2030', M2030: '남성 2030', FAMILY: '가족층', GOLF_FAN: '골프 팬', LOCAL_CONSUMER: '지역 소비자', NEW_CUSTOMER: '브랜드 신규고객',
};
/** 월 예산 밴드 → 원. 추천 PICK과 같은 기준(서버가 유일한 금액 기준) */
const BUDGET: Record<string, { min: number; max: number; label: string }> = {
  UNDER_30: { min: 100_000, max: 300_000, label: '30만원 이하' },
  M30_50: { min: 300_000, max: 500_000, label: '30~50만원' },
  M50_100: { min: 500_000, max: 1_000_000, label: '50~100만원' },
  OVER_100: { min: 1_000_000, max: 3_000_000, label: '100만원 이상' },
};
const ACTIVITY_FIELD: Record<string, string[]> = {
  ONLINE: ['sns', 'youtube'], EVENT: ['proAm', 'etc'], LESSON: ['lesson'], PRO_AM: ['proAm'],
};
const REGION_ALIAS: Record<string, string[]> = { 서울: ['서울'], 경기: ['경기', '인천'], 부산: ['부산', '경남', '울산'], 제주: ['제주'] };

export async function matchAthletes(input: AthleteMatchInput, userId?: string) {
  const objectives = (input.objectives || []).filter((o) => OBJ_GOALS[o]).slice(0, 2);
  const goals = [...new Set(objectives.flatMap((o) => OBJ_GOALS[o]))];
  const budget = BUDGET[input.budgetBand || ''] || BUDGET.M50_100;
  const targets = (input.targets || []).filter((t) => TARGET_LABEL[t]).slice(0, 2);
  const ages = targets.flatMap((t) => (t === 'F2030' || t === 'M2030' ? ['20대', '30대'] : t === 'FAMILY' ? ['30대', '40대'] : []));
  const gender = targets.includes('F2030') && !targets.includes('M2030') ? 'F' : targets.includes('M2030') && !targets.includes('F2030') ? 'M' : undefined;

  const engine: any = await createMatchRequest({
    brandType: 'ETC',
    goals: goals.length ? goals : ['BRAND_AWARENESS'],
    preferredMethod: 'AI_RECOMMEND',
    preferredAthleteIds: [],
    excludedAthleteIds: input.excludedAthleteIds || [],
    budget: { min: budget.min, max: budget.max },
    options: { includeSns: objectives.includes('SNS'), includeGrowthMarket: (input.activities || []).includes('FAN_STORE'), performanceGuarantee50: false },
    audience: ages.length || gender ? { ages: [...new Set(ages)], gender } : undefined,
    recommendationStyle: objectives.includes('GROWTH') ? 'DISCOVERY' : 'BALANCED',
    portfolioMode: 'AUTO',
  } as any, userId);

  const ranked: any[] = engine.recommendations || [];
  const ids = ranked.map((r) => r.athleteId);
  if (!ids.length) {
    return { requestId: engine.requestId, version: ATHLETE_MATCH_VERSION, engineVersion: RULE_VERSION, dataAsOf: engine.dataAsOf, candidateCount: 0, athletes: [], relax: relaxHints(input), brief: briefOf(input, budget) };
  }

  const [{ athletes: cards }, profiles] = await Promise.all([
    listPickAthletes({ ids, limit: 120 }),
    prisma.athlete.findMany({ where: { id: { in: ids } }, select: { id: true, region: true, activityFields: true, snsStats: true } }),
  ]);
  const cardBy = new Map(cards.map((c: any) => [c.id, c]));
  const profBy = new Map(profiles.map((p) => [p.id, p]));

  const regions = (input.regions || []).filter((r) => r !== '전국');
  const activities = input.activities || [];

  const passes = (r: any) => {
    const p = profBy.get(r.athleteId);
    const card = cardBy.get(r.athleteId);
    if (!card) return false;
    if (regions.length) {
      const region = String(p?.region || '');
      if (!regions.some((rg) => (REGION_ALIAS[rg] || [rg]).some((alias) => region.includes(alias)))) return false;
    }
    const fields = (p?.activityFields as any) || {};
    for (const act of activities) {
      if (act === 'OFFLINE' && card.slotOpen === 0) return false;
      if (act === 'FAN_STORE' && !card.modes?.includes('성장마켓')) return false;
      const keys = ACTIVITY_FIELD[act];
      if (keys && !keys.some((k) => fields[k])) return false;
    }
    return true;
  };

  const picked = ranked.filter(passes).slice(0, 4);
  const athletes = picked.map((r) => {
    const card = cardBy.get(r.athleteId) as any;
    const p = profBy.get(r.athleteId);
    const fields = (p?.activityFields as any) || {};
    const tags: string[] = [];
    if ((r.metrics?.followers || 0) >= 3000) tags.push('#SNS활발');
    if (fields.lesson) tags.push('#레슨');
    if (fields.proAm) tags.push('#프로암');
    if (card.isRecommended) tags.push('#추천선수');
    if (r.isDiscovery) tags.push('#성장가능성');
    if (card.slotOpen > 0) tags.push('#후원가능');
    const reasons: { code: string; text: string }[] = (r.reasons || []).slice(0, 2).map((x: any) => ({ code: x.code, text: x.text }));
    if (regions.length && p?.region) reasons.push({ code: 'REGION_MATCH', text: `${p.region} 활동 선수로 지역 연계에 적합합니다.` });
    return {
      ...card,
      fitScore: r.finalScore ?? r.matchScore ?? null,
      confidence: r.confidence,
      isDiscovery: !!r.isDiscovery,
      reasons: reasons.slice(0, 2),
      evidence: (r.evidence || []).slice(0, 4),
      tags: tags.slice(0, 3),
      badge: card.isRecommended ? 'RECOMMENDED' : r.isDiscovery ? 'GROWTH' : (r.metrics?.followers || 0) >= 5000 ? 'POPULAR' : card.dataStatus === 'NEW' ? 'NEW' : null,
    };
  });

  return {
    requestId: engine.requestId,
    version: ATHLETE_MATCH_VERSION,
    engineVersion: RULE_VERSION,
    dataAsOf: engine.dataAsOf,
    candidateCount: engine.candidateCount,
    athletes,
    partial: athletes.length > 0 && athletes.length < 4,
    relax: athletes.length < 4 ? relaxHints(input) : [],
    brief: briefOf(input, budget),
    sourceStatus: engine.sourceStatus,
  };
}

function briefOf(input: AthleteMatchInput, budget: { label: string }) {
  return {
    objectives: (input.objectives || []).map((o) => OBJ_LABEL[o] || o),
    targets: (input.targets || []).map((t) => TARGET_LABEL[t] || t),
    budgetLabel: budget.label,
    sports: input.sports || [],
    activities: input.activities || [],
    regions: input.regions || [],
  };
}

/** 후보 부족 시 조건 완화 제안 — 가짜 4명 채우기 금지 (§5.2) */
function relaxHints(input: AthleteMatchInput) {
  const hints: { key: string; label: string }[] = [];
  if ((input.regions || []).some((r) => r !== '전국')) hints.push({ key: 'REGION', label: '지역을 전국으로 넓히기' });
  if (input.budgetBand && input.budgetBand !== 'OVER_100') hints.push({ key: 'BUDGET', label: '예산 범위를 한 단계 올리기' });
  if ((input.activities || []).length) hints.push({ key: 'ACTIVITY', label: '활동 유형 조건 줄이기' });
  if ((input.targets || []).length) hints.push({ key: 'TARGET', label: '타깃 조건 줄이기' });
  return hints;
}

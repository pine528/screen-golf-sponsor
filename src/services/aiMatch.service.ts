/**
 * SPONPIK Sponsorship Intelligence Engine (SIE) — 코어 (핸드오프 v2.0)
 *
 * AI 간편 매칭의 추천을 담당하는 인텔리전스 레이어.
 *  - 파이프라인(§11): Fast Retrieve(내부 스냅샷 + Hard Filter) → Feature Build
 *    (cohort percentile 정규화 + time-decay §6.1) → 역할별 서브 점수(§5)
 *    → Brand Brief 목적별 재가중(§7.1) → 역할 분류(§5.1) → 패키지 최적화(§12)
 *    → Evidence 연결 설명(§13) → 리스크/대안.
 *  - LLM은 순위를 정하지 않는다. 모든 점수는 정형 Feature 기반 재현 가능 계산(AC-07).
 *  - 모든 핵심 reason은 evidence(내부 실측 지표)에 연결된다(AC-04).
 *  - 외부 소스(뉴스/YouTube/Instagram)는 커넥터 미설정 상태를 정직하게 표기하고
 *    (AC-06·AC-08), 비공개 지표를 추정값처럼 표시하지 않는다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const RULE_VERSION = 'deep-match-v3.1-2026-08-12';

/* ── 입력 (Brand Brief, §7 · 심층매칭 v3 §2) ── */
export interface AiMatchInput {
  brandType: string; // BEAUTY | FOOD | FASHION | HEALTH | LOCAL | ETC
  goals: string[]; // BRAND_AWARENESS | SNS_CONTENT | FAN_STORE | LONG_TERM | EVENT_TEST
  preferredMethod: string; // AUCTION | DIRECT | MONTHLY | YEARLY | AI_RECOMMEND
  preferredAthleteIds: string[];
  budget: { min: number; max: number };
  options: { includeSns: boolean; includeGrowthMarket: boolean; performanceGuarantee50: boolean };
  /* ── v3 심층 입력 (전부 선택 — v1 요청과 하위호환) ── */
  companyName?: string;
  brandName?: string;
  brandDescription?: string;
  /** INSTAGRAM | YOUTUBE | HOMESHOPPING | D2C | OFFLINE | PR */
  currentChannels?: string[];
  audience?: { ages?: string[]; gender?: string };
  /** SEARCH | SITE_VISIT | NEW_CUSTOMER | PURCHASE | SNS_ENGAGE | STORE_VISIT */
  desiredActions?: string[];
  /** BEST(최적) | BALANCED(균형) | DISCOVERY(새 선수 발견) — §5.3 */
  recommendationStyle?: 'BEST' | 'BALANCED' | 'DISCOVERY';
  excludedAthleteIds?: string[];
  /** 선수 구성 — AUTO(AI 판단) | SINGLE(1명 집중) | MULTI(2~3명 조합) — §12.3 */
  portfolioMode?: 'AUTO' | 'SINGLE' | 'MULTI';
  /** 사용자가 승인한 Brand Profile snapshot (§9.1) */
  brandProfile?: any;
}

/** 추천 스타일 → 다양성 계수 λ (§5.3) */
const DIVERSITY_LAMBDA: Record<string, number> = { BEST: 0.15, BALANCED: 0.35, DISCOVERY: 0.55 };

/** 성장마켓 팬스토어 운영 선수 (프론트 큐레이션과 동기화 — data/growthMarket.ts) */
const GROWTH_MARKET_ATHLETES: Record<string, { brands: string[] }> = {
  염돈웅: { brands: ['OREX', 'the GUYS'] },
  배진리: { brands: ['호이베이커리'] },
};

/** 슬롯 가시성 등급 (§5 Patch Fit — 방송 화면에 잘 잡히는 순) */
const SLOT_VISIBILITY: Record<string, number> = {
  CAP_FRONT: 1.0, CHEST_L: 0.9, CHEST_R: 0.9, CAP_SIDE_L: 0.75, CAP_SIDE_R: 0.75,
  CAP_BACK: 0.7, CAP_BRIM_TOP: 0.65, SLEEVE_L: 0.6, SLEEVE_R: 0.6, COLLAR_L: 0.55,
  COLLAR_R: 0.55, SHOULDER_LINE_L: 0.5, SHOULDER_LINE_R: 0.5, BACK_SHOULDER_L: 0.45,
  BACK_SHOULDER_R: 0.45, PANTS_HIP_SIDE_FACING: 0.35, PANTS_THIGH_SIDE_FACING: 0.35,
};
const slotVisibility = (code: string) => SLOT_VISIBILITY[code] ?? 0.3;

/**
 * 목적별 채널 가중치 매트릭스 (§7.1) — 합계 100.
 * 순서: patch, sns, pr, commerce, fan, longTerm
 */
const GOAL_WEIGHTS: Record<string, { patch: number; sns: number; pr: number; commerce: number; fan: number; longTerm: number }> = {
  BRAND_AWARENESS: { patch: 35, sns: 20, pr: 20, commerce: 5, fan: 10, longTerm: 10 },
  SNS_CONTENT: { patch: 10, sns: 45, pr: 15, commerce: 5, fan: 15, longTerm: 10 },
  FAN_STORE: { patch: 10, sns: 25, pr: 5, commerce: 35, fan: 20, longTerm: 5 },
  LONG_TERM: { patch: 20, sns: 20, pr: 10, commerce: 10, fan: 10, longTerm: 30 },
  EVENT_TEST: { patch: 40, sns: 15, pr: 10, commerce: 5, fan: 10, longTerm: 20 },
};

export function parseFollowers(snsStats: any): number | null {
  const raw = snsStats?.instagramFollowers;
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/,/g, '').trim();
  const man = s.match(/^([\d.]+)\s*만/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/* ── Feature / Evidence 타입 ── */

interface Evidence {
  evidenceId: string;
  sourceType: 'INTERNAL';
  sourceGrade: 'S';
  metric: string;
  label: string;
  value: string;
  dataAsOf: string;
}

interface CandidateRaw {
  athlete: any;
  slots: { code: string; name: string; price: number; grade: string | null; saleMode: string; saleModeLabel: string }[];
  minSlotPrice: number;
  followers: number | null;
  recentResultDays: number | null;
  resultCount12m: number;
  resultCount90d: number;
  favoriteCount: number;
  mediaExposureCount: number;
  newsCount: number;
  contractCount: number;
  hasAuction: boolean;
  hasDirect: boolean;
  growthMarket: { brands: string[] } | null;
  snsActive: boolean;
  maxSlotVisibility: number;
}

/** cohort 내 percentile (0~1). null 값은 계산에서 제외 (§6.1 — 결측은 0 처리 금지) */
function percentile(values: (number | null)[], v: number | null): number | null {
  if (v === null) return null;
  const pool = values.filter((x): x is number => x !== null);
  if (pool.length <= 1) return 0.5;
  const below = pool.filter((x) => x < v).length;
  return below / (pool.length - 1);
}

/** 최근성 time-decay (§6.1): 30일 이내 1.0 → 90일 0.7 → 365일 0.35 → 이후 0.1 */
function recencyDecay(days: number | null): number | null {
  if (days === null) return null;
  if (days <= 30) return 1.0;
  if (days <= 90) return 0.7;
  if (days <= 365) return 0.35;
  return 0.1;
}

/* ── 후보 수집 + Hard Filter (§11 Phase A) ── */

async function buildCandidates(input: AiMatchInput): Promise<{ candidates: CandidateRaw[]; excluded: { athleteId: string; name: string; reason: string }[]; cheapestSlotPrice: number | null }> {
  const now = new Date();
  const athletes = await prisma.athlete.findMany({
    where: { isActive: true, kycStatus: 'APPROVED' },
    include: {
      athleteSlots: {
        where: { saleEnabled: true },
        include: {
          slotTemplate: true,
          /* 직접 PICK(getOffers)과 같은 판정 — 판매 중 슬롯은 "막는 재고(판매완료·경매·승인대기·임시예약)나
             활성 hold가 없는 것"이다. 예전처럼 AVAILABLE 재고 행을 요구하면 대회 재고 기간이 끝난 뒤
             전 선수가 후보에서 빠져 추천이 항상 비거나(0명) 세션에 남은 옛 결과만 보이게 된다 (2026-09-15). */
          inventories: {
            where: { endDate: { gte: now }, status: { in: ['SOLD', 'AUCTION_ACTIVE', 'PENDING_APPROVAL', 'HELD'] } },
            take: 1,
          },
          holds: { where: { releasedAt: null, expiresAt: { gt: now } }, take: 1 },
        },
      },
      eventResults: { where: { status: 'APPROVED' }, orderBy: { eventDate: 'desc' }, take: 20 },
      slotInstances: { where: { status: 'OPEN' }, select: { slotTemplateId: true, saleMode: true, enableAuction: true, enableDirectBuy: true } },
      _count: { select: { favoritedBy: true, mediaExposures: true, newsArticles: true, contracts: true } },
    },
  });

  const candidates: CandidateRaw[] = [];
  const excluded: { athleteId: string; name: string; reason: string }[] = [];
  let cheapestSlotPrice: number | null = null; // 예산과 무관하게 판매 중인 최저가 — 후보 0명일 때 안내용
  const preferredSet = new Set(input.preferredAthleteIds || []);

  for (const a of athletes) {
    // 슬롯별 실제 판매방식 — 선수 단위가 아니라 '그 슬롯'의 OPEN 인스턴스 기준 (2026-08-12 오표기 수정)
    const instBySlotTemplate = new Map(a.slotInstances.map((si) => [si.slotTemplateId, si]));
    const slots = a.athleteSlots
      .filter((s) => s.inventories.length === 0 && s.holds.length === 0 && !s.restrictionNote && s.basePrice > 0)
      .map((s) => {
        const inst = instBySlotTemplate.get(s.slotTemplateId);
        const saleMode = inst?.saleMode === 'AUCTION' || (inst?.enableAuction && !inst?.enableDirectBuy) ? 'AUCTION'
          : inst && !inst.enableAuction && !inst.enableDirectBuy ? 'INQUIRY'
          : 'DIRECT';
        return {
          code: s.slotTemplate.code,
          name: s.customName || s.slotTemplate.name,
          price: s.basePrice,
          grade: s.baseGrade,
          saleMode,
          saleModeLabel: saleMode === 'AUCTION' ? '라이브 경매' : saleMode === 'INQUIRY' ? '협의' : '직접 구매',
        };
      })
      .sort((x, y) => slotVisibility(y.code) - slotVisibility(x.code));

    const reject = (reason: string) => {
      if (preferredSet.has(a.id)) excluded.push({ athleteId: a.id, name: a.name, reason });
    };

    if (slots.length === 0) { reject('현재 판매 가능한 슬롯이 없습니다'); continue; }

    const followers = parseFollowers(a.snsStats);
    const fields = (a.activityFields as any) || {};
    const snsActive = !!(fields.sns || fields.youtube || followers);
    if (input.options.includeSns && !snsActive) { reject('SNS 활동 정보가 확인되지 않습니다'); continue; }

    // 예산 판정은 마지막에 — 그래야 cheapestSlotPrice가 "조건을 만족하는 선수 기준 최저가"가 된다
    const minSlotPrice = Math.min(...slots.map((s) => s.price));
    cheapestSlotPrice = cheapestSlotPrice === null ? minSlotPrice : Math.min(cheapestSlotPrice, minSlotPrice);
    if (minSlotPrice > input.budget.max) { reject('가장 저렴한 슬롯이 예산 상한을 초과합니다'); continue; } // AC-09

    const hasAuction = a.slotInstances.some((si) => si.enableAuction || si.saleMode === 'AUCTION');
    const hasDirect = a.slotInstances.some((si) => si.saleMode !== 'AUCTION') || slots.length > 0;
    if (input.preferredMethod === 'AUCTION' && !hasAuction) { reject('진행 중인 라이브 경매 슬롯이 없습니다'); continue; }

    const latest = a.eventResults[0];
    const recentResultDays = latest ? Math.floor((now.getTime() - new Date(latest.eventDate).getTime()) / 86400000) : null;
    const yearAgo = new Date(now.getTime() - 365 * 86400000);
    const days90 = new Date(now.getTime() - 90 * 86400000);

    candidates.push({
      athlete: a,
      slots,
      minSlotPrice,
      followers,
      recentResultDays,
      resultCount12m: a.eventResults.filter((r) => new Date(r.eventDate) >= yearAgo).length,
      resultCount90d: a.eventResults.filter((r) => new Date(r.eventDate) >= days90).length,
      favoriteCount: a._count.favoritedBy,
      mediaExposureCount: a._count.mediaExposures,
      newsCount: a._count.newsArticles,
      contractCount: a._count.contracts,
      hasAuction,
      hasDirect,
      growthMarket: GROWTH_MARKET_ATHLETES[a.name] || null,
      snsActive,
      maxSlotVisibility: Math.max(...slots.map((s) => slotVisibility(s.code))),
    });
  }

  return { candidates, excluded, cheapestSlotPrice };
}

/* ── 역할별 서브 점수 (§5, §6.2) — cohort percentile 기반 0~100 ── */

interface SubScores {
  patch: number;
  sns: number;
  pr: number;
  commerce: number;
  fan: number;
  longTerm: number;
  hybrid: number;
}

function buildSubScores(c: CandidateRaw, cohort: CandidateRaw[], input: AiMatchInput): { scores: SubScores; features: Record<string, number | null> } {
  const p = {
    followers: percentile(cohort.map((x) => x.followers), c.followers),
    favorites: percentile(cohort.map((x) => x.favoriteCount), c.favoriteCount),
    results90: percentile(cohort.map((x) => x.resultCount90d), c.resultCount90d),
    media: percentile(cohort.map((x) => x.mediaExposureCount), c.mediaExposureCount || null),
    news: percentile(cohort.map((x) => x.newsCount), c.newsCount || null),
    slotCount: percentile(cohort.map((x) => x.slots.length), c.slots.length),
    contracts: percentile(cohort.map((x) => x.contractCount), c.contractCount || null),
  };
  const recency = recencyDecay(c.recentResultDays);
  const budgetMid = (input.budget.min + input.budget.max) / 2;
  const costEff = c.minSlotPrice <= budgetMid ? 1 - c.minSlotPrice / Math.max(budgetMid, 1) * 0.5 : Math.max(0, 1 - c.minSlotPrice / Math.max(input.budget.max, 1));

  const v = (x: number | null, fallback = 0.35) => (x === null ? fallback : x); // 결측은 중립 이하 + confidence에서 감점

  // PatchFit (§6.2 응용): 대회 가용성·방송 노출 이력·슬롯 가시성·비용 효율
  const patch = 100 * (
    0.25 * v(recency, 0.2)
    + 0.20 * v(p.results90)
    + 0.15 * v(p.media, 0.3)
    + 0.20 * c.maxSlotVisibility
    + 0.20 * costEff
  );

  // SNSFit: 팔로워 percentile·SNS 활동·팬 반응
  const sns = 100 * (
    0.40 * v(p.followers, 0.2)
    + 0.25 * (c.snsActive ? 0.9 : 0.1)
    + 0.20 * v(p.favorites)
    + 0.15 * v(recency, 0.3)
  );

  // PRFit: 기사·미디어 노출·최근 성과 서사
  const pr = 100 * (
    0.35 * v(p.news, 0.25)
    + 0.30 * v(p.media, 0.25)
    + 0.35 * v(recency, 0.25)
  );

  // CommerceFit: 팬스토어 운영·팬지수
  const commerce = 100 * (
    0.50 * (c.growthMarket ? 1 : 0.1)
    + 0.30 * v(p.favorites)
    + 0.20 * v(p.followers, 0.2)
  );

  // FanFit: 관심 등록·팬 반응
  const fan = 100 * (0.6 * v(p.favorites) + 0.4 * v(p.followers, 0.25));

  // LongTermFit: 슬롯 안정성·계약 이력·활동 지속성
  const longTerm = 100 * (
    0.35 * v(p.slotCount)
    + 0.25 * v(p.contracts, 0.3)
    + 0.25 * v(p.results90)
    + 0.15 * (c.snsActive ? 0.8 : 0.3)
  );

  // HybridFit (§6.2): 0.45 Patch + 0.45 SNS + 0.10 시너지
  const synergy = c.maxSlotVisibility >= 0.9 && c.snsActive ? 1 : 0.4;
  const hybrid = 0.45 * patch + 0.45 * sns + 10 * synergy;

  return {
    scores: {
      patch: Math.round(patch), sns: Math.round(sns), pr: Math.round(pr),
      commerce: Math.round(commerce), fan: Math.round(fan), longTerm: Math.round(longTerm),
      hybrid: Math.round(hybrid),
    },
    features: { ...p, recency, costEff },
  };
}

/** 역할 분류 (§5.1) — 서브 점수와 논리적으로 일치해야 함 (AC-10) */
function classifyRole(s: SubScores, input: AiMatchInput, c: CandidateRaw): { roleType: string; roleLabel: string } {
  if (input.goals.includes('FAN_STORE') && c.growthMarket && s.commerce >= 60) {
    return { roleType: 'COMMERCE_FIRST', roleLabel: '커머스 특화' };
  }
  const ranked = [
    { k: 'PATCH_FIRST', v: s.patch, label: '패치 특화' },
    { k: 'SOCIAL_FIRST', v: s.sns, label: 'SNS 특화' },
    { k: 'PR_FIRST', v: s.pr, label: 'PR 특화' },
  ].sort((a, b) => b.v - a.v);
  // 패치·SNS 모두 상위이고 격차가 작으면 혼합 (§5.1 HYBRID)
  if (s.patch >= 55 && s.sns >= 55 && Math.abs(s.patch - s.sns) <= 15) {
    return { roleType: 'HYBRID', roleLabel: '혼합 추천' };
  }
  return { roleType: ranked[0].k, roleLabel: ranked[0].label };
}

/** Confidence (§6.3): coverage × freshness × trust(내부 S등급=1) */
function calcConfidence(c: CandidateRaw): { value: number; level: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const signals = [c.followers !== null, c.recentResultDays !== null, c.slots.length >= 2, c.favoriteCount > 0, c.mediaExposureCount > 0 || c.newsCount > 0];
  const coverage = signals.filter(Boolean).length / signals.length;
  const freshness = c.recentResultDays === null ? 0.6 : c.recentResultDays <= 30 ? 1 : c.recentResultDays <= 90 ? 0.9 : 0.75;
  const value = Math.round(coverage * freshness * 100) / 100;
  return { value, level: value >= 0.8 ? 'HIGH' : value >= 0.6 ? 'MEDIUM' : 'LOW' };
}

/* ── Evidence + Reason (§9, §13, AC-04) ── */

function buildEvidence(c: CandidateRaw, dataAsOf: string): Evidence[] {
  const ev: Evidence[] = [];
  const push = (metric: string, label: string, value: string) =>
    ev.push({ evidenceId: `ev-${c.athlete.id.slice(0, 8)}-${metric}`, sourceType: 'INTERNAL', sourceGrade: 'S', metric, label, value, dataAsOf });

  push('available_slots', '판매 가능 슬롯', `${c.slots.length}개 (대표 ${c.slots[0]?.name}, 최저 ${c.minSlotPrice.toLocaleString()}원)`);
  if (c.followers !== null) push('instagram_followers', '인스타그램 팔로워', `${c.followers.toLocaleString()}명`);
  if (c.favoriteCount > 0) push('fan_favorites', '팬 관심 등록', `${c.favoriteCount}명`);
  if (c.recentResultDays !== null) push('recent_result', '최근 대회 성적', `${c.recentResultDays}일 전 (최근 12개월 ${c.resultCount12m}건)`);
  if (c.mediaExposureCount > 0) push('media_exposure', '미디어 노출 기록', `${c.mediaExposureCount}건`);
  if (c.newsCount > 0) push('news_articles', '뉴스 기사', `${c.newsCount}건`);
  if (c.growthMarket) push('growth_market', '성장마켓 팬스토어', c.growthMarket.brands.join(' · '));
  if (c.contractCount > 0) push('contracts', '후원 계약 이력', `${c.contractCount}건`);
  return ev;
}

function buildReasons(c: CandidateRaw, s: SubScores, role: string, evidence: Evidence[], input: AiMatchInput) {
  const find = (metric: string) => evidence.find((e) => e.metric === metric);
  const reasons: { code: string; text: string; evidenceIds: string[] }[] = [];
  const add = (code: string, text: string, metrics: string[]) => {
    const ids = metrics.map((m) => find(m)?.evidenceId).filter(Boolean) as string[];
    if (ids.length > 0) reasons.push({ code, text, evidenceIds: ids }); // 근거 없는 claim 금지 (§8.1)
  };

  if (role === 'PATCH_FIRST' || role === 'HYBRID') {
    add('PATCH_FIT', `가시성 높은 슬롯(${c.slots[0]?.name})이 판매 가능해 대회·방송 노출에 유리합니다 (패치 적합 ${s.patch}점).`, ['available_slots']);
  }
  if (c.followers && c.followers >= 3000) {
    add('SNS_STRENGTH', `인스타그램 팔로워 ${c.followers.toLocaleString()}명 — 후보군 내 상위 SNS 확산력입니다 (SNS 적합 ${s.sns}점).`, ['instagram_followers']);
  }
  if (c.recentResultDays !== null && c.recentResultDays <= 60) {
    add('RECENT_ACTIVITY', `${c.recentResultDays}일 전 대회 성적이 등록된 현역 활동 선수로 노출 시의성이 좋습니다.`, ['recent_result']);
  }
  if (c.growthMarket && (input.goals.includes('FAN_STORE') || input.options.includeGrowthMarket)) {
    add('FAN_COMMERCE_FIT', `팬스토어(${c.growthMarket.brands.join('·')})를 운영 중이라 판매·커머스 연계가 즉시 가능합니다 (커머스 적합 ${s.commerce}점).`, ['growth_market']);
  }
  if (c.favoriteCount > 0 && reasons.length < 3) {
    add('FAN_RESPONSE', `SPONPIK 팬 관심 등록 ${c.favoriteCount}명 — 자체 팬 반응이 확인된 선수입니다.`, ['fan_favorites']);
  }
  if (c.minSlotPrice <= (input.budget.min + input.budget.max) / 2 && reasons.length < 3) {
    add('BUDGET_FIT', `예산 중앙값 안에서 대표 슬롯(${c.minSlotPrice.toLocaleString()}원)과 추가 구성을 함께 담을 수 있습니다.`, ['available_slots']);
  }
  if (['MONTHLY', 'YEARLY'].includes(input.preferredMethod) && c.slots.length >= 3 && reasons.length < 3) {
    add('LONG_TERM_FIT', `가용 슬롯 ${c.slots.length}개로 월간 이상 계약 시 반복 노출 구성이 안정적입니다 (장기 적합 ${s.longTerm}점).`, ['available_slots']);
  }
  return reasons.slice(0, 4);
}

/** 리스크 (§13 risks[]) */
function buildRisks(c: CandidateRaw, conf: { level: string }): string[] {
  const risks: string[] = [];
  if (c.followers === null) risks.push('SNS 지표 미수집 — 선수 계정 연동 시 신뢰도가 올라갑니다');
  if (c.recentResultDays === null) risks.push('최근 대회 성적 데이터 없음');
  else if (c.recentResultDays > 180) risks.push(`마지막 등록 성적이 ${Math.round(c.recentResultDays / 30)}개월 전입니다`);
  if (c.slots.length === 1) risks.push('가용 슬롯이 1개뿐이라 대체 구성이 제한됩니다');
  if (c.mediaExposureCount === 0 && c.newsCount === 0) risks.push('미디어 노출 실측 데이터 미수집 (수집 예정)');
  if (conf.level === 'LOW') risks.push('데이터 신뢰도 낮음 — 추가 조사 권장');
  return risks;
}

/* ── 패키지 (§12) ── */

function budgetAllocation(goals: string[]) {
  if (goals.includes('FAN_STORE')) return { slot: 0.2, sns: 0.25, growthMarket: 0.45, ops: 0.1 };
  if (goals.includes('SNS_CONTENT')) return { slot: 0.3, sns: 0.5, growthMarket: 0.1, ops: 0.1 };
  if (goals.includes('LONG_TERM')) return { slot: 0.55, sns: 0.2, growthMarket: 0.15, ops: 0.1 };
  return { slot: 0.6, sns: 0.2, growthMarket: 0.1, ops: 0.1 };
}

function buildPackage(c: CandidateRaw, input: AiMatchInput, roleType: string) {
  const alloc = budgetAllocation(input.goals);
  const slotBudget = input.budget.max * alloc.slot;

  // 역할에 따라 슬롯 선택 전략 변경 (§5.1): SOCIAL/COMMERCE_FIRST는 서브 슬롯 위주
  const pool = roleType === 'SOCIAL_FIRST' || roleType === 'COMMERCE_FIRST'
    ? [...c.slots].sort((a, b) => a.price - b.price)
    : c.slots; // 가시성 순 정렬 상태

  const chosen: typeof c.slots = [];
  let slotTotal = 0;
  for (const s of pool) {
    if (chosen.length >= 3) break;
    if (slotTotal + s.price <= Math.max(slotBudget, c.minSlotPrice)) {
      chosen.push(s);
      slotTotal += s.price;
    }
  }
  if (chosen.length === 0) {
    const cheapest = [...c.slots].sort((a, b) => a.price - b.price)[0];
    chosen.push(cheapest);
    slotTotal = cheapest.price;
  }

  // 후원 방식은 선수 단위가 아니라 '실제로 담긴 슬롯'의 판매방식 기준으로 표기한다
  // (2026-08-12 수정 — 직접 구매 슬롯 패키지가 '라이브 경매'로 오표기되던 문제)
  const modes = new Set(chosen.map((s) => s.saleMode));
  const method =
    input.preferredMethod === 'AI_RECOMMEND'
      ? (modes.has('AUCTION') && modes.size === 1 ? 'AUCTION' : 'DIRECT')
      : input.preferredMethod;
  const methodLabel =
    ['MONTHLY', 'YEARLY'].includes(method) ? (method === 'YEARLY' ? '연간 계약' : '월간 계약')
      : modes.size > 1 ? '직접 구매 + 라이브 경매'
        : chosen[0]?.saleModeLabel || (method === 'AUCTION' ? '라이브 경매' : '직접 구매');
  const snsCount = roleType === 'SOCIAL_FIRST' || roleType === 'HYBRID' ? { feedPosts: 2, storyPosts: 2 } : { feedPosts: 1, storyPosts: 1 };
  const sns = input.options.includeSns && c.snsActive ? snsCount : null;
  const growthMarket = input.options.includeGrowthMarket && c.growthMarket ? { brands: c.growthMarket.brands } : null;

  return {
    method,
    methodLabel,
    duration: ['MONTHLY', 'YEARLY'].includes(method) ? (method === 'YEARLY' ? '연간' : '월간') : '대회 1회',
    slots: chosen,
    slotTotal,
    sns,
    growthMarket,
    guarantee50: input.options.performanceGuarantee50 ? { eligible: false, note: '성과보장 50 적용 상품은 상담을 통해 확정됩니다' } : null,
    allocation: alloc,
    priceConfirmed: slotTotal,
    priceNote: sns || growthMarket ? '슬롯 확정가 기준이며 SNS·성장마켓 구성은 상담 시 확정됩니다' : null,
  };
}

/* ── 소스 상태 (§15.2 부분 실패 명시, AC-08) ── */

function sourceStatus() {
  return {
    sponpikCore: 'OK', // 프로필·슬롯·가격·계약
    sponpikFan: 'OK', // 관심 등록
    sponpikPerformance: 'OK', // 대회 성적·미디어 노출 기록
    newsSearch: 'NOT_CONFIGURED', // 네이버 뉴스 API 키 설정 시 활성화 (P1)
    youtubePublic: 'NOT_CONFIGURED', // YouTube Data API 키 설정 시 활성화 (P1)
    instagramConnected: 'NOT_CONNECTED', // 선수 계정 OAuth 연동 시 활성화 (P4)
  };
}

/* ── 브랜드 컨텍스트 (§7 Brand Brief · §10 brand_preference_profile 1단계) ── */

/** 브랜드 업종 문자열 → 매칭 brandType 매핑 */
function mapBrandType(category?: string | null): string {
  const c = (category || '').toLowerCase();
  if (/화장|뷰티|코스메/.test(c)) return 'BEAUTY';
  if (/식품|음료|외식|푸드|베이커리|커피|f&b/.test(c)) return 'FOOD';
  if (/패션|의류|어패럴|웨어/.test(c)) return 'FASHION';
  if (/건강|헬스|제약|영양|피트니스|건기식/.test(c)) return 'HEALTH';
  return 'ETC';
}

/** 가입 브랜드의 업종·최근 요청·협업 이력 — 입력 프리필과 개인화에 사용 */
export async function getBrandContext(userId: string) {
  const brand = await prisma.brand.findUnique({
    where: { userId },
    select: { id: true, name: true, category: true, website: true, description: true, matchProfile: true },
  });
  if (!brand) return null;
  const [lastReq, contracts, prefRows] = await Promise.all([
    prisma.aiMatchRequest.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { input: true, createdAt: true } }),
    prisma.contract.findMany({ where: { brandId: brand.id }, select: { athleteId: true }, take: 50 }),
    prisma.brandAthletePreference.findMany({ where: { userId }, select: { athleteId: true, preference: true } }),
  ]);
  return {
    brandName: brand.name,
    category: brand.category,
    website: brand.website,
    registeredDescription: brand.description,
    suggestedBrandType: mapBrandType(brand.category),
    /** v3 §13 — 저장된 승인 Brand Profile (재방문 시 불러오기) */
    savedProfile: brand.matchProfile || null,
    lastInput: lastReq?.input || null,
    lastRequestAt: lastReq?.createdAt || null,
    collaboratedAthleteCount: new Set(contracts.map((c) => c.athleteId)).size,
    excludedAthleteIds: prefRows.filter((p) => p.preference === 'EXCLUDE').map((p) => p.athleteId),
    preferredAthleteIds: prefRows.filter((p) => p.preference === 'PREFER').map((p) => p.athleteId),
  };
}

/** 승인된 Brand Profile 저장 (§11-9 · AC-02: 승인값만 매칭 Feature) */
export async function saveBrandProfile(userId: string, profile: any) {
  const brand = await prisma.brand.findUnique({ where: { userId }, select: { id: true } });
  if (!brand) return null;
  const snapshot = { ...profile, approved: true, dataAsOf: new Date().toISOString() };
  await prisma.brand.update({ where: { id: brand.id }, data: { matchProfile: snapshot } });
  return snapshot;
}

/** 선수 선호/제외 피드백 (§8) — 다음 요청부터 즉시 반영 (AC-06) */
export async function setAthletePreference(userId: string, athleteId: string, preference: 'PREFER' | 'EXCLUDE' | 'CLEAR', reason?: string) {
  if (preference === 'CLEAR') {
    await prisma.brandAthletePreference.deleteMany({ where: { userId, athleteId } });
    return { athleteId, preference: 'CLEAR' };
  }
  await prisma.brandAthletePreference.upsert({
    where: { userId_athleteId: { userId, athleteId } },
    update: { preference, reason: reason || null },
    create: { userId, athleteId, preference, reason: reason || null },
  });
  return { athleteId, preference };
}

async function preferencesOf(userId?: string): Promise<{ prefer: Set<string>; exclude: Set<string> }> {
  if (!userId) return { prefer: new Set(), exclude: new Set() };
  const rows = await prisma.brandAthletePreference.findMany({ where: { userId } });
  return {
    prefer: new Set(rows.filter((r) => r.preference === 'PREFER').map((r) => r.athleteId)),
    exclude: new Set(rows.filter((r) => r.preference === 'EXCLUDE').map((r) => r.athleteId)),
  };
}

/** 최근 요청 노출 이력 (§5.2 repeat_exposure) — 최근 5개 요청의 상위 8명 노출 횟수 */
async function exposureHistoryOf(userId?: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!userId) return map;
  const recent = await prisma.aiMatchRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { results: true },
  });
  for (const r of recent) {
    const recs: any[] = (r.results as any)?.recommendations || [];
    for (const rec of recs.slice(0, 8)) map.set(rec.athleteId, (map.get(rec.athleteId) || 0) + 1);
  }
  return map;
}

/** 브랜드의 기존 협업(계약) 선수 집합 — 재협업 가점용 */
async function priorAthletesOf(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const brand = await prisma.brand.findUnique({ where: { userId }, select: { id: true } });
  if (!brand) return new Set();
  const contracts = await prisma.contract.findMany({ where: { brandId: brand.id }, select: { athleteId: true }, take: 100 });
  return new Set(contracts.map((c) => c.athleteId));
}

/* ── 공개 API ── */

export async function previewMatch(input: AiMatchInput) {
  const { candidates, excluded } = await buildCandidates(input);
  return { candidateCount: candidates.length, excludedPreferred: excluded };
}

export async function createMatchRequest(input: AiMatchInput, userId?: string) {
  const [{ candidates: allCandidates, excluded, cheapestSlotPrice }, priorAthletes, brandCtx, prefs, exposure] = await Promise.all([
    buildCandidates(input),
    priorAthletesOf(userId),
    userId ? getBrandContext(userId) : Promise.resolve(null),
    preferencesOf(userId),
    exposureHistoryOf(userId),
  ]);
  const dataAsOf = new Date().toISOString();

  // v3 §8 — 브랜드가 제외한 선수는 hard exclude (AC-06)
  const excludeSet = new Set([...(input.excludedAthleteIds || []), ...prefs.exclude]);
  const candidates = allCandidates.filter((c) => !excludeSet.has(c.athlete.id));

  // 목적별 가중치 합성 (복수 목적은 평균)
  const goalKeys = input.goals.filter((g) => GOAL_WEIGHTS[g]);
  const w = goalKeys.reduce(
    (acc, g) => {
      const gw = GOAL_WEIGHTS[g];
      for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += gw[k] / goalKeys.length;
      return acc;
    },
    { patch: 0, sns: 0, pr: 0, commerce: 0, fan: 0, longTerm: 0 },
  );

  // v3 §4 — 원하는 행동(KPI)·현재 채널 gap으로 가중치 보정 후 100으로 재정규화
  const actions = new Set(input.desiredActions || []);
  if (actions.has('PURCHASE')) { w.commerce += 8; w.fan += 2; }
  if (actions.has('SNS_ENGAGE')) { w.sns += 8; }
  if (actions.has('SEARCH') || actions.has('SITE_VISIT') || actions.has('NEW_CUSTOMER')) { w.pr += 4; w.patch += 4; }
  if (actions.has('STORE_VISIT')) { w.patch += 3; w.fan += 3; }
  const channels = new Set(input.currentChannels || []);
  if (channels.size > 0) {
    if (!channels.has('INSTAGRAM') && !channels.has('YOUTUBE')) w.sns += 5; // 인물·SNS 콘텐츠 gap 보완 (§4 marketing_gap)
    if (!channels.has('PR')) w.pr += 3;
  }
  const wSum = w.patch + w.sns + w.pr + w.commerce + w.fan + w.longTerm;
  for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] = (w[k] / wSum) * 100;

  const scored = candidates.map((c) => {
    const { scores, features } = buildSubScores(c, candidates, input);
    const { roleType, roleLabel } = classifyRole(scores, input, c);
    const conf = calcConfidence(c);
    const evidence = buildEvidence(c, dataAsOf);
    const reasons = buildReasons(c, scores, roleType, evidence, input);
    const pkg = buildPackage(c, input, roleType);
    const risks = buildRisks(c, conf);

    // 최종 점수 = 목적별 가중 합성만 사용.
    // (이전의 'HYBRID면 hybrid 점수로 상향' 보정은 데이터 풍부 선수가 어떤 목적에서든
    //  동일 순위로 고정되는 문제를 만들어 제거 — 2026-08-12. 역할 배지는 유지)
    let matchScore =
      (w.patch * scores.patch + w.sns * scores.sns + w.pr * scores.pr +
        w.commerce * scores.commerce + w.fan * scores.fan + w.longTerm * scores.longTerm) / 100;
    // 선호 방식 가용성 보너스 (0~4) — 방식 선택이 순위에 소폭 반영되도록
    if (input.preferredMethod === 'AUCTION' && c.hasAuction) matchScore += 4;
    else if (input.preferredMethod === 'DIRECT' && c.hasDirect) matchScore += 3;
    else if (['MONTHLY', 'YEARLY'].includes(input.preferredMethod) && c.slots.length >= 3) matchScore += 3;

    // 브랜드 개인화 (§10 1단계) — 이 브랜드와 실제 계약 이력이 있는 선수 가점
    if (priorAthletes.has(c.athlete.id)) {
      matchScore += 4;
      const ev = {
        evidenceId: `ev-${c.athlete.id.slice(0, 8)}-past_collab`,
        sourceType: 'INTERNAL' as const,
        sourceGrade: 'S' as const,
        metric: 'past_collaboration',
        label: '우리 브랜드 협업 이력',
        value: '계약 이력 있음',
        dataAsOf,
      };
      evidence.push(ev);
      reasons.unshift({
        code: 'PAST_COLLABORATION',
        text: `${brandCtx?.brandName || '귀사'}와 실제 협업(계약) 이력이 있는 선수로, 재협업 시 온보딩이 빠릅니다.`,
        evidenceIds: [ev.evidenceId],
      });
    }

    const preferred = (input.preferredAthleteIds || []).includes(c.athlete.id) || prefs.prefer.has(c.athlete.id);
    if (preferred) matchScore += 5; // §3.3 / v3 §8 선호 보너스

    return {
      athleteId: c.athlete.id,
      name: c.athlete.name,
      tour: c.athlete.tour,
      tourQualification: c.athlete.tourQualification,
      profileImageUrl: c.athlete.profileImageUrl,
      isFeatured: c.athlete.isFeatured,
      baseScore: Math.min(100, Math.round(matchScore)),
      matchScore: Math.min(100, Math.round(matchScore)),
      confidence: conf.level,
      confidenceValue: conf.value,
      roleType,
      roleLabel,
      subScores: scores,
      preferred,
      reasons,
      evidence,
      risks,
      features,
      package: pkg,
      metrics: {
        followers: c.followers,
        favoriteCount: c.favoriteCount,
        availableSlots: c.slots.length,
        minSlotPrice: c.minSlotPrice,
        recentResultDays: c.recentResultDays,
        resultCount12m: c.resultCount12m,
        mediaExposureCount: c.mediaExposureCount,
        newsCount: c.newsCount,
        growthMarketBrands: c.growthMarket?.brands || null,
      },
    };
  });

  /* ── v3 §5.2 Diversity Re-ranker: base → penalty/bonus → final (AC-04·AC-10 audit 가능) ── */
  const style = input.recommendationStyle || 'BALANCED';
  const lambda = DIVERSITY_LAMBDA[style] ?? 0.35;
  const lambdaScale = lambda / 0.35; // BALANCED 기준 배율
  const baseSorted = [...scored].sort((a, b) => b.baseScore - a.baseScore);
  const p70 = baseSorted[Math.floor(baseSorted.length * 0.3)]?.baseScore ?? 0; // 상위 30 percentile (AC-05 품질 threshold)

  const reranked = scored
    .map((r) => {
      const exposureCount = exposure.get(r.athleteId) || 0;
      const repeatPenalty = Math.min(12, exposureCount * 4) * lambdaScale;
      const isDiscovery = exposureCount === 0 && r.baseScore >= p70;
      const discoveryBonus = isDiscovery ? 6 * lambdaScale : 0;
      const finalScore = Math.min(100, Math.round(r.baseScore - repeatPenalty + discoveryBonus));
      return {
        ...r,
        matchScore: finalScore,
        finalScore,
        exposureCount,
        isDiscovery,
        penalties: { repeatExposure: Math.round(repeatPenalty * 10) / 10 },
        bonuses: { discovery: Math.round(discoveryBonus * 10) / 10, preference: r.preferred ? 5 : 0 },
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore || a.metrics.minSlotPrice - b.metrics.minSlotPrice);

  /* ── v3 §6 역할별 추천 슬롯 — 같은 선수는 한 역할에만 (AC-03), threshold 미달 시 비움 ── */
  const used = new Set<string>();
  const pickRole = (cond: (r: any) => boolean, sortBy: (r: any) => number) => {
    const pool = reranked.filter((r) => !used.has(r.athleteId) && cond(r));
    if (pool.length === 0) return null;
    const pickd = pool.sort((a, b) => sortBy(b) - sortBy(a))[0];
    used.add(pickd.athleteId);
    return pickd;
  };
  const toSlot = (role: string, label: string, desc: string, r: any, roleScore: number | null) =>
    r
      ? { role, label, desc, athleteId: r.athleteId, name: r.name, profileImageUrl: r.profileImageUrl, tour: r.tour, roleScore, finalScore: r.finalScore, confidence: r.confidence, subScores: r.subScores, reasonSummary: r.reasons?.[0]?.text || null, evidenceCount: (r.evidence || []).length, budget: r.package?.priceConfirmed ?? null, isDiscovery: r.isDiscovery }
      : { role, label, desc, athleteId: null, emptyReason: '기준을 충족하는 후보가 부족합니다' };

  const best = pickRole(() => true, (r) => r.finalScore);
  const patch = pickRole((r) => r.subScores.patch >= 55, (r) => r.subScores.patch);
  const social = pickRole((r) => r.subScores.sns >= 55, (r) => r.subScores.sns);
  const hybrid = pickRole((r) => r.subScores.patch >= 50 && r.subScores.sns >= 50, (r) => r.subScores.hybrid);
  const discovery = pickRole((r) => r.isDiscovery, (r) => r.finalScore);

  const roleSlots = [
    toSlot('BEST_MATCH', 'BEST MATCH', '종합 적합 · 안정형', best, best?.finalScore ?? null),
    toSlot('PATCH_PICK', 'PATCH PICK', '방송·대회 노출 특화', patch, patch?.subScores.patch ?? null),
    toSlot('SOCIAL_PICK', 'SOCIAL PICK', 'SNS 콘텐츠 특화', social, social?.subScores.sns ?? null),
    toSlot('HYBRID_PICK', 'HYBRID PICK', '패치 + SNS 균형', hybrid, hybrid?.subScores.hybrid ?? null),
    toSlot('DISCOVERY_PICK', 'DISCOVERY PICK', '새로운 고적합 후보', discovery, discovery?.finalScore ?? null),
  ];

  /* ── v3 §12.3 멀티 선수 포트폴리오 — 1명 집중 vs 역할 분산 (예산 내) ── */
  const portfolioMode = input.portfolioMode || 'AUTO';
  let portfolio: any = null;
  if (best) {
    const single = {
      athleteId: best.athleteId, name: best.name, profileImageUrl: best.profileImageUrl,
      total: best.package?.priceConfirmed ?? 0,
      slots: (best.package?.slots || []).map((sl: any) => ({ name: sl.name, price: sl.price, saleModeLabel: sl.saleModeLabel })),
    };
    let multi: any = null;
    if (portfolioMode !== 'SINGLE') {
      const members: any[] = [];
      let total = 0;
      const addMember = (r: any, role: string, pickSlot: (ss: any[]) => any) => {
        if (!r?.athleteId || members.some((m) => m.athleteId === r.athleteId)) return;
        const ss = r.package?.slots || [];
        const slot = pickSlot(ss);
        if (!slot) return;
        if (total + slot.price > input.budget.max) return;
        members.push({
          athleteId: r.athleteId, name: r.name, profileImageUrl: r.profileImageUrl, role,
          slot: { name: slot.name, price: slot.price, saleModeLabel: slot.saleModeLabel },
        });
        total += slot.price;
      };
      addMember(patch || best, '패치 노출', (ss) => ss[0]); // 가장 가시성 높은 슬롯
      addMember(social, 'SNS 콘텐츠', (ss) => [...ss].sort((a, b) => a.price - b.price)[0]); // 최저가 슬롯
      addMember(discovery || hybrid, '보조 노출·확장', (ss) => [...ss].sort((a, b) => a.price - b.price)[0]);
      if (members.length >= 2) {
        multi = { members, total, note: '역할별 대표 슬롯 1개 기준 — SNS·성장마켓 구성은 상담 시 확정됩니다' };
      }
    }
    portfolio = { mode: portfolioMode, single, multi };
  }

  // 대안 (§13 alternative_plan): 1안과 다른 역할의 최상위 선수
  const top = reranked.slice(0, 10).map((r, i, arr) => {
    if (i === 0) {
      const alt = arr.find((x) => x.roleType !== r.roleType);
      return { ...r, alternative: alt ? { athleteId: alt.athleteId, name: alt.name, roleLabel: alt.roleLabel, matchScore: alt.matchScore } : null };
    }
    return { ...r, alternative: null };
  });

  const results = {
    ruleVersion: RULE_VERSION,
    scoringVersion: RULE_VERSION,
    dataAsOf,
    candidateCount: candidates.length,
    cheapestSlotPrice,
    goalWeights: w,
    diversityMode: style,
    sourceStatus: sourceStatus(),
    brand: brandCtx ? { name: brandCtx.brandName, category: brandCtx.category } : null,
    brandProfileUsed: input.brandProfile ? true : false,
    roleSlots,
    portfolio,
    recommendations: top,
    excludedPreferred: excluded,
    excludedByBrand: [...excludeSet],
  };

  const req = await prisma.aiMatchRequest.create({
    data: { userId: userId || null, input: input as any, results: results as any, status: top.length === 0 ? 'EMPTY' : 'COMPLETED' },
  });

  return { requestId: req.id, status: req.status, ...results };
}

export async function getMatchRequest(id: string) {
  const req = await prisma.aiMatchRequest.findUnique({ where: { id } });
  if (!req) return null;
  return { requestId: req.id, userId: req.userId, status: req.status, input: req.input, createdAt: req.createdAt, ...(req.results as any) };
}

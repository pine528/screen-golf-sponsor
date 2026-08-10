/**
 * AI 간편 매칭 — 규칙 기반 추천 엔진 (핸드오프 v1.0 §3)
 *
 * LLM이 순위를 정하지 않는다. 정형 데이터 기반 Hard Filter + 가중치 점수가
 * source of truth다 (§3 '중요'). 모든 reason은 DB 실제 값에서만 만들어지고,
 * 지어낸 수치(예상 노출 등)는 넣지 않는다 — 없는 지표는 null(미수집)로 표기 (§10.1).
 *
 * 파이프라인: Hard Filter → Feature Build → Score(100점) → Package → Reason codes.
 * 추천 결과는 요청 레코드에 스냅샷으로 저장되어 재현 가능하다 (§10.1).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const RULE_VERSION = 'mvp-2026-08-10';

/* ── 입력 타입 (핸드오프 §9.2) ── */
export interface AiMatchInput {
  brandType: string; // BEAUTY | FOOD | FASHION | HEALTH | LOCAL | ETC
  goals: string[]; // BRAND_AWARENESS | SNS_CONTENT | FAN_STORE | LONG_TERM | EVENT_TEST
  preferredMethod: string; // AUCTION | DIRECT | MONTHLY | YEARLY | AI_RECOMMEND
  preferredAthleteIds: string[];
  budget: { min: number; max: number };
  options: { includeSns: boolean; includeGrowthMarket: boolean; performanceGuarantee50: boolean };
}

/** 성장마켓 팬스토어 운영 선수 (프론트 큐레이션과 동기화 — data/growthMarket.ts) */
const GROWTH_MARKET_ATHLETES: Record<string, { brands: string[] }> = {
  염돈웅: { brands: ['OREX', 'the GUYS'] },
  배진리: { brands: ['호이베이커리'] },
};

/** 슬롯 가시성 우선순위 — 패키지 구성 시 눈에 잘 띄는 슬롯부터 (§5) */
const SLOT_PRIORITY = [
  'CAP_FRONT', 'CHEST_L', 'CHEST_R', 'CAP_SIDE_L', 'CAP_SIDE_R', 'CAP_BACK', 'CAP_BRIM_TOP',
  'SLEEVE_L', 'SLEEVE_R', 'COLLAR_L', 'COLLAR_R', 'SHOULDER_LINE_L', 'SHOULDER_LINE_R',
  'BACK_SHOULDER_L', 'BACK_SHOULDER_R', 'PANTS_HIP_SIDE_FACING', 'PANTS_THIGH_SIDE_FACING',
];

const slotRank = (code: string) => {
  const i = SLOT_PRIORITY.indexOf(code);
  return i === -1 ? SLOT_PRIORITY.length : i;
};

/** snsStats JSON에서 인스타 팔로워 수를 숫자로 (예: "1.2만", "3,400") — 파싱 실패는 null */
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

interface CandidateFeature {
  athlete: any;
  slots: { code: string; name: string; price: number; grade: string | null }[];
  minSlotPrice: number;
  followers: number | null;
  recentResultDays: number | null; // 최근 성적까지 일수
  resultCount12m: number;
  favoriteCount: number;
  hasAuction: boolean;
  hasDirect: boolean;
  growthMarket: { brands: string[] } | null;
  snsActive: boolean;
}

/** 후보 수집 + Hard Filter (§3.1-1) */
async function buildCandidates(input: AiMatchInput): Promise<{ candidates: CandidateFeature[]; excluded: { athleteId: string; name: string; reason: string }[] }> {
  const now = new Date();
  const athletes = await prisma.athlete.findMany({
    where: { isActive: true, kycStatus: 'APPROVED' },
    include: {
      athleteSlots: {
        where: { saleEnabled: true },
        include: {
          slotTemplate: true,
          inventories: { where: { status: 'AVAILABLE', endDate: { gte: now } }, take: 1 },
        },
      },
      eventResults: {
        where: { status: 'APPROVED' },
        orderBy: { eventDate: 'desc' },
        take: 20,
      },
      slotInstances: { where: { status: 'OPEN' }, select: { saleMode: true, enableAuction: true } },
      _count: { select: { favoritedBy: true } },
    },
  });

  const candidates: CandidateFeature[] = [];
  const excluded: { athleteId: string; name: string; reason: string }[] = [];
  const preferredSet = new Set(input.preferredAthleteIds || []);

  for (const a of athletes) {
    // 판매 가능 재고가 있는 슬롯만
    const slots = a.athleteSlots
      .filter((s) => s.inventories.length > 0)
      .map((s) => ({
        code: s.slotTemplate.code,
        name: s.customName || s.slotTemplate.name,
        price: s.basePrice,
        grade: s.baseGrade,
      }))
      .sort((x, y) => slotRank(x.code) - slotRank(y.code));

    const reject = (reason: string) => {
      if (preferredSet.has(a.id)) excluded.push({ athleteId: a.id, name: a.name, reason });
    };

    if (slots.length === 0) { reject('현재 판매 가능한 슬롯이 없습니다'); continue; }

    const minSlotPrice = Math.min(...slots.map((s) => s.price));
    if (minSlotPrice > input.budget.max) { reject('가장 저렴한 슬롯이 예산 상한을 초과합니다'); continue; }

    const followers = parseFollowers(a.snsStats);
    const fields = (a.activityFields as any) || {};
    const snsActive = !!(fields.sns || fields.youtube || followers);
    if (input.options.includeSns && !snsActive) { reject('SNS 활동 정보가 확인되지 않습니다'); continue; }

    const growthMarket = GROWTH_MARKET_ATHLETES[a.name] || null;
    const hasAuction = a.slotInstances.some((si) => si.enableAuction || si.saleMode === 'AUCTION');
    const hasDirect = a.slotInstances.some((si) => si.saleMode !== 'AUCTION') || slots.length > 0;

    if (input.preferredMethod === 'AUCTION' && !hasAuction) { reject('진행 중인 라이브 경매 슬롯이 없습니다'); continue; }

    const latest = a.eventResults[0];
    const recentResultDays = latest ? Math.floor((now.getTime() - new Date(latest.eventDate).getTime()) / 86400000) : null;
    const yearAgo = new Date(now.getTime() - 365 * 86400000);
    const resultCount12m = a.eventResults.filter((r) => new Date(r.eventDate) >= yearAgo).length;

    candidates.push({
      athlete: a,
      slots,
      minSlotPrice,
      followers,
      recentResultDays,
      resultCount12m,
      favoriteCount: a._count.favoritedBy,
      hasAuction,
      hasDirect,
      growthMarket,
      snsActive,
    });
  }

  return { candidates, excluded };
}

/** 목적별 예산 배분 (§5.1) */
function budgetAllocation(goals: string[]) {
  if (goals.includes('FAN_STORE')) return { slot: 0.2, sns: 0.25, growthMarket: 0.45, ops: 0.1 };
  if (goals.includes('SNS_CONTENT')) return { slot: 0.3, sns: 0.5, growthMarket: 0.1, ops: 0.1 };
  if (goals.includes('LONG_TERM')) return { slot: 0.55, sns: 0.2, growthMarket: 0.15, ops: 0.1 };
  return { slot: 0.6, sns: 0.2, growthMarket: 0.1, ops: 0.1 }; // BRAND_AWARENESS 기본
}

/** 점수 계산 (§3.2 기본 가중치 100점) + reason codes */
function scoreCandidate(c: CandidateFeature, input: AiMatchInput) {
  const reasons: { code: string; text: string }[] = [];
  const budgetMid = (input.budget.min + input.budget.max) / 2;

  // 1) 이용목적 적합도 (20)
  let goalFit = 8;
  if (input.goals.includes('BRAND_AWARENESS')) {
    const visible = c.slots.filter((s) => ['CAP_FRONT', 'CHEST_L', 'CHEST_R'].includes(s.code)).length;
    goalFit += Math.min(6, visible * 3);
  }
  if (input.goals.includes('SNS_CONTENT') && c.snsActive) goalFit += 4;
  if (input.goals.includes('FAN_STORE') && c.growthMarket) goalFit += 6;
  if (input.goals.includes('LONG_TERM') && c.slots.length >= 3) goalFit += 3;
  goalFit = Math.min(20, goalFit);
  if (goalFit >= 14) {
    reasons.push({
      code: 'GOAL_FIT',
      text: input.goals.includes('FAN_STORE') && c.growthMarket
        ? `성장마켓 팬스토어(${c.growthMarket.brands.join('·')})를 운영 중이라 판매 연계에 유리합니다.`
        : `선택하신 목적에 맞는 노출 슬롯 ${c.slots.length}개가 판매 가능 상태입니다.`,
    });
  }

  // 2) SPONPIK Index (20) — 팬·SNS·활동 데이터의 종합 (실데이터만)
  let index = 5;
  if (c.favoriteCount > 0) index += Math.min(5, c.favoriteCount);
  if (c.followers) index += c.followers >= 10000 ? 6 : c.followers >= 1000 ? 4 : 2;
  if (c.resultCount12m > 0) index += Math.min(4, c.resultCount12m);
  if (c.athlete.isFeatured) index += 2;
  index = Math.min(20, index);

  // 3) 예산 적합도 (15) — 예산 중앙값 대비 최저 슬롯가 효율
  let budgetFit = 0;
  if (c.minSlotPrice <= input.budget.max) {
    const ratio = c.minSlotPrice / Math.max(1, budgetMid);
    budgetFit = ratio <= 0.4 ? 15 : ratio <= 0.7 ? 12 : ratio <= 1 ? 9 : 5;
  }
  if (budgetFit >= 12) {
    reasons.push({
      code: 'BUDGET_FIT',
      text: `예산 범위 안에서 대표 슬롯(최저 ${c.minSlotPrice.toLocaleString()}원)과 추가 구성을 함께 담을 수 있습니다.`,
    });
  }

  // 4) 후원방식 적합도 (15)
  let methodFit = 7;
  if (input.preferredMethod === 'AUCTION' && c.hasAuction) methodFit = 15;
  else if (input.preferredMethod === 'DIRECT' && c.hasDirect) methodFit = 14;
  else if (['MONTHLY', 'YEARLY'].includes(input.preferredMethod)) methodFit = c.slots.length >= 2 ? 13 : 9;
  else if (input.preferredMethod === 'AI_RECOMMEND') methodFit = 12;

  // 5) 브랜드-선수 적합도 (15) — 카테고리 태깅 전이라 활동분야·팬스토어 실데이터로 근사
  let brandFit = 7;
  if (c.growthMarket) brandFit += 4;
  if (c.snsActive) brandFit += 2;
  if (input.brandType === 'LOCAL' && c.athlete.region) brandFit += 2;
  brandFit = Math.min(15, brandFit);

  // 6) 최근 성과/활동성 (10)
  let recency = 2;
  if (c.recentResultDays !== null) {
    recency = c.recentResultDays <= 60 ? 10 : c.recentResultDays <= 180 ? 7 : 4;
    if (c.recentResultDays <= 60) {
      reasons.push({ code: 'RECENT_ACTIVITY', text: `최근 ${c.recentResultDays}일 내 대회 성적이 등록된 활동 중인 선수입니다.` });
    }
  }

  // 7) 운영 리스크/가용성 (5)
  const risk = Math.min(5, c.slots.length >= 3 ? 5 : c.slots.length * 2);

  if (c.followers && c.followers >= 5000) {
    reasons.push({ code: 'SNS_STRENGTH', text: `인스타그램 팔로워 ${c.followers.toLocaleString()}명을 보유해 SNS 콘텐츠 확산에 유리합니다.` });
  }
  if (c.growthMarket && !reasons.some((r) => r.code === 'GOAL_FIT')) {
    reasons.push({ code: 'FAN_COMMERCE_FIT', text: `팬스토어(${c.growthMarket.brands.join('·')}) 운영 중 — 팬 대상 판매 연계가 가능합니다.` });
  }
  if (['MONTHLY', 'YEARLY'].includes(input.preferredMethod) && c.slots.length >= 3) {
    reasons.push({ code: 'LONG_TERM_FIT', text: `가용 슬롯이 ${c.slots.length}개로 월간 이상 계약 시 반복 노출 구성이 안정적입니다.` });
  }

  let score = goalFit + index + budgetFit + methodFit + brandFit + recency + risk;

  // 선호 선수 보너스 (§3.3)
  const preferred = (input.preferredAthleteIds || []).includes(c.athlete.id);
  if (preferred) score = Math.min(100, score + 5);

  // 데이터 신뢰도 (§4.1) — 점수를 깎지 않고 별도 표기
  const signals = [c.followers !== null, c.recentResultDays !== null, c.slots.length >= 2, c.favoriteCount > 0].filter(Boolean).length;
  const confidence = signals >= 3 ? 'HIGH' : signals >= 2 ? 'MEDIUM' : 'LOW';

  return { score: Math.min(100, Math.round(score)), reasons: reasons.slice(0, 3), confidence, preferred, breakdown: { goalFit, index, budgetFit, methodFit, brandFit, recency, risk } };
}

/** 패키지 구성 (§5) — 예산 안에서 슬롯 + SNS + 성장마켓 조합 */
function buildPackage(c: CandidateFeature, input: AiMatchInput) {
  const alloc = budgetAllocation(input.goals);
  const slotBudget = input.budget.max * alloc.slot;

  const chosen: typeof c.slots = [];
  let slotTotal = 0;
  for (const s of c.slots) {
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

  const method =
    input.preferredMethod === 'AI_RECOMMEND'
      ? c.hasAuction ? 'AUCTION' : 'DIRECT'
      : input.preferredMethod;

  const sns = input.options.includeSns && c.snsActive ? { feedPosts: 2, storyPosts: 1 } : null;
  const growthMarket = input.options.includeGrowthMarket && c.growthMarket ? { brands: c.growthMarket.brands } : null;

  return {
    method,
    duration: ['MONTHLY', 'YEARLY'].includes(method) ? (method === 'YEARLY' ? '연간' : '월간') : '대회 1회',
    slots: chosen,
    slotTotal,
    sns,
    growthMarket,
    guarantee50: input.options.performanceGuarantee50 ? { eligible: false, note: '성과보장 50 적용 상품은 상담을 통해 확정됩니다' } : null,
    allocation: alloc,
    // 최종 제안가는 슬롯 합계만 확정값. SNS/성장마켓은 협의 항목 (임의 수치 금지)
    priceConfirmed: slotTotal,
    priceNote: sns || growthMarket ? '슬롯 확정가 기준이며 SNS·성장마켓 구성은 상담 시 확정됩니다' : null,
  };
}

/** 후보 수 미리보기 (§9.1 preview) */
export async function previewMatch(input: AiMatchInput) {
  const { candidates, excluded } = await buildCandidates(input);
  return { candidateCount: candidates.length, excludedPreferred: excluded };
}

/** 추천 실행 + 스냅샷 저장 (§9.1 requests) */
export async function createMatchRequest(input: AiMatchInput, userId?: string) {
  const { candidates, excluded } = await buildCandidates(input);

  const scored = candidates
    .map((c) => {
      const s = scoreCandidate(c, input);
      const pkg = buildPackage(c, input);
      return {
        athleteId: c.athlete.id,
        name: c.athlete.name,
        tour: c.athlete.tour,
        tourQualification: c.athlete.tourQualification,
        profileImageUrl: c.athlete.profileImageUrl,
        isFeatured: c.athlete.isFeatured,
        matchScore: s.score,
        confidence: s.confidence,
        preferred: s.preferred,
        reasons: s.reasons,
        breakdown: s.breakdown,
        package: pkg,
        // 실데이터 지표 — 없으면 null (미수집, §10.1)
        metrics: {
          followers: c.followers,
          favoriteCount: c.favoriteCount,
          availableSlots: c.slots.length,
          minSlotPrice: c.minSlotPrice,
          recentResultDays: c.recentResultDays,
          resultCount12m: c.resultCount12m,
          growthMarketBrands: c.growthMarket?.brands || null,
        },
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.metrics.minSlotPrice - b.metrics.minSlotPrice);

  const top = scored.slice(0, 10);
  const results = {
    ruleVersion: RULE_VERSION,
    dataAsOf: new Date().toISOString(),
    candidateCount: candidates.length,
    recommendations: top,
    excludedPreferred: excluded,
  };

  const req = await prisma.aiMatchRequest.create({
    data: {
      userId: userId || null,
      input: input as any,
      results: results as any,
      status: top.length === 0 ? 'EMPTY' : 'COMPLETED',
    },
  });

  return { requestId: req.id, status: req.status, ...results };
}

export async function getMatchRequest(id: string) {
  const req = await prisma.aiMatchRequest.findUnique({ where: { id } });
  if (!req) return null;
  return { requestId: req.id, status: req.status, input: req.input, createdAt: req.createdAt, ...(req.results as any) };
}

/**
 * 스폰픽 추천 PICK — 3안 생성 (핸드오프 v1.0 §6)
 *
 * 기존 AI 심층매칭 엔진(aiMatch.service)의 후보·점수·다양성 계산을 재사용하고,
 * 출력만 "실행 가능한 후원안 3개(안정형·균형형·도전형)"로 재구성한다 (RP-02).
 *
 *  - 선수 순위가 아니라 조합을 제시한다.
 *  - 같은 선수가 3개 안에 2회 이상 등장하지 않는다 (§6.4 다양성 하드룰).
 *  - 기대지표는 추정치를 만들지 않고 실측 가능한 값(SNS 팔로워·가용 슬롯·채널 수)만 쓴다.
 *    "예상 노출" 같은 보장성 표현은 사용하지 않는다 (§17.1 · LEG-06).
 */
import { createMatchRequest, RULE_VERSION } from './aiMatch.service';

export const RECOMMEND_PICK_VERSION = 'recommend-pick-v1-2026-09-01';

/* 자연어/칩 입력 (프론트 랜딩·brief 화면과 동일 키) */
export interface RecommendPickInput {
  freeText?: string;
  objective?: 'AWARENESS' | 'TRIAL' | 'PURCHASE' | 'LOCAL' | string;
  budgetBand?: 'UNDER_30' | 'M30_60' | 'M60_100' | 'OVER_100' | string;
  durationBand?: 'M1' | 'M1_3' | 'M3_6' | 'M6_PLUS' | string;
  category?: string;      // 업종 (BEAUTY | FOOD | ...)
  targetAges?: string[];
  channels?: string[];
  excludedAthleteIds?: string[];
  preferredAthleteIds?: string[];
  constraints?: string;
}

/** 예산 밴드 → 월 예산 범위(원). 서버가 유일한 금액 기준 (§6.5) */
const BUDGET_RANGE: Record<string, { min: number; max: number; label: string }> = {
  UNDER_30: { min: 100_000, max: 300_000, label: '월 30만원 이하' },
  M30_60: { min: 300_000, max: 600_000, label: '월 30~60만원' },
  M60_100: { min: 600_000, max: 1_000_000, label: '월 60~100만원' },
  OVER_100: { min: 1_000_000, max: 3_000_000, label: '월 100만원 이상' },
};

const DURATION_LABEL: Record<string, { label: string; months: number }> = {
  M1: { label: '1개월 이내', months: 1 },
  M1_3: { label: '1~3개월', months: 3 },
  M3_6: { label: '3~6개월', months: 6 },
  M6_PLUS: { label: '6개월 이상', months: 12 },
};

/** 목표 → 기존 엔진의 goals 매핑 */
const OBJECTIVE_GOALS: Record<string, string[]> = {
  AWARENESS: ['BRAND_AWARENESS'],
  TRIAL: ['SNS_CONTENT', 'EVENT_TEST'],
  PURCHASE: ['FAN_STORE', 'SNS_CONTENT'],
  LOCAL: ['FAN_STORE', 'BRAND_AWARENESS'],
  SNS: ['SNS_CONTENT', 'BRAND_AWARENESS'],
};

const OBJECTIVE_LABEL: Record<string, string> = {
  AWARENESS: '브랜드 인지도', TRIAL: '제품 체험', PURCHASE: '구매 전환', LOCAL: '지역 홍보', SNS: 'SNS 확산',
};

/** 자연어에서 조건 힌트 추출 — 규칙 기반(모델 미사용, §3.2 AI 사용 경계) */
export function extractFromText(text: string) {
  const t = text || '';
  const out: Partial<RecommendPickInput> & { confidence: Record<string, number> } = { confidence: {} };
  if (/인지도|알리|브랜딩|노출/.test(t)) { out.objective = 'AWARENESS'; out.confidence.objective = 0.8; }
  if (/체험|리뷰|사용\s*후기|시식/.test(t)) { out.objective = 'TRIAL'; out.confidence.objective = 0.8; }
  if (/구매|판매|전환|매출/.test(t)) { out.objective = 'PURCHASE'; out.confidence.objective = 0.85; }
  if (/지역|매장|방문|동네|상권/.test(t)) { out.objective = 'LOCAL'; out.confidence.objective = 0.75; }
  if (/SNS|인스타|릴스|숏폼|콘텐츠 확산|바이럴/i.test(t)) { out.objective = 'SNS'; out.confidence.objective = 0.8; }
  const man = t.match(/(\d{1,5})\s*만\s*원/);
  if (man) {
    const v = Number(man[1]);
    out.budgetBand = v <= 30 ? 'UNDER_30' : v <= 60 ? 'M30_60' : v < 100 ? 'M60_100' : 'OVER_100';
    out.confidence.budget = 0.9;
  }
  const mon = t.match(/(\d{1,2})\s*개월/);
  if (mon) {
    const v = Number(mon[1]);
    out.durationBand = v <= 1 ? 'M1' : v <= 3 ? 'M1_3' : v <= 6 ? 'M3_6' : 'M6_PLUS';
    out.confidence.duration = 0.9;
  }
  if (/화장품|뷰티|스킨|코스메/.test(t)) { out.category = 'BEAUTY'; out.confidence.category = 0.8; }
  else if (/식품|음료|베이커리|카페|먹/.test(t)) { out.category = 'FOOD'; out.confidence.category = 0.8; }
  else if (/의류|패션|웨어|옷/.test(t)) { out.category = 'FASHION'; out.confidence.category = 0.8; }
  else if (/건강|헬스|영양|보충/.test(t)) { out.category = 'HEALTH'; out.confidence.category = 0.8; }
  const ages = t.match(/(\d0)\s*[~\-–]?\s*(\d0)?\s*대/g);
  if (ages) { out.targetAges = ages.map((a) => a.replace(/\s/g, '')); out.confidence.target = 0.7; }
  return out;
}

type Plan = 'STABLE' | 'BALANCED' | 'CHALLENGE';

const PLAN_META: Record<Plan, { name: string; tagline: string; budgetRatio: number; badge?: string }> = {
  STABLE: { name: '안정형', tagline: '실행 가능성 우선', budgetRatio: 0.9 },
  BALANCED: { name: '균형형', tagline: '노출·콘텐츠 균형', budgetRatio: 1.0, badge: '추천' },
  CHALLENGE: { name: '도전형', tagline: '성장 가능성 우선', budgetRatio: 1.05 },
};

/** 후보 1명 → 안에 들어갈 라인 아이템. slot을 지정하면 그 슬롯으로 구성한다. */
function toMember(r: any, role: string, chosen?: any) {
  const slots: any[] = r.package?.slots || [];
  const slot = chosen || slots[0];
  return {
    athleteId: r.athleteId,
    name: r.name,
    tour: r.tour || '',
    profileImageUrl: r.profileImageUrl || '',
    role,
    fitScore: r.matchScore ?? r.finalScore ?? null,
    confidence: r.confidence,
    slot: slot
      ? { code: slot.code, name: slot.name, price: slot.price, saleMode: slot.saleMode, saleModeLabel: slot.saleModeLabel }
      : null,
    price: slot?.price ?? 0,
    followers: r.metrics?.followers ?? null,
    availableSlots: r.metrics?.availableSlots ?? 0,
    isDiscovery: !!r.isDiscovery,
    reason: r.reasons?.[0]?.text || null,
  };
}

/**
 * 3안 생성. reranked(점수순 후보)에서 안별 성향에 맞게 2~3명을 뽑되,
 * 이미 다른 안에 쓴 선수는 제외해 중복 노출을 막는다.
 */
function buildPlans(reranked: any[], budget: { min: number; max: number }) {
  const used = new Set<string>();
  /**
   * 예산 안에서 선수와 슬롯을 함께 고른다.
   * package.slots는 가시성 높은 순으로 정렬되어 있으므로 앞에서부터 시도하고,
   * 남은 예산에 맞지 않으면 더 저렴한 슬롯으로 내려간다 (§6.5 예산 최적화).
   */
  const take = (pool: any[], count: number, max: number) => {
    const out: { r: any; slot: any }[] = [];
    let total = 0;
    for (const r of pool) {
      if (out.length >= count) break;
      if (used.has(r.athleteId)) continue;
      const slots: any[] = (r.package?.slots || []).filter((s: any) => (s?.price ?? 0) > 0);
      if (slots.length === 0) continue;
      // 남은 예산: 아직 못 채운 자리 수를 감안해 1인당 상한을 둔다
      const remainingSeats = count - out.length;
      const perSeatCap = Math.max((max - total) / remainingSeats, 0);
      const affordable = slots.filter((s) => s.price <= Math.max(perSeatCap, max - total));
      const slot = affordable[0] || [...slots].sort((a, b) => a.price - b.price)[0];
      if (!slot || total + slot.price > max) continue;
      out.push({ r, slot });
      used.add(r.athleteId);
      total += slot.price;
    }
    return { picked: out, total };
  };

  const verified = reranked.filter((r) => r.confidence === 'HIGH' || r.confidence === 'MEDIUM');
  const growth = reranked.filter((r) => r.isDiscovery || r.subScores?.longTerm >= 55);

  const plans: any[] = [];
  const ROLES = ['패치 노출', 'SNS 콘텐츠', '보조 노출·확장'];

  (Object.keys(PLAN_META) as Plan[]).forEach((key) => {
    const meta = PLAN_META[key];
    const cap = Math.round(budget.max * meta.budgetRatio);
    // 안정형은 검증 선수 우선, 도전형은 성장/신규 우선, 균형형은 혼합
    const pool =
      key === 'STABLE' ? [...verified, ...reranked]
        : key === 'CHALLENGE' ? [...growth, ...reranked]
        : [...reranked];
    const wanted = key === 'STABLE' ? 2 : 3;
    const { picked, total } = take(pool, wanted, cap);
    if (picked.length === 0) return;

    const members = picked.map((p, i) => toMember(p.r, ROLES[i] || '추가 노출', p.slot));
    const followers = members.reduce((s, m) => s + (m.followers || 0), 0);
    const channels = new Set<string>();
    members.forEach((m) => { if (m.slot) channels.add('경기 착장'); if ((m.followers || 0) > 0) channels.add('SNS'); });

    plans.push({
      key,
      name: meta.name,
      tagline: meta.tagline,
      badge: meta.badge || null,
      total,
      budgetCap: cap,
      members,
      /* 기대지표 — 추정 없이 실측 합계만 (§17.1) */
      metrics: {
        athletes: members.length,
        totalFollowers: followers || null,
        availableSlots: members.reduce((s, m) => s + (m.availableSlots || 0), 0),
        channels: [...channels],
        avgFit: Math.round(members.reduce((s, m) => s + (m.fitScore || 0), 0) / members.length),
      },
      reasons: buildReasons(key, members),
      approvability: buildApprovability(members),
      risks: buildRisks(key, members, total, budget.max),
      expected: buildExpected(members),
    });
  });

  return plans;
}

/** 예상성과 산식 버전 — 바뀌면 올린다. 화면은 이 값을 함께 표시한다 (§14.1 methodVersion) */
export const EXPECTED_METHOD_VERSION = 'exp-v0.1';

/**
 * 승인 가능성 — 점수가 아니라 재고·데이터 상태로 판단한다 (v2.1 §1.3-4 실행 가능성 우선).
 *  HIGH: 전원 판매 중 슬롯 보유 + 데이터 HIGH/MEDIUM + 즉시 구매 슬롯
 *  MEDIUM: 슬롯은 있으나 선수 확인이 필요한 판매 방식이거나 데이터 MEDIUM
 *  LOW: 슬롯이 없거나 데이터 LOW 선수 포함
 */
function buildApprovability(members: any[]) {
  const noSlot = members.filter((m) => !m.slot);
  const lowData = members.filter((m) => m.confidence === 'LOW');
  const needsConfirm = members.filter((m) => m.slot && m.slot.saleMode && m.slot.saleMode !== 'BUY_NOW');
  let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  const reasons: string[] = [];
  if (noSlot.length || lowData.length) {
    level = 'LOW';
    if (noSlot.length) reasons.push(`${noSlot.map((m) => m.name).join(' · ')} — 판매 중인 슬롯 없음`);
    if (lowData.length) reasons.push(`${lowData.map((m) => m.name).join(' · ')} — 데이터 수집 중`);
  } else if (needsConfirm.length) {
    level = 'MEDIUM';
    reasons.push(`${needsConfirm.map((m) => m.name).join(' · ')} — 선수 확인 후 확정되는 판매 방식`);
  } else {
    reasons.push('전원 즉시 선택 가능한 슬롯 · 데이터 충분');
  }
  const label = level === 'HIGH' ? '승인 가능성 높음' : level === 'MEDIUM' ? '선수 확인 필요' : '실행 전 확인 필요';
  return { level, label, reasons, approvalWindowHours: 72 };
}

/** 위험 — 사용자가 신청 전에 알아야 할 것만. 없으면 빈 배열 */
function buildRisks(key: Plan, members: any[], total: number, budgetMax: number) {
  const risks: { code: string; label: string; text: string }[] = [];
  const low = members.filter((m) => m.confidence === 'LOW');
  if (low.length) risks.push({ code: 'DATA_LOW', label: '데이터 부족', text: `${low.map((m) => m.name).join(' · ')}는 지표가 수집 중이라 예상 범위의 불확실성이 큽니다.` });
  const noSlot = members.filter((m) => !m.slot);
  if (noSlot.length) risks.push({ code: 'NO_SLOT', label: '슬롯 미확보', text: `${noSlot.map((m) => m.name).join(' · ')}는 현재 판매 중인 착장 슬롯이 없어 온라인 상품으로 대체될 수 있습니다.` });
  if (total > budgetMax) risks.push({ code: 'OVER_BUDGET', label: '예산 초과', text: `구성 금액이 입력 예산 상한을 ${(total - budgetMax).toLocaleString()}원 넘습니다.` });
  const noSns = members.filter((m) => !(m.followers > 0));
  if (noSns.length === members.length) risks.push({ code: 'NO_SNS', label: 'SNS 데이터 없음', text: 'SNS 도달 예상 범위를 만들 수 있는 팔로워 데이터가 없습니다.' });
  if (key === 'CHALLENGE' && !risks.some((r) => r.code === 'DATA_LOW')) {
    risks.push({ code: 'GROWTH', label: '성장 우선 구성', text: '노출 이력이 적은 선수를 포함해 결과 편차가 클 수 있습니다.' });
  }
  return risks;
}

/**
 * 예상성과 — 실측(팔로워 합계)에 공개된 산식을 적용한 범위. 보장이 아니다 (§14.1).
 * 팔로워 데이터가 없으면 만들지 않는다 (LEG-06: 추정으로 빈칸을 채우지 않는다).
 */
function buildExpected(members: any[]) {
  const withSns = members.filter((m) => m.followers > 0);
  if (!withSns.length) return null;
  const followers = withSns.reduce((s, m) => s + m.followers, 0);
  const allHigh = withSns.every((m) => m.confidence === 'HIGH');
  const confidence = allHigh && withSns.length === members.length ? 'MEDIUM' : 'LOW';
  return {
    methodVersion: EXPECTED_METHOD_VERSION,
    dataAsOf: new Date().toISOString(),
    guaranteed: false,
    confidence,
    metrics: [
      {
        metric: 'SNS 도달 (게시 1회당)',
        minValue: Math.round(followers * 0.02),
        maxValue: Math.round(followers * 0.06),
        basis: `팔로워 합계 ${followers.toLocaleString()} × 업계 평균 게시당 도달률 2~6%`,
      },
    ],
    assumptions: ['선수 계정에 브랜드 콘텐츠 1회 이상 게시', '게시 시점 팔로워 수가 기준일과 유사'],
  };
}

function buildReasons(key: Plan, members: any[]) {
  const names = members.map((m) => m.name).join(' · ');
  const base = [
    { code: 'FIT', label: '타깃 적합도', text: `${names} — 후보군 내 상대 적합도 평균 ${Math.round(members.reduce((s, m) => s + (m.fitScore || 0), 0) / members.length)}점` },
  ];
  if (key === 'STABLE') {
    base.push({ code: 'EXEC', label: '실행 가능성', text: '데이터가 충분하고 판매 중인 슬롯이 확보된 선수로 구성했습니다.' });
    base.push({ code: 'BUDGET', label: '예산 효율', text: '예산의 90% 이내로 구성해 추가 활동 여지를 남겼습니다.' });
  } else if (key === 'BALANCED') {
    base.push({ code: 'MIX', label: '노출·콘텐츠 균형', text: '경기 착장 노출과 SNS 콘텐츠를 함께 담았습니다.' });
    base.push({ code: 'BUDGET', label: '예산 활용', text: '예산 범위를 최대한 활용하되 초과하지 않도록 구성했습니다.' });
  } else {
    base.push({ code: 'GROWTH', label: '성장 가능성', text: '최근 노출이 적었던 신규·성장 선수를 포함해 발견 기회를 넓혔습니다.' });
    base.push({ code: 'RISK', label: '확인 필요', text: '데이터가 축적 중인 선수가 포함되어 실행 전 확인이 필요합니다.' });
  }
  return base;
}

/**
 * 추천 PICK 생성 — brief(자연어+칩)를 기존 엔진 입력으로 변환해 실행하고 3안으로 재구성한다.
 */
export async function createRecommendPick(input: RecommendPickInput, userId?: string) {
  const hints = extractFromText(input.freeText || '');
  const objective = input.objective || hints.objective || 'AWARENESS';
  const budgetBand = input.budgetBand || hints.budgetBand || 'M60_100';
  const durationBand = input.durationBand || hints.durationBand || 'M1_3';
  const category = input.category || hints.category || 'ETC';
  const budget = BUDGET_RANGE[budgetBand] || BUDGET_RANGE.M60_100;

  const engineInput = {
    brandType: category,
    goals: OBJECTIVE_GOALS[objective] || ['BRAND_AWARENESS'],
    preferredMethod: 'AI_RECOMMEND',
    preferredAthleteIds: input.preferredAthleteIds || [],
    excludedAthleteIds: input.excludedAthleteIds || [],
    budget: { min: budget.min, max: budget.max },
    options: { includeSns: true, includeGrowthMarket: true, performanceGuarantee50: false },
    brandDescription: input.freeText,
    currentChannels: input.channels,
    audience: input.targetAges?.length ? { ages: input.targetAges } : undefined,
    recommendationStyle: 'BALANCED' as const,
    portfolioMode: 'AUTO' as const,
  };

  const engine: any = await createMatchRequest(engineInput as any, userId);
  const ranked: any[] = engine.recommendations || [];
  const plans = buildPlans(ranked, budget);

  /* 예산 불일치 안내 (§2.4) — 조합을 못 만들면 최소 필요 금액과 완화안을 준다 */
  const slotPrices = ranked
    .flatMap((r) => (r.package?.slots || []).map((s: any) => s?.price))
    .filter((p: any) => typeof p === 'number' && p > 0);
  const minRequired = slotPrices.length ? Math.min(...slotPrices) : null;
  const budgetGap = plans.length === 0 && minRequired
    ? {
        minRequired,
        message: `현재 조건에서는 선수 1명 기준 최소 ${minRequired.toLocaleString()}원이 필요합니다.`,
        options: [
          { key: 'RAISE_BUDGET', label: `예산을 ${Math.ceil(minRequired / 100000) * 10}만원 이상으로 올리기` },
          { key: 'DIGITAL', label: '디지털 파트너 월 구독으로 시작하기 (월 49,000원~)' },
        ],
      }
    : null;

  return {
    requestId: engine.requestId,
    version: RECOMMEND_PICK_VERSION,
    engineVersion: RULE_VERSION,
    dataAsOf: engine.dataAsOf,
    candidateCount: engine.candidateCount,
    brief: {
      freeText: input.freeText || '',
      objective, objectiveLabel: OBJECTIVE_LABEL[objective] || objective,
      budgetBand, budgetLabel: budget.label, budgetMin: budget.min, budgetMax: budget.max,
      durationBand, durationLabel: (DURATION_LABEL[durationBand] || DURATION_LABEL.M1_3).label,
      category,
      extracted: hints,
    },
    plans,
    /* 후보가 부족하면 3안을 억지로 만들지 않는다 (§12.4 Cold start) */
    partial: plans.length > 0 && plans.length < 3,
    budgetGap,
    sourceStatus: engine.sourceStatus,
  };
}

/**
 * 직접 선택 PICK — 탐색 · 오퍼 · 견적함 · 홀드 · 검증 (핸드오프 v1.0)
 *
 * 원칙
 *  - 가격은 서버 quote가 단일 진실원천이다 (§5.6). 클라이언트 계산값은 안내용.
 *  - 재고는 hold + 트랜잭션으로 oversell을 막는다 (§6.4).
 *  - ONLINE_ONLY는 offlineUse=false가 강제된다 (§12.3).
 *  - 실측되지 않은 지표는 내보내지 않는다 (LEG-06). 미수집은 null.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/* ────────────────────────────────────────────────────────────
 * 정책 상수 — 화면·견적이 모두 여기만 본다 (부록 B)
 * 기간 요금은 "슬롯 월 단가 × 개월수" 선형 규칙, 대회 1회는 1개월 단가 기준.
 * ──────────────────────────────────────────────────────────── */
export const DURATIONS = [
  { code: 'SINGLE_EVENT', label: '대회 1회', months: 1, note: '1개월 단가 기준' },
  { code: 'DAYS_30', label: '30일', months: 1, note: null },
  { code: 'MONTHS_3', label: '3개월', months: 3, note: null },
  { code: 'MONTHS_6', label: '6개월', months: 6, note: null },
  { code: 'MONTHS_12', label: '12개월', months: 12, note: null },
] as const;

export const SALE_MODES = [
  { code: 'BUY_NOW', label: '직접구매', desc: '표시 금액으로 바로 신청' },
  { code: 'NEGOTIATED', label: '협의형', desc: '조건을 협의한 뒤 확정' },
  { code: 'AUCTION', label: '경매', desc: '진행 중인 경매에 입찰' },
  { code: 'LONG_TERM', label: '장기계약', desc: '6·12개월 파트너십' },
] as const;

/** 추가 활동 요율 — 시안 명시 기준가. 선수 승인 시 최종 확정된다. */
export const ADD_ONS = [
  { code: 'SNS_FEED', label: 'SNS 피드', price: 40_000, max: 12 },
  { code: 'SNS_STORY', label: 'SNS 스토리', price: 20_000, max: 12 },
  { code: 'SNS_REELS', label: '릴스', price: 20_000, max: 12 },
  { code: 'STORE_VISIT', label: '매장 방문', price: 300_000, max: 4 },
  { code: 'EVENT_ATTEND', label: '행사 참석', price: 700_000, max: 4 },
  { code: 'PRO_AM', label: '프로암', price: 500_000, max: 4 },
  { code: 'PRODUCT_REVIEW', label: '제품 사용 후기', price: 300_000, max: 4 },
] as const;

/** 사용 범위 — ONLINE_ONLY 상품은 OFFLINE을 선택할 수 없다 */
export const SCOPES = [
  { code: 'OFFLINE', label: '대회 착장' },
  { code: 'ONLINE', label: '온라인 이미지' },
  { code: 'PRINT', label: '매장 인쇄물' },
  { code: 'SECONDARY', label: '2차 활용' },
] as const;

/** 슬롯 표준 taxonomy — 코드와 UI 명칭은 1:1 (§4.2 / §16.2) */
export const SLOT_TAXONOMY: { group: string; label: string; view: 'FRONT' | 'BACK'; match: (c: string) => boolean }[] = [
  { group: 'CAP', label: '모자', view: 'FRONT', match: (c) => c.startsWith('CAP') && c !== 'CAP_BACK' },
  { group: 'COLLAR', label: '카라', view: 'FRONT', match: (c) => c.startsWith('COLLAR') },
  { group: 'TOP', label: '상의', view: 'FRONT', match: (c) => c.startsWith('CHEST') || c.startsWith('TOP') },
  { group: 'CLAVICLE', label: '쇄골', view: 'FRONT', match: (c) => c.startsWith('CLAVICLE') },
  { group: 'SLEEVE', label: '소매', view: 'FRONT', match: (c) => c.startsWith('SLEEVE') },
  { group: 'SHOULDER', label: '어깨', view: 'FRONT', match: (c) => c.startsWith('SHOULDER') },
  { group: 'BACK', label: '등', view: 'BACK', match: (c) => c.startsWith('BACK') || c === 'CAP_BACK' },
  { group: 'BOTTOM', label: '하의', view: 'FRONT', match: (c) => c.startsWith('PANTS') || c.startsWith('BOTTOM') },
];

const groupOf = (code: string) => SLOT_TAXONOMY.find((t) => t.match(code)) || null;

export const HOLD_MINUTES = 15;
export const HOLD_EXTEND_MINUTES = 10;
export const QUOTE_TTL_MINUTES = 30;
export const MAX_ATHLETES_PER_DRAFT = 5;
const AUCTION_BLOCKED_DURATIONS = ['MONTHS_6', 'MONTHS_12'];

/** 온라인 상품 기본 카탈로그 — 선수별 등록이 없으면 이 값으로 시딩한다 */
const DEFAULT_OFFERS = [
  { code: 'ONLINE_PROFILE_PATCH', name: '온라인 프로필 패치', type: 'ONLINE_ONLY', price: 200_000, unit: 'MONTH', sortOrder: 1, printUse: false, description: '선수 온라인 프로필 이미지에 브랜드 로고 노출' },
  { code: 'GROWTH_MARKET_IMAGE', name: '성장마켓 이미지', type: 'STORE_MARKET', price: 250_000, unit: 'MONTH', sortOrder: 2, printUse: false, description: '팬스토어·성장마켓 배너와 상품 이미지' },
  { code: 'STORE_PRINT', name: '매장용 인쇄물', type: 'STORE_MARKET', price: 150_000, unit: 'MONTH', sortOrder: 3, printUse: true, description: '등록 매장 POP·포스터 인쇄물' },
];

export function getOptions() {
  return {
    durations: DURATIONS,
    saleModes: SALE_MODES,
    addOns: ADD_ONS,
    scopes: SCOPES,
    slotGroups: SLOT_TAXONOMY.map((t) => ({ group: t.group, label: t.label, view: t.view })),
    auctionBlockedDurations: AUCTION_BLOCKED_DURATIONS,
    holdMinutes: HOLD_MINUTES,
    maxAthletes: MAX_ATHLETES_PER_DRAFT,
    pricingRule: '슬롯 월 단가 × 기간(개월) + 추가 활동',
  };
}

/* ── 1단계: 선수 탐색 (§3) ───────────────────────────────── */

export interface SearchParams {
  q?: string; tour?: string; region?: string; maxMonthly?: number;
  mode?: string; sort?: string; limit?: number;
}

export async function listPickAthletes(params: SearchParams) {
  const athletes = await prisma.athlete.findMany({
    where: {
      isActive: true,
      kycStatus: 'APPROVED',
      ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
      ...(params.tour ? { tour: { contains: params.tour, mode: 'insensitive' } } : {}),
      ...(params.region ? { region: { contains: params.region, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true, name: true, tour: true, region: true, profileImageUrl: true,
      isRecommended: true, recommendOrder: true, profileUpdatedAt: true, createdAt: true,
    },
    /* limit은 '결과 수'다 — 판매 상품이 없는 선수가 걸러지므로 후보는 넉넉히 읽는다 */
    take: 300,
  });
  if (!athletes.length) return { athletes: [], total: 0 };

  const ids = athletes.map((a) => a.id);
  await ensureOffers(ids);
  const [slots, offers, temps, results] = await Promise.all([
    prisma.athleteSlot.findMany({
      where: { athleteId: { in: ids }, saleEnabled: true },
      select: { id: true, athleteId: true, basePrice: true, approvalRequired: true },
    }),
    prisma.athleteOfferProduct.findMany({
      where: { athleteId: { in: ids }, isActive: true },
      select: { athleteId: true, price: true, type: true },
    }),
    prisma.fanTemperatureEvent.groupBy({
      by: ['athleteId'], where: { athleteId: { in: ids } }, _sum: { deltaMilli: true },
    }),
    prisma.athleteEventResult.findMany({
      where: { athleteId: { in: ids }, status: 'APPROVED' },
      orderBy: { eventDate: 'desc' },
      select: { athleteId: true, eventName: true, eventDate: true, rank: true },
    }),
  ]);

  /* 판매 중인 슬롯의 현재 점유 상태 */
  const slotIds = slots.map((s) => s.id);
  const now = new Date();
  const [busy, holds] = await Promise.all([
    slotIds.length
      ? prisma.slotInventory.findMany({
          where: {
            athleteSlotId: { in: slotIds },
            endDate: { gte: now },
            status: { in: ['SOLD', 'PENDING_APPROVAL', 'HELD'] },
          },
          select: { athleteSlotId: true },
        })
      : Promise.resolve([]),
    slotIds.length
      ? prisma.inventoryHold.findMany({
          where: { athleteSlotId: { in: slotIds }, releasedAt: null, expiresAt: { gt: now } },
          select: { athleteSlotId: true },
        })
      : Promise.resolve([]),
  ]);
  const busySet = new Set([
    ...busy.map((b) => b.athleteSlotId),
    ...holds.map((h) => h.athleteSlotId).filter(Boolean) as string[],
  ]);

  const tempMap = new Map(temps.map((t) => [t.athleteId, (t._sum.deltaMilli || 0) / 1000]));
  const resultMap = new Map<string, any[]>();
  for (const r of results) resultMap.set(r.athleteId, [...(resultMap.get(r.athleteId) || []), r]);

  let list = athletes.map((a) => {
    const mySlots = slots.filter((s) => s.athleteId === a.id);
    const myOffers = offers.filter((o) => o.athleteId === a.id);
    const openSlots = mySlots.filter((s) => !busySet.has(s.id));
    const prices = [...openSlots.map((s) => s.basePrice), ...myOffers.map((o) => o.price)];
    const rs = (resultMap.get(a.id) || []).slice(0, 5);
    const ranked = rs.filter((r) => r.rank != null);

    const modes: string[] = [];
    if (openSlots.length) modes.push('오프라인 슬롯');
    if (myOffers.some((o) => o.type === 'ONLINE_ONLY')) modes.push('온라인 전용');
    if (myOffers.some((o) => o.type === 'STORE_MARKET')) modes.push('성장마켓');
    if (mySlots.some((s) => s.approvalRequired)) modes.push('협의형');

    return {
      id: a.id, name: a.name, tour: a.tour, region: a.region, profileImageUrl: a.profileImageUrl,
      availability: mySlots.length === 0 && myOffers.length === 0 ? 'CLOSED'
        : openSlots.length === 0 ? 'PARTIAL' : 'OPEN',
      slotTotal: mySlots.length,
      slotOpen: openSlots.length,
      offerCount: myOffers.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      modes: modes.slice(0, 3),
      fanTemp: tempMap.get(a.id) ?? 0,
      recentResults: rs.map((r) => ({ eventName: r.eventName, eventDate: r.eventDate, rank: r.rank })),
      recentAvgRank: ranked.length ? Math.round(ranked.reduce((s, r) => s + r.rank!, 0) / ranked.length) : null,
      top10Count: ranked.filter((r) => r.rank! <= 10).length,
      /* 데이터 상태 — 성과·프로필 갱신 이력으로만 판단 (§11.3) */
      dataStatus: rs.length === 0 ? 'NEW'
        : a.profileUpdatedAt && Date.now() - new Date(a.profileUpdatedAt).getTime() > 90 * 86400_000 ? 'DUE'
        : 'FRESH',
      isRecommended: a.isRecommended,
      createdAt: a.createdAt,
    };
  }).filter((a) => a.slotTotal > 0 || a.offerCount > 0);

  if (params.maxMonthly) list = list.filter((a) => a.minPrice != null && a.minPrice <= params.maxMonthly!);
  if (params.mode === 'ONLINE') list = list.filter((a) => a.modes.includes('온라인 전용'));
  if (params.mode === 'OFFLINE') list = list.filter((a) => a.slotOpen > 0);

  /* 정렬 — 추천순은 쓰지 않는다 (§3.1) */
  const lastDate = (a: any) => (a.recentResults[0]?.eventDate ? new Date(a.recentResults[0].eventDate).getTime() : 0);
  const sorters: Record<string, (a: any, b: any) => number> = {
    RECENT: (a, b) => lastDate(b) - lastDate(a),
    FAN_TEMP: (a, b) => b.fanTemp - a.fanTemp,
    PERFORMANCE: (a, b) => (a.recentAvgRank ?? 999) - (b.recentAvgRank ?? 999),
    PRICE: (a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity),
    NEW: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  };
  list.sort(sorters[params.sort || 'RECENT'] || sorters.RECENT);

  const limit = Math.min(params.limit || 60, 120);
  return { athletes: list.slice(0, limit), total: list.length };
}

/* ── 3단계 데이터: 오퍼(슬롯 + 온라인 상품) (§4) ─────────── */

/**
 * 선수 온라인 상품이 없으면 기본 카탈로그로 시딩한다.
 * 목록과 상세가 같은 값을 보여야 하므로 두 경로에서 모두 호출한다.
 */
async function ensureOffers(athleteIds: string | string[]) {
  const ids = Array.isArray(athleteIds) ? athleteIds : [athleteIds];
  if (!ids.length) return;
  const existing = await prisma.athleteOfferProduct.findMany({
    where: { athleteId: { in: ids } },
    select: { athleteId: true },
    distinct: ['athleteId'],
  });
  const has = new Set(existing.map((e) => e.athleteId));
  const missing = ids.filter((id) => !has.has(id));
  if (!missing.length) return;
  await prisma.athleteOfferProduct.createMany({
    data: missing.flatMap((athleteId) => DEFAULT_OFFERS.map((o) => ({
      athleteId, code: o.code, name: o.name, type: o.type, price: o.price,
      unit: o.unit, sortOrder: o.sortOrder, description: o.description, printUse: o.printUse,
    }))),
    skipDuplicates: true,
  });
}

export async function getOffers(athleteId: string) {
  await ensureOffers(athleteId);
  const now = new Date();

  const [slots, offers] = await Promise.all([
    prisma.athleteSlot.findMany({
      where: { athleteId, saleEnabled: true },
      include: {
        slotTemplate: {
          select: {
            code: true, name: true, nameKr: true, bodyPart: true, grade: true,
            displayX: true, displayY: true, uiHeadline: true, uiCopy: true,
            recommendedWMm: true, recommendedHMm: true,
          },
        },
        inventories: {
          where: { endDate: { gte: now } },
          orderBy: { startDate: 'asc' },
          select: { id: true, status: true, startDate: true, endDate: true, reservedUntil: true, auctionId: true },
        },
        holds: {
          where: { releasedAt: null, expiresAt: { gt: now } },
          select: { id: true, expiresAt: true },
        },
      },
      orderBy: { basePrice: 'desc' },
    }),
    prisma.athleteOfferProduct.findMany({
      where: { athleteId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const mapped = slots.map((s) => {
    const live = s.inventories.find((i) => ['SOLD', 'AUCTION_ACTIVE', 'PENDING_APPROVAL', 'HELD'].includes(i.status));
    const held = s.holds.length > 0;
    const t = s.slotTemplate;

    /* 상태 머신 (§4.4) — 코드는 하나만 결정한다 */
    let status: string;
    if (s.restrictionNote) status = 'BLOCKED';
    else if (live?.status === 'SOLD') status = 'SOLD';
    else if (live?.status === 'AUCTION_ACTIVE') status = 'AUCTION';
    else if (live?.status === 'PENDING_APPROVAL') status = 'RESERVED';
    else if (live?.status === 'HELD' || held) status = 'HOLD';
    else if (s.approvalRequired) status = 'NEEDS_CONFIRMATION';
    else status = 'AVAILABLE';

    const g = groupOf(t.code);
    return {
      athleteSlotId: s.id,
      code: t.code,
      name: s.customName || t.nameKr || t.name,
      group: g?.group || 'ETC',
      groupLabel: g?.label || '기타',
      view: g?.view || 'FRONT',
      x: t.displayX, y: t.displayY,
      price: s.basePrice,
      grade: s.baseGrade || t.grade,
      status,
      selectable: status === 'AVAILABLE' || status === 'NEEDS_CONFIRMATION' || status === 'AUCTION',
      approvalRequired: s.approvalRequired,
      holdExpiresAt: s.holds[0]?.expiresAt ?? live?.reservedUntil ?? null,
      auctionId: live?.auctionId ?? null,
      restrictionNote: s.restrictionNote,
      headline: t.uiHeadline, copy: t.uiCopy,
      patchWidthMm: t.recommendedWMm, patchHeightMm: t.recommendedHMm,
    };
  });

  return {
    slots: mapped,
    offers: offers.map((o) => ({
      id: o.id, code: o.code, name: o.name, type: o.type, description: o.description,
      price: o.price, unit: o.unit, minMonths: o.minMonths,
      rights: { offlineUse: o.offlineUse, onlineUse: o.onlineUse, printUse: o.printUse, secondaryUse: o.secondaryUse },
    })),
    viewCounts: {
      FRONT: mapped.filter((s) => s.view === 'FRONT').length,
      BACK: mapped.filter((s) => s.view === 'BACK').length,
    },
    verifiedAt: now,
  };
}

/* ── 2단계: 퀵프로필 (§3.3) ─────────────────────────────── */

export async function getQuickProfile(athleteId: string) {
  const a = await prisma.athlete.findFirst({
    where: { id: athleteId, isActive: true },
    select: {
      id: true, name: true, tour: true, region: true, profileImageUrl: true, bio: true,
      height: true, debutYear: true, affiliation: true, activityFields: true, snsStats: true,
      tourQualification: true, blockedCategories: true, primarySponsors: true, highlights: true,
      profileUpdatedAt: true,
    },
  });
  if (!a) return null;

  const [results, offersData, temp] = await Promise.all([
    prisma.athleteEventResult.findMany({
      where: { athleteId, status: 'APPROVED' },
      orderBy: { eventDate: 'desc' }, take: 10,
      select: { eventName: true, eventDate: true, rank: true, tour: true, score: true },
    }),
    getOffers(athleteId),
    prisma.fanTemperatureEvent.aggregate({ where: { athleteId }, _sum: { deltaMilli: true } }),
  ]);

  const ranked = results.filter((r) => r.rank != null);
  const openSlots = offersData.slots.filter((s) => s.selectable);
  const prices = [...openSlots.map((s) => s.price), ...offersData.offers.map((o) => o.price)];

  return {
    athlete: a,
    fanTemp: (temp._sum.deltaMilli || 0) / 1000,
    recentResults: results.slice(0, 5),
    allResults: results,
    recentAvgRank: ranked.length ? Math.round(ranked.slice(0, 5).reduce((s, r) => s + r.rank!, 0) / Math.min(5, ranked.length)) : null,
    top10Count: ranked.filter((r) => r.rank! <= 10).length,
    minPrice: prices.length ? Math.min(...prices) : null,
    slotOpen: openSlots.length,
    slotTotal: offersData.slots.length,
    availableSlots: openSlots.map((s) => ({ code: s.code, name: s.name, price: s.price, status: s.status })),
    offers: offersData.offers,
    blockedCategories: a.blockedCategories || [],
    primarySponsors: a.primarySponsors ?? null,
    verifiedAt: offersData.verifiedAt,
  };
}

/* ── 가격 계산 (§5.6 서버 권위) ─────────────────────────── */

export interface ItemInput {
  athleteId: string;
  kind?: 'OFFLINE_SLOT' | 'ONLINE_PRODUCT';
  slotCode?: string;
  offerCode?: string;
  durationCode?: string;
  startDate?: string;
  saleMode?: string;
  addOns?: { code: string; count?: number }[];
  scopes?: string[];
}

/** 항목 1건의 서버 가격·권리 계산. 판매 불가면 status/conflictCode를 담아 돌려준다. */
export async function priceItem(input: ItemInput) {
  const duration = DURATIONS.find((d) => d.code === input.durationCode) || DURATIONS[0];
  const saleMode = SALE_MODES.find((m) => m.code === input.saleMode) || SALE_MODES[0];

  if (saleMode.code === 'AUCTION' && AUCTION_BLOCKED_DURATIONS.includes(duration.code)) {
    throw Object.assign(new Error('6개월 이상 장기 상품은 경매로 판매하지 않습니다'), { status: 400 });
  }

  const picked = (input.addOns || [])
    .map((a) => {
      const def = ADD_ONS.find((x) => x.code === a.code);
      if (!def) return null;
      const count = Math.max(1, Math.min(def.max, Number(a.count) || 1));
      return { code: def.code, label: def.label, unitPrice: def.price, count, price: def.price * count };
    })
    .filter(Boolean) as { code: string; label: string; unitPrice: number; count: number; price: number }[];
  const addOnAmount = picked.reduce((s, a) => s + a.price, 0);

  let basePrice = 0;
  let slotName = '';
  let athleteSlotId: string | undefined;
  let offerProductId: string | undefined;
  let status = 'OK';
  let conflictCode: string | null = null;
  let conflictNote: string | null = null;
  let rights = { offlineUse: true, onlineUse: true, printUse: false, secondaryUse: false };
  const kind = input.kind || (input.offerCode ? 'ONLINE_PRODUCT' : 'OFFLINE_SLOT');

  if (kind === 'ONLINE_PRODUCT') {
    await ensureOffers(input.athleteId);
    const offer = await prisma.athleteOfferProduct.findFirst({
      where: { athleteId: input.athleteId, code: input.offerCode, isActive: true },
    });
    if (!offer) throw Object.assign(new Error('선택한 온라인 상품을 판매 중이 아닙니다'), { status: 409 });
    basePrice = offer.price;
    slotName = offer.name;
    offerProductId = offer.id;
    rights = { offlineUse: offer.offlineUse, onlineUse: offer.onlineUse, printUse: offer.printUse, secondaryUse: offer.secondaryUse };
    if (duration.months < offer.minMonths) {
      status = 'CONFLICT';
      conflictCode = 'MIN_DURATION';
      conflictNote = `최소 ${offer.minMonths}개월부터 계약할 수 있습니다`;
    }
  } else {
    const offersData = await getOffers(input.athleteId);
    const slot = offersData.slots.find((s) => s.code === input.slotCode);
    if (!slot) throw Object.assign(new Error('선택한 슬롯을 판매 중이 아닙니다'), { status: 409 });
    basePrice = slot.price;
    slotName = slot.name;
    athleteSlotId = slot.athleteSlotId;
    if (!slot.selectable) {
      status = 'CONFLICT';
      conflictCode = slot.status === 'BLOCKED' ? 'RIGHTS_CONFLICT' : 'SLOT_TAKEN';
      conflictNote = slot.restrictionNote || '현재 선택할 수 없는 위치입니다';
    } else if (slot.status === 'NEEDS_CONFIRMATION') {
      status = 'NEEDS_CONFIRMATION';
      conflictNote = '선수 확인 후 확정되는 조건입니다';
    }
  }

  /* 사용 범위 — 상품이 허용하지 않는 범위는 서버에서 제거한다 (§12.3) */
  const requested = new Set(input.scopes && input.scopes.length ? input.scopes : ['ONLINE']);
  if (!rights.offlineUse) requested.delete('OFFLINE');
  if (!rights.printUse) requested.delete('PRINT');
  if (!rights.secondaryUse) requested.delete('SECONDARY');
  const scopes = [...requested];

  const durationAmount = basePrice * duration.months;
  const subtotal = durationAmount + addOnAmount;

  return {
    kind, athleteSlotId, offerProductId,
    slotCode: kind === 'OFFLINE_SLOT' ? input.slotCode : undefined,
    slotName,
    duration: { code: duration.code, label: duration.label, months: duration.months, note: duration.note },
    saleMode: { code: saleMode.code, label: saleMode.label },
    startDate: input.startDate ? new Date(input.startDate) : null,
    addOns: picked, addOnAmount,
    scopes, rights,
    basePrice, durationAmount, subtotal,
    vatAmount: Math.round(subtotal * 0.1),
    total: subtotal + Math.round(subtotal * 0.1),
    status, conflictCode, conflictNote,
    pricingRule: getOptions().pricingRule,
  };
}

/** 단건 견적 (화면 안내용) */
export async function quote(input: ItemInput) {
  const a = await prisma.athlete.findUnique({
    where: { id: input.athleteId },
    select: { id: true, name: true, tour: true, profileImageUrl: true },
  });
  if (!a) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });
  return { athlete: a, ...(await priceItem(input)) };
}

/* ── 견적함 (§7) ────────────────────────────────────────── */

const DRAFT_INCLUDE = {
  items: {
    include: {
      athlete: { select: { id: true, name: true, tour: true, region: true, profileImageUrl: true } },
      offer: { select: { id: true, code: true, name: true, type: true } },
      hold: { select: { id: true, expiresAt: true, releasedAt: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

function shapeDraft(d: any) {
  const items = (d.items || []).map((i: any) => ({
    ...i,
    holdExpiresAt: i.hold && !i.hold.releasedAt ? i.hold.expiresAt : null,
  }));
  const supply = items.reduce((s: number, i: any) => s + i.subtotal, 0);
  const confirmed = items.filter((i: any) => i.status === 'OK').reduce((s: number, i: any) => s + i.subtotal, 0);
  const pending = supply - confirmed;
  const vat = Math.round(supply * 0.1);
  const athleteIds = [...new Set(items.map((i: any) => i.athleteId))];
  const holdEnds = items.map((i: any) => i.holdExpiresAt).filter(Boolean).map((x: any) => new Date(x).getTime());

  return {
    ...d,
    items,
    summary: {
      athleteCount: athleteIds.length,
      itemCount: items.length,
      supplyAmount: supply,
      vatAmount: vat,
      totalAmount: supply + vat,
      confirmedAmount: confirmed,
      pendingAmount: pending,
      monthlyEquivalent: items.reduce((s: number, i: any) => s + Math.round(i.subtotal / Math.max(1, i.months)), 0),
      holdExpiresAt: holdEnds.length ? new Date(Math.min(...holdEnds)) : null,
      hasConflict: items.some((i: any) => i.status === 'CONFLICT'),
      needsConfirmation: items.some((i: any) => i.status === 'NEEDS_CONFIRMATION'),
    },
  };
}

/** 활성 견적함 — 없으면 만든다 */
export async function getOrCreateDraft(brandUserId: string) {
  const existing = await prisma.directPickDraft.findFirst({
    where: { brandUserId, status: { in: ['CONFIGURING', 'HELD', 'VALIDATION_REQUIRED', 'READY_TO_REQUEST'] } },
    orderBy: { updatedAt: 'desc' },
    include: DRAFT_INCLUDE,
  });
  if (existing) return shapeDraft(existing);
  const created = await prisma.directPickDraft.create({ data: { brandUserId }, include: DRAFT_INCLUDE });
  return shapeDraft(created);
}

export async function getDraft(id: string, brandUserId: string) {
  const d = await prisma.directPickDraft.findUnique({ where: { id }, include: DRAFT_INCLUDE });
  if (!d) return null;
  if (d.brandUserId !== brandUserId) return 'FORBIDDEN' as const;
  return shapeDraft(d);
}

/** 항목 담기 — hold 생성까지 한 트랜잭션 (§6.4) */
export async function addItem(draftId: string, input: ItemInput, brandUserId: string, idempotencyKey?: string) {
  const draft = await prisma.directPickDraft.findUnique({
    where: { id: draftId },
    include: { items: { select: { athleteId: true, slotCode: true, offerProductId: true } } },
  });
  if (!draft) throw Object.assign(new Error('견적함을 찾을 수 없습니다'), { status: 404 });
  if (draft.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403 });
  if (draft.status === 'SUBMITTED' || draft.status === 'CONVERTED') {
    throw Object.assign(new Error('승인 요청 후에는 견적을 직접 수정할 수 없습니다'), { status: 409 });
  }

  const athleteIds = new Set(draft.items.map((i) => i.athleteId));
  if (!athleteIds.has(input.athleteId) && athleteIds.size >= MAX_ATHLETES_PER_DRAFT) {
    throw Object.assign(new Error(`한 견적에는 최대 ${MAX_ATHLETES_PER_DRAFT}명까지 담을 수 있습니다`), { status: 400 });
  }

  /* 이미 담은 항목인지 먼저 본다 — 내가 잡은 hold를 남의 선점으로 오인하면 안 된다 */
  const kind = input.kind || (input.offerCode ? 'ONLINE_PRODUCT' : 'OFFLINE_SLOT');
  if (kind === 'OFFLINE_SLOT' && input.slotCode) {
    if (draft.items.some((i) => i.athleteId === input.athleteId && i.slotCode === input.slotCode)) {
      throw Object.assign(new Error('이미 담은 항목입니다'), { status: 409 });
    }
  }

  const priced = await priceItem(input);
  if (priced.status === 'CONFLICT' && priced.conflictCode === 'SLOT_TAKEN') {
    throw Object.assign(new Error(priced.conflictNote || '방금 다른 브랜드가 선점했습니다'), { status: 409 });
  }

  if (kind === 'ONLINE_PRODUCT'
    && draft.items.some((i) => i.athleteId === input.athleteId && i.offerProductId === priced.offerProductId)) {
    throw Object.assign(new Error('이미 담은 항목입니다'), { status: 409 });
  }

  const key = idempotencyKey || `${draftId}:${input.athleteId}:${priced.slotCode || priced.offerProductId}`;
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.directPickItem.create({
      data: {
        draftId,
        athleteId: input.athleteId,
        kind: priced.kind,
        athleteSlotId: priced.athleteSlotId,
        slotCode: priced.slotCode,
        slotName: priced.slotName,
        offerProductId: priced.offerProductId,
        durationCode: priced.duration.code,
        months: priced.duration.months,
        startDate: priced.startDate,
        saleMode: priced.saleMode.code,
        addOns: priced.addOns as unknown as Prisma.InputJsonValue,
        scopes: priced.scopes as unknown as Prisma.InputJsonValue,
        basePrice: priced.basePrice,
        durationAmount: priced.durationAmount,
        addOnAmount: priced.addOnAmount,
        subtotal: priced.subtotal,
        status: priced.status,
        conflictCode: priced.conflictCode,
        conflictNote: priced.conflictNote,
      },
    });
    /* 오프라인 슬롯만 재고 점유가 필요하다 */
    if (priced.kind === 'OFFLINE_SLOT' && priced.athleteSlotId) {
      await tx.inventoryHold.create({
        data: { draftItemId: item.id, athleteSlotId: priced.athleteSlotId, brandUserId, expiresAt, idempotencyKey: key },
      });
    }
    await tx.directPickDraft.update({
      where: { id: draftId },
      data: {
        status: 'HELD',
        quoteVersion: `q-${Date.now()}`,
        quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000),
      },
    });
    return item;
  });

  return { item: created, draft: await getDraft(draftId, brandUserId) };
}

export async function updateItem(itemId: string, input: Partial<ItemInput>, brandUserId: string) {
  const item = await prisma.directPickItem.findUnique({
    where: { id: itemId },
    include: { draft: true, offer: true },
  });
  if (!item) throw Object.assign(new Error('항목을 찾을 수 없습니다'), { status: 404 });
  if (item.draft.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403 });
  if (item.draft.status === 'SUBMITTED' || item.draft.status === 'CONVERTED') {
    throw Object.assign(new Error('승인 요청 후에는 수정안(revision)을 만들어야 합니다'), { status: 409 });
  }

  const priced = await priceItem({
    athleteId: item.athleteId,
    kind: item.kind as any,
    slotCode: item.slotCode ?? undefined,
    offerCode: item.offer?.code,
    durationCode: input.durationCode ?? item.durationCode,
    startDate: input.startDate ?? item.startDate?.toISOString(),
    saleMode: input.saleMode ?? item.saleMode,
    addOns: input.addOns ?? ((item.addOns as any[]) || []).map((a) => ({ code: a.code, count: a.count })),
    scopes: input.scopes ?? ((item.scopes as string[]) || []),
  });

  await prisma.directPickItem.update({
    where: { id: itemId },
    data: {
      durationCode: priced.duration.code,
      months: priced.duration.months,
      startDate: priced.startDate,
      saleMode: priced.saleMode.code,
      addOns: priced.addOns as unknown as Prisma.InputJsonValue,
      scopes: priced.scopes as unknown as Prisma.InputJsonValue,
      basePrice: priced.basePrice,
      durationAmount: priced.durationAmount,
      addOnAmount: priced.addOnAmount,
      subtotal: priced.subtotal,
      status: priced.status,
      conflictCode: priced.conflictCode,
      conflictNote: priced.conflictNote,
    },
  });
  /* 가격·기간·권리가 바뀌면 재검증이 필요하다 (§7.3) */
  await prisma.directPickDraft.update({
    where: { id: item.draftId },
    data: { revision: { increment: 1 }, status: 'VALIDATION_REQUIRED' },
  });
  return getDraft(item.draftId, brandUserId);
}

export async function removeItem(itemId: string, brandUserId: string) {
  const item = await prisma.directPickItem.findUnique({ where: { id: itemId }, include: { draft: true } });
  if (!item) throw Object.assign(new Error('항목을 찾을 수 없습니다'), { status: 404 });
  if (item.draft.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403 });
  await prisma.directPickItem.delete({ where: { id: itemId } }); // hold는 cascade 삭제
  return getDraft(item.draftId, brandUserId);
}

/** 홀드 연장 — 결제 진입 시 1회 (§6.2) */
export async function extendHolds(draftId: string, brandUserId: string) {
  const draft = await getDraft(draftId, brandUserId);
  if (!draft || draft === 'FORBIDDEN') throw Object.assign(new Error('견적함을 찾을 수 없습니다'), { status: 404 });
  const now = new Date();
  const holds = await prisma.inventoryHold.findMany({
    where: { item: { draftId }, releasedAt: null, extendedAt: null },
    select: { id: true, expiresAt: true },
  });
  for (const h of holds) {
    const base = h.expiresAt > now ? h.expiresAt : now;
    await prisma.inventoryHold.update({
      where: { id: h.id },
      data: { expiresAt: new Date(base.getTime() + HOLD_EXTEND_MINUTES * 60_000), extendedAt: now },
    });
  }
  return { extended: holds.length, draft: await getDraft(draftId, brandUserId) };
}

/** hard validation — 승인 요청/결제 직전 (§6.1) */
export async function validateDraft(draftId: string, brandUserId: string) {
  const draft = await prisma.directPickDraft.findUnique({
    where: { id: draftId },
    include: { items: { include: { offer: true, hold: true } } },
  });
  if (!draft) throw Object.assign(new Error('견적함을 찾을 수 없습니다'), { status: 404 });
  if (draft.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403 });
  if (!draft.items.length) throw Object.assign(new Error('견적함이 비어 있습니다'), { status: 400 });

  const issues: { itemId: string; code: string; severity: 'ERROR' | 'WARN'; message: string; resolution: string }[] = [];
  const now = new Date();

  for (const item of draft.items) {
    const priced = await priceItem({
      athleteId: item.athleteId,
      kind: item.kind as any,
      slotCode: item.slotCode ?? undefined,
      offerCode: item.offer?.code,
      durationCode: item.durationCode,
      startDate: item.startDate?.toISOString(),
      saleMode: item.saleMode,
      addOns: ((item.addOns as any[]) || []).map((a) => ({ code: a.code, count: a.count })),
      scopes: (item.scopes as string[]) || [],
    }).catch(() => null);

    if (!priced) {
      issues.push({ itemId: item.id, code: 'ATHLETE_CLOSED', severity: 'ERROR', message: `${item.slotName} 판매가 중단되었습니다`, resolution: '항목을 삭제하거나 대체 위치를 선택하세요' });
      continue;
    }
    /* 내가 잡은 hold 때문에 SLOT_TAKEN이 뜨는 건 충돌이 아니다 */
    const mine = item.hold && !item.hold.releasedAt && item.hold.expiresAt > now;
    if (priced.status === 'CONFLICT' && !(priced.conflictCode === 'SLOT_TAKEN' && mine)) {
      issues.push({ itemId: item.id, code: priced.conflictCode || 'SLOT_TAKEN', severity: 'ERROR', message: priced.conflictNote || `${item.slotName}을(를) 선택할 수 없습니다`, resolution: '대체 위치를 선택하세요' });
    }
    if (priced.subtotal !== item.subtotal) {
      issues.push({ itemId: item.id, code: 'PRICE_CHANGED', severity: 'ERROR', message: `${item.slotName} 금액이 ${item.subtotal.toLocaleString()}원 → ${priced.subtotal.toLocaleString()}원으로 변경되었습니다`, resolution: '변경된 금액에 동의하면 계속 진행할 수 있습니다' });
    }
    if (item.kind === 'OFFLINE_SLOT' && !mine) {
      issues.push({ itemId: item.id, code: 'HOLD_EXPIRED', severity: 'ERROR', message: `${item.slotName} 임시 보유가 만료되었습니다`, resolution: '재고를 다시 확보한 뒤 진행하세요' });
    }
    if (priced.status === 'NEEDS_CONFIRMATION') {
      issues.push({ itemId: item.id, code: 'NEEDS_CONFIRMATION', severity: 'WARN', message: `${item.slotName}은(는) 선수 확인이 필요합니다`, resolution: '승인 요청 시 함께 확인됩니다' });
    }

    await prisma.directPickItem.update({
      where: { id: item.id },
      data: {
        basePrice: priced.basePrice, durationAmount: priced.durationAmount,
        addOnAmount: priced.addOnAmount, subtotal: priced.subtotal,
        status: mine && priced.conflictCode === 'SLOT_TAKEN' ? 'OK' : priced.status,
        conflictCode: mine && priced.conflictCode === 'SLOT_TAKEN' ? null : priced.conflictCode,
        conflictNote: mine && priced.conflictCode === 'SLOT_TAKEN' ? null : priced.conflictNote,
      },
    });
  }

  const hasError = issues.some((i) => i.severity === 'ERROR');
  await prisma.directPickDraft.update({
    where: { id: draftId },
    data: {
      status: hasError ? 'VALIDATION_REQUIRED' : 'READY_TO_REQUEST',
      quoteVersion: `q-${Date.now()}`,
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000),
    },
  });

  return { result: hasError ? 'CONFLICT' : 'READY', issues, draft: await getDraft(draftId, brandUserId) };
}

/** 대체안 제안 — 동일 선수 유사 위치 3개 (§6.3) */
export async function suggestAlternatives(itemId: string, brandUserId: string) {
  const item = await prisma.directPickItem.findUnique({ where: { id: itemId }, include: { draft: true } });
  if (!item) throw Object.assign(new Error('항목을 찾을 수 없습니다'), { status: 404 });
  if (item.draft.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403 });

  const { slots } = await getOffers(item.athleteId);
  const g = item.slotCode ? groupOf(item.slotCode)?.group : null;
  const open = slots.filter((s) => s.selectable && s.code !== item.slotCode);
  const sameGroup = open.filter((s) => s.group === g);
  const rest = open
    .filter((s) => s.group !== g)
    .sort((a, b) => Math.abs(a.price - item.basePrice) - Math.abs(b.price - item.basePrice));

  return { alternatives: [...sameGroup, ...rest].slice(0, 3) };
}

/** 견적함 → 승인 요청 (§8) — application.service를 재사용한다 */
export async function submitDraft(draftId: string, brandUserId: string, brandInfo?: any) {
  const check = await validateDraft(draftId, brandUserId);
  if (check.result === 'CONFLICT') {
    throw Object.assign(new Error('해결되지 않은 충돌이 있습니다'), { status: 409 });
  }
  const draft = check.draft as any;

  const { submitApplication } = await import('./application.service');
  const app = await submitApplication({
    sourceType: 'DIRECT_PICK',
    sourceId: draftId,
    planName: '직접 선택 PICK',
    items: draft.items.map((i: any) => ({
      athleteId: i.athleteId,
      slotCode: i.slotCode ?? undefined,
      slotName: i.slotName ?? undefined,
      role: i.kind === 'ONLINE_PRODUCT' ? '온라인 전용' : '착장',
      presetPrice: i.subtotal,
    })),
    snapshot: {
      draftId,
      revision: draft.revision,
      quoteVersion: draft.quoteVersion,
      brandInfo: brandInfo ?? null,
      items: draft.items.map((i: any) => ({
        athleteId: i.athleteId, kind: i.kind, slotCode: i.slotCode, slotName: i.slotName,
        durationCode: i.durationCode, months: i.months, saleMode: i.saleMode,
        addOns: i.addOns, scopes: i.scopes, subtotal: i.subtotal,
      })),
      summary: draft.summary,
    },
  } as any, brandUserId);

  await prisma.directPickDraft.update({
    where: { id: draftId },
    data: { status: 'SUBMITTED', applicationId: app.id, submittedAt: new Date() },
  });

  /* 승인 대기 동안 재고를 잡아 둔다 (§6.2) */
  await prisma.inventoryHold.updateMany({
    where: { item: { draftId }, releasedAt: null },
    data: { expiresAt: new Date(Date.now() + 72 * 3600_000) },
  });

  return { applicationId: app.id, application: app };
}

export async function listDrafts(brandUserId: string) {
  const drafts = await prisma.directPickDraft.findMany({
    where: { brandUserId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: DRAFT_INCLUDE,
  });
  return { drafts: drafts.map(shapeDraft) };
}

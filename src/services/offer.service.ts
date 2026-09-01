/**
 * 지금 가능한 후원 — 완성형 상품 조회 · 재고 · 가격 · 보관함/장바구니
 * (핸드오프 v1.0 2026-08-22)
 *
 * 원칙
 *  - `availableQty`는 구성요소별 가능 수량의 **최솟값**이다 (§9.1). 하나라도 부족하면 구매 차단.
 *  - 예상성과는 보장값이 아니다. 범위·근거·기준일·신뢰도를 함께 내보낸다 (§5.2).
 *  - 담기는 hold를 걸지 않는다. hold는 체크아웃 진입 때만 15분 (§6.1).
 *  - 확정가·사전승인·재고확보가 모두 유효할 때만 '바로 구매'를 제공한다 (§1.3 · §9.4).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/* ── 정책 상수 (§15.4 최종 정책 기본안) ───────────────── */
export const CHECKOUT_HOLD_MINUTES = 15;
export const CART_KEEP_DAYS = 30;
export const CART_KEEP_DAYS_GUEST = 7;
export const APPROVAL_SLA_HOURS = 72;
const VAT_RATE = 0.1;

export const OFFER_TYPES = [
  { code: 'EVENT_SLOT', label: '대회 노출', desc: '특정 대회의 착장 슬롯 중심' },
  { code: 'READY_NOW', label: '바로 시작', desc: '선수 사전승인·재고 확보 완료' },
  { code: 'ONLINE_SUBSCRIPTION', label: '온라인 구독', desc: '온라인 파트너 월 구독' },
  { code: 'CONTENT_PACKAGE', label: '콘텐츠 패키지', desc: '피드·릴스·스토리 묶음' },
  { code: 'LOCAL_ACTIVATION', label: '지역 상생', desc: '지역선수·매장방문·POP' },
  { code: 'FAN_COMMERCE', label: '팬 커머스', desc: '성장마켓·할인코드·팬참여' },
  { code: 'LIMITED_DROP', label: '한정 판매', desc: '잔여 슬롯·마감임박' },
  { code: 'AUCTION_LINK', label: '경매 연결', desc: '진행 중인 경매로 이동' },
  { code: 'CUSTOM_CURATED', label: '기획 상품', desc: '캠페인·ESG·행사 기획' },
] as const;

export const PURPOSES = ['인지', '콘텐츠', '구매', '지역', 'ESG', '팬참여'];

export const BUDGET_BANDS = [
  { code: 'B1', label: '30만원 이하', max: 300_000 },
  { code: 'B2', label: '30~60만원', min: 300_000, max: 600_000 },
  { code: 'B3', label: '60~100만원', min: 600_000, max: 1_000_000 },
  { code: 'B4', label: '100만원 이상', min: 1_000_000 },
];

/** 큐레이션 섹션 자동 규칙 (§4.2 · §8.4) */
export const SECTIONS = [
  { key: 'READY_NOW', label: '바로 시작 가능한 후원', desc: '사전승인·확정가·재고가 모두 확보된 상품' },
  { key: 'CLOSING_SOON', label: '곧 마감되는 기회', desc: '판매 종료 7일 이내 또는 재고 20% 이하' },
  { key: 'NEW', label: '새롭게 열린 상품', desc: '발행 14일 이내' },
  { key: 'LOW_BUDGET', label: '월 30만원 이하', desc: '소상공인·온라인 구독' },
  { key: 'EVENT', label: '대회별 후원', desc: '현재·예정 대회 기준' },
  { key: 'ONLINE_ONLY', label: '온라인 전용', desc: '오프라인 사용이 없는 상품' },
  { key: 'LOCAL', label: '지역과 함께 성장', desc: '지역선수·방문·POP·ESG' },
  { key: 'AUCTION', label: '현재 진행 경매', desc: '경매로 이동' },
] as const;

const OFFER_INCLUDE = {
  athletes: {
    include: { athlete: { select: { id: true, name: true, tour: true, region: true, profileImageUrl: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
  components: { orderBy: { sortOrder: 'asc' as const } },
  options: { orderBy: { sortOrder: 'asc' as const } },
};

/* ── 재고 계산 (§9.1) ───────────────────────────────── */

/**
 * 구성요소별 가능 수량의 최솟값을 구한다.
 * 슬롯 구성요소는 실제 슬롯 판매상태·hold까지 확인한다.
 */
async function computeAvailableQty(offer: any): Promise<{ qty: number; blockers: string[] }> {
  const blockers: string[] = [];
  if (offer.stockMode === 'UNLIMITED') return { qty: Number.MAX_SAFE_INTEGER, blockers };
  if (offer.stockMode === 'MANUAL') {
    return { qty: Math.max(0, offer.capacity - offer.reservedQty - offer.soldQty), blockers };
  }

  const base = Math.max(0, offer.capacity - offer.reservedQty - offer.soldQty);
  let qty = base;
  if (base === 0) blockers.push('상품 재고 소진');

  /* 슬롯 구성요소 — 하나라도 판매 불가면 0 */
  const slotComponents = (offer.components || []).filter(
    (c: any) => c.componentType === 'SLOT' && c.athleteSlotId,
  );
  if (slotComponents.length) {
    const now = new Date();
    const slotIds = slotComponents.map((c: any) => c.athleteSlotId);
    const [slots, busy, holds] = await Promise.all([
      prisma.athleteSlot.findMany({
        where: { id: { in: slotIds } },
        select: { id: true, saleEnabled: true, restrictionNote: true, slotTemplate: { select: { name: true } } },
      }),
      prisma.slotInventory.findMany({
        where: {
          athleteSlotId: { in: slotIds },
          endDate: { gte: now },
          status: { in: ['SOLD', 'PENDING_APPROVAL', 'HELD'] },
        },
        select: { athleteSlotId: true, status: true },
      }),
      prisma.inventoryHold.findMany({
        where: { athleteSlotId: { in: slotIds }, releasedAt: null, expiresAt: { gt: now } },
        select: { athleteSlotId: true },
      }),
    ]);
    const blocked = new Set([
      ...busy.map((b) => b.athleteSlotId),
      ...(holds.map((h) => h.athleteSlotId).filter(Boolean) as string[]),
    ]);
    for (const c of slotComponents) {
      const slot = slots.find((s) => s.id === c.athleteSlotId);
      if (!slot || !slot.saleEnabled || slot.restrictionNote) {
        qty = 0;
        blockers.push(`${c.label} 판매 중지`);
      } else if (blocked.has(c.athleteSlotId)) {
        qty = 0;
        blockers.push(`${c.label} 다른 계약·예약과 겹침`);
      }
    }
  }

  return { qty: Math.max(0, qty), blockers };
}

/** 사전승인이 아직 유효한가 (§9.4) */
function preApprovalValid(offer: any) {
  if (offer.approvalMode !== 'PRE_APPROVED' || !offer.preApprovedAt) return false;
  if (offer.preApprovalTo && new Date(offer.preApprovalTo) < new Date()) return false;
  if (offer.preApprovalMaxQty != null && offer.soldQty >= offer.preApprovalMaxQty) return false;
  return true;
}

/** 상품 1건의 계산된 판매 상태 — 목록·상세·검증이 모두 이 함수를 쓴다 */
export async function decorateOffer(offer: any) {
  const now = new Date();
  const { qty, blockers } = await computeAvailableQty(offer);
  const preApproved = preApprovalValid(offer);

  const expired = offer.salesTo ? new Date(offer.salesTo) < now : false;
  const daysLeft = offer.salesTo
    ? Math.ceil((new Date(offer.salesTo).getTime() - now.getTime()) / 86400_000)
    : null;
  const stockRatio = offer.capacity > 0 ? qty / offer.capacity : 1;

  /* 표시 상태 — 저장된 status를 계산 결과로 보정한다 (§3.5) */
  let display = offer.status;
  if (offer.status === 'PUBLISHED') {
    if (expired) display = 'EXPIRED';
    else if (qty <= 0) display = 'SOLD_OUT';
    else if ((daysLeft != null && daysLeft <= 7) || stockRatio <= 0.2) display = 'LOW_STOCK';
  }

  const sellable = display === 'PUBLISHED' || display === 'LOW_STOCK';
  const vat = Math.round(offer.supplyAmount * VAT_RATE);

  /* 허용 행동 (§13.2 allowedActions) */
  const allowedActions: string[] = [];
  if (sellable) {
    allowedActions.push('SAVE');
    if (offer.priceType === 'AUCTION') allowedActions.push('AUCTION');
    else if (offer.priceType === 'NEGOTIABLE') allowedActions.push('NEGOTIATE', 'ADD');
    else {
      allowedActions.push('ADD');
      if (preApproved && offer.priceType !== 'SUBSCRIPTION') allowedActions.push('BUY');
      else allowedActions.push('REQUEST');
      if (offer.priceType === 'SUBSCRIPTION') allowedActions.push('REQUEST');
    }
  } else if (display === 'SOLD_OUT') {
    allowedActions.push('NOTIFY');
  }

  /* 배지 */
  const badges: string[] = [];
  if (preApproved && sellable && offer.priceType === 'FIXED') badges.push('즉시구매');
  if (!preApproved && sellable && offer.approvalMode === 'ATHLETE_APPROVAL') badges.push('선수확인');
  if (offer.priceType === 'NEGOTIABLE') badges.push('조건협의');
  if (offer.priceType === 'SUBSCRIPTION') badges.push('정기후원');
  if (!offer.offlineUse) badges.push('온라인전용');
  if (display === 'LOW_STOCK') badges.push('마감임박');
  if (offer.publishedAt && now.getTime() - new Date(offer.publishedAt).getTime() <= 14 * 86400_000) badges.push('신규');

  return {
    ...offer,
    availableQty: offer.stockMode === 'UNLIMITED' ? null : qty,
    stockBlockers: blockers,
    preApproved,
    displayStatus: display,
    sellable,
    daysLeft,
    vatAmount: vat,
    totalAmount: offer.supplyAmount + vat,
    monthlyAmount: offer.months > 1 ? Math.round(offer.supplyAmount / offer.months) : offer.supplyAmount,
    allowedActions,
    badges,
    /* 성과는 보장이 아니라는 사실을 응답에 못박는다 (§5.2) */
    expectedPerformance: offer.expectedMetrics
      ? {
          metrics: offer.expectedMetrics,
          methodology: offer.methodology,
          methodVersion: offer.methodVersion,
          confidence: offer.confidence,
          dataAsOf: offer.dataAsOf,
          guaranteed: offer.guaranteed,
          assumptions: offer.assumptions,
          disclaimer: '과거 데이터 기반 추정치이며 실제 성과를 보장하지 않습니다.',
        }
      : null,
  };
}

/* ── 목록 (§4) ──────────────────────────────────────── */

export interface ListParams {
  q?: string;
  purpose?: string;
  budget?: string;
  duration?: string;
  mode?: string; // OFFLINE | ONLINE | CONTENT | VISIT | MARKET | MIXED
  state?: string; // BUY_NOW | NEEDS_APPROVAL | NEGOTIABLE | AUCTION | CLOSING
  section?: string;
  sort?: string; // CLOSING | PRICE_ASC | RECENT | POPULAR | DURATION
  limit?: number;
}

export async function listOffers(params: ListParams) {
  const now = new Date();
  const rows = await prisma.offer.findMany({
    where: {
      status: { in: ['PUBLISHED', 'LOW_STOCK', 'PAUSED', 'SOLD_OUT'] },
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' } },
              { subtitle: { contains: params.q, mode: 'insensitive' } },
              { athletes: { some: { athlete: { name: { contains: params.q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
      ...(params.purpose ? { purposes: { has: params.purpose } } : {}),
      ...(params.duration ? { durationCode: params.duration } : {}),
    },
    include: OFFER_INCLUDE,
    take: 200,
  });

  let list = await Promise.all(rows.map(decorateOffer));

  /* SOLD_OUT·PAUSED는 기본 목록에서 제외하되 상세는 유지한다 (§4.4) */
  list = list.filter((o) => o.sellable || params.state === 'ALL');

  if (params.budget) {
    const band = BUDGET_BANDS.find((b) => b.code === params.budget);
    if (band) {
      list = list.filter((o) => {
        const v = o.monthlyAmount;
        return (band.min == null || v >= band.min) && (band.max == null || v <= band.max);
      });
    }
  }
  if (params.mode === 'ONLINE') list = list.filter((o) => !o.offlineUse);
  if (params.mode === 'OFFLINE') list = list.filter((o) => o.offlineUse);
  if (params.mode === 'CONTENT') list = list.filter((o) => o.components.some((c: any) => c.componentType === 'CONTENT'));
  if (params.mode === 'VISIT') list = list.filter((o) => o.components.some((c: any) => c.componentType === 'VISIT'));
  if (params.mode === 'MARKET') list = list.filter((o) => o.components.some((c: any) => c.componentType === 'MARKET'));

  if (params.state === 'BUY_NOW') list = list.filter((o) => o.allowedActions.includes('BUY'));
  if (params.state === 'NEEDS_APPROVAL') list = list.filter((o) => o.allowedActions.includes('REQUEST') && !o.allowedActions.includes('BUY'));
  if (params.state === 'NEGOTIABLE') list = list.filter((o) => o.priceType === 'NEGOTIABLE');
  if (params.state === 'AUCTION') list = list.filter((o) => o.priceType === 'AUCTION');
  if (params.state === 'ONLINE_ONLY') list = list.filter((o) => !o.offlineUse);
  if (params.state === 'CLOSING') list = list.filter((o) => o.displayStatus === 'LOW_STOCK');

  if (params.section) list = list.filter((o) => matchSection(o, params.section!, now));

  const sorters: Record<string, (a: any, b: any) => number> = {
    CLOSING: (a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999),
    PRICE_ASC: (a, b) => a.monthlyAmount - b.monthlyAmount,
    RECENT: (a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime(),
    POPULAR: (a, b) => (b.detailCount + b.saveCount * 3) - (a.detailCount + a.saveCount * 3),
    DURATION: (a, b) => a.months - b.months,
  };
  list.sort(sorters[params.sort || 'RECENT'] || sorters.RECENT);

  const limit = Math.min(params.limit || 24, 60);

  /* 탭 카운트 — 필터 적용 전 전체 기준 */
  const all = (await Promise.all(rows.map(decorateOffer))).filter((o) => o.sellable);
  return {
    offers: list.slice(0, limit),
    total: list.length,
    counts: {
      ALL: all.length,
      BUY_NOW: all.filter((o) => o.allowedActions.includes('BUY')).length,
      NEEDS_APPROVAL: all.filter((o) => o.allowedActions.includes('REQUEST') && !o.allowedActions.includes('BUY')).length,
      ONLINE_ONLY: all.filter((o) => !o.offlineUse).length,
      CLOSING: all.filter((o) => o.displayStatus === 'LOW_STOCK').length,
    },
  };
}

function matchSection(o: any, key: string, now: Date) {
  switch (key) {
    case 'READY_NOW': return o.allowedActions.includes('BUY');
    case 'CLOSING_SOON': return o.displayStatus === 'LOW_STOCK';
    case 'NEW': return !!o.publishedAt && now.getTime() - new Date(o.publishedAt).getTime() <= 14 * 86400_000;
    case 'LOW_BUDGET': return o.monthlyAmount <= 300_000;
    case 'EVENT': return o.type === 'EVENT_SLOT';
    case 'ONLINE_ONLY': return !o.offlineUse;
    case 'LOCAL': return o.type === 'LOCAL_ACTIVATION' || o.purposes.includes('지역');
    case 'AUCTION': return o.priceType === 'AUCTION';
    default: return true;
  }
}

/** 랜딩 섹션 — 관리자 배치가 있으면 그것을 우선한다 (§8.2) */
export async function getSections(surface = 'SPONSOR_LANDING', keys?: string[]) {
  const now = new Date();
  const wanted = keys?.length ? keys : ['READY_NOW', 'CLOSING_SOON', 'ONLINE_ONLY'];

  const placements = await prisma.offerPlacement.findMany({
    where: {
      surface,
      sectionKey: { in: wanted },
      status: 'ACTIVE',
      OR: [{ activeFrom: null }, { activeFrom: { lte: now } }],
      AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: now } }] }],
    },
    include: { offer: { include: OFFER_INCLUDE } },
    orderBy: [{ pinned: 'desc' }, { rank: 'asc' }],
  });

  const sections = [];
  for (const key of wanted) {
    const def = SECTIONS.find((s) => s.key === key)!;
    const pinned = placements.filter((p) => p.sectionKey === key);
    let offers = await Promise.all(pinned.map((p) => decorateOffer(p.offer)));
    offers = offers.filter((o) => o.sellable);

    /* 배치가 없거나 모자라면 자동 규칙으로 채운다 */
    if (offers.length < 3) {
      const auto = await listOffers({ section: key, sort: key === 'CLOSING_SOON' ? 'CLOSING' : 'RECENT', limit: 6 });
      const have = new Set(offers.map((o) => o.id));
      for (const o of auto.offers) {
        if (offers.length >= 3) break;
        if (!have.has(o.id)) offers.push(o);
      }
    }
    sections.push({
      key,
      label: def.label,
      desc: def.desc,
      offers: offers.slice(0, 3),
      sponsored: pinned.filter((p) => p.isSponsored).map((p) => p.offerId),
    });
  }
  return { sections };
}

/* ── 상세 (§5) ──────────────────────────────────────── */

export async function getOffer(idOrSlug: string, opts?: { countView?: boolean }) {
  const offer = await prisma.offer.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }, { code: idOrSlug }] },
    include: OFFER_INCLUDE,
  });
  if (!offer) return null;
  if (opts?.countView) {
    await prisma.offer.update({ where: { id: offer.id }, data: { detailCount: { increment: 1 } } }).catch(() => null);
  }
  const decorated = await decorateOffer(offer);

  /* 선수 요약 — 퀵프로필 레이어용 (§5.1 4번) */
  const athleteIds = offer.athletes.map((a) => a.athleteId);
  const temps = athleteIds.length
    ? await prisma.fanTemperatureEvent.groupBy({
        by: ['athleteId'], where: { athleteId: { in: athleteIds } }, _sum: { deltaMilli: true },
      })
    : [];
  const tempMap = new Map(temps.map((t) => [t.athleteId, (t._sum.deltaMilli || 0) / 1000]));

  return {
    ...decorated,
    athletes: offer.athletes.map((a) => ({
      ...a,
      athlete: { ...a.athlete, fanTemp: tempMap.get(a.athleteId) ?? 0 },
    })),
    /* 실행 일정 — 승인 → 소재 → 제작 → 게시/출전 → 리포트 (§5.1 8번) */
    executionSteps: buildExecutionSteps(offer),
  };
}

function buildExecutionSteps(offer: any) {
  const start = offer.executionFrom ? new Date(offer.executionFrom) : null;
  const step = (days: number) => (start ? new Date(start.getTime() - days * 86400_000) : null);
  return [
    { key: 'APPROVAL', label: '승인', at: step(offer.leadTimeDays + 7) },
    { key: 'ASSET', label: '소재 제출', at: step(offer.leadTimeDays + 3) },
    { key: 'PRODUCTION', label: '패치·이미지 제작', at: step(offer.leadTimeDays) },
    { key: 'LIVE', label: '게시 · 출전', at: start },
    { key: 'REPORT', label: '성과 리포트', at: offer.executionTo ? new Date(new Date(offer.executionTo).getTime() + 14 * 86400_000) : null },
  ];
}

/* ── 옵션 가격 (§13.1 POST /offers/:id/quote) ───────── */

export interface QuoteInput {
  offerId: string;
  quantity?: number;
  startDate?: string;
  options?: Record<string, any>;
}

export async function quoteOffer(input: QuoteInput) {
  const offer = await prisma.offer.findUnique({ where: { id: input.offerId }, include: OFFER_INCLUDE });
  if (!offer) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });

  const d = await decorateOffer(offer);
  const qty = Math.max(1, Math.min(input.quantity || 1, d.availableQty ?? 99));

  /* 허용된 옵션만 가격에 반영한다 (§3.4 · OPTION_INVALID) */
  const picked: { code: string; label: string; value: any; addPrice: number }[] = [];
  for (const opt of offer.options) {
    const v = input.options?.[opt.code];
    if (v == null || v === false) {
      if (opt.required && opt.kind !== 'BRAND_INPUT') {
        throw Object.assign(new Error(`${opt.label}은(는) 필수 선택입니다`), { status: 400, code: 'OPTION_INVALID' });
      }
      continue;
    }
    if (opt.kind === 'SELECT_ONE') {
      const choices = (opt.choices as any[]) || [];
      const found = choices.find((c: any) => c.value === v || c === v);
      if (!found) throw Object.assign(new Error(`${opt.label} 선택값이 올바르지 않습니다`), { status: 400, code: 'OPTION_INVALID' });
      picked.push({ code: opt.code, label: opt.label, value: v, addPrice: found.addPrice ?? 0 });
    } else if (opt.kind === 'ADD_ON') {
      picked.push({ code: opt.code, label: opt.label, value: true, addPrice: opt.addPrice });
    } else if (opt.kind === 'QUANTITY') {
      const n = Math.max(opt.minQty ?? 1, Math.min(opt.maxQty ?? 99, Number(v) || 1));
      picked.push({ code: opt.code, label: opt.label, value: n, addPrice: opt.addPrice * n });
    } else if (opt.kind === 'BRAND_INPUT' || opt.kind === 'NEGOTIABLE') {
      picked.push({ code: opt.code, label: opt.label, value: v, addPrice: 0 });
    }
  }

  const optionAmount = picked.reduce((s, o) => s + o.addPrice, 0);
  const supply = (offer.supplyAmount + optionAmount) * qty;
  const vat = Math.round(supply * VAT_RATE);

  /* 시작일 — lead time 이전은 선택할 수 없다 (§5.4 · §7.3) */
  let startDate: Date | null = null;
  if (input.startDate) {
    startDate = new Date(input.startDate);
    const earliest = new Date(Date.now() + offer.leadTimeDays * 86400_000);
    if (startDate < earliest) {
      throw Object.assign(
        new Error(`제작 리드타임 ${offer.leadTimeDays}일을 고려해 ${earliest.toLocaleDateString('ko-KR')} 이후로 선택해주세요`),
        { status: 400, code: 'OPTION_INVALID' },
      );
    }
  }

  return {
    offerId: offer.id,
    offerVersion: offer.version,
    priceType: offer.priceType,
    quantity: qty,
    startDate,
    options: picked,
    optionAmount,
    supplyAmount: supply,
    vatAmount: vat,
    totalAmount: supply + vat,
    monthlyAmount: offer.months > 1 ? Math.round(supply / offer.months) : supply,
    availableQty: d.availableQty,
    allowedActions: d.allowedActions,
    displayStatus: d.displayStatus,
  };
}

/* ── 보관함 (§6.1) ──────────────────────────────────── */

export async function listSaved(brandUserId: string) {
  const rows = await prisma.savedOffer.findMany({
    where: { brandUserId },
    include: { offer: { include: OFFER_INCLUDE } },
    orderBy: { createdAt: 'desc' },
  });
  return { saved: await Promise.all(rows.map(async (r) => ({ id: r.id, savedAt: r.createdAt, offer: await decorateOffer(r.offer) }))) };
}

export async function saveOffer(brandUserId: string, offerId: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true } });
  if (!offer) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  try {
    await prisma.savedOffer.create({ data: { brandUserId, offerId } });
    await prisma.offer.update({ where: { id: offerId }, data: { saveCount: { increment: 1 } } });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e; // 이미 담았으면 조용히 넘어간다
  }
  return listSaved(brandUserId);
}

export async function unsaveOffer(brandUserId: string, offerId: string) {
  await prisma.savedOffer.deleteMany({ where: { brandUserId, offerId } });
  return listSaved(brandUserId);
}

/* ── 장바구니 · 주문군 (§6.2 · §6.4) ────────────────── */

/** 주문군 판정 — 함께 결제할 수 있는지를 이 값으로 가른다 */
export function orderGroupOf(o: any): 'A_IMMEDIATE' | 'B_APPROVAL' | 'C_NEGOTIATION' | 'D_AUCTION' | 'E_SUBSCRIPTION' {
  if (o.priceType === 'AUCTION') return 'D_AUCTION';
  if (o.priceType === 'NEGOTIABLE') return 'C_NEGOTIATION';
  if (o.priceType === 'SUBSCRIPTION') return 'E_SUBSCRIPTION';
  return o.preApproved ? 'A_IMMEDIATE' : 'B_APPROVAL';
}

export const ORDER_GROUPS = [
  { key: 'A_IMMEDIATE', label: '즉시결제 가능', desc: '즉시 결제가 가능한 상품입니다.', payable: true },
  { key: 'B_APPROVAL', label: '선수 승인 필요', desc: '선수의 승인이 필요한 상품입니다.', payable: false },
  { key: 'C_NEGOTIATION', label: '조건 협의', desc: '상품 조건에 대한 협의가 필요한 상품입니다.', payable: false },
  { key: 'D_AUCTION', label: '경매 · 별도 결제', desc: '경매 상품 또는 별도 결제가 필요한 상품입니다.', payable: false },
  { key: 'E_SUBSCRIPTION', label: '월 구독', desc: '약정과 자동결제가 적용되는 상품입니다.', payable: false },
] as const;

export async function getCart(brandUserId: string) {
  const items = await prisma.offerCartItem.findMany({
    where: { brandUserId },
    include: { offer: { include: OFFER_INCLUDE } },
    orderBy: { createdAt: 'asc' },
  });

  const lines: any[] = [];
  for (const it of items) {
    const d = await decorateOffer(it.offer);
    let quote: any = null;
    let issue: { code: string; message: string } | null = null;
    try {
      quote = await quoteOffer({
        offerId: it.offerId,
        quantity: it.quantity,
        startDate: it.startDate?.toISOString(),
        options: (it.options as any) || {},
      });
    } catch (e: any) {
      issue = { code: e?.code || 'OPTION_INVALID', message: e?.message || '옵션을 다시 확인해주세요' };
    }
    if (!d.sellable) {
      issue = d.displayStatus === 'SOLD_OUT'
        ? { code: 'SOLD_OUT', message: '재고가 소진되었습니다' }
        : d.displayStatus === 'EXPIRED'
          ? { code: 'OFFER_EXPIRED', message: '판매가 종료되었습니다' }
          : { code: 'DATA_STALE', message: '현재 구매할 수 없는 상품입니다' };
    } else if (quote && quote.supplyAmount !== it.quotedAmount) {
      issue = { code: 'PRICE_CHANGED', message: `금액이 ${it.quotedAmount.toLocaleString()}원 → ${quote.supplyAmount.toLocaleString()}원으로 변경되었습니다` };
    }

    lines.push({
      id: it.id,
      quantity: it.quantity,
      startDate: it.startDate,
      options: it.options,
      quotedAmount: it.quotedAmount,
      currentAmount: quote?.supplyAmount ?? null,
      vatAmount: quote?.vatAmount ?? null,
      group: orderGroupOf(d),
      issue,
      offer: d,
    });
  }

  const groups = ORDER_GROUPS.map((g) => {
    const gl = lines.filter((l) => l.group === g.key);
    const supply = gl.reduce((s, l) => s + (l.currentAmount ?? 0), 0);
    return {
      ...g,
      items: gl,
      count: gl.length,
      supplyAmount: supply,
      vatAmount: Math.round(supply * VAT_RATE),
      totalAmount: supply + Math.round(supply * VAT_RATE),
    };
  });

  const payable = groups.find((g) => g.key === 'A_IMMEDIATE')!;
  return {
    lines,
    groups,
    summary: {
      itemCount: lines.length,
      /* 지금 결제 가능 / 승인 후 결제 / 협의 중 금액을 분리한다 (§6.2) */
      payableAmount: payable.totalAmount,
      approvalAmount: groups.find((g) => g.key === 'B_APPROVAL')!.totalAmount,
      negotiationAmount: groups.find((g) => g.key === 'C_NEGOTIATION')!.totalAmount,
      subscriptionAmount: groups.find((g) => g.key === 'E_SUBSCRIPTION')!.totalAmount,
      hasIssue: lines.some((l) => l.issue),
    },
  };
}

export async function addToCart(
  brandUserId: string,
  input: { offerId: string; quantity?: number; startDate?: string; options?: Record<string, any> },
) {
  const quote = await quoteOffer(input as QuoteInput);
  const startDate = input.startDate ? new Date(input.startDate) : null;

  /* 같은 상품·같은 시작일이면 수량을 합친다 (§6.4) */
  const existing = await prisma.offerCartItem.findFirst({
    where: {
      brandUserId,
      offerId: input.offerId,
      startDate: startDate ?? null,
    },
  });

  if (existing) {
    const merged = existing.quantity + (input.quantity || 1);
    const re = await quoteOffer({ ...input, quantity: merged } as QuoteInput);
    await prisma.offerCartItem.update({
      where: { id: existing.id },
      data: { quantity: re.quantity, quotedAmount: re.supplyAmount, quotedAt: new Date(), options: (input.options ?? undefined) as Prisma.InputJsonValue },
    });
  } else {
    await prisma.offerCartItem.create({
      data: {
        brandUserId,
        offerId: input.offerId,
        quantity: quote.quantity,
        startDate,
        options: (input.options ?? undefined) as Prisma.InputJsonValue,
        quotedAmount: quote.supplyAmount,
      },
    });
  }
  /* 보관함에 있던 상품이면 장바구니로 옮긴다 */
  await prisma.savedOffer.deleteMany({ where: { brandUserId, offerId: input.offerId } });
  return getCart(brandUserId);
}

export async function updateCartItem(
  itemId: string,
  brandUserId: string,
  patch: { quantity?: number; startDate?: string; options?: Record<string, any> },
) {
  const item = await prisma.offerCartItem.findUnique({ where: { id: itemId } });
  if (!item) throw Object.assign(new Error('항목을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  if (item.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403, code: 'FORBIDDEN' });

  const quote = await quoteOffer({
    offerId: item.offerId,
    quantity: patch.quantity ?? item.quantity,
    startDate: patch.startDate ?? item.startDate?.toISOString(),
    options: patch.options ?? ((item.options as any) || {}),
  });
  await prisma.offerCartItem.update({
    where: { id: itemId },
    data: {
      quantity: quote.quantity,
      startDate: patch.startDate ? new Date(patch.startDate) : item.startDate,
      options: (patch.options ?? (item.options as any) ?? undefined) as Prisma.InputJsonValue,
      quotedAmount: quote.supplyAmount,
      quotedAt: new Date(),
    },
  });
  return getCart(brandUserId);
}

export async function removeCartItem(itemId: string, brandUserId: string, keepSaved = false) {
  const item = await prisma.offerCartItem.findUnique({ where: { id: itemId } });
  if (!item) throw Object.assign(new Error('항목을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  if (item.brandUserId !== brandUserId) throw Object.assign(new Error('권한이 없습니다'), { status: 403, code: 'FORBIDDEN' });
  await prisma.offerCartItem.delete({ where: { id: itemId } });
  if (keepSaved) await saveOffer(brandUserId, item.offerId).catch(() => null);
  return getCart(brandUserId);
}

/* ── 주문 전환 (§10) — 승인·계약·결제는 공통 모듈 재사용 ── */

/**
 * 선택한 장바구니 항목을 하나의 신청(SponsorshipApplication)으로 만든다.
 * 같은 주문군만 함께 처리한다 (CART_GROUP_MISMATCH).
 */
export async function checkoutCart(
  brandUserId: string,
  input: { itemIds: string[]; brandInfo?: any },
) {
  if (!input.itemIds?.length) throw Object.assign(new Error('결제할 상품을 선택해주세요'), { status: 400, code: 'INVALID_REQUEST' });

  const cart = await getCart(brandUserId);
  const chosen = cart.lines.filter((l) => input.itemIds.includes(l.id));
  if (!chosen.length) throw Object.assign(new Error('선택한 상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });

  const groups = new Set(chosen.map((l) => l.group));
  if (groups.size > 1) {
    throw Object.assign(new Error('주문군이 다른 상품은 함께 결제할 수 없습니다'), { status: 409, code: 'CART_GROUP_MISMATCH' });
  }
  const blocked = chosen.find((l) => l.issue);
  if (blocked) {
    throw Object.assign(new Error(blocked.issue!.message), { status: 409, code: blocked.issue!.code });
  }

  /* 상품 1건 = 신청 항목 1건. 선수는 상품의 대표 선수를 쓴다 */
  const items = chosen.flatMap((l) =>
    l.offer.athletes.map((a: any, idx: number) => ({
      athleteId: a.athleteId,
      slotCode: l.offer.components.find((c: any) => c.componentType === 'SLOT' && c.athleteId === a.athleteId)?.slotCode ?? undefined,
      slotName: `${l.offer.title}${l.offer.athletes.length > 1 ? ` · ${a.athlete.name}` : ''}`,
      role: l.offer.offlineUse ? '착장' : '온라인 전용',
      /* 금액은 대표 선수에게 몰아 담고 나머지는 0으로 둔다 (계약 라인은 상품 단위) */
      presetPrice: idx === 0 ? (l.currentAmount ?? 0) : 0,
    })),
  );

  const { submitApplication } = await import('./application.service');
  const app = await submitApplication({
    sourceType: 'DIRECT_PICK',
    sourceId: `offer-cart:${chosen.map((c) => c.offer.id).join(',')}`,
    planName: '지금 가능한 후원',
    items,
    snapshot: {
      channel: 'AVAILABLE_OFFERS',
      orderGroup: [...groups][0],
      brandInfo: input.brandInfo ?? null,
      offers: chosen.map((l) => ({
        offerId: l.offer.id,
        offerVersion: l.offer.version,
        code: l.offer.code,
        title: l.offer.title,
        priceType: l.offer.priceType,
        quantity: l.quantity,
        startDate: l.startDate,
        options: l.options,
        supplyAmount: l.currentAmount,
        components: l.offer.components.map((c: any) => ({ type: c.componentType, label: c.label, quantity: c.quantity })),
        rights: {
          offlineUse: l.offer.offlineUse, onlineUse: l.offer.onlineUse,
          printUse: l.offer.printUse, secondaryUse: l.offer.secondaryUse, territory: l.offer.territory,
        },
        expectedPerformance: l.offer.expectedPerformance,
      })),
    },
  } as any, brandUserId);

  /* 재고 예약 + 장바구니 정리 */
  await prisma.$transaction([
    ...chosen.map((l) =>
      prisma.offer.update({ where: { id: l.offer.id }, data: { reservedQty: { increment: l.quantity } } })),
    prisma.offerCartItem.deleteMany({ where: { id: { in: input.itemIds }, brandUserId } }),
  ]);

  return { applicationId: app.id, orderGroup: [...groups][0], application: app };
}

export { OFFER_INCLUDE };

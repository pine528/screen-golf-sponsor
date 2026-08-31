/**
 * 직접 PICK — 선수 · 슬롯 · 후원 구성 (리디자인 v2.0 시안 img_12~14)
 *
 * 원칙
 *  - 금액은 항상 서버에서 재계산한다 (§14.4). 클라이언트가 보낸 금액은 쓰지 않는다.
 *  - 노출 지표·성과 수치는 실측된 값만 내보낸다 (LEG-06). 미수집은 null.
 *  - 결제는 선수 승인 이후에만 (RP-06 / UX-04) — 신청은 application.service를 재사용한다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ────────────────────────────────────────────────────────────
 * 정책 상수 — 화면·견적이 모두 여기만 본다.
 * 기간 요금은 "슬롯 월 단가 × 개월수"의 선형 규칙이며,
 * 대회 1회는 1개월 단가를 기준으로 한다. (운영 확정 시 이 표만 고친다)
 * ──────────────────────────────────────────────────────────── */
export const DURATIONS = [
  { code: 'SINGLE_EVENT', label: '대회 1회', months: 1, note: '1개월 단가 기준' },
  { code: 'DAYS_30', label: '30일', months: 1, note: null },
  { code: 'MONTHS_6', label: '6개월', months: 6, note: null },
  { code: 'MONTHS_12', label: '12개월', months: 12, note: null },
] as const;

export const PRODUCT_TYPES = [
  { code: 'APPAREL', label: '착장', desc: '경기복 · 모자 · 장비 로고 노출' },
  { code: 'SNS', label: 'SNS', desc: '선수 채널 콘텐츠 연계' },
  { code: 'STORE', label: '매장 · 방문', desc: '매장 방문 · 레슨 · 프로암' },
  { code: 'BUNDLE', label: '통합 패키지', desc: '착장 + SNS + 현장 활동' },
] as const;

/** 추가 활동 요율 — 시안 명시 기준가. 선수 승인 시 최종 확정된다. */
export const ADD_ONS = [
  { code: 'SNS_STORY', label: 'SNS 스토리', price: 150_000 },
  { code: 'SNS_FEED', label: 'SNS 피드', price: 300_000 },
  { code: 'STORE_VISIT', label: '매장 방문', price: 300_000 },
  { code: 'EVENT_ATTEND', label: '행사 참석', price: 700_000 },
  { code: 'PRODUCT_REVIEW', label: '제품 사용 후기', price: 300_000 },
] as const;

/** 구매 방식 — 6·12개월 장기 상품은 경매를 허용하지 않는다 (스키마 정책) */
export const TRANSACTION_TYPES = [
  { code: 'BUY_NOW', label: '직접구매', desc: '표시 금액으로 바로 신청' },
  { code: 'AUCTION', label: '경매 참여', desc: '진행 중인 경매에 입찰' },
  { code: 'PROPOSAL', label: '장기 파트너십 제안', desc: '조건을 제안하고 협의' },
] as const;

const AUCTION_BLOCKED_DURATIONS = ['MONTHS_6', 'MONTHS_12'];

export function getOptions() {
  return {
    durations: DURATIONS,
    productTypes: PRODUCT_TYPES,
    addOns: ADD_ONS,
    transactionTypes: TRANSACTION_TYPES,
    auctionBlockedDurations: AUCTION_BLOCKED_DURATIONS,
    pricingRule: '슬롯 월 단가 × 기간(개월) + 추가 활동',
  };
}

/* ── 1단계: 선수 목록 ─────────────────────────────────────── */

export async function listPickAthletes(params: { q?: string; tour?: string; region?: string; limit?: number }) {
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
      isRecommended: true, recommendOrder: true, snsStats: true,
    },
    orderBy: [{ isRecommended: 'desc' }, { recommendOrder: 'asc' }, { name: 'asc' }],
    take: Math.min(params.limit || 60, 100),
  });
  if (!athletes.length) return { athletes: [] };

  const ids = athletes.map((a) => a.id);
  const slots = await prisma.athleteSlot.findMany({
    where: { athleteId: { in: ids }, saleEnabled: true },
    select: { athleteId: true, basePrice: true },
  });
  const digital = await prisma.athleteDigitalInventory.findMany({
    where: { athleteId: { in: ids }, isOpen: true },
    select: { athleteId: true },
  });
  const digitalSet = new Set(digital.map((d) => d.athleteId));

  const byAthlete = new Map<string, number[]>();
  for (const s of slots) {
    const arr = byAthlete.get(s.athleteId) || [];
    arr.push(s.basePrice);
    byAthlete.set(s.athleteId, arr);
  }

  return {
    athletes: athletes
      .map((a) => {
        const prices = byAthlete.get(a.id) || [];
        return {
          ...a,
          slotCount: prices.length,
          minSlotPrice: prices.length ? Math.min(...prices) : null,
          hasDigitalPartner: digitalSet.has(a.id),
        };
      })
      .filter((a) => a.slotCount > 0),
  };
}

/* ── 선수 상세 패널 (img_12 우측) ─────────────────────────── */

export async function getPickAthlete(athleteId: string) {
  const a = await prisma.athlete.findFirst({
    where: { id: athleteId, isActive: true },
    select: {
      id: true, name: true, tour: true, region: true, profileImageUrl: true, bio: true,
      height: true, debutYear: true, affiliation: true, activityFields: true,
      snsStats: true, tourQualification: true,
    },
  });
  if (!a) return null;

  const [results, slots, digital] = await Promise.all([
    prisma.athleteEventResult.findMany({
      where: { athleteId, status: 'APPROVED' },
      orderBy: [{ eventDate: 'desc' }],
      take: 5,
      select: { eventName: true, eventDate: true, rank: true, tour: true },
    }),
    prisma.athleteSlot.findMany({
      where: { athleteId, saleEnabled: true },
      select: { basePrice: true },
    }),
    prisma.athleteDigitalInventory.findMany({
      where: { athleteId, isOpen: true },
      select: { planCode: true },
    }),
  ]);

  let digitalMinPrice: number | null = null;
  if (digital.length) {
    const plans = await prisma.digitalPlan.findMany({
      where: { code: { in: digital.map((d) => d.planCode) }, active: true },
      select: { monthlyPrice: true },
    });
    digitalMinPrice = plans.length ? Math.min(...plans.map((p) => p.monthlyPrice)) : null;
  }

  return {
    athlete: a,
    recentResults: results,
    minSlotPrice: slots.length ? Math.min(...slots.map((s) => s.basePrice)) : null,
    slotCount: slots.length,
    digital: digital.length ? { planCodes: digital.map((d) => d.planCode), minMonthlyPrice: digitalMinPrice } : null,
  };
}

/* ── 2단계: 슬롯 도식 ─────────────────────────────────────── */

/** 슬롯 상태는 인벤토리에서 읽는다. 인벤토리가 없으면 판매설정만으로 '구매 가능'. */
export async function getPickSlots(athleteId: string) {
  const { inventoryService } = await import('./inventory.service');
  const rows = await inventoryService.getAthleteInventory(athleteId);

  const slots = rows
    .filter((s: any) => s.saleEnabled)
    .map((s: any) => {
      const live = s.inventories.find((i: any) =>
        ['SOLD', 'AUCTION_ACTIVE', 'PENDING_APPROVAL', 'HELD'].includes(i.status));
      const t = s.slotTemplate;
      return {
        athleteSlotId: s.id,
        code: t.code,
        name: s.customName || t.nameKr || t.name,
        bodyPart: t.bodyPart,
        category: t.category,
        grade: s.baseGrade || t.grade,
        x: t.displayX, y: t.displayY,
        price: s.basePrice,
        status: live?.status || (s.restrictionNote ? 'RESTRICTED' : 'AVAILABLE'),
        auctionId: live?.auctionId || null,
        restrictionNote: s.restrictionNote || null,
        headline: t.uiHeadline || null,
        copy: t.uiCopy || null,
      };
    });

  return { slots };
}

/* ── 3단계: 견적 (§14.4 서버 재계산) ─────────────────────── */

export interface QuoteInput {
  athleteId: string;
  slotCode: string;
  durationCode?: string;
  productType?: string;
  addOns?: string[];
  transactionType?: string;
}

export async function quote(input: QuoteInput) {
  const duration = DURATIONS.find((d) => d.code === input.durationCode) || DURATIONS[0];
  const productType = PRODUCT_TYPES.find((p) => p.code === input.productType) || PRODUCT_TYPES[0];
  const transactionType = TRANSACTION_TYPES.find((t) => t.code === input.transactionType) || TRANSACTION_TYPES[0];

  if (transactionType.code === 'AUCTION' && AUCTION_BLOCKED_DURATIONS.includes(duration.code)) {
    throw Object.assign(new Error('6개월 이상 장기 상품은 경매로 판매하지 않습니다'), { status: 400 });
  }

  const slot = await prisma.athleteSlot.findFirst({
    where: { athleteId: input.athleteId, saleEnabled: true, slotTemplate: { code: input.slotCode } },
    include: { slotTemplate: { select: { code: true, name: true, nameKr: true } } },
  });
  if (!slot) throw Object.assign(new Error('선택한 슬롯을 판매 중이 아닙니다'), { status: 409 });

  const picked = ADD_ONS.filter((a) => (input.addOns || []).includes(a.code));
  const slotAmount = slot.basePrice * duration.months;
  const addOnAmount = picked.reduce((s, a) => s + a.price, 0);
  const subtotal = slotAmount + addOnAmount;

  return {
    slot: {
      code: slot.slotTemplate.code,
      name: slot.customName || slot.slotTemplate.nameKr || slot.slotTemplate.name,
      monthlyPrice: slot.basePrice,
    },
    duration: { code: duration.code, label: duration.label, months: duration.months, note: duration.note },
    productType: { code: productType.code, label: productType.label },
    transactionType: { code: transactionType.code, label: transactionType.label },
    addOns: picked.map((a) => ({ code: a.code, label: a.label, price: a.price })),
    slotAmount,
    addOnAmount,
    subtotal,
    vatAmount: Math.round(subtotal * 0.1),
    total: subtotal + Math.round(subtotal * 0.1),
    pricingRule: getOptions().pricingRule,
  };
}

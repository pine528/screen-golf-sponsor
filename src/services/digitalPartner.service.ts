/**
 * 디지털 파트너 월 구독 (핸드오프 v1.0 §2·§5·§7)
 *
 *  - 경기복·대회 현장 부착은 포함하지 않는다 (UX-02: 모든 화면에 반복 표기).
 *  - 결제는 선수 승인 후에만 (UX-04 / BR-05).
 *  - 잔여 수량은 제출 시 soft hold, 승인 시 hard reserve (§8.3 동시성).
 *  - 가격은 서버가 플랜 × 선수 배수로 재계산한다 (§8.3).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { logAdmin } from './fanAdmin.service';

const prisma = new PrismaClient();

export const DIGITAL_APPROVAL_HOURS = 72;

/** 출시 권장 가격 (§2.1) — DB에 플랜이 없으면 이 값으로 자동 시딩한다 */
const DEFAULT_PLANS = [
  {
    code: 'START', name: 'START', monthlyPrice: 49_000, capacity: 20, sortOrder: 1,
    benefits: ['선수 승인 공식 디지털 배지', '팬스토어 기본 입점', '웹 배너 3종', '기본 리포트'],
    exclusions: ['SNS 게시', '매장 POP', '독점'],
  },
  {
    code: 'GROW', name: 'GROW', monthlyPrice: 99_000, capacity: 10, sortOrder: 2,
    benefits: ['START 전체 포함', 'SNS 템플릿 6종', '등록매장 POP', '할인코드 · QR 리포트'],
    exclusions: ['선수 개인 게시', '방문'],
  },
  {
    code: 'PLUS', name: 'PLUS', monthlyPrice: 199_000, capacity: 5, sortOrder: 3,
    benefits: ['GROW 전체 포함', '분기별 소재 리프레시', '업종 제한', '상세 리포트'],
    exclusions: ['출연 · 촬영', '경기복'],
  },
];

/** 플랜 목록 — 없으면 기본 3종을 만든다 (Beta 동일가격 §부록B) */
export async function listPlans() {
  const existing = await prisma.digitalPlan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  if (existing.length > 0) return existing;
  for (const p of DEFAULT_PLANS) {
    await prisma.digitalPlan.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code, name: p.name, monthlyPrice: p.monthlyPrice, termMonths: 12,
        capacity: p.capacity, sortOrder: p.sortOrder,
        benefits: p.benefits as Prisma.InputJsonValue,
        exclusions: p.exclusions as Prisma.InputJsonValue,
      },
    });
  }
  return prisma.digitalPlan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
}

/** 관리자 — 비활성 포함 전체 플랜 (Admin Pricing Config, v2.1 §9.2) */
export async function listAllPlans() {
  await listPlans(); // 기본 3종 시딩 보장
  return prisma.digitalPlan.findMany({ orderBy: { sortOrder: 'asc' } });
}

/** 관리자 — 플랜 가격·수량·포함/미포함 수정. 진행 중 구독은 계약 스냅샷을 따르므로 소급되지 않는다. */
export async function updatePlan(
  code: string,
  patch: { name?: string; monthlyPrice?: number; capacity?: number; active?: boolean; benefits?: string[]; exclusions?: string[] },
  adminId: string,
  reason: string,
) {
  const before = await prisma.digitalPlan.findUnique({ where: { code } });
  if (!before) throw Object.assign(new Error('플랜을 찾을 수 없습니다'), { status: 404 });
  if (!reason || !reason.trim()) throw Object.assign(new Error('변경 사유가 필요합니다'), { status: 400 });
  if (patch.monthlyPrice != null && (!Number.isInteger(patch.monthlyPrice) || patch.monthlyPrice <= 0)) {
    throw Object.assign(new Error('월 구독료는 1원 이상의 정수여야 합니다'), { status: 400 });
  }
  if (patch.capacity != null && (!Number.isInteger(patch.capacity) || patch.capacity < 0)) {
    throw Object.assign(new Error('수량은 0 이상의 정수여야 합니다'), { status: 400 });
  }
  const data: Prisma.DigitalPlanUpdateInput = {};
  if (patch.name != null) data.name = String(patch.name).trim().slice(0, 40) || before.name;
  if (patch.monthlyPrice != null) data.monthlyPrice = patch.monthlyPrice;
  if (patch.capacity != null) data.capacity = patch.capacity;
  if (patch.active != null) data.active = !!patch.active;
  if (patch.benefits) data.benefits = patch.benefits.map(String).slice(0, 12) as Prisma.InputJsonValue;
  if (patch.exclusions) data.exclusions = patch.exclusions.map(String).slice(0, 12) as Prisma.InputJsonValue;
  const after = await prisma.digitalPlan.update({ where: { code }, data });
  await logAdmin(adminId, 'DIGITAL_PLAN_UPDATE', 'DIGITAL_PLAN', code, reason, {
    before: { name: before.name, monthlyPrice: before.monthlyPrice, capacity: before.capacity, active: before.active },
    after: { name: after.name, monthlyPrice: after.monthlyPrice, capacity: after.capacity, active: after.active },
  });
  return after;
}

/** 선수별 잔여 수량 — 재고 레코드가 없으면 플랜 기본 capacity를 쓴다 */
async function remainingFor(athleteId: string, plans: { code: string; capacity: number }[]) {
  const invs = await prisma.athleteDigitalInventory.findMany({ where: { athleteId } });
  const active = await prisma.digitalApplication.groupBy({
    by: ['planCode'],
    where: { athleteId, status: { in: ['SUBMITTED', 'ATHLETE_APPROVED', 'PAYMENT_PENDING', 'ACTIVE'] } },
    _count: { _all: true },
  });
  const used = new Map(active.map((a) => [a.planCode, a._count._all]));
  return plans.map((p) => {
    const inv = invs.find((i) => i.planCode === p.code);
    const capacity = inv?.capacity ?? p.capacity;
    const isOpen = inv ? inv.isOpen : true;
    const remaining = Math.max(0, capacity - (used.get(p.code) || 0));
    const multiplier = inv ? Number(inv.priceMultiplier) : 1;
    return { planCode: p.code, capacity, remaining, isOpen, multiplier };
  });
}

/** 모집 중인 선수 목록 (§5.3) */
export async function listDigitalAthletes(params: { q?: string; tour?: string; plan?: string; limit?: number }) {
  const plans = await listPlans();
  const athletes = await prisma.athlete.findMany({
    where: {
      isActive: true, kycStatus: 'APPROVED',
      ...(params.q ? { name: { contains: params.q } } : {}),
      ...(params.tour ? { tour: { contains: params.tour } } : {}),
    },
    select: { id: true, name: true, tour: true, region: true, profileImageUrl: true, snsStats: true, isRecommended: true },
    orderBy: [{ isRecommended: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(params.limit || 40, 60),
  });

  const out = [];
  for (const a of athletes) {
    const stock = await remainingFor(a.id, plans.map((p) => ({ code: p.code, capacity: p.capacity })));
    const open = stock.filter((s) => s.isOpen && s.remaining > 0);
    if (open.length === 0) continue;
    const cheapest = plans
      .filter((p) => open.some((s) => s.planCode === p.code))
      .map((p) => ({ ...p, price: Math.round(p.monthlyPrice * (open.find((s) => s.planCode === p.code)!.multiplier)) }))
      .sort((x, y) => x.price - y.price)[0];
    out.push({
      id: a.id, name: a.name, tour: a.tour, region: a.region, profileImageUrl: a.profileImageUrl,
      isRecommended: a.isRecommended,
      minMonthlyPrice: cheapest?.price ?? null,
      stock,
      totalRemaining: open.reduce((s, x) => s + x.remaining, 0),
      totalCapacity: stock.reduce((s, x) => s + x.capacity, 0),
    });
  }
  return { plans, athletes: out };
}

/** 선수 상세 — 플랜별 가격·잔여 */
export async function getDigitalAthlete(athleteId: string) {
  const plans = await listPlans();
  const athlete = await prisma.athlete.findFirst({
    where: { id: athleteId, isActive: true, kycStatus: 'APPROVED' },
    select: {
      id: true, name: true, tour: true, region: true, profileImageUrl: true, bio: true,
      snsStats: true, activityFields: true, primarySponsors: true,
    },
  });
  if (!athlete) return null;
  const stock = await remainingFor(athleteId, plans.map((p) => ({ code: p.code, capacity: p.capacity })));
  return {
    athlete,
    plans: plans.map((p) => {
      const s = stock.find((x) => x.planCode === p.code)!;
      const price = Math.round(p.monthlyPrice * s.multiplier);
      return {
        id: p.id, code: p.code, name: p.name,
        monthlyPrice: price,
        annualTotal: price * p.termMonths,
        termMonths: p.termMonths,
        benefits: p.benefits, exclusions: p.exclusions,
        remaining: s.remaining, capacity: s.capacity, isOpen: s.isOpen,
      };
    }),
  };
}

export interface DigitalApplyInput {
  athleteId: string;
  planCode: string;
  category?: string;
  region?: string;
  homepage?: string;
  storeCount?: number;
  logoUrl?: string;
  scopes?: string[];
  brandMessage?: string;
}

/** 구독 신청 (§5.4) — 잔여 수량·업종 충돌을 서버에서 재검증 */
export async function applyDigital(input: DigitalApplyInput, brandUserId: string) {
  const plans = await listPlans();
  const plan = plans.find((p) => p.code === input.planCode);
  if (!plan) throw Object.assign(new Error('선택한 플랜을 찾을 수 없습니다'), { status: 400 });

  const athlete = await prisma.athlete.findFirst({
    where: { id: input.athleteId, isActive: true, kycStatus: 'APPROVED' },
    select: { id: true },
  });
  if (!athlete) throw Object.assign(new Error('현재 구독 신청이 불가능한 선수입니다'), { status: 409 });

  const stock = await remainingFor(input.athleteId, plans.map((p) => ({ code: p.code, capacity: p.capacity })));
  const s = stock.find((x) => x.planCode === plan.code)!;
  if (!s.isOpen || s.remaining <= 0) {
    throw Object.assign(new Error('방금 모집이 마감되었습니다'), { status: 409 }); // §10.1
  }

  /* 동일 브랜드의 중복 신청 방지 */
  const dup = await prisma.digitalApplication.findFirst({
    where: { brandUserId, athleteId: input.athleteId, status: { in: ['SUBMITTED', 'ATHLETE_APPROVED', 'PAYMENT_PENDING', 'ACTIVE'] } },
  });
  if (dup) throw Object.assign(new Error('이미 진행 중인 신청이 있습니다'), { status: 409 });

  const monthly = Math.round(plan.monthlyPrice * s.multiplier);

  return prisma.digitalApplication.create({
    data: {
      brandUserId,
      athleteId: input.athleteId,
      planId: plan.id,
      planCode: plan.code,
      status: 'SUBMITTED',
      monthlyAmount: monthly,
      termMonths: plan.termMonths,
      category: input.category,
      region: input.region,
      homepage: input.homepage,
      storeCount: input.storeCount,
      logoUrl: input.logoUrl,
      scopes: (input.scopes ?? undefined) as Prisma.InputJsonValue | undefined,
      brandMessage: input.brandMessage?.slice(0, 500),
      submittedAt: new Date(),
      approvalDueAt: new Date(Date.now() + DIGITAL_APPROVAL_HOURS * 3600 * 1000),
    },
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } }, plan: true },
  });
}

export async function getDigitalApplication(id: string, userId?: string, role?: string) {
  const app = await prisma.digitalApplication.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, userId: true, name: true, tour: true, profileImageUrl: true } },
      plan: true,
    },
  });
  if (!app) return null;
  if (role === 'ADMIN') return app;
  if (app.brandUserId !== userId && app.athlete.userId !== userId) return 'FORBIDDEN' as const;
  return app;
}

/** 선수 승인/수정요청/거절 (BR-04 사유 필수) */
export async function reviewDigital(
  id: string,
  action: 'APPROVE' | 'REVISION' | 'REJECT',
  actor: { id: string; role?: string },
  reasonCode?: string,
  comment?: string,
) {
  if (action !== 'APPROVE' && !comment && !reasonCode) {
    throw Object.assign(new Error('거절·수정요청에는 사유가 필요합니다'), { status: 400 });
  }
  const app = await prisma.digitalApplication.findUnique({
    where: { id },
    include: { athlete: { select: { userId: true } } },
  });
  if (!app) throw Object.assign(new Error('신청을 찾을 수 없습니다'), { status: 404 });
  if (actor.role !== 'ADMIN' && app.athlete.userId !== actor.id) {
    throw Object.assign(new Error('본인에게 요청된 건만 처리할 수 있습니다'), { status: 403 });
  }
  if (app.status === 'ACTIVE') throw Object.assign(new Error('이미 구독이 시작된 신청입니다'), { status: 409 });

  const status = action === 'APPROVE' ? 'ATHLETE_APPROVED' : action === 'REVISION' ? 'NEEDS_REVISION' : 'REJECTED';
  return prisma.digitalApplication.update({
    where: { id },
    data: { status, reasonCode, comment, reviewedAt: new Date(), reviewedBy: actor.id },
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } }, plan: true },
  });
}

/** 계약·첫 결제 (§7.3) — 승인 후에만, 12개월 약정 */
export async function checkoutDigital(id: string, brandUserId: string) {
  const app = await prisma.digitalApplication.findUnique({ where: { id } });
  if (!app) throw Object.assign(new Error('신청을 찾을 수 없습니다'), { status: 404 });
  if (app.brandUserId !== brandUserId) throw Object.assign(new Error('결제 권한이 없습니다'), { status: 403 });
  if (app.status === 'ACTIVE') throw Object.assign(new Error('이미 구독이 시작되었습니다'), { status: 409 });
  if (app.status !== 'ATHLETE_APPROVED') {
    throw Object.assign(new Error('선수 승인 후에 결제할 수 있습니다'), { status: 409 }); // UX-04
  }
  if (app.approvalDueAt && app.approvalDueAt < new Date()) {
    throw Object.assign(new Error('승인 유효기간이 지났습니다. 재승인이 필요합니다'), { status: 409 });
  }

  const from = new Date();
  const to = new Date(from);
  to.setMonth(to.getMonth() + app.termMonths);
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);

  return prisma.digitalApplication.update({
    where: { id },
    data: { status: 'ACTIVE', effectiveFrom: from, effectiveTo: to, nextBillingAt: next, paidAt: from },
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } }, plan: true },
  });
}

export async function listBrandSubscriptions(brandUserId: string) {
  return prisma.digitalApplication.findMany({
    where: { brandUserId },
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } }, plan: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/** 선수 승인함 (디지털 구독분) */
export async function listAthleteDigitalRequests(userId: string) {
  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return [];
  return prisma.digitalApplication.findMany({
    where: { athleteId: athlete.id },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

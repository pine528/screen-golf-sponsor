/**
 * 후원 신청·승인·결제 (추천 PICK 핸드오프 v1.0 §9 · §10 · §13)
 *
 * 상태 흐름: SUBMITTED → (선수별 승인) → PARTIAL_APPROVAL/APPROVED
 *            → PAYMENT_PENDING → ACTIVE
 * 원칙
 *  - 결제는 승인 이후에만 가능 (RP-06 승인 선행 / BR-05)
 *  - 금액은 항상 서버에서 재계산한다 (§14.4)
 *  - 승인 유효기간 기본 72시간 (§9.3)
 *  - 모든 승인·거절·결제는 ApplicationReview에 감사 기록 (§14.4)
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const APPROVAL_WINDOW_HOURS = 72;
const VAT_RATE = 0.1;

export interface SubmitInput {
  sourceId?: string;      // AiMatchRequest.id
  planKey?: string;
  planName?: string;
  durationMonths?: number;
  items: { athleteId: string; slotInstanceId?: string; slotCode?: string; slotName?: string; role?: string }[];
  snapshot?: any;
}

/** 신청 생성 — 가격은 클라이언트 값을 믿지 않고 슬롯 원장에서 다시 읽는다 */
export async function submitApplication(input: SubmitInput, brandUserId: string) {
  if (!input.items?.length) throw Object.assign(new Error('선수를 1명 이상 선택해주세요'), { status: 400 });
  if (input.items.length > 4) throw Object.assign(new Error('한 신청에는 최대 4명까지 담을 수 있습니다'), { status: 400 });

  const athleteIds = [...new Set(input.items.map((i) => i.athleteId))];
  if (athleteIds.length !== input.items.length) {
    throw Object.assign(new Error('같은 선수를 중복해서 담을 수 없습니다'), { status: 400 });
  }

  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds }, isActive: true, kycStatus: 'APPROVED' },
    select: { id: true, name: true },
  });
  if (athletes.length !== athleteIds.length) {
    throw Object.assign(new Error('현재 후원 신청이 불가능한 선수가 포함되어 있습니다'), { status: 409 });
  }

  /* 슬롯 가격·판매 상태 서버 재검증 (§14.4) */
  const priced: { athleteId: string; slotInstanceId?: string; slotCode?: string; slotName?: string; role?: string; price: number }[] = [];
  for (const it of input.items) {
    let price = 0;
    let slotName = it.slotName;
    let slotInstanceId = it.slotInstanceId;

    const slot = await prisma.athleteSlot.findFirst({
      where: {
        athleteId: it.athleteId,
        saleEnabled: true,
        ...(it.slotCode ? { slotTemplate: { code: it.slotCode } } : {}),
      },
      include: { slotTemplate: true },
      orderBy: { basePrice: 'asc' },
    });
    if (!slot) throw Object.assign(new Error(`선택한 슬롯을 판매 중이 아닙니다 (${it.slotName || it.slotCode || ''})`), { status: 409 });
    price = slot.basePrice;
    slotName = slot.customName || slot.slotTemplate.name;

    // OPEN 상태 인스턴스가 있으면 연결 (없어도 신청 자체는 가능 — 협의 상품)
    if (!slotInstanceId) {
      const inst = await prisma.slotInstance.findFirst({
        where: { athleteId: it.athleteId, slotTemplateId: slot.slotTemplateId, status: 'OPEN' },
        select: { id: true },
      });
      slotInstanceId = inst?.id;
    }
    priced.push({ ...it, slotInstanceId, slotName, price });
  }

  const months = Math.max(1, Math.min(12, input.durationMonths || 1));
  const total = priced.reduce((s, p) => s + p.price, 0);
  const vat = Math.round(total * VAT_RATE);
  const due = new Date(Date.now() + APPROVAL_WINDOW_HOURS * 3600 * 1000);

  const app = await prisma.sponsorshipApplication.create({
    data: {
      brandUserId,
      sourceType: 'RECOMMEND_PICK',
      sourceId: input.sourceId,
      planKey: input.planKey,
      planName: input.planName,
      status: 'SUBMITTED',
      totalAmount: total,
      vatAmount: vat,
      durationMonths: months,
      snapshot: (input.snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
      submittedAt: new Date(),
      approvalDueAt: due,
      items: {
        create: priced.map((p) => ({
          athleteId: p.athleteId,
          slotInstanceId: p.slotInstanceId,
          slotCode: p.slotCode,
          slotName: p.slotName,
          role: p.role,
          price: p.price,
          status: 'PENDING',
        })),
      },
      reviews: {
        create: { actorId: brandUserId, actorRole: 'BRAND', action: 'SUBMIT', comment: `${priced.length}명 승인 요청` },
      },
    },
    include: { items: { include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } } } }, reviews: true },
  });
  return app;
}

/** 신청 조회 — 브랜드 본인 / 포함된 선수 / ADMIN */
export async function getApplication(id: string, userId?: string, role?: string) {
  const app = await prisma.sponsorshipApplication.findUnique({
    where: { id },
    include: {
      items: {
        include: { athlete: { select: { id: true, userId: true, name: true, tour: true, profileImageUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      reviews: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!app) return null;
  if (role === 'ADMIN') return app;
  const isOwner = app.brandUserId === userId;
  const isParty = app.items.some((i) => i.athlete.userId === userId);
  if (!isOwner && !isParty) return 'FORBIDDEN' as const;
  return app;
}

/** 선수(또는 관리자)의 개별 승인/수정요청/거절 — §9.4 */
export async function reviewItem(
  applicationId: string,
  itemId: string,
  action: 'APPROVE' | 'REVISION' | 'REJECT',
  actor: { id: string; role?: string },
  reasonCode?: string,
  comment?: string,
) {
  if ((action === 'REJECT' || action === 'REVISION') && !comment && !reasonCode) {
    throw Object.assign(new Error('거절·수정요청에는 사유가 필요합니다'), { status: 400 }); // BR-04
  }

  const item = await prisma.applicationItem.findUnique({
    where: { id: itemId },
    include: { athlete: { select: { userId: true } }, application: true },
  });
  if (!item || item.applicationId !== applicationId) {
    throw Object.assign(new Error('신청 항목을 찾을 수 없습니다'), { status: 404 });
  }
  if (actor.role !== 'ADMIN' && item.athlete.userId !== actor.id) {
    throw Object.assign(new Error('본인에게 요청된 건만 처리할 수 있습니다'), { status: 403 });
  }
  if (item.application.status === 'ACTIVE' || item.application.status === 'CANCELLED') {
    throw Object.assign(new Error('이미 종료된 신청입니다'), { status: 409 });
  }

  const nextStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REVISION' ? 'NEEDS_REVISION' : 'REJECTED';

  return prisma.$transaction(async (tx) => {
    await tx.applicationItem.update({
      where: { id: itemId },
      data: { status: nextStatus, reasonCode, comment, reviewedAt: new Date(), reviewedBy: actor.id },
    });
    await tx.applicationReview.create({
      data: { applicationId, itemId, actorId: actor.id, actorRole: actor.role || 'ATHLETE', action, reasonCode, comment },
    });

    /* 전체 상태 재계산 (§9.2) */
    const items = await tx.applicationItem.findMany({ where: { applicationId } });
    const approved = items.filter((i) => i.status === 'APPROVED').length;
    const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'NEEDS_REVISION').length;
    const rejected = items.filter((i) => i.status === 'REJECTED').length;

    const status =
      approved === items.length ? 'APPROVED'
        : rejected === items.length ? 'REJECTED'
        : pending === 0 ? 'PARTIAL_APPROVAL'
        : 'SUBMITTED';

    return tx.sponsorshipApplication.update({
      where: { id: applicationId },
      data: { status },
      include: {
        items: { include: { athlete: { select: { id: true, userId: true, name: true, tour: true, profileImageUrl: true } } } },
        reviews: { orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

/**
 * 결제 — 승인된 항목만 청구한다.
 * 전원 승인(APPROVED) 또는 일부 승인 후 브랜드가 부분 진행을 선택한 경우(PARTIAL_APPROVAL) 허용 (§9.3).
 * 실제 PG 연동은 기존 결제 모듈을 쓰며, 여기서는 계약 스냅샷 고정과 상태 전이만 담당한다.
 */
export async function checkoutApplication(id: string, brandUserId: string, opts?: { partial?: boolean }) {
  const app = await prisma.sponsorshipApplication.findUnique({ where: { id }, include: { items: true } });
  if (!app) throw Object.assign(new Error('신청을 찾을 수 없습니다'), { status: 404 });
  if (app.brandUserId !== brandUserId) throw Object.assign(new Error('결제 권한이 없습니다'), { status: 403 });
  if (app.status === 'ACTIVE') throw Object.assign(new Error('이미 결제가 완료되었습니다'), { status: 409 });

  const approved = app.items.filter((i) => i.status === 'APPROVED');
  if (approved.length === 0) throw Object.assign(new Error('승인된 선수가 없어 결제할 수 없습니다'), { status: 409 }); // BR-05
  if (approved.length !== app.items.length && !opts?.partial) {
    throw Object.assign(new Error('승인되지 않은 선수가 있습니다. 부분 진행에 동의해주세요'), { status: 409 });
  }
  if (app.approvalDueAt && app.approvalDueAt < new Date()) {
    throw Object.assign(new Error('승인 유효기간이 지났습니다. 재승인이 필요합니다'), { status: 409 });
  }

  const total = approved.reduce((s, i) => s + i.price, 0);
  const vat = Math.round(total * VAT_RATE);

  return prisma.$transaction(async (tx) => {
    await tx.applicationReview.create({
      data: {
        applicationId: id, actorId: brandUserId, actorRole: 'BRAND', action: 'PAY',
        comment: `${approved.length}명 · 공급가 ${total.toLocaleString()}원`,
      },
    });
    return tx.sponsorshipApplication.update({
      where: { id },
      data: { status: 'ACTIVE', totalAmount: total, vatAmount: vat, paidAt: new Date() },
      include: {
        items: { include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } } } },
        reviews: { orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

/** 선수 승인함 — 나에게 온 승인 요청 (§9.4) */
export async function listAthleteRequests(userId: string) {
  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return [];
  const items = await prisma.applicationItem.findMany({
    where: { athleteId: athlete.id },
    include: {
      application: { select: { id: true, planName: true, status: true, durationMonths: true, approvalDueAt: true, submittedAt: true, snapshot: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return items;
}

/** 브랜드의 신청 목록 */
export async function listBrandApplications(brandUserId: string) {
  return prisma.sponsorshipApplication.findMany({
    where: { brandUserId },
    include: {
      items: { include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * 지금 가능한 후원 — 관리자 상품 빌더 · 검증 · 발행 · 진열 · 대시보드
 * (핸드오프 v1.0 2026-08-22 §7 · §8 · §11)
 *
 * 원칙
 *  - 발행 전 검증을 통과하지 못하면 PUBLISHED로 갈 수 없다 (§7.3).
 *  - 온라인 전용 상품에 offlineUse=true를 둘 수 없다 (§7.3 · §12.3).
 *  - 예상성과는 근거·기준일 없이 발행할 수 없다 (§7.3).
 *  - 모든 변경은 OfferAudit에 남는다 (§11.3).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { decorateOffer, OFFER_INCLUDE, SECTIONS } from './offer.service';

const prisma = new PrismaClient();

/** 빌더 템플릿 (§8.1) */
export const OFFER_TEMPLATES = [
  {
    code: 'EVENT_EXPOSURE', name: '대회 노출형', type: 'EVENT_SLOT',
    fixed: '슬롯 + SNS + ROI 리포트', editable: '선수 · 대회 · 위치 · 가격',
    requiredFields: 10, leadTimeDays: 5,
    defaults: { channels: ['대회 현장 (온사이트)', '공식 중계', '대회 웹사이트'], purposes: ['인지'], durationCode: 'SINGLE_EVENT', months: 1 },
  },
  {
    code: 'ONLINE_PARTNER', name: '온라인 파트너 구독', type: 'ONLINE_SUBSCRIPTION',
    fixed: '온라인 패치 + 성장마켓 + 인쇄물', editable: '선수 · 플랜 · 가격',
    requiredFields: 9, leadTimeDays: 2,
    defaults: { channels: ['선수 온라인 프로필', '성장마켓'], purposes: ['구매'], durationCode: 'MONTHS_12', months: 12, priceType: 'SUBSCRIPTION', offlineUse: false },
  },
  {
    code: 'CONTENT_BURST', name: '콘텐츠 버스트', type: 'CONTENT_PACKAGE',
    fixed: '피드 / 릴스 / 스토리 수량', editable: '선수 · 수량 · 기간',
    requiredFields: 12, leadTimeDays: 7,
    defaults: { channels: ['선수 SNS'], purposes: ['콘텐츠'], durationCode: 'DAYS_30', months: 1 },
  },
  {
    code: 'LOCAL_GROWTH', name: '지역 상생', type: 'LOCAL_ACTIVATION',
    fixed: '지역선수 + 방문 + POP + QR', editable: '지역 · 매장 · 일정',
    requiredFields: 11, leadTimeDays: 10,
    defaults: { channels: ['등록 매장', '선수 SNS'], purposes: ['지역', 'ESG'], durationCode: 'MONTHS_3', months: 3 },
  },
  {
    code: 'FAN_COMMERCE', name: '팬 커머스', type: 'FAN_COMMERCE',
    fixed: '스토어 + 할인코드 + VOTE/커뮤니티', editable: '상품 · 혜택 · 정산',
    requiredFields: 11, leadTimeDays: 7,
    defaults: { channels: ['팬스토어', '팬 참여'], purposes: ['팬참여', '구매'], durationCode: 'MONTHS_3', months: 3 },
  },
  {
    code: 'BLANK', name: '빈 상품 (처음부터 만들기)', type: 'CUSTOM_CURATED',
    fixed: '없음', editable: '전체',
    requiredFields: 8, leadTimeDays: 7,
    defaults: {},
  },
] as const;

/** 발행에 필요한 필수 항목 — 완성도 계산과 검증이 같은 표를 본다 (§7.2 · §7.3) */
const REQUIRED_FIELDS: { key: string; label: string; group: string; check: (o: any) => boolean }[] = [
  { key: 'title', label: '상품명', group: '상품정보', check: (o) => !!o.title?.trim() },
  { key: 'code', label: '내부 코드', group: '상품정보', check: (o) => !!o.code?.trim() },
  { key: 'summary', label: '상품 요약', group: '상품정보', check: (o) => !!o.summary?.trim() },
  { key: 'categories', label: '타겟 브랜드 카테고리', group: '상품정보', check: (o) => (o.categories || []).length > 0 },
  { key: 'priceType', label: '구매 방식', group: '상품정보', check: (o) => !!o.priceType },
  { key: 'channels', label: '노출 채널', group: '상품정보', check: (o) => (o.channels || []).length > 0 },
  { key: 'salesPeriod', label: '판매 기간', group: '상품정보', check: (o) => !!o.salesFrom && !!o.salesTo },
  { key: 'athletes', label: '선수 구성', group: '상품정보', check: (o) => (o.athletes || []).length > 0 },
  { key: 'components', label: '구성 요소', group: '상품정보', check: (o) => (o.components || []).length > 0 },
  { key: 'price', label: '가격', group: '가격·재고', check: (o) => o.priceType === 'NEGOTIABLE' || o.supplyAmount > 0 },
  { key: 'capacity', label: '재고 수량', group: '가격·재고', check: (o) => o.stockMode === 'UNLIMITED' || o.capacity > 0 },
  { key: 'execution', label: '실행 기간', group: '가격·재고', check: (o) => !!o.executionFrom && !!o.executionTo },
  { key: 'metrics', label: '예상성과 지표', group: '성과표현', check: (o) => Array.isArray(o.expectedMetrics) && o.expectedMetrics.length > 0 },
  { key: 'dataAsOf', label: '성과 기준일', group: '성과표현', check: (o) => !!o.dataAsOf },
  { key: 'confidence', label: '성과 신뢰도', group: '성과표현', check: (o) => !!o.confidence },
  { key: 'rights', label: '사용권 범위', group: '권리·동의', check: (o) => o.offlineUse || o.onlineUse || o.printUse },
  { key: 'heroImage', label: '대표 이미지', group: '권리·동의', check: (o) => !!o.heroImageUrl },
];

/* ── 목록 · 운영 경보 (§11.1 · §11.3) ───────────────── */

export async function listAdminOffers(params: {
  q?: string; status?: string; priceType?: string; athleteId?: string;
  owner?: string; from?: string; to?: string; quick?: string; limit?: number; page?: number;
}) {
  const where: Prisma.OfferWhereInput = {
    ...(params.q
      ? { OR: [{ title: { contains: params.q, mode: 'insensitive' } }, { code: { contains: params.q, mode: 'insensitive' } }] }
      : {}),
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
    ...(params.priceType && params.priceType !== 'ALL' ? { priceType: params.priceType } : {}),
    ...(params.owner && params.owner !== 'ALL' ? { ownerName: params.owner } : {}),
    ...(params.athleteId ? { athletes: { some: { athleteId: params.athleteId } } } : {}),
    ...(params.from || params.to
      ? { salesFrom: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
      : {}),
  };

  const rows = await prisma.offer.findMany({
    where, include: OFFER_INCLUDE, orderBy: { updatedAt: 'desc' }, take: 300,
  });
  let list = await Promise.all(rows.map(decorateOffer));

  /* 빠른 필터 (§11.2) */
  if (params.quick === 'CLOSING') list = list.filter((o) => o.daysLeft != null && o.daysLeft <= 7);
  if (params.quick === 'LOW_STOCK') list = list.filter((o) => o.availableQty != null && o.availableQty <= 1);
  if (params.quick === 'NEEDS_REVIEW') list = list.filter((o) => o.status === 'REVIEW' || (!o.preApproved && o.approvalMode === 'PRE_APPROVED'));
  if (params.quick === 'STALE') list = list.filter((o) => isStale(o));
  if (params.quick === 'MARGIN') list = list.filter((o) => marginOf(o) < 0);
  if (params.quick === 'CONFLICT') list = list.filter((o) => o.stockBlockers.length > 0);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(params.limit || 10, 100);

  return {
    offers: list.slice((page - 1) * limit, page * limit).map(toAdminRow),
    total: list.length,
    page,
    limit,
    stats: {
      published: list.filter((o) => o.displayStatus === 'PUBLISHED' || o.displayStatus === 'LOW_STOCK').length,
      pendingApproval: list.filter((o) => o.status === 'REVIEW').length,
      closingSoon: list.filter((o) => o.daysLeft != null && o.daysLeft <= 7 && o.sellable).length,
      stockConflict: list.filter((o) => o.stockBlockers.length > 0).length,
    },
  };
}

function toAdminRow(o: any) {
  return {
    id: o.id, code: o.code, title: o.title, type: o.type,
    status: o.status, displayStatus: o.displayStatus,
    priceType: o.priceType, supplyAmount: o.supplyAmount, monthlyAmount: o.monthlyAmount,
    capacity: o.capacity, availableQty: o.availableQty, stockMode: o.stockMode,
    salesFrom: o.salesFrom, salesTo: o.salesTo, daysLeft: o.daysLeft,
    ownerName: o.ownerName, reviewerName: o.reviewerName,
    preApproved: o.preApproved, stockBlockers: o.stockBlockers,
    placementCount: undefined as number | undefined,
    metrics: { view: o.viewCount, detail: o.detailCount, save: o.saveCount, sold: o.soldQty },
    dataAsOf: o.dataAsOf,
    stale: isStale(o),
    margin: marginOf(o),
    athletes: (o.athletes || []).map((a: any) => ({
      id: a.athlete.id, name: a.athlete.name, tour: a.athlete.tour, profileImageUrl: a.athlete.profileImageUrl,
    })),
  };
}

/** 성과 기준일이 30일을 넘으면 stale로 본다 (§11.3) */
function isStale(o: any) {
  if (!o.dataAsOf) return true;
  return Date.now() - new Date(o.dataAsOf).getTime() > 30 * 86400_000;
}

function marginOf(o: any) {
  return o.supplyAmount - o.costAmount - o.platformFee;
}

/** 운영 경보 (§11.3) */
export async function getAlerts() {
  const rows = await prisma.offer.findMany({
    where: { status: { in: ['PUBLISHED', 'LOW_STOCK', 'REVIEW', 'SCHEDULED'] } },
    include: OFFER_INCLUDE,
    take: 300,
  });
  const list = await Promise.all(rows.map(decorateOffer));
  const now = new Date();
  const alerts: any[] = [];

  for (const o of list) {
    if (o.stockBlockers.length) {
      alerts.push({
        type: 'STOCK_CONFLICT', severity: 'ERROR', badge: '재고충돌',
        title: '슬롯 중복 감지',
        message: `${o.athletes[0]?.athlete?.name ?? ''} 선수의 '${o.title}'이(가) 다른 상품의 노출 기간과 겹칩니다.`,
        detail: o.stockBlockers.join(' · '),
        offerId: o.id, offerCode: o.code,
        period: o.executionFrom && o.executionTo ? { from: o.executionFrom, to: o.executionTo } : null,
        action: { label: '슬롯 확인하기', to: `/admin/offers/${o.id}` },
      });
    }
    if (o.daysLeft != null && o.daysLeft <= 7 && o.sellable) {
      alerts.push({
        type: 'CLOSING_SOON', severity: 'WARN', badge: '마감임박',
        title: '마감 임박 상품',
        message: `7일 이내 마감되는 상품이 있습니다.`,
        detail: `${o.title} · 마감 ${new Date(o.salesTo).toLocaleDateString('ko-KR')}`,
        offerId: o.id, offerCode: o.code,
        action: { label: '대상 상품 보기', to: `/admin/offers?quick=CLOSING` },
      });
    }
    if (o.status === 'REVIEW') {
      const waitedDays = Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / 86400_000);
      alerts.push({
        type: 'REVIEW_DELAY', severity: 'INFO', badge: '승인필요',
        title: '승인 지연',
        message: '승인 대기 중인 상품이 있습니다.',
        detail: `${o.title} · 대기 ${waitedDays}일`,
        offerId: o.id, offerCode: o.code,
        action: { label: '승인 대기 목록 보기', to: `/admin/offers?status=REVIEW` },
      });
    }
    if (o.approvalMode === 'PRE_APPROVED' && o.preApprovalTo && new Date(o.preApprovalTo) < now) {
      alerts.push({
        type: 'PREAPPROVAL_EXPIRED', severity: 'WARN', badge: '사전승인만료',
        title: '사전승인 만료',
        message: '즉시구매 배지가 제거되고 일반 승인 흐름으로 전환됩니다.',
        detail: o.title, offerId: o.id, offerCode: o.code,
        action: { label: '상품 보기', to: `/admin/offers/${o.id}` },
      });
    }
    if (marginOf(o) < 0) {
      alerts.push({
        type: 'NEGATIVE_MARGIN', severity: 'ERROR', badge: '마진이상',
        title: '마진 음수',
        message: '원가와 수수료가 판매가를 넘습니다. 발행·할인이 차단됩니다.',
        detail: `${o.title} · 마진 ${marginOf(o).toLocaleString()}원`,
        offerId: o.id, offerCode: o.code,
        action: { label: '가격 수정', to: `/admin/offers/${o.id}` },
      });
    }
    if (isStale(o) && o.sellable) {
      alerts.push({
        type: 'DATA_STALE', severity: 'WARN', badge: '데이터',
        title: '성과 데이터 갱신 필요',
        message: '성과 기준일이 30일을 넘었습니다.',
        detail: `${o.title} · 기준일 ${o.dataAsOf ? new Date(o.dataAsOf).toLocaleDateString('ko-KR') : '없음'}`,
        offerId: o.id, offerCode: o.code,
        action: { label: '성과 갱신', to: `/admin/offers/${o.id}` },
      });
    }
  }

  const order = { ERROR: 0, WARN: 1, INFO: 2 } as Record<string, number>;
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return { alerts: alerts.slice(0, 30), counts: { total: alerts.length, error: alerts.filter((a) => a.severity === 'ERROR').length } };
}

/* ── 빌더 (§7.1) ────────────────────────────────────── */

export async function getAdminOffer(id: string) {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { ...OFFER_INCLUDE, placements: true, audits: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!offer) return null;
  const d = await decorateOffer(offer);
  return {
    ...d,
    placements: offer.placements,
    audits: offer.audits,
    completeness: completenessOf(offer),
    margin: marginOf(d),
  };
}

function completenessOf(o: any) {
  const items = REQUIRED_FIELDS.map((f) => ({ key: f.key, label: f.label, group: f.group, done: f.check(o) }));
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

async function audit(offerId: string, actor: { id?: string; name?: string }, action: string, patch?: any) {
  await prisma.offerAudit.create({
    data: {
      offerId, actorId: actor.id, actorName: actor.name || '관리자', action,
      after: (patch ?? undefined) as Prisma.InputJsonValue,
    },
  }).catch(() => null);
}

export async function createOffer(input: any, actor: { id?: string; name?: string }) {
  const tpl = OFFER_TEMPLATES.find((t) => t.code === input.template);
  const defaults: any = tpl?.defaults ?? {};

  const base = (input.code || `OFFER-${Date.now().toString().slice(-6)}`).toUpperCase();
  const offer = await prisma.offer.create({
    data: {
      code: base,
      slug: (input.slug || base).toLowerCase(),
      title: input.title || '새 후원상품',
      subtitle: input.subtitle,
      summary: input.summary,
      type: input.type || tpl?.type || 'CUSTOM_CURATED',
      status: 'DRAFT',
      categories: input.categories ?? [],
      channels: input.channels ?? defaults.channels ?? [],
      purposes: input.purposes ?? defaults.purposes ?? [],
      durationCode: input.durationCode ?? defaults.durationCode ?? 'SINGLE_EVENT',
      months: input.months ?? defaults.months ?? 1,
      priceType: input.priceType ?? defaults.priceType ?? 'FIXED',
      offlineUse: input.offlineUse ?? defaults.offlineUse ?? true,
      leadTimeDays: input.leadTimeDays ?? tpl?.leadTimeDays ?? 7,
      ownerName: actor.name,
      ...(input.salesFrom ? { salesFrom: new Date(input.salesFrom) } : {}),
      ...(input.salesTo ? { salesTo: new Date(input.salesTo) } : {}),
    },
  });
  await audit(offer.id, actor, 'CREATE', { template: input.template });
  return getAdminOffer(offer.id);
}

const DATE_FIELDS = ['salesFrom', 'salesTo', 'executionFrom', 'executionTo', 'dataAsOf', 'preApprovedAt', 'preApprovalTo', 'scheduledAt'];
const SCALARS = [
  'title', 'subtitle', 'summary', 'type', 'heroImageUrl', 'categories', 'channels', 'purposes',
  'eventId', 'leadTimeDays', 'durationCode', 'months', 'priceType', 'supplyAmount', 'originalPrice',
  'discountReason', 'costAmount', 'platformFee', 'stockMode', 'capacity', 'holdMinutes',
  'approvalMode', 'preApprovalMaxQty', 'offlineUse', 'onlineUse', 'printUse', 'secondaryUse',
  'territory', 'rightsNote', 'restrictions', 'expectedMetrics', 'methodology', 'methodVersion',
  'confidence', 'guaranteed', 'assumptions', 'ownerName', 'reviewerName', 'changeReason',
];

export async function updateOffer(id: string, patch: any, actor: { id?: string; name?: string }) {
  const before = await prisma.offer.findUnique({ where: { id }, include: OFFER_INCLUDE });
  if (!before) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });

  const data: any = {};
  for (const k of SCALARS) if (patch[k] !== undefined) data[k] = patch[k];
  for (const k of DATE_FIELDS) if (patch[k] !== undefined) data[k] = patch[k] ? new Date(patch[k]) : null;

  /* 온라인 전용에는 오프라인 사용을 둘 수 없다 (§7.3) */
  if (data.type === 'ONLINE_SUBSCRIPTION' || before.type === 'ONLINE_SUBSCRIPTION') {
    if (data.offlineUse === true) {
      throw Object.assign(new Error('온라인 전용 상품에는 오프라인 사용 권리를 설정할 수 없습니다'), { status: 400, code: 'RIGHTS_CONFLICT' });
    }
  }

  /* 발행된 상품의 핵심 변경은 version을 올리고 재승인 대상이 된다 (§14.2) */
  const coreChanged = ['supplyAmount', 'priceType', 'months', 'durationCode', 'offlineUse', 'onlineUse', 'printUse', 'secondaryUse']
    .some((k) => data[k] !== undefined && (before as any)[k] !== data[k]);
  if (coreChanged && ['PUBLISHED', 'LOW_STOCK'].includes(before.status)) {
    data.version = before.version + 1;
    data.preApprovedAt = null; // 핵심 변경은 사전승인을 무효화한다 (§9.4)
    data.status = 'REVIEW';
  }

  await prisma.offer.update({ where: { id }, data });

  /* 구성·옵션·선수는 통째로 교체한다 */
  if (Array.isArray(patch.athletes)) {
    await prisma.offerAthlete.deleteMany({ where: { offerId: id } });
    if (patch.athletes.length) {
      await prisma.offerAthlete.createMany({
        data: patch.athletes.map((a: any, i: number) => ({
          offerId: id, athleteId: a.athleteId ?? a, role: a.role, sortOrder: a.sortOrder ?? i,
        })),
        skipDuplicates: true,
      });
    }
  }
  if (Array.isArray(patch.components)) {
    await prisma.offerComponent.deleteMany({ where: { offerId: id } });
    if (patch.components.length) {
      await prisma.offerComponent.createMany({
        data: patch.components.map((c: any, i: number) => ({
          offerId: id, componentType: c.componentType, label: c.label,
          athleteId: c.athleteId, athleteSlotId: c.athleteSlotId, slotCode: c.slotCode,
          offerProductId: c.offerProductId, requiredQty: c.requiredQty ?? 1,
          quantity: c.quantity ?? 1, unitPrice: c.unitPrice ?? 0, note: c.note, sortOrder: c.sortOrder ?? i,
        })),
      });
    }
  }
  if (Array.isArray(patch.options)) {
    await prisma.offerOption.deleteMany({ where: { offerId: id } });
    if (patch.options.length) {
      await prisma.offerOption.createMany({
        data: patch.options.map((o: any, i: number) => ({
          offerId: id, kind: o.kind, code: o.code, label: o.label,
          choices: (o.choices ?? undefined) as Prisma.InputJsonValue,
          minQty: o.minQty, maxQty: o.maxQty, addPrice: o.addPrice ?? 0,
          required: !!o.required, sortOrder: o.sortOrder ?? i,
        })),
        skipDuplicates: true,
      });
    }
  }

  await audit(id, actor, coreChanged ? 'PRICE' : 'UPDATE', { fields: Object.keys(data) });
  return getAdminOffer(id);
}

/* ── 발행 검증 (§7.3) ───────────────────────────────── */

export async function validateOffer(id: string) {
  const offer = await prisma.offer.findUnique({ where: { id }, include: OFFER_INCLUDE });
  if (!offer) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  const d = await decorateOffer(offer);

  const issues: { code: string; severity: 'ERROR' | 'WARN'; group: string; message: string; resolution: string }[] = [];
  const now = new Date();

  const missing = completenessOf(offer).items.filter((i) => !i.done);
  for (const m of missing) {
    issues.push({
      code: 'REQUIRED_MISSING', severity: m.group === '권리·동의' ? 'WARN' : 'ERROR', group: m.group,
      message: `${m.label}이(가) 입력되지 않았습니다`, resolution: `${m.group} 단계에서 ${m.label}을(를) 입력하세요`,
    });
  }

  /* 선수 모집·승인 */
  if (offer.athletes.length) {
    const ids = offer.athletes.map((a) => a.athleteId);
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, isActive: true, kycStatus: true },
    });
    for (const a of athletes) {
      if (!a.isActive || a.kycStatus !== 'APPROVED') {
        issues.push({
          code: 'ATHLETE_UNAVAILABLE', severity: 'ERROR', group: '선수승인',
          message: `${a.name} 선수는 현재 후원 상품에 포함할 수 없습니다`, resolution: '선수 상태를 확인하거나 구성에서 제외하세요',
        });
      }
    }
    if (offer.approvalMode === 'PRE_APPROVED' && !offer.preApprovedAt) {
      issues.push({
        code: 'PREAPPROVAL_MISSING', severity: 'ERROR', group: '선수승인',
        message: '사전승인 상품인데 선수 최종 승인이 없습니다', resolution: '선수 승인 요청을 보내거나 승인 모드를 변경하세요',
      });
    }
    if (offer.preApprovalTo && new Date(offer.preApprovalTo) < now) {
      issues.push({
        code: 'APPROVAL_EXPIRED', severity: 'ERROR', group: '선수승인',
        message: '사전승인 유효기간이 지났습니다', resolution: '재승인을 받거나 일반 승인 모드로 전환하세요',
      });
    }
  }

  /* 슬롯 재고 */
  for (const b of d.stockBlockers) {
    issues.push({ code: 'RESOURCE_CONFLICT', severity: 'ERROR', group: '가격·재고', message: b, resolution: '구성 요소를 바꾸거나 기간을 조정하세요' });
  }

  /* 일정 · lead time */
  if (offer.executionFrom && offer.salesTo) {
    const gap = (new Date(offer.executionFrom).getTime() - new Date(offer.salesTo).getTime()) / 86400_000;
    if (gap < 0) {
      issues.push({ code: 'SCHEDULE_INVALID', severity: 'ERROR', group: '가격·재고', message: '판매 종료일이 실행 시작일보다 늦습니다', resolution: '판매 기간을 조정하세요' });
    } else if (gap < offer.leadTimeDays) {
      issues.push({ code: 'LEAD_TIME_TIGHT', severity: 'WARN', group: '가격·재고', message: `제작 리드타임 ${offer.leadTimeDays}일보다 여유가 적습니다`, resolution: '판매 종료일을 앞당기거나 리드타임을 조정하세요' });
    }
  }

  /* 가격 */
  const margin = marginOf(offer);
  if (offer.priceType !== 'NEGOTIABLE' && margin < 0) {
    issues.push({ code: 'NEGATIVE_MARGIN', severity: 'ERROR', group: '가격·재고', message: `마진이 ${margin.toLocaleString()}원입니다`, resolution: '판매가를 올리거나 원가를 조정하세요' });
  }
  if (offer.originalPrice != null && offer.originalPrice < offer.supplyAmount) {
    issues.push({ code: 'PRICE_INVALID', severity: 'ERROR', group: '가격·재고', message: '정가가 판매가보다 낮습니다', resolution: '정가와 판매가를 확인하세요' });
  }

  /* 권리 — 온라인 전용에 오프라인 사용 (§12.3) */
  if (offer.type === 'ONLINE_SUBSCRIPTION' && offer.offlineUse) {
    issues.push({ code: 'RIGHTS_CONFLICT', severity: 'ERROR', group: '권리·동의', message: '온라인 전용 상품에 오프라인 사용 권리가 설정되어 있습니다', resolution: '오프라인 사용을 해제하세요' });
  }

  /* 성과 근거 */
  if (Array.isArray(offer.expectedMetrics) && (offer.expectedMetrics as any[]).length && !offer.methodology) {
    issues.push({ code: 'METHOD_MISSING', severity: 'ERROR', group: '성과표현', message: '예상성과 산출 근거가 없습니다', resolution: '측정 방법과 근거 데이터를 입력하세요' });
  }
  if (offer.guaranteed) {
    issues.push({ code: 'GUARANTEE_REVIEW', severity: 'WARN', group: '성과표현', message: '성과 보장 상품은 법무 검토가 필요합니다', resolution: '보장 정책과 지원 한도를 확인하세요' });
  }

  /* 진열 — 판매기간 밖 배치 (§7.3) */
  const placements = await prisma.offerPlacement.findMany({ where: { offerId: id, status: 'ACTIVE' } });
  for (const p of placements) {
    if (offer.salesTo && p.activeTo && new Date(p.activeTo) > new Date(offer.salesTo)) {
      issues.push({ code: 'PLACEMENT_INVALID', severity: 'WARN', group: '진열', message: '판매 기간을 넘는 진열 배치가 있습니다', resolution: '배치 기간을 판매 기간 안으로 줄이세요' });
      break;
    }
  }

  const canPublish = !issues.some((i) => i.severity === 'ERROR');
  await prisma.offer.update({ where: { id }, data: { status: canPublish && offer.status === 'DRAFT' ? 'REVIEW' : offer.status } }).catch(() => null);

  return {
    result: canPublish ? 'READY' : 'BLOCKED',
    canPublish,
    issues,
    completeness: completenessOf(offer),
    /* 검토 체크리스트 — 시안 A06의 5개 그룹 */
    checklist: ['상품정보', '가격·재고', '성과표현', '권리·동의', '선수승인'].map((group) => {
      const gi = issues.filter((i) => i.group === group);
      return {
        group,
        status: gi.some((i) => i.severity === 'ERROR') ? 'ERROR' : gi.length ? 'WARN' : 'OK',
        issues: gi,
      };
    }),
  };
}

export async function publishOffer(id: string, input: { scheduledAt?: string; salesTo?: string; reviewerName?: string }, actor: { id?: string; name?: string }) {
  const check = await validateOffer(id);
  if (!check.canPublish) {
    throw Object.assign(new Error('검증을 통과하지 못했습니다'), { status: 409, code: 'PLACEMENT_INVALID' });
  }
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const offer = await prisma.offer.update({
    where: { id },
    data: {
      status: scheduled && scheduled > new Date() ? 'SCHEDULED' : 'PUBLISHED',
      scheduledAt: scheduled,
      publishedAt: scheduled && scheduled > new Date() ? null : new Date(),
      reviewerName: input.reviewerName ?? actor.name,
      ...(input.salesTo ? { salesTo: new Date(input.salesTo) } : {}),
    },
  });
  await audit(id, actor, 'PUBLISH', { scheduledAt: scheduled, status: offer.status });
  return getAdminOffer(id);
}

export async function setOfferStatus(id: string, status: 'PAUSED' | 'PUBLISHED' | 'ARCHIVED', reason: string | undefined, actor: { id?: string; name?: string }) {
  const offer = await prisma.offer.update({
    where: { id },
    data: { status, pauseReason: status === 'PAUSED' ? reason : null },
  });
  await audit(id, actor, status === 'PAUSED' ? 'PAUSE' : status === 'ARCHIVED' ? 'ARCHIVE' : 'RESUME', { reason });
  return offer;
}

export async function duplicateOffer(id: string, actor: { id?: string; name?: string }) {
  const src = await prisma.offer.findUnique({ where: { id }, include: OFFER_INCLUDE });
  if (!src) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  const suffix = Date.now().toString().slice(-4);
  const copy = await prisma.offer.create({
    data: {
      code: `${src.code}-C${suffix}`,
      slug: `${src.slug}-c${suffix}`,
      title: `${src.title} (사본)`,
      subtitle: src.subtitle, summary: src.summary, type: src.type, status: 'DRAFT',
      heroImageUrl: src.heroImageUrl, categories: src.categories, channels: src.channels, purposes: src.purposes,
      executionFrom: src.executionFrom, executionTo: src.executionTo, eventId: src.eventId,
      leadTimeDays: src.leadTimeDays, durationCode: src.durationCode, months: src.months,
      priceType: src.priceType, supplyAmount: src.supplyAmount, costAmount: src.costAmount, platformFee: src.platformFee,
      stockMode: src.stockMode, capacity: src.capacity, holdMinutes: src.holdMinutes,
      approvalMode: src.approvalMode,
      offlineUse: src.offlineUse, onlineUse: src.onlineUse, printUse: src.printUse, secondaryUse: src.secondaryUse,
      territory: src.territory, rightsNote: src.rightsNote,
      restrictions: (src.restrictions ?? undefined) as Prisma.InputJsonValue,
      methodology: src.methodology, methodVersion: src.methodVersion, confidence: src.confidence,
      ownerName: actor.name,
    },
  });
  if (src.athletes.length) {
    await prisma.offerAthlete.createMany({
      data: src.athletes.map((a) => ({ offerId: copy.id, athleteId: a.athleteId, role: a.role, sortOrder: a.sortOrder })),
    });
  }
  if (src.components.length) {
    await prisma.offerComponent.createMany({
      data: src.components.map((c) => ({
        offerId: copy.id, componentType: c.componentType, label: c.label, athleteId: c.athleteId,
        athleteSlotId: c.athleteSlotId, slotCode: c.slotCode, offerProductId: c.offerProductId,
        requiredQty: c.requiredQty, quantity: c.quantity, unitPrice: c.unitPrice, note: c.note, sortOrder: c.sortOrder,
      })),
    });
  }
  if (src.options.length) {
    await prisma.offerOption.createMany({
      data: src.options.map((o) => ({
        offerId: copy.id, kind: o.kind, code: o.code, label: o.label,
        choices: (o.choices ?? undefined) as Prisma.InputJsonValue,
        minQty: o.minQty, maxQty: o.maxQty, addPrice: o.addPrice, required: o.required, sortOrder: o.sortOrder,
      })),
    });
  }
  await audit(copy.id, actor, 'CREATE', { duplicatedFrom: id });
  return getAdminOffer(copy.id);
}

/* ── 구성 보조: 선수 슬롯 인벤토리 (§7.1 2단계) ─────── */

export async function getBuilderSlots(athleteId: string, range?: { from?: string; to?: string }) {
  const { getOffers } = await import('./directPick.service');
  const data = await getOffers(athleteId);

  /* 이 슬롯을 쓰는 다른 상품 — 기간 충돌 경고용 */
  const codes = data.slots.map((s) => s.code);
  const conflicts = codes.length
    ? await prisma.offerComponent.findMany({
        where: {
          slotCode: { in: codes },
          athleteId,
          offer: { status: { in: ['PUBLISHED', 'LOW_STOCK', 'SCHEDULED', 'REVIEW'] } },
        },
        select: { slotCode: true, offer: { select: { id: true, title: true, executionFrom: true, executionTo: true } } },
      })
    : [];

  const from = range?.from ? new Date(range.from) : null;
  const to = range?.to ? new Date(range.to) : null;
  const overlaps = (a?: Date | null, b?: Date | null) =>
    !from || !to || !a || !b ? false : new Date(a) <= to && new Date(b) >= from;

  return {
    slots: data.slots.map((s) => {
      const conf = conflicts.filter((c) => c.slotCode === s.code && overlaps(c.offer.executionFrom, c.offer.executionTo));
      return {
        ...s,
        conflicts: conf.map((c) => ({
          offerId: c.offer.id, title: c.offer.title,
          from: c.offer.executionFrom, to: c.offer.executionTo,
        })),
      };
    }),
    offers: data.offers,
    viewCounts: data.viewCounts,
  };
}

/* ── 진열 (§8.2 · §8.3) ─────────────────────────────── */

export async function listPlacements(surface?: string) {
  const rows = await prisma.offerPlacement.findMany({
    where: surface ? { surface } : {},
    include: { offer: { include: OFFER_INCLUDE } },
    orderBy: [{ surface: 'asc' }, { sectionKey: 'asc' }, { pinned: 'desc' }, { rank: 'asc' }],
  });
  const decorated = await Promise.all(rows.map(async (p) => ({ ...p, offer: await decorateOffer(p.offer) })));
  return {
    placements: decorated,
    sections: SECTIONS.map((s) => ({ ...s, items: decorated.filter((p) => p.sectionKey === s.key) })),
  };
}

export async function upsertPlacement(input: any, actor: { id?: string; name?: string }) {
  const offer = await prisma.offer.findUnique({ where: { id: input.offerId }, select: { id: true, salesTo: true } });
  if (!offer) throw Object.assign(new Error('상품을 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });

  /* 판매 기간을 벗어난 배치는 만들 수 없다 (§8.3) */
  if (input.activeTo && offer.salesTo && new Date(input.activeTo) > new Date(offer.salesTo)) {
    throw Object.assign(
      new Error(`상품 판매 종료일(${new Date(offer.salesTo).toLocaleDateString('ko-KR')}) 이후로는 진열할 수 없습니다`),
      { status: 400, code: 'PLACEMENT_INVALID' },
    );
  }

  const data = {
    offerId: input.offerId,
    surface: input.surface || 'AVAILABLE_LIST',
    sectionKey: input.sectionKey || 'READY_NOW',
    rank: input.rank ?? 100,
    pinned: !!input.pinned,
    activeFrom: input.activeFrom ? new Date(input.activeFrom) : null,
    activeTo: input.activeTo ? new Date(input.activeTo) : null,
    audience: (input.audience ?? undefined) as Prisma.InputJsonValue,
    badge: input.badge,
    reason: input.reason,
    isSponsored: !!input.isSponsored,
    dailyCap: input.dailyCap ?? null,
    status: input.status || 'ACTIVE',
  };

  const placement = input.id
    ? await prisma.offerPlacement.update({ where: { id: input.id }, data })
    : await prisma.offerPlacement.create({ data });

  /* 배치 변경은 상품 version을 올리지 않고 placement audit만 남긴다 (§8.3) */
  await audit(input.offerId, actor, 'PLACEMENT', { surface: data.surface, sectionKey: data.sectionKey, rank: data.rank });
  return placement;
}

export async function removePlacement(id: string, actor: { id?: string; name?: string }) {
  const p = await prisma.offerPlacement.findUnique({ where: { id } });
  if (!p) throw Object.assign(new Error('배치를 찾을 수 없습니다'), { status: 404, code: 'NOT_FOUND' });
  await prisma.offerPlacement.delete({ where: { id } });
  await audit(p.offerId, actor, 'PLACEMENT', { removed: true });
  return { ok: true };
}

/* ── 판매·전환·재고 대시보드 (§11.4) ────────────────── */

export async function getDashboard(range?: { from?: string; to?: string }) {
  const to = range?.to ? new Date(range.to) : new Date();
  const from = range?.from ? new Date(range.from) : new Date(to.getTime() - 21 * 86400_000);

  const rows = await prisma.offer.findMany({ include: OFFER_INCLUDE, take: 300 });
  const list = await Promise.all(rows.map(decorateOffer));

  const [cartCount, savedCount, apps] = await Promise.all([
    prisma.offerCartItem.count(),
    prisma.savedOffer.count(),
    prisma.sponsorshipApplication.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, status: true, totalAmount: true, createdAt: true, paidAt: true, snapshot: true },
    }),
  ]);

  const paid = apps.filter((a) => a.status === 'ACTIVE');
  const impression = list.reduce((s, o) => s + o.viewCount, 0);
  const detail = list.reduce((s, o) => s + o.detailCount, 0);
  const save = savedCount + list.reduce((s, o) => s + o.saveCount, 0);
  const checkout = apps.length;
  const purchase = paid.length;
  const revenue = paid.reduce((s, a) => s + a.totalAmount, 0);

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  /* 일별 매출 */
  const days: { date: string; revenue: number; count: number }[] = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400_000)) {
    const key = d.toISOString().slice(0, 10);
    const same = paid.filter((a) => (a.paidAt || a.createdAt).toISOString().slice(0, 10) === key);
    days.push({ date: key, revenue: same.reduce((s, a) => s + a.totalAmount, 0), count: same.length });
  }

  const byOffer = list
    .map((o) => ({
      id: o.id, code: o.code, title: o.title, type: o.type,
      heroImageUrl: o.heroImageUrl,
      view: o.viewCount, detail: o.detailCount, save: o.saveCount, sold: o.soldQty,
      revenue: o.soldQty * o.supplyAmount,
      saveToBuy: pct(o.soldQty, o.saveCount),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const byAthlete = new Map<string, { id: string; name: string; profileImageUrl: string | null; offers: number; sold: number; revenue: number }>();
  for (const o of list) {
    for (const a of o.athletes) {
      const cur = byAthlete.get(a.athleteId) || {
        id: a.athleteId, name: a.athlete.name, profileImageUrl: a.athlete.profileImageUrl, offers: 0, sold: 0, revenue: 0,
      };
      cur.offers += 1;
      cur.sold += o.soldQty;
      cur.revenue += o.soldQty * o.supplyAmount;
      byAthlete.set(a.athleteId, cur);
    }
  }

  const byChannel = new Map<string, number>();
  for (const o of list) for (const c of o.channels) byChannel.set(c, (byChannel.get(c) || 0) + o.soldQty);

  const alerts = await getAlerts();

  return {
    range: { from, to },
    kpis: {
      impression, detail, save, checkout, purchase, revenue,
      cartCount,
    },
    funnel: [
      { key: 'IMPRESSION', label: '노출', value: impression, rate: 100 },
      { key: 'DETAIL', label: '상세조회', value: detail, rate: pct(detail, impression) },
      { key: 'SAVE', label: '보관 (찜)', value: save, rate: pct(save, detail) },
      { key: 'CHECKOUT', label: '결제진입', value: checkout, rate: pct(checkout, save) },
      { key: 'PURCHASE', label: '구매', value: purchase, rate: pct(purchase, checkout) },
    ],
    daily: days,
    rates: {
      saveToBuy: pct(purchase, save),
      detailToBuy: pct(purchase, detail),
      checkoutToBuy: pct(purchase, checkout),
      cancelRate: pct(apps.filter((a) => a.status === 'CANCELLED').length, apps.length),
      lowStockRatio: pct(list.filter((o) => o.displayStatus === 'LOW_STOCK').length, list.length),
    },
    topOffers: byOffer.slice(0, 3),
    byOffer: byOffer.slice(0, 20),
    byAthlete: [...byAthlete.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    byChannel: [...byChannel.entries()].map(([channel, sold]) => ({ channel, sold })).sort((a, b) => b.sold - a.sold),
    alerts: alerts.alerts.slice(0, 5),
  };
}

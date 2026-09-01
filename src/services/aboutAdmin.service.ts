/**
 * 소개 운영 관리자 IA01~IA14 (핸드오프 v1.0 2026-08-22 §20)
 *
 * 게시 차단 규칙 (§5.4)
 *  출처 없는 성과수치, 만료된 초상·로고 사용권, 계약 당사자 반대,
 *  개인정보 포함, 승인되지 않은 인용문이 있으면 게시할 수 없다.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { logAdmin } from './fanAdmin.service';
import { evaluate } from './guarantee.service';

const prisma = new PrismaClient();
const DAY = 86400_000;
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** 사례 상태 머신 (§6.2) */
export const CASE_STATES = [
  { code: 'DRAFT', label: '작성 중', next: ['IN_REVIEW'] },
  { code: 'IN_REVIEW', label: '검토 중', next: ['DRAFT', 'AWAITING_PARTY', 'APPROVED'] },
  { code: 'AWAITING_PARTY', label: '당사자 승인 대기', next: ['APPROVED', 'IN_REVIEW'] },
  { code: 'APPROVED', label: '승인 완료', next: ['SCHEDULED', 'PUBLISHED'] },
  { code: 'SCHEDULED', label: '예약 발행', next: ['PUBLISHED', 'APPROVED'] },
  { code: 'PUBLISHED', label: '게시 중', next: ['ARCHIVED', 'ON_HOLD'] },
  { code: 'ARCHIVED', label: '보관', next: [] },
  { code: 'ON_HOLD', label: '법무 보류', next: ['IN_REVIEW', 'ARCHIVED'] },
] as const;

export const BLOCK_TYPES = [
  { code: 'HERO', label: '히어로', pages: 'ALL', rule: '제목·설명·CTA 1개' },
  { code: 'FEATURE_GRID', label: '핵심 기능 카드', pages: 'service', rule: '3~6개' },
  { code: 'CASE_CAROUSEL', label: '사례 캐러셀', pages: 'service,brands', rule: '공개 사례만' },
  { code: 'METRIC_STRIP', label: '성과 스트립', pages: 'cases,guarantee', rule: 'source 연결 필수' },
  { code: 'STEPS', label: '단계 안내', pages: 'guarantee,how-it-works', rule: '3~6단계' },
  { code: 'FAQ', label: 'FAQ', pages: 'guarantee,how-it-works', rule: '질문 중복 검사' },
  { code: 'BRAND_GRID', label: '브랜드 그리드', pages: 'service,brands', rule: '권리 유효 브랜드만' },
  { code: 'INSTAGRAM_CTA', label: '인스타 CTA', pages: 'service', rule: '공식 URL 고정' },
  { code: 'LEGAL_NOTE', label: '법적 고지', pages: 'guarantee,cases', rule: '법무 승인 버전' },
] as const;

export const CMS_ROLES = [
  { code: 'CONTENT_EDITOR', label: '콘텐츠 에디터', can: '초안 작성·에셋 업로드·미리보기' },
  { code: 'DATA_REVIEWER', label: '데이터 검수자', can: '성과 지표·출처·공개범위 검수' },
  { code: 'BRAND_MANAGER', label: '브랜드 매니저', can: '브랜드 정보·로고 승인 확인' },
  { code: 'LEGAL_REVIEWER', label: '법무 검토자', can: '성과보장·표현·권리 검토' },
  { code: 'PUBLISHER', label: '게시 담당', can: '예약·게시·종료' },
  { code: 'SUPER_ADMIN', label: '최고 관리자', can: '권한·긴급중단·복구' },
] as const;

/* ── IA01 소개 운영 대시보드 ────────────────────────── */

export async function getDashboard() {
  const now = new Date();
  const in30 = new Date(+now + 30 * DAY);
  const stale = new Date(+now - 90 * DAY);

  const [
    published, awaitingReview, staleCases, expiringRights,
    missingEvidence, guaranteeExceptions, statusGroups, recentLogs,
  ] = await Promise.all([
    prisma.matchingCase.count({ where: { status: 'PUBLISHED' } }),
    prisma.matchingCase.count({ where: { status: { in: ['IN_REVIEW', 'AWAITING_PARTY'] } } }),
    prisma.matchingCase.count({ where: { status: 'PUBLISHED', publishedAt: { lt: stale } } }),
    prisma.rightsGrant.count({ where: { status: { in: ['VALID', 'EXPIRING'] }, validTo: { gte: now, lte: in30 } } }),
    prisma.caseMetric.count({ where: { OR: [{ sourceName: null }, { sourceId: null }], case: { status: { not: 'ARCHIVED' } } } }),
    prisma.guaranteeSnapshot.count({ where: { status: { in: ['DATA_PENDING', 'APPEALED'] } } }),
    prisma.matchingCase.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.adminActionLog.findMany({
      where: { targetType: { in: ['CONTENT_PAGE', 'MATCHING_CASE', 'PARTNER_BRAND', 'GUARANTEE_POLICY', 'RIGHTS_GRANT'] } },
      orderBy: { createdAt: 'desc' }, take: 8,
    }),
  ]);

  const totalCases = statusGroups.reduce((s, g) => s + g._count._all, 0);

  /* 오늘 처리할 일 — 마감이 있는 것부터 */
  const [rightsQueue, pendingApprovals, dataPending] = await Promise.all([
    prisma.rightsGrant.findMany({
      where: { status: { in: ['VALID', 'EXPIRING'] }, validTo: { gte: now, lte: in30 } },
      orderBy: { validTo: 'asc' }, take: 5,
    }),
    prisma.caseApproval.findMany({
      where: { status: { in: ['PENDING', 'VIEWED', 'CHANGES_REQUESTED'] } },
      orderBy: { requestedAt: 'asc' }, take: 5,
      include: { case: { select: { id: true, title: true } } },
    }),
    prisma.guaranteeObservation.findMany({
      where: { collectStatus: 'PENDING', nextCheckAt: { lt: now } },
      orderBy: { nextCheckAt: 'asc' }, take: 5,
      include: { snapshot: { select: { id: true, brandName: true, athleteName: true } } },
    }),
  ]);

  const todo = [
    ...rightsQueue.map((r) => ({
      id: r.id, priority: r.validTo && +r.validTo - +now < 7 * DAY ? '긴급' : '높음',
      task: `권리 만료 임박: ${r.assetName}`,
      owner: r.ownerTeam ?? '권리 관리자',
      dueAt: r.validTo,
      to: `/admin/about/rights?id=${r.id}`, action: '확인하기',
    })),
    ...pendingApprovals.map((a) => ({
      id: a.id, priority: '높음',
      task: `당사자 승인 대기: ${a.case.title}`,
      owner: '콘텐츠 에디터',
      dueAt: a.expiresAt,
      to: `/admin/about/cases/${a.caseId}/approval`, action: '검토하기',
    })),
    ...dataPending.map((o) => ({
      id: o.id, priority: '보통',
      task: `DATA_PENDING: ${o.label} (${o.snapshot.brandName ?? ''})`,
      owner: '데이터 관리자',
      dueAt: o.nextCheckAt,
      to: `/admin/about/guarantee/${o.snapshotId}`, action: '확인하기',
    })),
  ];

  return {
    kpis: [
      { key: 'published', label: '게시 콘텐츠', value: published, unit: '건', sub: '전체 사례 기준' },
      { key: 'review', label: '승인 대기', value: awaitingReview, unit: '건', sub: '리뷰가 필요한 항목' },
      { key: 'stale', label: '갱신 필요', value: staleCases, unit: '건', sub: '기준일 90일 경과' },
      { key: 'rights', label: '권리 만료 임박', value: expiringRights, unit: '건', sub: '30일 이내 만료 예정' },
      { key: 'evidence', label: '출처 미연결', value: missingEvidence, unit: '건', sub: '게시 차단 대상' },
      { key: 'guarantee', label: '보장 예외', value: guaranteeExceptions, unit: '건', sub: '데이터 대기·이의제기' },
    ],
    pipeline: CASE_STATES.filter((s) => s.code !== 'ARCHIVED').map((s) => {
      const n = statusGroups.find((g) => g.status === s.code)?._count._all ?? 0;
      return { code: s.code, label: s.label, count: n, percent: rate(n, totalCases) };
    }),
    todo: todo.slice(0, 8),
    todoTotal: todo.length,
    health: [
      { key: 'stale', label: '90일 이상 미갱신 콘텐츠', count: staleCases, threshold: 5, level: staleCases > 5 ? '주의' : '정상' },
      { key: 'rights', label: '권리 만료 임박 (30일 이내)', count: expiringRights, threshold: 0, level: expiringRights > 0 ? '주의' : '정상' },
      { key: 'evidence', label: '출처 없는 성과 지표', count: missingEvidence, threshold: 0, level: missingEvidence > 0 ? '경고' : '정상' },
      { key: 'guarantee', label: '보장 데이터 대기·이의', count: guaranteeExceptions, threshold: 0, level: guaranteeExceptions > 0 ? '주의' : '정상' },
    ],
    activities: recentLogs.map((l) => ({
      id: l.id, at: l.createdAt, action: l.action, target: l.targetType,
      actor: l.actorId, reason: l.reason,
    })),
    notice: '집계할 데이터가 없는 항목은 비율을 만들지 않고 비워 둡니다.',
  };
}

/* ── IA02 페이지 · 메뉴 CMS ─────────────────────────── */

export async function listPages() {
  const pages = await prisma.contentPage.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { blocks: true } } },
  });
  return {
    pages: pages.map((p) => ({
      id: p.id, slug: p.slug, title: p.title, menuLabel: p.menuLabel, menuDesc: p.menuDesc,
      status: p.status, version: p.version, blocks: p._count.blocks,
      publishedAt: p.publishedAt, updatedAt: p.updatedAt,
    })),
    blockTypes: BLOCK_TYPES,
    roles: CMS_ROLES,
  };
}

export async function getPageAdmin(id: string) {
  const p = await prisma.contentPage.findUnique({
    where: { id }, include: { blocks: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!p) return null;

  /* 검증 체크리스트 (시안 IA02 우측) */
  const checks = [
    { key: 'required', label: '필수 필드 입력', ok: !!p.title && p.blocks.length > 0 },
    { key: 'alt', label: '이미지 대체 텍스트', ok: p.blocks.every((b: any) => !(b.payload?.imageUrl) || !!b.payload?.imageAlt) },
    { key: 'links', label: '내부 링크 정상', ok: p.blocks.every((b: any) => !b.payload?.ctaTo || String(b.payload.ctaTo).startsWith('/')) },
    { key: 'menuLabel', label: '메뉴 라벨 길이', ok: !p.menuLabel || p.menuLabel.length <= 12 },
    { key: 'seo', label: 'SEO 설명', ok: !!p.seoDesc },
  ];

  return {
    page: {
      id: p.id, slug: p.slug, title: p.title, menuLabel: p.menuLabel, menuDesc: p.menuDesc,
      status: p.status, version: p.version, locale: p.locale,
      seoTitle: p.seoTitle, seoDesc: p.seoDesc, ogImageUrl: p.ogImageUrl,
      scheduledAt: p.scheduledAt, publishedAt: p.publishedAt, updatedAt: p.updatedAt,
    },
    blocks: p.blocks.map((b) => ({
      id: b.id, type: b.type, name: b.name, payload: b.payload,
      visible: b.visible, sortOrder: b.sortOrder,
    })),
    blockTypes: BLOCK_TYPES,
    checks,
    canPublish: checks.filter((c) => c.key !== 'seo').every((c) => c.ok),
  };
}

export async function savePage(input: any & { adminId: string }) {
  const data = {
    slug: input.slug, title: input.title,
    menuLabel: input.menuLabel, menuDesc: input.menuDesc,
    seoTitle: input.seoTitle, seoDesc: input.seoDesc, ogImageUrl: input.ogImageUrl,
    sortOrder: input.sortOrder ?? 0,
    updatedBy: input.adminId,
  };
  const page = input.id
    ? await prisma.contentPage.update({ where: { id: input.id }, data })
    : await prisma.contentPage.create({ data: { ...data, status: 'DRAFT' } });

  /* 블록 전체 교체 — 순서와 표시 여부를 그대로 반영한다 */
  if (Array.isArray(input.blocks)) {
    await prisma.contentBlock.deleteMany({ where: { pageId: page.id } });
    await prisma.contentBlock.createMany({
      data: input.blocks.map((b: any, i: number) => ({
        pageId: page.id, type: b.type, name: b.name,
        payload: b.payload ?? {}, visible: b.visible !== false, sortOrder: i,
      })),
    });
  }

  await logAdmin(input.adminId, input.id ? 'CONTENT_PAGE_SAVE' : 'CONTENT_PAGE_CREATE', 'CONTENT_PAGE', page.id, input.title, {});
  return { page };
}

export async function publishPage(id: string, adminId: string, scheduledAt?: string) {
  const detail = await getPageAdmin(id);
  if (!detail) throw Object.assign(new Error('페이지를 찾을 수 없습니다'), { status: 404 });
  if (!detail.canPublish) {
    const failed = detail.checks.filter((c) => !c.ok).map((c) => c.label);
    throw Object.assign(new Error(`검증을 통과하지 못했습니다: ${failed.join(', ')}`), { status: 400, code: 'VALIDATION' });
  }

  const page = await prisma.contentPage.update({
    where: { id },
    data: scheduledAt
      ? { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt), publishedBy: adminId }
      : { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: adminId, version: { increment: 1 } },
  });
  await logAdmin(adminId, scheduledAt ? 'CONTENT_PAGE_SCHEDULE' : 'CONTENT_PAGE_PUBLISH', 'CONTENT_PAGE', id, undefined, { scheduledAt });
  return { page };
}

/* ── IA03 · IA04 매칭사례 목록 · 편집 ───────────────── */

export async function listCasesAdmin(params: {
  status?: string; verified?: string; rights?: string; assignee?: string;
  brand?: string; q?: string; page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);

  const where: Prisma.MatchingCaseWhereInput = {
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
    ...(params.assignee ? { assigneeId: params.assignee } : {}),
    ...(params.q
      ? { OR: [{ title: { contains: params.q, mode: 'insensitive' } }, { code: { contains: params.q, mode: 'insensitive' } }] }
      : {}),
    ...(params.brand ? { partnerBrand: { displayName: { contains: params.brand, mode: 'insensitive' } } } : {}),
  };

  const [rows, total, groups, rightsExpiring, rightsExpired] = await Promise.all([
    prisma.matchingCase.findMany({
      where, orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
      include: {
        partnerBrand: { select: { displayName: true, logoLight: true } },
        metrics: { select: { verificationStatus: true, sourceName: true } },
        approvals: { select: { party: true, status: true } },
      },
    }),
    prisma.matchingCase.count({ where }),
    prisma.matchingCase.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.rightsGrant.count({ where: { status: { in: ['VALID', 'EXPIRING'] }, validTo: { gte: new Date(), lte: new Date(Date.now() + 30 * DAY) } } }),
    prisma.rightsGrant.count({ where: { status: 'EXPIRED' } }),
  ]);

  return {
    cases: rows.map((c) => {
      const verified = c.metrics.length > 0 && c.metrics.every((m) => ['VERIFIED', 'FINAL'].includes(m.verificationStatus));
      const noSource = c.metrics.some((m) => !m.sourceName);
      const partyDone = c.approvals.length > 0 && c.approvals.every((a) => a.status === 'APPROVED');
      return {
        id: c.id, code: c.code, title: c.title,
        brandName: c.partnerBrand?.displayName ?? c.brandName,
        brandLogoUrl: c.partnerBrand?.logoLight ?? null,
        athleteName: c.athleteName,
        status: c.status,
        statusLabel: CASE_STATES.find((s) => s.code === c.status)?.label ?? c.status,
        verificationLabel: c.metrics.length === 0 ? '미검증' : verified ? '검증 완료' : noSource ? '보완 필요' : '검토 중',
        verificationTone: c.metrics.length === 0 ? 'slate' : verified ? 'emerald' : noSource ? 'rose' : 'sky',
        partyLabel: c.approvals.length === 0 ? '미요청' : partyDone ? '승인 완료' : '승인 대기',
        assigneeId: c.assigneeId,
        publishedAt: c.publishedAt,
        updatedAt: c.updatedAt,
      };
    }),
    total, page, limit,
    summary: {
      total: groups.reduce((s, g) => s + g._count._all, 0),
      byStatus: CASE_STATES.map((s) => ({
        code: s.code, label: s.label,
        count: groups.find((g) => g.status === s.code)?._count._all ?? 0,
      })),
      rightsExpiring, rightsExpired,
    },
    states: CASE_STATES,
  };
}

export async function getCaseAdmin(id: string) {
  const c = await prisma.matchingCase.findUnique({
    where: { id },
    include: {
      partnerBrand: true,
      metrics: { orderBy: { sortOrder: 'asc' } },
      quotes: true,
      approvals: true,
    },
  });
  if (!c) return null;

  return {
    case: {
      id: c.id, code: c.code, slug: c.slug, title: c.title, summary: c.summary,
      background: c.background,
      partnerBrandId: c.partnerBrandId, brandName: c.partnerBrand?.displayName ?? c.brandName,
      athleteId: c.athleteId, athleteName: c.athleteName,
      contractId: c.contractId,
      sport: c.sport, tour: c.tour,
      sponsorTypes: c.sponsorTypes, objectiveCodes: c.objectiveCodes,
      heroImageUrl: c.heroImageUrl,
      periodFrom: c.periodFrom, periodTo: c.periodTo,
      executionBlocks: c.executionBlocks, timeline: c.timeline,
      status: c.status,
      statusLabel: CASE_STATES.find((s) => s.code === c.status)?.label ?? c.status,
      nextStates: CASE_STATES.find((s) => s.code === c.status)?.next ?? [],
      visibility: c.visibility, verified: c.verified, featured: c.featured,
      scheduledAt: c.scheduledAt, publishedAt: c.publishedAt,
      updatedAt: c.updatedAt,
    },
    metrics: c.metrics,
    quotes: c.quotes,
    approvals: c.approvals,
    gate: await publishGate(c.id),
  };
}

/**
 * 게시 게이트 (§5.4) — 하나라도 막히면 게시할 수 없다.
 */
export async function publishGate(caseId: string) {
  const c = await prisma.matchingCase.findUnique({
    where: { id: caseId },
    include: { metrics: true, quotes: true, approvals: true, partnerBrand: true },
  });
  if (!c) return { ok: false, blockers: [{ code: 'NOT_FOUND', label: '사례를 찾을 수 없습니다' }], checks: [] };

  const now = new Date();
  const rights = await prisma.rightsGrant.findMany({
    where: {
      OR: [
        ...(c.athleteId ? [{ athleteId: c.athleteId }] : []),
        ...(c.partnerBrandId ? [{ partnerBrandId: c.partnerBrandId }] : []),
      ],
    },
  });
  const expiredRights = rights.filter((r) => r.status === 'EXPIRED' || r.status === 'REVOKED' || (r.validTo && r.validTo < now));
  const noEvidence = c.metrics.filter((m) => !m.sourceName || !m.sourceType);
  const unapprovedQuotes = c.quotes.filter((q) => !q.approved);
  const partyBlocked = c.approvals.filter((a) => a.status === 'CHANGES_REQUESTED');
  const partyPending = c.approvals.filter((a) => ['PENDING', 'VIEWED'].includes(a.status));

  const checks = [
    { code: 'CONTRACT', label: '계약·캠페인 연결', ok: !!c.contractId, detail: c.contractId ? null : '계약 ID가 연결되지 않았습니다' },
    { code: 'EVIDENCE', label: '성과 수치 출처', ok: noEvidence.length === 0, detail: noEvidence.length ? `${noEvidence.length}건의 지표에 출처가 없습니다` : null },
    { code: 'RIGHTS', label: '초상·로고 사용권', ok: expiredRights.length === 0, detail: expiredRights.length ? `만료·철회된 권리 ${expiredRights.length}건` : null },
    { code: 'QUOTES', label: '인용문 승인', ok: unapprovedQuotes.length === 0, detail: unapprovedQuotes.length ? `승인되지 않은 인용문 ${unapprovedQuotes.length}건` : null },
    { code: 'PARTY', label: '당사자 승인', ok: partyBlocked.length === 0 && partyPending.length === 0, detail: partyBlocked.length ? '당사자가 변경을 요청했습니다' : partyPending.length ? '승인 대기 중입니다' : null },
    { code: 'VISIBILITY', label: '지표별 공개범위 지정', ok: c.metrics.every((m) => !!m.visibility), detail: null },
  ];

  const blockers = checks.filter((c2) => !c2.ok).map((c2) => ({ code: c2.code, label: c2.label, detail: c2.detail }));
  return { ok: blockers.length === 0, blockers, checks };
}

export async function saveCase(input: any & { adminId: string }) {
  if (!input.title?.trim()) throw Object.assign(new Error('사례 제목을 입력해주세요'), { status: 400 });

  const slug = input.slug || `case-${Date.now().toString(36)}`;
  const code = input.code || `SP-${new Date().getFullYear()}-${String(await prisma.matchingCase.count() + 1).padStart(5, '0')}`;

  const data = {
    title: input.title, summary: input.summary, background: input.background,
    partnerBrandId: input.partnerBrandId || null,
    athleteId: input.athleteId || null,
    athleteName: input.athleteName, brandName: input.brandName,
    contractId: input.contractId || null,
    sport: input.sport, tour: input.tour,
    sponsorTypes: input.sponsorTypes ?? [],
    objectiveCodes: input.objectiveCodes ?? [],
    heroImageUrl: input.heroImageUrl,
    periodFrom: input.periodFrom ? new Date(input.periodFrom) : null,
    periodTo: input.periodTo ? new Date(input.periodTo) : null,
    executionBlocks: input.executionBlocks ?? undefined,
    timeline: input.timeline ?? undefined,
    visibility: input.visibility ?? 'PUBLIC_EXACT',
    featured: !!input.featured,
  };

  const c = input.id
    ? await prisma.matchingCase.update({ where: { id: input.id }, data })
    : await prisma.matchingCase.create({ data: { ...data, slug, code, status: 'DRAFT', createdBy: input.adminId } });

  /* 지표 전체 교체 — 출처 없는 값도 저장은 하되 게이트에서 막는다 */
  if (Array.isArray(input.metrics)) {
    await prisma.caseMetric.deleteMany({ where: { caseId: c.id } });
    if (input.metrics.length) {
      await prisma.caseMetric.createMany({
        data: input.metrics.map((m: any, i: number) => ({
          caseId: c.id,
          metricCode: m.metricCode ?? `metric_${i}`,
          label: m.label,
          definition: m.definition,
          definitionVersion: m.definitionVersion,
          value: Number(m.value) || 0,
          unit: m.unit ?? '',
          displayValue: m.displayValue,
          periodStart: m.periodStart ? new Date(m.periodStart) : null,
          periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
          sourceType: m.sourceType ?? 'MANUAL',
          sourceName: m.sourceName,
          sourceId: m.sourceId,
          evidenceUri: m.evidenceUri,
          aggregationNote: m.aggregationNote,
          verificationStatus: m.verificationStatus ?? 'RAW',
          visibility: m.visibility ?? 'MEMBER_ONLY',
          isPrimary: !!m.isPrimary,
          sortOrder: i,
        })),
      });
    }
  }

  await logAdmin(input.adminId, input.id ? 'MATCHING_CASE_SAVE' : 'MATCHING_CASE_CREATE', 'MATCHING_CASE', c.id, input.title, {});
  return { case: c };
}

export async function moveCaseState(input: { id: string; to: string; reason?: string; scheduledAt?: string; adminId: string }) {
  const c = await prisma.matchingCase.findUnique({ where: { id: input.id } });
  if (!c) throw Object.assign(new Error('사례를 찾을 수 없습니다'), { status: 404 });

  const def = CASE_STATES.find((s) => s.code === c.status);
  if (!def || !(def.next as readonly string[]).includes(input.to)) {
    /* 법무 보류는 어느 상태에서든 가능 (§6.2 ANY) */
    if (input.to !== 'ON_HOLD') {
      throw Object.assign(new Error(`${def?.label ?? c.status} 상태에서는 이동할 수 없습니다`), { status: 400, code: 'INVALID_TRANSITION' });
    }
  }

  if (input.to === 'PUBLISHED' || input.to === 'SCHEDULED') {
    const gate = await publishGate(c.id);
    if (!gate.ok) {
      throw Object.assign(
        new Error(`게시할 수 없습니다: ${gate.blockers.map((b) => b.label).join(', ')}`),
        { status: 400, code: 'PUBLISH_BLOCKED', blockers: gate.blockers },
      );
    }
  }
  if (input.to === 'ON_HOLD' && !input.reason?.trim()) {
    throw Object.assign(new Error('보류 사유를 입력해주세요'), { status: 400 });
  }

  const updated = await prisma.matchingCase.update({
    where: { id: c.id },
    data: {
      status: input.to,
      ...(input.to === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      ...(input.to === 'SCHEDULED' && input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}),
      ...(input.to === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      ...(input.to === 'ON_HOLD' ? { holdReason: input.reason } : {}),
    },
  });

  await logAdmin(input.adminId, `MATCHING_CASE_${input.to}`, 'MATCHING_CASE', c.id, input.reason, { from: c.status, to: input.to });
  return { case: updated };
}

/* ── IA05 공개범위 · 근거 검수 ──────────────────────── */

export async function getEvidenceReview(caseId: string) {
  const c = await prisma.matchingCase.findUnique({
    where: { id: caseId },
    include: {
      partnerBrand: { select: { displayName: true, logoLight: true } },
      metrics: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!c) return null;

  const done = c.metrics.filter((m) => ['VERIFIED', 'FINAL'].includes(m.verificationStatus)).length;

  return {
    case: {
      id: c.id, code: c.code, title: c.title,
      brandName: c.partnerBrand?.displayName ?? c.brandName,
      brandLogoUrl: c.partnerBrand?.logoLight ?? null,
      athleteName: c.athleteName,
      periodFrom: c.periodFrom, periodTo: c.periodTo,
    },
    progress: { done, total: c.metrics.length },
    metrics: c.metrics.map((m) => ({
      id: m.id, metricCode: m.metricCode, label: m.label,
      value: m.value, unit: m.unit, displayValue: m.displayValue,
      definition: m.definition, aggregationNote: m.aggregationNote,
      sourceType: m.sourceType, sourceName: m.sourceName, sourceId: m.sourceId,
      evidenceUri: m.evidenceUri,
      periodStart: m.periodStart, periodEnd: m.periodEnd,
      verificationStatus: m.verificationStatus,
      verifiedAt: m.verifiedAt,
      visibility: m.visibility,
      /* 영업비밀·개인정보 항목은 PUBLIC 으로 올릴 수 없다 (§16.2) */
      canPublicize: !['PARTY_ONLY', 'PRIVATE'].includes(m.visibility) || false,
      lockReason: ['PARTY_ONLY', 'PRIVATE'].includes(m.visibility)
        ? '계약 금액·내부 KPI 등 비공개 지정 항목은 PUBLIC으로 변경할 수 없습니다'
        : null,
      hasEvidence: !!m.sourceName,
    })),
    visibilityOptions: [
      { code: 'PUBLIC_EXACT', label: 'PUBLIC (정확한 수치)' },
      { code: 'PUBLIC_RANGE', label: 'PUBLIC (범위)' },
      { code: 'PUBLIC_LABEL', label: 'PUBLIC (정성 라벨)' },
      { code: 'MEMBER_ONLY', label: 'MEMBER_ONLY (로그인)' },
      { code: 'PARTY_ONLY', label: 'PARTY_ONLY (계약 당사자)' },
      { code: 'PRIVATE', label: 'PRIVATE (표시 안 함)' },
    ],
    notice: '출처가 연결되지 않은 지표가 하나라도 있으면 사례를 게시할 수 없습니다.',
  };
}

export async function reviewMetric(input: {
  metricId: string; visibility?: string; verificationStatus?: string;
  sourceName?: string; sourceType?: string; evidenceUri?: string; note?: string; adminId: string;
}) {
  const m = await prisma.caseMetric.findUnique({ where: { id: input.metricId } });
  if (!m) throw Object.assign(new Error('지표를 찾을 수 없습니다'), { status: 404 });

  /* PARTY_ONLY / PRIVATE 로 지정된 항목을 공개로 올리려면 상대방 동의가 필요하다 (§16.2) */
  if (input.visibility?.startsWith('PUBLIC') && ['PARTY_ONLY', 'PRIVATE'].includes(m.visibility)) {
    throw Object.assign(
      new Error('영업비밀·비공개로 지정된 항목은 상대방 동의 없이 PUBLIC으로 변경할 수 없습니다'),
      { status: 400, code: 'VISIBILITY_LOCKED' },
    );
  }
  if (input.verificationStatus === 'VERIFIED' && !(input.sourceName ?? m.sourceName)) {
    throw Object.assign(new Error('출처가 없는 지표는 검증 완료로 바꿀 수 없습니다'), { status: 400, code: 'NO_SOURCE' });
  }

  const updated = await prisma.caseMetric.update({
    where: { id: input.metricId },
    data: {
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.verificationStatus ? { verificationStatus: input.verificationStatus } : {}),
      ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.evidenceUri !== undefined ? { evidenceUri: input.evidenceUri } : {}),
      ...(input.verificationStatus === 'VERIFIED' ? { verifiedAt: new Date(), verifiedBy: input.adminId } : {}),
    },
  });

  await logAdmin(input.adminId, 'CASE_METRIC_REVIEW', 'MATCHING_CASE', m.caseId, input.note, {
    metricId: m.id, before: { visibility: m.visibility, verificationStatus: m.verificationStatus },
    after: { visibility: updated.visibility, verificationStatus: updated.verificationStatus },
  });
  return { metric: updated };
}

/* ── IA06 당사자 승인 ───────────────────────────────── */

export async function getCaseApproval(caseId: string) {
  const c = await prisma.matchingCase.findUnique({
    where: { id: caseId },
    include: {
      approvals: true, quotes: true,
      partnerBrand: { select: { displayName: true, logoLight: true } },
      metrics: { where: { visibility: { startsWith: 'PUBLIC' } }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!c) return null;

  const gate = await publishGate(caseId);
  const brand = c.approvals.find((a) => a.party === 'BRAND');
  const athlete = c.approvals.find((a) => a.party === 'ATHLETE');

  return {
    case: {
      id: c.id, code: c.code, title: c.title,
      brandName: c.partnerBrand?.displayName ?? c.brandName,
      athleteName: c.athleteName,
      heroImageUrl: c.heroImageUrl,
      status: c.status,
    },
    parties: [
      { party: 'BRAND', label: '브랜드', name: c.partnerBrand?.displayName ?? c.brandName, ...shapeApproval(brand) },
      { party: 'ATHLETE', label: '선수', name: c.athleteName, ...shapeApproval(athlete) },
    ],
    /* 항목별 승인 대상 */
    items: [
      { key: 'heroImage', label: '대표 이미지', preview: c.heroImageUrl },
      { key: 'logo', label: '브랜드 로고', preview: c.partnerBrand?.logoLight },
      ...c.quotes.map((q) => ({ key: `quote_${q.id}`, label: `인용문 (${q.authorName})`, preview: q.content })),
      { key: 'metrics', label: '공개 성과 지표', preview: c.metrics.map((m) => `${m.label} ${m.displayValue ?? m.value}${m.unit}`).join(' · ') },
    ],
    gate,
    notice: '모든 항목은 브랜드와 선수 모두 승인해야 공개할 수 있습니다.',
  };
}

function shapeApproval(a?: any) {
  if (!a) return { status: 'NOT_REQUESTED', statusLabel: '미요청', comment: null, requestedAt: null, respondedAt: null, expiresAt: null };
  return {
    id: a.id,
    status: a.status,
    statusLabel: ({ PENDING: '승인 대기', VIEWED: '열람', APPROVED: '승인 완료', CHANGES_REQUESTED: '변경 요청' } as any)[a.status] ?? a.status,
    comment: a.comment,
    itemStatus: a.itemStatus,
    requestedAt: a.requestedAt, viewedAt: a.viewedAt, respondedAt: a.respondedAt, expiresAt: a.expiresAt,
  };
}

export async function requestApproval(caseId: string, adminId: string, parties: string[] = ['BRAND', 'ATHLETE']) {
  const expiresAt = new Date(Date.now() + 7 * DAY);
  for (const party of parties) {
    await prisma.caseApproval.upsert({
      where: { caseId_party: { caseId, party } },
      update: { status: 'PENDING', requestedAt: new Date(), expiresAt, respondedAt: null, comment: null },
      create: { caseId, party, status: 'PENDING', expiresAt },
    });
  }
  await prisma.matchingCase.update({ where: { id: caseId }, data: { status: 'AWAITING_PARTY' } });
  await logAdmin(adminId, 'CASE_APPROVAL_REQUEST', 'MATCHING_CASE', caseId, undefined, { parties });
  return { requested: parties, expiresAt };
}

export async function recordApproval(input: {
  caseId: string; party: string; status: string; comment?: string; itemStatus?: any; adminId: string;
}) {
  if (!['APPROVED', 'CHANGES_REQUESTED', 'VIEWED'].includes(input.status)) {
    throw Object.assign(new Error('알 수 없는 승인 상태입니다'), { status: 400 });
  }
  if (input.status === 'CHANGES_REQUESTED' && !input.comment?.trim()) {
    throw Object.assign(new Error('변경 요청 사유를 입력해주세요'), { status: 400 });
  }

  await prisma.caseApproval.upsert({
    where: { caseId_party: { caseId: input.caseId, party: input.party } },
    update: {
      status: input.status, comment: input.comment, itemStatus: input.itemStatus ?? undefined,
      respondedAt: new Date(), ...(input.status === 'VIEWED' ? { viewedAt: new Date() } : {}),
    },
    create: {
      caseId: input.caseId, party: input.party, status: input.status,
      comment: input.comment, itemStatus: input.itemStatus ?? undefined, respondedAt: new Date(),
    },
  });

  const all = await prisma.caseApproval.findMany({ where: { caseId: input.caseId } });
  if (all.length > 0 && all.every((a) => a.status === 'APPROVED')) {
    await prisma.matchingCase.update({ where: { id: input.caseId }, data: { status: 'APPROVED' } });
  }
  if (input.status === 'CHANGES_REQUESTED') {
    await prisma.matchingCase.update({ where: { id: input.caseId }, data: { status: 'IN_REVIEW' } });
  }

  await logAdmin(input.adminId, `CASE_APPROVAL_${input.status}`, 'MATCHING_CASE', input.caseId, input.comment, { party: input.party });
  return await getCaseApproval(input.caseId);
}

/* ── IA10 브랜드 CMS ────────────────────────────────── */

export async function listBrandsAdmin(params: { status?: string; category?: string; q?: string }) {
  const rows = await prisma.partnerBrand.findMany({
    where: {
      ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
      ...(params.category && params.category !== 'ALL' ? { category: params.category } : {}),
      ...(params.q ? { displayName: { contains: params.q, mode: 'insensitive' } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { cases: true } }, rights: { select: { status: true, validTo: true } } },
  });

  return {
    brands: rows.map((b) => {
      const rightsIssue = b.rights.some((r) => r.status !== 'VALID' || (r.validTo && r.validTo < new Date()));
      return {
        id: b.id, slug: b.slug, name: b.displayName, category: b.category,
        logoUrl: b.logoLight, status: b.status,
        statusLabel: ({
          PROSPECT: '영업 대상', ONBOARDING: '준비 중', ACTIVE_PARTNER: '게시',
          PAST_PARTNER: '이전 협업', SUSPENDED: '중단', ARCHIVED: '보관',
        } as any)[b.status] ?? b.status,
        cases: b._count.cases,
        rightsOk: !rightsIssue,
        updatedAt: b.updatedAt,
      };
    }),
    statuses: [
      { code: 'ALL', label: '전체' },
      { code: 'ONBOARDING', label: '준비 중' },
      { code: 'ACTIVE_PARTNER', label: '게시' },
      { code: 'PAST_PARTNER', label: '이전 협업' },
      { code: 'SUSPENDED', label: '중단' },
    ],
  };
}

export async function getBrandAdmin(id: string) {
  const b = await prisma.partnerBrand.findUnique({
    where: { id },
    include: {
      cases: { select: { id: true, title: true, status: true, athleteName: true, publishedAt: true }, orderBy: { updatedAt: 'desc' } },
      rights: { orderBy: { validTo: 'asc' } },
    },
  });
  if (!b) return null;

  const now = new Date();
  const logoRight = b.rights.find((r) => r.assetType === 'LOGO');
  const dup = await prisma.partnerBrand.findFirst({
    where: { id: { not: b.id }, displayName: { contains: b.displayName.slice(0, 4), mode: 'insensitive' } },
    select: { id: true, displayName: true, status: true, createdAt: true },
  });

  const checks = [
    { key: 'basic', label: '기본정보 입력', ok: !!b.displayName && !!b.category && !!b.description },
    { key: 'logo', label: '로고 업로드 및 승인', ok: !!b.logoLight && (!logoRight || logoRight.status === 'VALID') },
    { key: 'athletes', label: '선수 관계 설정', ok: b.cases.some((c) => !!c.athleteName) },
    { key: 'cases', label: '협업사례 등록 (1건 이상)', ok: b.cases.length > 0 },
    { key: 'exposure', label: '노출 설정 구성', ok: b.sortOrder >= 0 },
    { key: 'legal', label: '법적 권리 및 사용 동의 확인', ok: !!logoRight && logoRight.status === 'VALID' && (!logoRight.validTo || logoRight.validTo > now) },
  ];

  return {
    brand: {
      id: b.id, slug: b.slug, name: b.displayName, legalName: b.legalName,
      category: b.category, description: b.description,
      website: b.website, instagram: b.instagram, storeUrl: b.storeUrl,
      contactEmail: b.contactEmail,
      logoLight: b.logoLight, logoDark: b.logoDark, logoAlt: b.logoAlt,
      heroImageUrl: b.heroImageUrl,
      status: b.status, featured: b.featured, sortOrder: b.sortOrder,
      seoTitle: b.seoTitle, seoDesc: b.seoDesc,
      updatedAt: b.updatedAt,
    },
    logoRight: logoRight
      ? {
          id: logoRight.id, status: logoRight.status,
          validFrom: logoRight.validFrom, validTo: logoRight.validTo,
          allowedScopes: logoRight.allowedScopes,
          evidenceName: logoRight.evidenceName,
        }
      : null,
    cases: b.cases,
    rights: b.rights,
    checks,
    checksDone: checks.filter((c) => c.ok).length,
    canPublish: checks.every((c) => c.ok),
    duplicateWarning: dup ? { id: dup.id, name: dup.displayName, status: dup.status, createdAt: dup.createdAt } : null,
  };
}

export async function saveBrand(input: any & { adminId: string }) {
  if (!input.displayName?.trim()) throw Object.assign(new Error('브랜드명을 입력해주세요'), { status: 400 });
  if (!input.category?.trim()) throw Object.assign(new Error('카테고리를 선택해주세요'), { status: 400 });

  const slug = input.slug || input.displayName.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').slice(0, 40);
  const data = {
    displayName: input.displayName, legalName: input.legalName, category: input.category,
    description: input.description, website: input.website, instagram: input.instagram,
    storeUrl: input.storeUrl, contactEmail: input.contactEmail,
    logoLight: input.logoLight, logoDark: input.logoDark, logoAlt: input.logoAlt,
    heroImageUrl: input.heroImageUrl,
    featured: !!input.featured, sortOrder: input.sortOrder ?? 0,
    seoTitle: input.seoTitle, seoDesc: input.seoDesc,
    brandId: input.brandId || null,
  };

  const b = input.id
    ? await prisma.partnerBrand.update({ where: { id: input.id }, data })
    : await prisma.partnerBrand.create({ data: { ...data, slug, status: 'ONBOARDING' } });

  await logAdmin(input.adminId, input.id ? 'PARTNER_BRAND_SAVE' : 'PARTNER_BRAND_CREATE', 'PARTNER_BRAND', b.id, input.displayName, {});
  return { brand: b };
}

export async function publishBrand(id: string, adminId: string) {
  const detail = await getBrandAdmin(id);
  if (!detail) throw Object.assign(new Error('브랜드를 찾을 수 없습니다'), { status: 404 });
  if (!detail.canPublish) {
    const failed = detail.checks.filter((c) => !c.ok).map((c) => c.label);
    throw Object.assign(new Error(`게시 체크리스트를 통과하지 못했습니다: ${failed.join(', ')}`), { status: 400, code: 'CHECKLIST' });
  }
  const b = await prisma.partnerBrand.update({
    where: { id }, data: { status: 'ACTIVE_PARTNER', publishedAt: new Date() },
  });
  await logAdmin(adminId, 'PARTNER_BRAND_PUBLISH', 'PARTNER_BRAND', id, undefined, {});
  return { brand: b };
}

/* ── IA13 권리 · 만료 큐 ────────────────────────────── */

export async function listRights(params: {
  assetType?: string; holderType?: string; status?: string; q?: string; page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);
  const now = new Date();
  const in30 = new Date(+now + 30 * DAY);

  const where: Prisma.RightsGrantWhereInput = {
    ...(params.assetType && params.assetType !== 'ALL' ? { assetType: params.assetType } : {}),
    ...(params.holderType && params.holderType !== 'ALL' ? { holderType: params.holderType } : {}),
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
    ...(params.q ? { assetName: { contains: params.q, mode: 'insensitive' } } : {}),
  };

  const [rows, total, expiringSoon, expired, missing, blocked] = await Promise.all([
    prisma.rightsGrant.findMany({ where, orderBy: { validTo: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.rightsGrant.count({ where }),
    prisma.rightsGrant.count({ where: { validTo: { gte: now, lte: in30 }, status: { in: ['VALID', 'EXPIRING'] } } }),
    prisma.rightsGrant.count({ where: { OR: [{ status: 'EXPIRED' }, { validTo: { lt: now } }] } }),
    prisma.rightsGrant.count({ where: { OR: [{ evidenceUrl: null }, { status: 'MISSING_EVIDENCE' }] } }),
    prisma.rightsGrant.count({ where: { status: 'BLOCKED' } }),
  ]);
  const allCount = await prisma.rightsGrant.count();

  return {
    rights: rows.map((r) => {
      const remain = r.validTo ? Math.ceil((+r.validTo - +now) / DAY) : null;
      return {
        id: r.id, assetType: r.assetType, assetName: r.assetName,
        thumbnailUrl: r.thumbnailUrl, holderName: r.holderName, holderType: r.holderType,
        allowedScopes: r.allowedScopes, allowedRegion: r.allowedRegion,
        evidenceName: r.evidenceName, hasEvidence: !!r.evidenceUrl,
        validFrom: r.validFrom, validTo: r.validTo,
        remainDays: remain,
        status: r.status,
        statusLabel: !r.evidenceUrl ? '증빙 누락'
          : remain !== null && remain < 0 ? '만료'
          : remain !== null && remain <= 30 ? '30일 이내 만료'
          : r.status === 'BLOCKED' ? '게시 차단됨' : '유효',
        ownerTeam: r.ownerTeam, usedIn: r.usedIn,
      };
    }),
    total, page, limit,
    kpis: [
      { key: 'expiring', label: '30일 이내 만료', value: expiringSoon, percent: rate(expiringSoon, allCount) },
      { key: 'expired', label: '이미 만료', value: expired, percent: rate(expired, allCount) },
      { key: 'missing', label: '증빙 누락', value: missing, percent: rate(missing, allCount) },
      { key: 'blocked', label: '게시 차단됨', value: blocked, percent: rate(blocked, allCount) },
    ],
    notice: '권리가 만료된 에셋은 향후 모든 신규 게시에 자동으로 차단됩니다. 감사 이력과 증빙 자료는 삭제하지 않고 보존합니다.',
  };
}

export async function saveRight(input: any & { adminId: string }) {
  if (!input.assetName?.trim()) throw Object.assign(new Error('에셋명을 입력해주세요'), { status: 400 });
  if (!input.holderName?.trim()) throw Object.assign(new Error('권리 보유자를 입력해주세요'), { status: 400 });

  const data = {
    assetType: input.assetType ?? 'PORTRAIT', assetName: input.assetName,
    assetUrl: input.assetUrl, thumbnailUrl: input.thumbnailUrl,
    holderType: input.holderType ?? 'ATHLETE', holderName: input.holderName,
    athleteId: input.athleteId || null, partnerBrandId: input.partnerBrandId || null,
    allowedScopes: input.allowedScopes ?? [], allowedRegion: input.allowedRegion,
    evidenceUrl: input.evidenceUrl, evidenceName: input.evidenceName,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    ownerTeam: input.ownerTeam, managerName: input.managerName, managerContact: input.managerContact,
    note: input.note,
    status: input.evidenceUrl ? (input.status ?? 'VALID') : 'MISSING_EVIDENCE',
  };

  const r = input.id
    ? await prisma.rightsGrant.update({ where: { id: input.id }, data })
    : await prisma.rightsGrant.create({ data });

  await logAdmin(input.adminId, input.id ? 'RIGHTS_GRANT_SAVE' : 'RIGHTS_GRANT_CREATE', 'RIGHTS_GRANT', r.id, input.assetName, {});
  return { right: r };
}

/** 만료 스윕 — 기한이 지난 권리를 EXPIRED 로 바꾸고 게시물을 차단 큐에 올린다 */
export async function sweepRights(adminId?: string) {
  const now = new Date();
  const expired = await prisma.rightsGrant.updateMany({
    where: { validTo: { lt: now }, status: { in: ['VALID', 'EXPIRING'] } },
    data: { status: 'EXPIRED' },
  });
  const expiring = await prisma.rightsGrant.updateMany({
    where: { validTo: { gte: now, lte: new Date(+now + 30 * DAY) }, status: 'VALID' },
    data: { status: 'EXPIRING' },
  });
  if (adminId) await logAdmin(adminId, 'RIGHTS_SWEEP', 'RIGHTS_GRANT', 'ALL', '만료 스윕', { expired: expired.count, expiring: expiring.count });
  return { expired: expired.count, expiring: expiring.count };
}

/* ── IA12 분석 · SEO ────────────────────────────────── */

export async function getAnalytics(params: { from?: string; to?: string }) {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from ? new Date(params.from) : new Date(+to - 28 * DAY);
  const span = Math.max(1, Math.round((+to - +from) / DAY));
  const prevFrom = new Date(+from - span * DAY);

  const count = (event: string, a: Date, b: Date) =>
    prisma.aboutAnalyticsEvent.count({ where: { event, createdAt: { gte: a, lte: b } } });

  const [view, menuClick, caseView, evidence, cta, prevView, prevCta, pageGroups] = await Promise.all([
    count('intro_view', from, to),
    count('about_menu_click', from, to),
    count('case_view', from, to),
    count('evidence_open', from, to),
    count('intro_cta_click', from, to),
    count('intro_view', prevFrom, from),
    count('intro_cta_click', prevFrom, from),
    prisma.aboutAnalyticsEvent.groupBy({
      by: ['pageSlug'],
      where: { event: 'intro_view', createdAt: { gte: from, lte: to }, pageSlug: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const delta = (cur: number, prev: number) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

  /* 퍼널 — 각 단계는 실제 이벤트 수만 쓴다 */
  const funnel = [
    { step: 1, label: '소개 진입', value: view },
    { step: 2, label: '메뉴 선택', value: menuClick },
    { step: 3, label: '사례 상세', value: caseView },
    { step: 4, label: '근거 열람', value: evidence },
    { step: 5, label: 'CTA 클릭', value: cta },
  ].map((s, i, arr) => ({
    ...s,
    ofTotal: rate(s.value, arr[0].value),
    stepRate: i === 0 ? null : rate(s.value, arr[i - 1].value),
    dropRate: i === 0 ? null : arr[i - 1].value > 0 ? Math.round((1 - s.value / arr[i - 1].value) * 1000) / 10 : null,
  }));

  /* SEO 건강 — 실제 콘텐츠에서 센다 */
  const [pages, casesPub, missingSeo, dupTitle] = await Promise.all([
    prisma.contentPage.count({ where: { status: 'PUBLISHED' } }),
    prisma.matchingCase.count({ where: { status: 'PUBLISHED' } }),
    prisma.contentPage.count({ where: { status: 'PUBLISHED', OR: [{ seoTitle: null }, { seoDesc: null }] } }),
    prisma.contentPage.groupBy({ by: ['seoTitle'], where: { status: 'PUBLISHED', seoTitle: { not: null } }, _count: { _all: true }, having: { seoTitle: { _count: { gt: 1 } } } }),
  ]);

  return {
    period: { from, to, days: span },
    kpis: [
      { key: 'view', label: '소개 진입', value: view, unit: '건', delta: delta(view, prevView) },
      { key: 'menu', label: '메뉴 클릭', value: menuClick, unit: '건', delta: null },
      { key: 'caseCtr', label: '사례 상세 CTR', value: rate(caseView, menuClick), unit: '%', delta: null },
      { key: 'evidence', label: '근거 열람', value: evidence, unit: '건', delta: null },
      { key: 'cta', label: 'CTA 전환율', value: rate(cta, view), unit: '%', delta: delta(cta, prevCta) },
    ],
    funnel,
    pages: pageGroups
      .map((g) => ({ slug: g.pageSlug!, views: g._count._all }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    seo: {
      publishedPages: pages,
      publishedCases: casesPub,
      missingMeta: missingSeo,
      duplicateTitles: dupTitle.length,
      checks: [
        { key: 'title', label: '타이틀', ok: dupTitle.length === 0, detail: dupTitle.length ? `중복 ${dupTitle.length}건` : '중복 없음' },
        { key: 'meta', label: '메타 설명', ok: missingSeo === 0, detail: missingSeo ? `누락 ${missingSeo}건` : '누락 없음' },
      ],
    },
    notice: view === 0
      ? '아직 수집된 소개 영역 이벤트가 없습니다. 화면에서 이벤트가 발생하면 집계가 시작됩니다.'
      : null,
  };
}

/* ── IA14 감사로그 ──────────────────────────────────── */

export async function getAuditLogs(params: {
  from?: string; to?: string; actor?: string; action?: string; entity?: string;
  page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? 20);

  const where: Prisma.AdminActionLogWhereInput = {
    ...(params.actor ? { actorId: params.actor } : {}),
    ...(params.action ? { action: { contains: params.action, mode: 'insensitive' } } : {}),
    ...(params.entity && params.entity !== 'ALL' ? { targetType: params.entity } : {}),
    ...(params.from || params.to
      ? { createdAt: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
      : {}),
  };

  const [rows, total, entityTypes] = await Promise.all([
    prisma.adminActionLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.adminActionLog.count({ where }),
    prisma.adminActionLog.groupBy({ by: ['targetType'], _count: { _all: true } }),
  ]);

  /* 민감 변경은 별도 표시 (§11.4) */
  const SENSITIVE = ['VISIBILITY', 'METRIC', 'GUARANTEE', 'RIGHTS', 'POINT_ADJUST', 'SANCTION'];

  return {
    logs: rows.map((l) => ({
      id: l.id, at: l.createdAt, actor: l.actorId, action: l.action,
      entityType: l.targetType, entityId: l.targetId,
      reason: l.reason, body: l.requestBody,
      sensitive: SENSITIVE.some((s) => l.action.includes(s)),
      ip: l.ipAddress,
    })),
    total, page, limit,
    entityTypes: entityTypes.map((e) => ({ code: e.targetType, count: e._count._all })),
    retention: { years: 7, policy: '감사로그 보관 정책 v2.1' },
    notice: '감사 로그는 변경 및 삭제가 불가능합니다. 일반 편집자는 로그를 삭제하거나 수정할 수 없습니다.',
  };
}

/* ── IA07 · IA08 · IA09 성과보장 ────────────────────── */

export async function listPolicies() {
  const rows = await prisma.guaranteePolicy.findMany({ orderBy: { createdAt: 'desc' } });
  return {
    policies: rows.map((p) => ({
      id: p.id, version: p.version, summary: p.summary, status: p.status,
      judgeMode: p.judgeMode, minScore: p.minScore,
      effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
      appealWindowDays: p.appealWindowDays,
      legalApprovedAt: p.legalApprovedAt,
      createdAt: p.createdAt,
    })),
    judgeModes: [
      { code: 'ALL', label: 'ALL (모든 KPI 충족)' },
      { code: 'ANY', label: 'ANY (하나만 충족)' },
      { code: 'WEIGHTED', label: 'WEIGHTED (가중 합산)' },
    ],
  };
}

export async function getPolicy(id: string) {
  const p = await prisma.guaranteePolicy.findUnique({ where: { id } });
  if (!p) return null;

  const active = await prisma.guaranteePolicy.findFirst({ where: { status: 'ACTIVE' } });
  const rules = (p.metricRules as any[]) ?? [];

  /* 검토 필요 항목 — 정의가 빠진 KPI를 그대로 알려준다 */
  const warnings: string[] = [];
  for (const r of rules) {
    if (!r.source) warnings.push(`'${r.label ?? r.code}' KPI의 데이터 출처가 없습니다.`);
    if (r.weight === undefined && p.judgeMode === 'WEIGHTED') warnings.push(`'${r.label ?? r.code}' KPI의 가중치가 없습니다.`);
    if (!r.definition) warnings.push(`'${r.label ?? r.code}' KPI의 집계 정의가 없습니다.`);
  }

  /* 기간 충돌 */
  const conflict = active && active.id !== p.id && p.effectiveFrom && active.effectiveTo
    ? p.effectiveFrom < active.effectiveTo
    : false;

  return {
    policy: {
      id: p.id, version: p.version, summary: p.summary, status: p.status,
      eligibleProductTypes: p.eligibleProductTypes,
      qualificationRules: p.qualificationRules,
      metricRules: p.metricRules,
      judgeMode: p.judgeMode, minScore: p.minScore,
      remedyRules: p.remedyRules, exclusions: p.exclusions,
      appealWindowDays: p.appealWindowDays,
      effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
      legalApprovedBy: p.legalApprovedBy, legalApprovedAt: p.legalApprovedAt,
      updatedAt: p.updatedAt,
    },
    activeVersion: active ? { id: active.id, version: active.version, effectiveFrom: active.effectiveFrom } : null,
    warnings,
    conflict: conflict ? '기존 ACTIVE 정책과 적용 기간이 일부 중복됩니다.' : null,
    editable: p.status === 'DRAFT',
    notice: 'ACTIVE 상태의 정책은 변경할 수 없으며, 새 버전은 시행일에 자동 전환됩니다.',
  };
}

export async function savePolicy(input: any & { adminId: string }) {
  if (!input.version?.trim()) throw Object.assign(new Error('버전을 입력해주세요'), { status: 400 });

  if (input.id) {
    const cur = await prisma.guaranteePolicy.findUnique({ where: { id: input.id } });
    if (cur && cur.status !== 'DRAFT') {
      throw Object.assign(new Error('DRAFT 상태의 정책만 수정할 수 있습니다'), { status: 400, code: 'NOT_EDITABLE' });
    }
  }

  const data = {
    version: input.version, summary: input.summary,
    eligibleProductTypes: input.eligibleProductTypes ?? [],
    qualificationRules: input.qualificationRules ?? {},
    metricRules: input.metricRules ?? [],
    judgeMode: input.judgeMode ?? 'ALL',
    minScore: input.minScore ?? null,
    remedyRules: input.remedyRules ?? { ratio: 30, cap: 15_000_000, validMonths: 6, cashRefund: false },
    exclusions: input.exclusions ?? undefined,
    appealWindowDays: input.appealWindowDays ?? 14,
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
  };

  const p = input.id
    ? await prisma.guaranteePolicy.update({ where: { id: input.id }, data })
    : await prisma.guaranteePolicy.create({ data: { ...data, status: 'DRAFT', createdBy: input.adminId } });

  await logAdmin(input.adminId, input.id ? 'GUARANTEE_POLICY_SAVE' : 'GUARANTEE_POLICY_CREATE', 'GUARANTEE_POLICY', p.id, input.version, {});
  return { policy: p };
}

export async function activatePolicy(id: string, adminId: string) {
  const p = await prisma.guaranteePolicy.findUnique({ where: { id } });
  if (!p) throw Object.assign(new Error('정책을 찾을 수 없습니다'), { status: 404 });
  if (!p.legalApprovedAt) {
    throw Object.assign(new Error('법무 검토 승인 후에 활성화할 수 있습니다'), { status: 400, code: 'LEGAL_REQUIRED' });
  }
  const rules = (p.metricRules as any[]) ?? [];
  if (!rules.length) throw Object.assign(new Error('KPI가 하나도 정의되지 않았습니다'), { status: 400 });

  const activated = await prisma.$transaction(async (t) => {
    await t.guaranteePolicy.updateMany({
      where: { status: 'ACTIVE' }, data: { status: 'RETIRED', effectiveTo: new Date() },
    });
    return t.guaranteePolicy.update({
      where: { id }, data: { status: 'ACTIVE', effectiveFrom: p.effectiveFrom ?? new Date() },
    });
  });

  await logAdmin(adminId, 'GUARANTEE_POLICY_ACTIVATE', 'GUARANTEE_POLICY', id, undefined, {});
  return {
    policy: activated,
    notice: '기존 계약의 스냅샷은 그대로 유지되며, 새 정책은 이후 계약부터 적용됩니다.',
  };
}

export async function approvePolicyLegal(id: string, adminId: string, note?: string) {
  const p = await prisma.guaranteePolicy.update({
    where: { id }, data: { legalApprovedBy: adminId, legalApprovedAt: new Date() },
  });
  await logAdmin(adminId, 'GUARANTEE_POLICY_LEGAL_APPROVE', 'GUARANTEE_POLICY', id, note, {});
  return { policy: p };
}

/** IA08 계약별 판정 */
export async function listJudgements(params: { status?: string; q?: string; page?: number; limit?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);

  const where: Prisma.GuaranteeSnapshotWhereInput = {
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
    ...(params.q
      ? { OR: [{ brandName: { contains: params.q, mode: 'insensitive' } }, { athleteName: { contains: params.q, mode: 'insensitive' } }] }
      : {}),
  };

  const [rows, total, groups] = await Promise.all([
    prisma.guaranteeSnapshot.findMany({
      where, orderBy: { measureEnd: 'asc' },
      skip: (page - 1) * limit, take: limit,
      include: { observations: true },
    }),
    prisma.guaranteeSnapshot.count({ where }),
    prisma.guaranteeSnapshot.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    items: rows.map((s) => {
      const auto = evaluate({ judgeMode: s.judgeMode, minScore: s.minScore }, s.observations);
      return {
        id: s.id, policyVersion: s.policyVersion, contractId: s.contractId,
        brandName: s.brandName, athleteName: s.athleteName,
        contractAmount: s.contractAmount,
        status: s.status,
        measureStart: s.measureStart, measureEnd: s.measureEnd,
        autoResult: auto.status,
        autoReason: auto.reason,
        score: auto.score,
        finalized: !!s.finalizedAt,
      };
    }),
    total, page, limit,
    byStatus: groups.map((g) => ({ code: g.status, count: g._count._all })),
  };
}

export async function getJudgement(id: string) {
  const s = await prisma.guaranteeSnapshot.findUnique({
    where: { id },
    include: { observations: { orderBy: { metricCode: 'asc' } }, appeals: true, remedies: true, policy: true },
  });
  if (!s) return null;

  const auto = evaluate({ judgeMode: s.judgeMode, minScore: s.minScore }, s.observations);
  const rules: any = s.remedyRules ?? {};

  const logs = await prisma.adminActionLog.findMany({
    where: { targetType: 'GUARANTEE_SNAPSHOT', targetId: s.id },
    orderBy: { createdAt: 'desc' }, take: 20,
  });

  return {
    snapshot: {
      id: s.id, policyVersion: s.policyVersion, policyLocked: true,
      contractId: s.contractId, brandName: s.brandName, athleteName: s.athleteName,
      contractAmount: s.contractAmount,
      judgeMode: s.judgeMode, minScore: s.minScore,
      measureStart: s.measureStart, measureEnd: s.measureEnd,
      status: s.status,
      finalizedAt: s.finalizedAt, locked: !!s.lockedAt,
    },
    observations: s.observations.map((o) => ({
      id: o.id, metricCode: o.metricCode, label: o.label,
      target: o.target, actual: o.actual, unit: o.unit, weight: o.weight, required: o.required,
      achievementRate: o.actual !== null && o.target > 0 ? Math.round((o.actual / o.target) * 1000) / 10 : null,
      collectStatus: o.collectStatus, judgement: o.judgement,
      sourceName: o.sourceName, excludeReason: o.excludeReason, provisional: o.provisional,
    })),
    autoResult: auto,
    remedyEstimate: auto.status === 'NOT_MET' && s.contractAmount && rules.ratio
      ? {
          ratio: rules.ratio,
          amount: Math.min(Math.floor(s.contractAmount * (rules.ratio / 100)), rules.cap ?? Number.MAX_SAFE_INTEGER),
          cap: rules.cap ?? null,
          validMonths: rules.validMonths ?? null,
        }
      : null,
    exclusions: EXCLUSION_CODES,
    appeals: s.appeals,
    remedies: s.remedies,
    auditTrail: logs.map((l) => ({ at: l.createdAt, actor: l.actorId, action: l.action, reason: l.reason })),
    warnings: [
      ...(s.finalizedAt ? ['최종 확정된 판정은 수정할 수 없습니다. 정정이 필요하면 새 버전을 만들어야 합니다.'] : []),
      ...(auto.status === 'DATA_PENDING' ? ['필수 데이터가 수집되지 않아 확정할 수 없습니다.'] : []),
    ],
  };
}

const EXCLUSION_CODES = [
  { code: 'NONE', label: '예외 없음' },
  { code: 'ATHLETE_INJURY', label: '선수 부상·질병·징계' },
  { code: 'SCHEDULE_CHANGE', label: '경기·일정 변경 또는 취소' },
  { code: 'BRAND_DELAY', label: '브랜드 귀책 지연·중단' },
  { code: 'FALSE_INFO', label: '부정확한 정보 제공·계약 위반' },
  { code: 'FORCE_MAJEURE', label: '불가항력' },
];

/** 관측치 수정 — 확정 전에만 가능하다 */
export async function updateObservation(input: {
  id: string; actual?: number | null; collectStatus?: string;
  excludeReason?: string; sourceName?: string; adminId: string;
}) {
  const o = await prisma.guaranteeObservation.findUnique({
    where: { id: input.id }, include: { snapshot: true },
  });
  if (!o) throw Object.assign(new Error('관측치를 찾을 수 없습니다'), { status: 404 });
  if (o.snapshot.finalizedAt) {
    throw Object.assign(new Error('최종 확정된 계약은 수정할 수 없습니다'), { status: 400, code: 'FINALIZED' });
  }
  if (input.excludeReason && input.excludeReason !== 'NONE' && !input.sourceName) {
    throw Object.assign(new Error('예외 적용에는 근거가 필요합니다'), { status: 400, code: 'EVIDENCE_REQUIRED' });
  }

  const actual = input.actual;
  const updated = await prisma.guaranteeObservation.update({
    where: { id: input.id },
    data: {
      ...(actual !== undefined ? { actual, observedAt: new Date() } : {}),
      ...(input.collectStatus ? { collectStatus: input.collectStatus } : {}),
      ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
      ...(input.excludeReason
        ? {
            judgement: input.excludeReason === 'NONE' ? 'DATA_PENDING' : 'EXCLUDED',
            excludeReason: input.excludeReason === 'NONE' ? null : input.excludeReason,
            excludeApprovedBy: input.excludeReason === 'NONE' ? null : input.adminId,
          }
        : {}),
      ...(actual !== undefined && actual !== null
        ? { judgement: actual >= o.target ? 'MET' : 'NOT_MET', collectStatus: input.collectStatus ?? 'COLLECTED' }
        : {}),
    },
  });

  await logAdmin(input.adminId, 'GUARANTEE_OBSERVATION_UPDATE', 'GUARANTEE_SNAPSHOT', o.snapshotId, input.excludeReason, {
    metricCode: o.metricCode, before: o.actual, after: updated.actual,
  });
  return { observation: updated };
}

/** 최종 확정 — 확정 후에는 잠긴다 (§8.5) */
export async function finalizeJudgement(input: { id: string; adminId: string; note?: string }) {
  const s = await prisma.guaranteeSnapshot.findUnique({
    where: { id: input.id }, include: { observations: true },
  });
  if (!s) throw Object.assign(new Error('계약을 찾을 수 없습니다'), { status: 404 });
  if (s.finalizedAt) return { finalized: false, reason: 'ALREADY' as const };

  const auto = evaluate({ judgeMode: s.judgeMode, minScore: s.minScore }, s.observations);
  if (auto.status === 'DATA_PENDING') {
    throw Object.assign(new Error(auto.reason), { status: 400, code: 'DATA_PENDING' });
  }

  const nextStatus = auto.status === 'MET' ? 'MET' : 'REMEDY_ELIGIBLE';
  const updated = await prisma.guaranteeSnapshot.update({
    where: { id: s.id },
    data: {
      status: nextStatus,
      judgedAt: new Date(), judgedBy: input.adminId,
      finalizedAt: new Date(), lockedAt: new Date(),
      finalSnapshot: {
        result: auto.status, reason: auto.reason, score: auto.score,
        observations: s.observations.map((o) => ({
          metricCode: o.metricCode, label: o.label, target: o.target,
          actual: o.actual, unit: o.unit, judgement: o.judgement,
        })),
        finalizedAt: new Date().toISOString(),
      } as any,
    },
  });

  await logAdmin(input.adminId, 'GUARANTEE_FINALIZE', 'GUARANTEE_SNAPSHOT', s.id, input.note ?? auto.reason, { result: auto.status });
  return {
    finalized: true,
    result: auto.status,
    status: nextStatus,
    snapshot: updated,
    notice: auto.status === 'NOT_MET'
      ? '보완지원 발급은 운영과 재무 2인 승인이 필요합니다.'
      : null,
  };
}

/** IA09 이의제기 · 보완지원 */
export async function listAppeals(params: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);
  const now = new Date();

  const where: Prisma.GuaranteeAppealWhereInput =
    params.status && params.status !== 'ALL' ? { status: params.status } : {};

  const [rows, total, groups, overdue] = await Promise.all([
    prisma.guaranteeAppeal.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
      include: { snapshot: { select: { id: true, brandName: true, athleteName: true, contractAmount: true, remedyRules: true } } },
    }),
    prisma.guaranteeAppeal.count({ where }),
    prisma.guaranteeAppeal.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.guaranteeAppeal.count({ where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] }, slaDueAt: { lt: now } } }),
  ]);

  return {
    appeals: rows.map((a) => ({
      id: a.id, code: a.code, status: a.status,
      brandName: a.snapshot.brandName, athleteName: a.snapshot.athleteName,
      contractAmount: a.snapshot.contractAmount,
      reason: a.reason, evidenceTypes: a.evidenceTypes,
      slaDueAt: a.slaDueAt,
      slaRemainMs: a.slaDueAt ? +a.slaDueAt - Date.now() : null,
      overdue: a.slaDueAt ? a.slaDueAt < now : false,
      decisionType: a.decisionType, decidedAt: a.decidedAt,
      createdAt: a.createdAt,
    })),
    total, page, limit,
    kpis: {
      total: groups.reduce((s, g) => s + g._count._all, 0),
      received: groups.find((g) => g.status === 'RECEIVED')?._count._all ?? 0,
      reviewing: groups.find((g) => g.status === 'UNDER_REVIEW')?._count._all ?? 0,
      decided: groups.find((g) => g.status === 'DECIDED')?._count._all ?? 0,
      overdue,
    },
    decisionTypes: [
      { code: 'APPROVE', label: '승인', desc: '전액 조건 승인' },
      { code: 'PARTIAL', label: '부분 승인', desc: '일부 금액·조건 승인' },
      { code: 'REJECT', label: '반려', desc: '승인 불가' },
    ],
    decisionCodes: [
      { code: 'PERF-01', label: '성과 기준 충족 확인' },
      { code: 'PERF-02', label: '성과 측정 오류 (검증 후 인정)' },
      { code: 'PERF-03', label: '외부 요인 인정' },
      { code: 'PERF-04', label: '브랜드 귀책' },
      { code: 'PERF-05', label: '근거 불충분' },
    ],
  };
}

export async function decideAppeal(input: {
  id: string; decisionType: string; decisionCode: string; note?: string;
  ratio?: number; capAmount?: number; adminId: string;
}) {
  const a = await prisma.guaranteeAppeal.findUnique({
    where: { id: input.id }, include: { snapshot: true },
  });
  if (!a) throw Object.assign(new Error('이의제기를 찾을 수 없습니다'), { status: 404 });
  if (a.status === 'DECIDED' || a.status === 'SUPPORT_ISSUED') {
    return { decided: false, reason: 'ALREADY' as const };
  }
  if (!input.decisionCode) throw Object.assign(new Error('사유 코드를 선택해주세요'), { status: 400 });

  const appeal = await prisma.guaranteeAppeal.update({
    where: { id: a.id },
    data: {
      status: 'DECIDED', decisionType: input.decisionType, decisionCode: input.decisionCode,
      decisionNote: input.note, decidedBy: input.adminId, decidedAt: new Date(),
    },
  });

  await prisma.guaranteeSnapshot.update({
    where: { id: a.snapshotId },
    data: { status: input.decisionType === 'REJECT' ? 'FINAL' : 'REMEDY_ELIGIBLE' },
  });

  await logAdmin(input.adminId, 'GUARANTEE_APPEAL_DECIDE', 'GUARANTEE_SNAPSHOT', a.snapshotId, input.note, {
    appealId: a.id, decisionType: input.decisionType, decisionCode: input.decisionCode,
  });

  return {
    decided: true,
    appeal,
    needsSecondApproval: input.decisionType !== 'REJECT',
    notice: input.decisionType !== 'REJECT'
      ? '재무적 영향이 있는 결정은 2인 승인 후 지원 발급이 가능합니다.'
      : null,
  };
}

/** 보완지원 발급 — 요청자와 다른 관리자가 승인해야 한다 (§8.5) */
export async function issueRemedy(input: {
  snapshotId: string; ratio: number; capAmount: number; validMonths?: number;
  note?: string; adminId: string; approverId?: string;
}) {
  const s = await prisma.guaranteeSnapshot.findUnique({ where: { id: input.snapshotId } });
  if (!s) throw Object.assign(new Error('계약을 찾을 수 없습니다'), { status: 404 });
  if (!['NOT_MET', 'REMEDY_ELIGIBLE'].includes(s.status)) {
    throw Object.assign(new Error('보완지원 대상 상태가 아닙니다'), { status: 400, code: 'NOT_ELIGIBLE' });
  }
  if (!input.approverId || input.approverId === input.adminId) {
    throw Object.assign(
      new Error('보완지원 발급은 요청자와 다른 관리자의 승인이 필요합니다'),
      { status: 403, code: 'SECOND_APPROVAL_REQUIRED' },
    );
  }

  const amount = Math.min(
    Math.floor((s.contractAmount ?? 0) * (input.ratio / 100)),
    input.capAmount,
  );
  if (amount <= 0) throw Object.assign(new Error('지원 금액이 0원 이하입니다'), { status: 400 });

  const months = input.validMonths ?? 6;
  const seq = await prisma.remedyGrant.count();
  const grant = await prisma.remedyGrant.create({
    data: {
      code: `SUP-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`,
      snapshotId: s.id, brandId: s.brandId,
      ratio: input.ratio, capAmount: input.capAmount, issuedAmount: amount,
      status: 'ISSUED',
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + months)),
      issuedBy: input.adminId, approvedBy: input.approverId,
      note: input.note,
    },
  });

  await prisma.guaranteeSnapshot.update({ where: { id: s.id }, data: { status: 'REMEDY_ISSUED' } });
  await logAdmin(input.adminId, 'REMEDY_ISSUE', 'GUARANTEE_SNAPSHOT', s.id, input.note, {
    grantId: grant.id, amount, approver: input.approverId,
  });

  return {
    grant,
    notice: '보완지원은 현금이 아닌 SPONPIK 보장 지원으로 지급됩니다. 타인 양도와 현금 전환은 불가합니다.',
  };
}

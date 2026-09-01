/**
 * SPONPIK 소개 허브 — 콘텐츠 · 매칭사례 · 파트너 브랜드 (핸드오프 v1.0 2026-08-22)
 *
 * 원칙
 *  - 출처 없는 성과 수치는 게시할 수 없다 (§5.4).
 *  - 공개등급(visibility)에 따라 응답에서 값을 아예 빼거나 라벨로 바꾼다 (§5.3 · §16.2).
 *  - 권리가 만료된 에셋은 자동으로 노출에서 뺀다 (§10.4 · §17.1).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86400_000;

/* ── 메뉴 · IA (§2.1) ───────────────────────────────── */

export const ABOUT_MENU = [
  {
    key: 'service', label: '서비스소개', slug: 'service',
    desc: '스폰픽이 제공하는 가치와 차별점을 소개합니다.',
    to: '/about/service', cta: { label: '후원 방식 보기', to: '/sponsor/available' },
  },
  {
    key: 'cases', label: '매칭사례', slug: 'cases',
    desc: '실제 스폰서 매칭 사례를 확인해 보세요.',
    to: '/about/cases', cta: { label: '유사 후원 시작', to: '/sponsor/recommended' },
  },
  {
    key: 'guarantee', label: '성과보장프로그램', slug: 'performance-guarantee',
    desc: '스폰픽만의 성과보장 시스템을 안내합니다.',
    to: '/about/performance-guarantee', cta: { label: '적용 상품 확인', to: '/sponsor/available' },
  },
  {
    key: 'how', label: '이용방법', slug: 'how-it-works',
    desc: '스폰픽 이용 절차와 방법을 쉽게 안내합니다.',
    to: '/about/how-it-works', cta: { label: '내게 맞는 시작 선택', to: '/about/how-it-works' },
  },
  {
    key: 'brands', label: '함께하는 브랜드', slug: 'brands',
    desc: '스폰픽과 함께하는 브랜드를 소개합니다.',
    to: '/about/brands', cta: { label: '브랜드 협업 문의', to: '/contact' },
  },
] as const;

export const INSTAGRAM = {
  url: 'https://www.instagram.com/sponpik_official/',
  label: '공식 인스타그램 보기',
  text: '더 자세한 서비스 이야기와 최신 매칭 소식은 SPONPIK 공식 인스타그램에서 확인하세요.',
};

/* ── 공개등급 (§5.3) ────────────────────────────────── */

export const VISIBILITY_LEVELS = [
  { code: 'PUBLIC_EXACT', label: '정확한 수치', example: '조회수 18,420회' },
  { code: 'PUBLIC_RANGE', label: '범위·증감률', example: '1만~2만 회, 전월 대비 +18%' },
  { code: 'PUBLIC_LABEL', label: '정성 라벨', example: '목표 달성, 재계약 검토' },
  { code: 'MEMBER_ONLY', label: '로그인 후 공개', example: '상세 채널별 수치' },
  { code: 'PARTY_ONLY', label: '계약 당사자만', example: '계약금·내부 KPI' },
  { code: 'PRIVATE', label: '표시 안 함', example: '개인정보·비공개 조건' },
] as const;

type Viewer = { id?: string; role?: string; brandId?: string } | undefined;

/** 범위 표기 — 자릿수를 보존한 하한~상한으로 뭉갠다 */
function toRange(value: number, unit: string) {
  if (value <= 0) return null;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const lo = Math.floor(value / mag) * mag;
  const hi = lo + mag;
  const fmt = (n: number) =>
    n >= 100_000_000 ? `${Math.round(n / 100_000_000)}억`
      : n >= 10_000 ? `${Math.round(n / 10_000)}만`
      : n.toLocaleString('ko-KR');
  return `${fmt(lo)}~${fmt(hi)}${unit}`;
}

/**
 * 지표 하나를 공개등급에 맞게 변환한다.
 * 볼 수 없는 값은 값 자체를 응답에 넣지 않는다 (§16.2 — party-only 필드 직렬화 금지).
 */
export function shapeMetric(m: any, viewer: Viewer, isParty: boolean) {
  const base = {
    id: m.id,
    metricCode: m.metricCode,
    label: m.label,
    unit: m.unit,
    visibility: m.visibility,
    isPrimary: m.isPrimary,
    verificationStatus: m.verificationStatus,
    periodStart: m.periodStart,
    periodEnd: m.periodEnd,
  };

  const canSeeExact =
    m.visibility === 'PUBLIC_EXACT' ||
    (m.visibility === 'MEMBER_ONLY' && !!viewer?.id) ||
    (m.visibility === 'PARTY_ONLY' && isParty);

  if (m.visibility === 'PRIVATE') {
    return { ...base, display: null, restricted: true, restrictedReason: '비공개 항목입니다' };
  }
  if (canSeeExact) {
    return {
      ...base,
      display: m.displayValue ?? `${m.value.toLocaleString('ko-KR')}${m.unit}`,
      value: m.value,
      restricted: false,
      /* 근거는 값을 볼 수 있는 사람에게만 (§5.2) */
      evidence: {
        definition: m.definition,
        definitionVersion: m.definitionVersion,
        sourceType: m.sourceType,
        sourceName: m.sourceName,
        aggregationNote: m.aggregationNote,
        evidenceUri: isParty ? m.evidenceUri : null,
        verifiedAt: m.verifiedAt,
      },
    };
  }
  /* 값은 뭉개도 출처·검증 상태는 공개한다 (§5.2 — 수치는 근거와 함께 표시) */
  const publicEvidence = {
    definition: m.definition,
    sourceType: m.sourceType,
    sourceName: m.sourceName,
    verifiedAt: m.verifiedAt,
    evidenceUri: null,
  };
  if (m.visibility === 'PUBLIC_RANGE') {
    return { ...base, display: toRange(m.value, m.unit), restricted: false, approximate: true, evidence: publicEvidence };
  }
  if (m.visibility === 'PUBLIC_LABEL') {
    return { ...base, display: m.displayValue ?? '집계 완료', restricted: false, qualitative: true, evidence: publicEvidence };
  }
  /* MEMBER_ONLY 비로그인 · PARTY_ONLY 제3자 */
  return {
    ...base,
    display: null,
    restricted: true,
    restrictedReason: m.visibility === 'MEMBER_ONLY' ? '로그인 후 확인할 수 있습니다' : '계약 당사자만 확인할 수 있습니다',
  };
}

/* ── 콘텐츠 페이지 (§4 · §11.2) ─────────────────────── */

export async function getPage(slug: string) {
  const page = await prisma.contentPage.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { blocks: { where: { visible: true }, orderBy: { sortOrder: 'asc' } } },
  });
  if (!page) return null;
  return {
    slug: page.slug,
    title: page.title,
    seo: { title: page.seoTitle ?? page.title, description: page.seoDesc, ogImage: page.ogImageUrl },
    blocks: page.blocks.map((b) => ({ id: b.id, type: b.type, name: b.name, payload: b.payload })),
    publishedAt: page.publishedAt,
    version: page.version,
  };
}

/** 소개 허브 메타 — 메뉴·인스타·공개등급 정의 */
export function getMeta() {
  return {
    menu: ABOUT_MENU,
    instagram: INSTAGRAM,
    visibilityLevels: VISIBILITY_LEVELS,
    /* 롤오버 동작 기준 (§2.2) */
    megaMenu: { openDelayMs: 150, closeDelayMs: 250, hint: '처음이신가요? 서비스소개부터 보기' },
  };
}

/* ── 매칭사례 (§5) ──────────────────────────────────── */

const CASE_LIST_SELECT = {
  id: true, slug: true, code: true, title: true, summary: true,
  athleteName: true, brandName: true, sport: true, tour: true,
  sponsorTypes: true, objectiveCodes: true, heroImageUrl: true,
  periodFrom: true, periodTo: true, verified: true, featured: true,
  publishedAt: true, visibility: true,
} satisfies Prisma.MatchingCaseSelect;

export async function listCases(params: {
  sport?: string; tour?: string; sponsorType?: string; category?: string;
  objective?: string; sort?: string; q?: string; brandSlug?: string;
  limit?: number; page?: number;
}, viewer: Viewer) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(24, params.limit ?? 12);

  const where: Prisma.MatchingCaseWhereInput = {
    status: 'PUBLISHED',
    ...(params.sport ? { sport: params.sport } : {}),
    ...(params.tour ? { tour: params.tour } : {}),
    ...(params.sponsorType ? { sponsorTypes: { has: params.sponsorType } } : {}),
    ...(params.objective ? { objectiveCodes: { has: params.objective } } : {}),
    ...(params.brandSlug ? { partnerBrand: { slug: params.brandSlug } } : {}),
    ...(params.category ? { partnerBrand: { category: params.category } } : {}),
    ...(params.q
      ? { OR: [{ title: { contains: params.q, mode: 'insensitive' } }, { athleteName: { contains: params.q, mode: 'insensitive' } }, { brandName: { contains: params.q, mode: 'insensitive' } }] }
      : {}),
  };

  const orderBy: Prisma.MatchingCaseOrderByWithRelationInput =
    params.sort === 'LATEST' ? { publishedAt: 'desc' }
      : params.sort === 'VERIFIED' ? { verified: 'desc' }
      : { sortOrder: 'asc' };

  const [rows, total, facets] = await Promise.all([
    prisma.matchingCase.findMany({
      where, orderBy: [orderBy, { publishedAt: 'desc' }],
      skip: (page - 1) * limit, take: limit,
      include: {
        partnerBrand: { select: { slug: true, displayName: true, logoLight: true, category: true } },
        metrics: {
          where: { isPrimary: true, visibility: { not: 'PRIVATE' } },
          orderBy: { sortOrder: 'asc' }, take: 2,
        },
      },
    }),
    prisma.matchingCase.count({ where }),
    caseFacets(),
  ]);

  return {
    cases: rows.map((c) => ({
      id: c.id, slug: c.slug, title: c.title, summary: c.summary,
      athleteName: c.athleteName, brandName: c.partnerBrand?.displayName ?? c.brandName,
      brandSlug: c.partnerBrand?.slug ?? null,
      brandLogoUrl: c.partnerBrand?.logoLight ?? null,
      sport: c.sport, tour: c.tour,
      sponsorTypes: c.sponsorTypes, objectiveCodes: c.objectiveCodes,
      heroImageUrl: c.heroImageUrl,
      periodFrom: c.periodFrom, periodTo: c.periodTo,
      verified: c.verified,
      /* 카드에는 대표 지표만 (§5.1) */
      highlights: c.metrics.map((m) => shapeMetric(m, viewer, false)),
    })),
    total, page, limit,
    facets,
    sorts: [
      { code: 'RECOMMENDED', label: '추천순' },
      { code: 'LATEST', label: '최신순' },
      { code: 'VERIFIED', label: '성과확인순' },
    ],
    emptyGuide: {
      title: '선택한 조건에 맞는 사례가 없습니다.',
      desc: '필터를 조정하거나 추천 PICK으로 비슷한 후원을 찾아보세요.',
      cta: { label: '추천 PICK 받기', to: '/sponsor/recommended' },
    },
  };
}

async function caseFacets() {
  const [sports, tours, types, categories] = await Promise.all([
    prisma.matchingCase.groupBy({ by: ['sport'], where: { status: 'PUBLISHED', sport: { not: null } }, _count: { _all: true } }),
    prisma.matchingCase.groupBy({ by: ['tour'], where: { status: 'PUBLISHED', tour: { not: null } }, _count: { _all: true } }),
    prisma.matchingCase.findMany({ where: { status: 'PUBLISHED' }, select: { sponsorTypes: true } }),
    prisma.partnerBrand.groupBy({ by: ['category'], where: { status: { in: ['ACTIVE_PARTNER', 'PAST_PARTNER'] } }, _count: { _all: true } }),
  ]);

  const typeCount = new Map<string, number>();
  for (const r of types) for (const t of r.sponsorTypes) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);

  return {
    sport: sports.map((s) => ({ code: s.sport!, label: s.sport!, count: s._count._all })),
    tour: tours.map((s) => ({ code: s.tour!, label: s.tour!, count: s._count._all })),
    sponsorType: [...typeCount.entries()].map(([code, count]) => ({ code, label: code, count })),
    category: categories.map((c) => ({ code: c.category, label: c.category, count: c._count._all })),
  };
}

export async function getCase(slug: string, viewer: Viewer) {
  const c = await prisma.matchingCase.findFirst({
    where: { slug, status: { in: ['PUBLISHED', 'ARCHIVED'] } },
    include: {
      partnerBrand: true,
      metrics: { orderBy: { sortOrder: 'asc' } },
      quotes: { where: { approved: true } },
    },
  });
  if (!c) return null;

  /* 계약 당사자 여부 — 브랜드 계정이 이 사례의 브랜드와 같을 때만 (§5.3 PARTY_ONLY) */
  const isParty = !!viewer?.brandId && !!c.partnerBrand?.brandId && viewer.brandId === c.partnerBrand.brandId;

  const related = c.partnerBrandId
    ? await prisma.matchingCase.findMany({
        where: { status: 'PUBLISHED', partnerBrandId: c.partnerBrandId, id: { not: c.id } },
        select: { slug: true, title: true, athleteName: true, heroImageUrl: true, tour: true },
        take: 3,
      })
    : [];

  return {
    id: c.id, slug: c.slug, code: c.code, title: c.title, summary: c.summary,
    background: c.background,
    athleteId: c.athleteId, athleteName: c.athleteName,
    brand: c.partnerBrand
      ? {
          slug: c.partnerBrand.slug, name: c.partnerBrand.displayName,
          logoUrl: c.partnerBrand.logoLight, category: c.partnerBrand.category,
        }
      : { slug: null, name: c.brandName, logoUrl: null, category: null },
    sport: c.sport, tour: c.tour,
    sponsorTypes: c.sponsorTypes, objectiveCodes: c.objectiveCodes,
    heroImageUrl: c.heroImageUrl,
    periodFrom: c.periodFrom, periodTo: c.periodTo,
    verified: c.verified,
    archived: c.status === 'ARCHIVED',
    execution: c.executionBlocks,
    timeline: c.timeline,
    metrics: c.metrics.map((m) => shapeMetric(m, viewer, isParty)),
    quotes: c.quotes.map((q) => ({
      speaker: q.speaker, authorName: q.authorName, authorRole: q.authorRole,
      avatarUrl: q.avatarUrl, content: q.content,
    })),
    related,
    isParty,
    /* 하단 CTA (§5.2) */
    cta: { label: '비슷한 후원 추천받기', to: '/sponsor/recommended' },
    evidenceNotice: '성과 수치는 측정 기간과 데이터 출처를 함께 표기하며, 검증이 끝난 값만 공개합니다.',
  };
}

/** 성과 근거 레이어 (IU04 · §5.2) — 값을 볼 수 있는 사람에게만 근거를 준다 */
export async function getMetricEvidence(metricId: string, viewer: Viewer) {
  const m = await prisma.caseMetric.findUnique({
    where: { id: metricId },
    include: { case: { include: { partnerBrand: { select: { brandId: true } } } } },
  });
  if (!m || m.case.status !== 'PUBLISHED') return null;

  const isParty = !!viewer?.brandId && viewer.brandId === m.case.partnerBrand?.brandId;
  const shaped = shapeMetric(m, viewer, isParty);
  if (shaped.restricted) {
    return { restricted: true, reason: (shaped as any).restrictedReason };
  }

  return {
    restricted: false,
    metric: shaped,
    definition: m.definition,
    aggregationNote: m.aggregationNote,
    period: { start: m.periodStart, end: m.periodEnd },
    source: { type: m.sourceType, name: m.sourceName },
    verification: { status: m.verificationStatus, verifiedAt: m.verifiedAt },
    /* 원본 리포트는 계약 당사자만 (§5.3) */
    rawReportUri: isParty ? m.evidenceUri : null,
    rawReportNotice: isParty ? null : '원본 리포트는 계약 당사자만 확인할 수 있습니다',
    notice: 'SPONPIK은 객관적 데이터와 검증 절차를 통해 성과의 신뢰성을 확인합니다.',
  };
}

/* ── 파트너 브랜드 (§10) ────────────────────────────── */

/** 목록에 노출 가능한 상태 (§10.3) */
const LISTABLE = ['ACTIVE_PARTNER', 'PAST_PARTNER'];

export async function listBrands(params: {
  category?: string; q?: string; hasStore?: string; status?: string; page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(48, params.limit ?? 12);

  const where: Prisma.PartnerBrandWhereInput = {
    status: params.status && LISTABLE.includes(params.status) ? params.status : { in: LISTABLE },
    ...(params.category ? { category: params.category } : {}),
    ...(params.q ? { displayName: { contains: params.q, mode: 'insensitive' } } : {}),
    ...(params.hasStore === 'true' ? { storeUrl: { not: null } } : {}),
  };

  const [rows, total, categories] = await Promise.all([
    prisma.partnerBrand.findMany({
      where, orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { displayName: 'asc' }],
      skip: (page - 1) * limit, take: limit,
      include: { _count: { select: { cases: true } } },
    }),
    prisma.partnerBrand.count({ where }),
    prisma.partnerBrand.groupBy({ by: ['category'], where: { status: { in: LISTABLE } }, _count: { _all: true } }),
  ]);

  /* 협업 선수 수는 사례에서 센다 (중복 제거) */
  const ids = rows.map((r) => r.id);
  const caseRows = ids.length
    ? await prisma.matchingCase.findMany({
        where: { partnerBrandId: { in: ids }, status: 'PUBLISHED' },
        select: { partnerBrandId: true, athleteId: true, athleteName: true },
      })
    : [];
  const athletesOf = new Map<string, Set<string>>();
  for (const c of caseRows) {
    const key = c.partnerBrandId!;
    const set = athletesOf.get(key) ?? new Set<string>();
    set.add(c.athleteId ?? c.athleteName ?? '');
    athletesOf.set(key, set);
  }

  return {
    brands: rows.map((b) => ({
      id: b.id, slug: b.slug, name: b.displayName, category: b.category,
      logoUrl: b.logoLight, logoAlt: b.logoAlt ?? `${b.displayName} 로고`,
      status: b.status,
      statusLabel: b.status === 'ACTIVE_PARTNER' ? '활성 파트너' : '이전 협업',
      hasStore: !!b.storeUrl,
      athletes: athletesOf.get(b.id)?.size ?? 0,
      projects: b._count.cases,
      featured: b.featured,
    })),
    total, page, limit,
    categories: categories.map((c) => ({ code: c.category, label: c.category, count: c._count._all })),
    cta: { label: '브랜드로 참여하기', to: '/contact' },
  };
}

export async function getBrand(slug: string, viewer: Viewer) {
  const b = await prisma.partnerBrand.findFirst({
    where: { slug, status: { in: [...LISTABLE, 'ARCHIVED'] } },
  });
  if (!b) return null;

  const [cases, rights] = await Promise.all([
    prisma.matchingCase.findMany({
      where: { partnerBrandId: b.id, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: {
        metrics: { where: { isPrimary: true, visibility: { not: 'PRIVATE' } }, take: 3, orderBy: { sortOrder: 'asc' } },
      },
      take: 6,
    }),
    prisma.rightsGrant.findMany({
      where: { partnerBrandId: b.id, assetType: 'LOGO' },
      select: { status: true, validTo: true },
    }),
  ]);

  /* 로고 사용권이 만료됐으면 이미지 대신 텍스트로 (§17.1) */
  const logoValid = rights.length === 0 || rights.some((r) => r.status === 'VALID' && (!r.validTo || r.validTo > new Date()));

  const athletes = [...new Map(
    cases.filter((c) => c.athleteId || c.athleteName)
      .map((c) => [c.athleteId ?? c.athleteName!, { id: c.athleteId, name: c.athleteName }]),
  ).values()];

  return {
    id: b.id, slug: b.slug, name: b.displayName, legalName: b.legalName,
    category: b.category, description: b.description,
    website: b.website, instagram: b.instagram, storeUrl: b.storeUrl,
    logoUrl: logoValid ? b.logoLight : null,
    logoDarkUrl: logoValid ? b.logoDark : null,
    logoAlt: b.logoAlt ?? `${b.displayName} 로고`,
    logoBlocked: !logoValid,
    heroImageUrl: b.heroImageUrl,
    status: b.status,
    statusLabel: b.status === 'ACTIVE_PARTNER' ? '활동 파트너' : b.status === 'PAST_PARTNER' ? '이전 협업' : '보관',
    athletes,
    cases: cases.map((c) => ({
      slug: c.slug, title: c.title, athleteName: c.athleteName, tour: c.tour,
      heroImageUrl: c.heroImageUrl, sponsorTypes: c.sponsorTypes, verified: c.verified,
      highlights: c.metrics.map((m) => shapeMetric(m, viewer, false)),
    })),
    seo: { title: b.seoTitle ?? `${b.displayName} | 함께하는 브랜드`, description: b.seoDesc ?? b.description },
    notice: '모든 성과 데이터는 협업 종료 후 선수·브랜드의 동의를 받아 SPONPIK이 검증한 결과입니다.',
    cta: { label: '협업 문의', to: '/contact' },
  };
}

/* ── 분석 이벤트 (§13.1 · §13.3) ────────────────────── */

const ALLOWED_EVENTS = [
  'about_menu_open', 'about_menu_click', 'intro_view', 'intro_section_view',
  'case_filter_apply', 'case_view', 'evidence_open', 'brand_view',
  'instagram_click', 'intro_cta_click', 'guarantee_check',
];

/** 개인 식별자는 저장하지 않는다. visitorKey 는 클라이언트가 만든 가명 ID 만 허용한다 */
export async function trackEvent(input: {
  event: string; pageSlug?: string; visitorKey?: string; role?: string; params?: any;
}) {
  if (!ALLOWED_EVENTS.includes(input.event)) return { tracked: false, reason: 'UNKNOWN_EVENT' as const };
  const key = (input.visitorKey ?? '').slice(0, 64);
  /* 이메일·전화번호 형태가 들어오면 버린다 */
  if (/@|\d{9,}/.test(key)) return { tracked: false, reason: 'PII_REJECTED' as const };

  await prisma.aboutAnalyticsEvent.create({
    data: {
      event: input.event, pageSlug: input.pageSlug, visitorKey: key || null,
      role: input.role, params: input.params ?? undefined,
    },
  }).catch(() => null);
  return { tracked: true };
}

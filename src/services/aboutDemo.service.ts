/**
 * 스폰픽 소개 — 파트너 브랜드 · 실측 매칭사례 시드
 *
 * 구 소개 페이지(`pages/about/AboutBrands.tsx` · `AboutCases.tsx`)에 하드코딩돼 있던 파트너 브랜드 로고 목록과
 * 2026-08 GTOUR/WGTOUR 6차 방송 노출 트래킹 실측 사례 2건을 PartnerBrand / MatchingCase 레코드로 옮긴다.
 *
 *  - 값은 구 페이지에 있던 것만. 홈페이지·소개문·성과 수치 등 확인되지 않은 정보는 넣지 않는다 (LEG-06).
 *  - 실측 사례의 지표는 트래킹 리포트가 출처인 것만 PUBLIC_EXACT, 나머지는 PUBLIC_LABEL(정성).
 *  - slug 기준 멱등. 선수는 이름으로 찾고 없으면 이름만 남긴다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedBrand = { slug: string; name: string; category: string; logo: string; storeSlug?: string; sortOrder: number };

/** 구 AboutBrands 로고 목록 + 팬스토어가 있는 브랜드 */
export const PARTNER_BRANDS: SeedBrand[] = [
  { slug: 'orex', name: 'OREX', category: '골프 · 스포츠', logo: '/brands/orex.png', storeSlug: 'orex-youmdonwoong', sortOrder: 1 },
  { slug: 'fau', name: 'FAU', category: '골프 · 스포츠', logo: '/brands/fau.png', sortOrder: 2 },
  { slug: 'elensilia', name: 'ELENSILIA', category: '건강 · 뷰티', logo: '/brands/elensilia.png', sortOrder: 3 },
  { slug: 'nature-republic', name: 'NATURE REPUBLIC', category: '건강 · 뷰티', logo: '/brands/nature-republic.png', sortOrder: 4 },
  { slug: 'kilogram-studio', name: 'Kilogram studio', category: '골프 · 스포츠', logo: '/brands/kilogram-studio.png', sortOrder: 5 },
  { slug: 'brrr-studio', name: 'Brrr. studio', category: '식품 · 라이프', logo: '/brands/brrr-studio.png', sortOrder: 6 },
  { slug: 'nlt1', name: 'NLT1 COMPANY', category: '식품 · 라이프', logo: '/brands/nlt1.png', sortOrder: 7 },
  { slug: 'ahnguk-health', name: '안국건강', category: '건강 · 뷰티', logo: '/brands/ahnguk-health.png', sortOrder: 8 },
  { slug: 'the-guys', name: 'the GUYS', category: '패션 · 잡화', logo: '/brands/the-guys.png', storeSlug: 'the-guys-youmdonwoong', sortOrder: 9 },
  { slug: 'hoi-bakery', name: '호이베이커리', category: '식품 · 라이프', logo: '/brands/hoi-bakery-wordmark.png', storeSlug: 'hoi-bakery-baejinri', sortOrder: 10 },
];

/** 2026 GTOUR/WGTOUR 6차 메이저 방송 노출 트래킹 리포트 기준 실측 사례 (구 AboutCases SUB_CASES) */
const SOURCE = '2026 GTOUR/WGTOUR 6차 메이저 방송 노출 트래킹 리포트';
const CASES = [
  {
    slug: 'orex-x-youmdonwoong-gtour-2026', code: 'SP-2026-GT06-01', brandSlug: 'orex', athleteName: '염돈웅',
    title: '오렉스 × 염돈웅 프로 — GTOUR 6차 메이저 중계 노출',
    summary: '대회 중계 중심 브랜드 노출',
    background: '골프 용품 브랜드 오렉스가 대회 중계 화면에서 자연스럽게 노출되는 것을 목표로, 염돈웅 프로의 우측 소매 슬롯에 로고를 부착했습니다.',
    sport: '골프', tour: 'KPGA', sponsorTypes: ['후원슬롯'], objectiveCodes: ['AWARENESS'],
    heroImageUrl: '/golfers/youm-donwoong-2026.jpeg',
    periodFrom: new Date('2026-08-01'), periodTo: new Date('2026-08-31'),
    executionBlocks: [
      { title: '우측 소매', desc: '오렉스 로고 패치 노출', badge: '착장 위치' },
      { title: '대회 1회', desc: 'GTOUR 6차 메이저 · 공동 2위', badge: '2026.08' },
    ],
    timeline: [
      { label: '계약', date: '2026.07' }, { label: '패치 제작', date: '2026.07' },
      { label: '대회 출전', date: '2026.08' }, { label: '성과 검증', date: '2026.08' },
    ],
    metrics: [
      { metricCode: 'broadcast_exposure', label: '중계 착용 노출', value: 1, unit: '건', displayValue: '중계 착용 노출 실측 확인', visibility: 'PUBLIC_LABEL', isPrimary: true, definition: '대회 중계 화면에 후원 슬롯(로고)이 식별 가능하게 노출된 사실을 트래킹 리포트로 확인', aggregationNote: '중계 영상 프레임 단위 트래킹 후 식별 가능 노출만 인정' },
      { metricCode: 'broadcast_views', label: '중계 조회', value: 228000, unit: '회', displayValue: '22.8만 회', visibility: 'PUBLIC_EXACT', isPrimary: true, definition: '노출이 확인된 중계 영상의 누적 조회 수', aggregationNote: '중계 플랫폼 공개 조회 수 기준' },
    ],
  },
  {
    slug: 'elensilia-x-jangyeonju-wgtour-2026', code: 'SP-2026-WG06-01', brandSlug: 'elensilia', athleteName: '장연주',
    title: '엘렌실라 × 장연주 프로 — WGTOUR 6차 메이저 중계 노출',
    summary: '여성 골프 팬 대상 브랜드 인지',
    background: '뷰티 브랜드 엘렌실라가 여성 골프 팬층에 브랜드를 알리는 것을 목표로, 장연주 프로의 우측 소매 2단 패치 슬롯을 활용했습니다.',
    sport: '골프', tour: 'KLPGA', sponsorTypes: ['후원슬롯', '팬스토어'], objectiveCodes: ['AWARENESS'],
    heroImageUrl: '/golfers/jang-yeonju.jpeg',
    periodFrom: new Date('2026-08-01'), periodTo: new Date('2026-08-31'),
    executionBlocks: [
      { title: '우측 소매 2단 패치', desc: '엘렌실라 로고 노출', badge: '착장 위치' },
      { title: '대회 1회', desc: 'WGTOUR 6차 메이저', badge: '2026.08' },
    ],
    timeline: [
      { label: '계약', date: '2026.07' }, { label: '패치 제작', date: '2026.07' },
      { label: '대회 출전', date: '2026.08' }, { label: '성과 검증', date: '2026.08' },
    ],
    metrics: [
      { metricCode: 'broadcast_closeup', label: '중계 클로즈업 노출', value: 1, unit: '건', displayValue: '버디 세리머니 클로즈업 노출 확인', visibility: 'PUBLIC_LABEL', isPrimary: true, definition: '대회 중계 중 선수 클로즈업 장면에서 후원 슬롯이 식별 가능하게 노출된 사실을 트래킹 리포트로 확인', aggregationNote: '중계 영상 프레임 단위 트래킹 후 식별 가능 노출만 인정' },
    ],
  },
];

export async function seedAboutPartners() {
  const results: { slug: string; kind: 'BRAND' | 'CASE'; status: 'CREATED' | 'UPDATED' | 'SKIPPED'; reason?: string }[] = [];
  const brandIds = new Map<string, string>();

  for (const b of PARTNER_BRANDS) {
    const store = b.storeSlug ? await prisma.fanStore.findUnique({ where: { slug: b.storeSlug }, select: { slug: true } }) : null;
    const data = {
      displayName: b.name, category: b.category, logoLight: b.logo, logoAlt: `${b.name} 로고`,
      storeUrl: store ? `/fan/store/${store.slug}` : null, sortOrder: b.sortOrder, status: 'ACTIVE_PARTNER',
    };
    const existing = await prisma.partnerBrand.findUnique({ where: { slug: b.slug }, select: { id: true } });
    const row = existing
      ? await prisma.partnerBrand.update({ where: { id: existing.id }, data })
      : await prisma.partnerBrand.create({ data: { ...data, slug: b.slug, publishedAt: new Date() } });
    brandIds.set(b.slug, row.id);
    results.push({ slug: b.slug, kind: 'BRAND', status: existing ? 'UPDATED' : 'CREATED' });
  }

  for (const c of CASES) {
    const athlete = await prisma.athlete.findFirst({ where: { name: c.athleteName }, select: { id: true, profileImageUrl: true } });
    const brandName = PARTNER_BRANDS.find((b) => b.slug === c.brandSlug)!.name;
    const data = {
      title: c.title, summary: c.summary, background: c.background,
      partnerBrandId: brandIds.get(c.brandSlug) ?? null, athleteId: athlete?.id ?? null,
      athleteName: c.athleteName, brandName,
      sport: c.sport, tour: c.tour, sponsorTypes: c.sponsorTypes, objectiveCodes: c.objectiveCodes,
      heroImageUrl: athlete?.profileImageUrl ?? c.heroImageUrl,
      periodFrom: c.periodFrom, periodTo: c.periodTo,
      executionBlocks: c.executionBlocks, timeline: c.timeline,
      visibility: 'PUBLIC_EXACT', verified: true, status: 'PUBLISHED',
    };
    const existing = await prisma.matchingCase.findUnique({ where: { slug: c.slug }, select: { id: true } });
    const row = existing
      ? await prisma.matchingCase.update({ where: { id: existing.id }, data })
      : await prisma.matchingCase.create({ data: { ...data, slug: c.slug, code: c.code, publishedAt: new Date(), featured: c === CASES[0] } });

    const current = await prisma.caseMetric.findMany({ where: { caseId: row.id }, select: { id: true, metricCode: true } });
    for (const [i, m] of c.metrics.entries()) {
      const mdata = {
        label: m.label, value: m.value, unit: m.unit, displayValue: m.displayValue, visibility: m.visibility, isPrimary: m.isPrimary,
        definition: m.definition, aggregationNote: m.aggregationNote, sourceType: 'REPORT', sourceName: SOURCE,
        periodStart: c.periodFrom, periodEnd: c.periodTo, verificationStatus: 'VERIFIED', verifiedAt: c.periodTo, sortOrder: i,
      };
      const found = current.find((x) => x.metricCode === m.metricCode);
      if (found) await prisma.caseMetric.update({ where: { id: found.id }, data: mdata });
      else await prisma.caseMetric.create({ data: { ...mdata, caseId: row.id, metricCode: m.metricCode } });
    }
    results.push({ slug: c.slug, kind: 'CASE', status: existing ? 'UPDATED' : 'CREATED', reason: athlete ? undefined : `선수 '${c.athleteName}' 미연결(이름만 표시)` });
  }
  return { results, brands: PARTNER_BRANDS.length, cases: CASES.length };
}

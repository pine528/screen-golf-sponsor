/**
 * 소개 허브 검증용 최소 시드 (로컬 개발 전용)
 * 공개등급·게시 게이트·성과보장 판정이 실제로 동작하는지 확인하기 위한 데이터.
 * 운영 DB에는 넣지 않는다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  /* 파트너 브랜드 */
  const brand = await prisma.partnerBrand.upsert({
    where: { slug: 'demo-health' },
    update: {},
    create: {
      slug: 'demo-health',
      displayName: '데모건강',
      category: '건강기능식품',
      description: '데모건강은 검증용 샘플 브랜드입니다. 실제 브랜드가 아닙니다.',
      website: 'https://example.com',
      status: 'ACTIVE_PARTNER',
      publishedAt: new Date(),
      logoAlt: '데모건강 로고',
    },
  });

  /* 로고 사용권 — 유효 */
  await prisma.rightsGrant.create({
    data: {
      assetType: 'LOGO', assetName: '데모건강 로고 (컬러)',
      holderType: 'BRAND', holderName: '데모건강',
      partnerBrandId: brand.id,
      allowedScopes: ['website', 'social'],
      allowedRegion: '대한민국',
      evidenceUrl: 'https://example.com/logo-consent.pdf',
      evidenceName: '상표권 사용 동의서.pdf',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-12-31'),
      status: 'VALID',
      ownerTeam: '브랜드팀',
    },
  }).catch(() => null);

  /* 초상권 — 30일 이내 만료 (권리 큐 확인용) */
  await prisma.rightsGrant.create({
    data: {
      assetType: 'PORTRAIT', assetName: '데모선수 프로필 사진',
      holderType: 'ATHLETE', holderName: '데모선수',
      allowedScopes: ['website'],
      evidenceUrl: 'https://example.com/portrait.pdf',
      evidenceName: '초상권 사용 동의서.pdf',
      validFrom: new Date('2026-01-01'),
      validTo: new Date(Date.now() + 6 * 86400_000),
      status: 'VALID',
      ownerTeam: '콘텐츠팀',
    },
  }).catch(() => null);

  /* 매칭사례 */
  const c = await prisma.matchingCase.upsert({
    where: { slug: 'demo-health-x-demo-athlete' },
    update: {},
    create: {
      slug: 'demo-health-x-demo-athlete',
      code: 'SP-2026-00001',
      title: '데모건강 × 데모선수 시즌 후원',
      summary: '건강기능식품 신뢰도 및 구매 전환 확대',
      background: '신제품 인지도를 골프 팬층으로 확장하고 긍정적 브랜드 경험을 만드는 것이 목표였습니다.',
      partnerBrandId: brand.id,
      athleteName: '데모선수',
      brandName: '데모건강',
      contractId: 'DEMO-CONTRACT-0001',
      sport: '골프', tour: 'KPGA',
      sponsorTypes: ['모자 정면', 'SNS 콘텐츠'],
      objectiveCodes: ['AWARENESS', 'CONVERSION'],
      executionBlocks: [
        { title: '모자 정면', desc: '데모건강 로고 노출', badge: '착장 위치' },
        { title: '대회 1회', desc: 'KPGA 정규투어', badge: '2026.05' },
        { title: 'SNS 콘텐츠 2건', desc: '인스타그램 피드 1건 · 숏폼 1건' },
      ],
      timeline: [
        { label: '계약', date: '2026.04.30' }, { label: '패치 제작', date: '2026.05.07' },
        { label: '대회 출전', date: '2026.05.24' }, { label: '콘텐츠', date: '2026.05.20' },
        { label: '성과 검증', date: '2026.06.15' },
      ],
      periodFrom: new Date('2026-04-01'),
      periodTo: new Date('2027-03-31'),
      status: 'PUBLISHED',
      verified: true,
      publishedAt: new Date(),
    },
  });

  /* 지표 — 공개등급별로 하나씩 (LEG-06 · §5.3 확인용) */
  const metrics = [
    {
      metricCode: 'sns_views', label: 'SNS 콘텐츠 조회', value: 18420, unit: '회',
      displayValue: '18,420회', visibility: 'PUBLIC_EXACT', isPrimary: true,
      sourceType: 'API', sourceName: '인스타그램 인사이트',
      definition: '후원 기간 동안 선수 관련 공식 SNS 콘텐츠의 총 조회수 합계',
      aggregationNote: '중복 조회 및 봇 트래픽 필터링 후 집계 (동일 사용자 24시간 내 중복 조회 1회로 집계)',
      verificationStatus: 'FINAL',
    },
    {
      metricCode: 'broadcast_seconds', label: '방송 노출', value: 86, unit: '회',
      displayValue: '86회', visibility: 'PUBLIC_RANGE',
      sourceType: 'FILE', sourceName: '방송 모니터링 리포트',
      verificationStatus: 'VERIFIED',
    },
    {
      metricCode: 'store_visits', label: '브랜드 방문', value: 4352, unit: '회',
      visibility: 'MEMBER_ONLY',
      sourceType: 'API', sourceName: 'GA4 이벤트',
      verificationStatus: 'VERIFIED',
    },
    {
      metricCode: 'contract_amount', label: '계약 금액', value: 120000000, unit: '원',
      visibility: 'PARTY_ONLY',
      sourceType: 'FILE', sourceName: '계약서',
      verificationStatus: 'VERIFIED',
    },
  ];

  for (const [i, m] of metrics.entries()) {
    await prisma.caseMetric.create({
      data: {
        caseId: c.id, ...m, sortOrder: i,
        periodStart: new Date('2026-05-20'), periodEnd: new Date('2026-06-29'),
        verifiedAt: new Date(),
      },
    }).catch(() => null);
  }

  await prisma.caseQuote.create({
    data: {
      caseId: c.id, speaker: 'BRAND', authorName: '데모건강 마케팅팀',
      content: '목표로 한 골프 팬층에 자연스럽게 노출되어 신제품 인지도 향상에 긍정적인 효과를 확인했습니다.',
      approved: true, approvedAt: new Date(),
    },
  }).catch(() => null);

  /* 성과보장 정책 + 계약 스냅샷 */
  const policy = await prisma.guaranteePolicy.upsert({
    where: { version: 'v1.0-demo' },
    update: {},
    create: {
      version: 'v1.0-demo',
      summary: '검증용 성과보장 정책',
      eligibleProductTypes: ['RECOMMENDED_PICK'],
      qualificationRules: { minAmount: 10_000_000, minMonths: 1 },
      metricRules: [
        { code: 'broadcast', label: '방송 노출', operator: 'gte', target: 600, unit: '초', weight: 40, source: 'KOBACO 방송 모니터링', required: true, definition: '총 방송 노출 시간' },
        { code: 'sns', label: 'SNS 활동', operator: 'gte', target: 1000, unit: '건', weight: 30, source: 'SPONPIK SNS 수집', required: true, definition: '브랜드 언급 게시물 수' },
        { code: 'fan', label: '팬 반응', operator: 'gte', target: 5, unit: '%', weight: 30, source: 'SPONPIK 감성 분석', required: true, definition: '긍정 반응률' },
      ],
      judgeMode: 'WEIGHTED', minScore: 80,
      remedyRules: { ratio: 30, cap: 15_000_000, validMonths: 6, cashRefund: false },
      appealWindowDays: 14,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-04-01'),
      legalApprovedBy: 'demo-legal',
      legalApprovedAt: new Date(),
    },
  });

  const snap = await prisma.guaranteeSnapshot.create({
    data: {
      policyId: policy.id, policyVersion: policy.version,
      contractId: 'DEMO-CONTRACT-0001',
      brandName: '데모건강', athleteName: '데모선수',
      contractAmount: 150_000_000,
      kpiTargets: policy.metricRules as any,
      judgeMode: 'WEIGHTED', minScore: 80,
      remedyRules: policy.remedyRules as any,
      measureStart: new Date('2026-04-15'),
      measureEnd: new Date('2026-05-14'),
      appealWindowDays: 14,
      status: 'MEASURING',
    },
  }).catch(() => null);

  if (snap) {
    /* 하나는 미수집으로 남겨 DATA_PENDING 을 확인한다 */
    await prisma.guaranteeObservation.createMany({
      data: [
        { snapshotId: snap.id, metricCode: 'broadcast', label: '방송 노출', target: 600, actual: 842, unit: '초', weight: 40, required: true, sourceName: 'KOBACO', collectStatus: 'VERIFIED', judgement: 'MET', provisional: false },
        { snapshotId: snap.id, metricCode: 'sns', label: 'SNS 활동', target: 1000, actual: 726, unit: '건', weight: 30, required: true, sourceName: 'Instagram', collectStatus: 'COLLECTED', judgement: 'NOT_MET' },
        { snapshotId: snap.id, metricCode: 'fan', label: '팬 반응', target: 5, actual: null, unit: '%', weight: 30, required: true, sourceName: 'SPONPIK Analytics', collectStatus: 'PENDING', judgement: 'DATA_PENDING', nextCheckAt: new Date(Date.now() + 3 * 86400_000) },
      ],
    }).catch(() => null);
  }

  /* 소개 페이지 (CMS) */
  const page = await prisma.contentPage.upsert({
    where: { slug: 'service' },
    update: {},
    create: {
      slug: 'service', title: '서비스소개',
      menuLabel: '서비스소개', menuDesc: '스폰픽이 제공하는 가치와 차별점을 소개합니다.',
      seoTitle: 'SPONPIK 서비스소개', seoDesc: '선수와 후원방식을 선택하고 성과까지 확인하는 스포츠 후원 플랫폼',
      status: 'PUBLISHED', publishedAt: new Date(),
    },
  });
  await prisma.contentBlock.createMany({
    data: [
      { pageId: page.id, type: 'HERO', name: '히어로', payload: { title: '선수의 가능성에 브랜드를 PICK하다', description: '원하는 선수와 후원방식을 직접 선택하거나 추천을 받으세요.', ctaLabel: '후원 시작', ctaTo: '/sponsor/available' }, sortOrder: 0 },
      { pageId: page.id, type: 'FEATURE_GRID', name: '핵심 기능', payload: { title: '핵심 기능 5가지' }, sortOrder: 1 },
      { pageId: page.id, type: 'INSTAGRAM_CTA', name: '공식 인스타 CTA', payload: { title: '스폰픽의 일상과 인사이트를 만나보세요', ctaLabel: '인스타그램 바로가기', ctaTo: 'https://www.instagram.com/sponpik_official/' }, sortOrder: 2 },
    ],
  }).catch(() => null);

  console.log('seeded:', { brand: brand.slug, case: c.slug, policy: policy.version, page: page.slug });
}

main().finally(() => prisma.$disconnect());

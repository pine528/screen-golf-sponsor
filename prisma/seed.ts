import { PrismaClient, BodyPart, MaterialRule } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@screengolf.com' },
    update: {},
    create: {
      email: 'admin@screengolf.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      admin: {
        create: {
          name: 'System Admin',
          department: 'Operations',
        },
      },
    },
  });
  console.log('Admin user created:', adminUser.email);

  // Create Brand User
  const brandPassword = await bcrypt.hash('brand123!', 12);
  const brandUser = await prisma.user.upsert({
    where: { email: 'brand@example.com' },
    update: {},
    create: {
      email: 'brand@example.com',
      passwordHash: brandPassword,
      role: 'BRAND',
      brand: {
        create: {
          name: '테스트 브랜드',
          bizNo: '123-45-67890',
          contactEmail: 'brand@example.com',
          contactPhone: '010-1234-5678',
          category: 'SPORTS',
          kycStatus: 'APPROVED',
        },
      },
    },
  });
  console.log('Brand user created:', brandUser.email);

  // Create Athlete User
  const athletePassword = await bcrypt.hash('athlete123!', 12);
  const athleteUser = await prisma.user.upsert({
    where: { email: 'athlete@example.com' },
    update: {},
    create: {
      email: 'athlete@example.com',
      passwordHash: athletePassword,
      role: 'ATHLETE',
      athlete: {
        create: {
          name: '김프로',
          tour: 'GTOUR',
          bio: 'GTOUR 시즌 챔피언',
          kycStatus: 'APPROVED',
        },
      },
    },
  });
  console.log('Athlete user created:', athleteUser.email);

  // Create Slot Templates (Top 6 Slots)
  const slotTemplates = [
    {
      code: 'SG-01',
      name: '상의 가슴 좌측 (Chest-L)',
      bodyPart: BodyPart.SHIRT_CHEST_LEFT,
      sizeMaxWMm: 60,
      sizeMaxHMm: 50,
      perimeterMaxMm: 220,
      recommendedWMm: 55,
      recommendedHMm: 50,
      forbiddenNotes: '가슴 중앙(방송 마이크/주최 로고 예상), 목선~카라 내부, 지퍼 라인, 기존 메인 스폰서 영역',
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 300000,
    },
    {
      code: 'SG-02',
      name: '상의 가슴 우측 (Chest-R)',
      bodyPart: BodyPart.SHIRT_CHEST_RIGHT,
      sizeMaxWMm: 60,
      sizeMaxHMm: 50,
      perimeterMaxMm: 220,
      recommendedWMm: 55,
      recommendedHMm: 50,
      forbiddenNotes: '가슴 중앙(방송 마이크/주최 로고 예상), 목선~카라 내부, 지퍼 라인',
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 300000,
    },
    {
      code: 'SG-03',
      name: '상의 소매 우측 (Upper Sleeve-R)',
      bodyPart: BodyPart.SHIRT_SLEEVE_RIGHT,
      sizeMaxWMm: 70,
      sizeMaxHMm: 30,
      perimeterMaxMm: 200,
      recommendedWMm: 60,
      recommendedHMm: 25,
      forbiddenNotes: '소매 끝단(주름/굴곡 심함) 회피',
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'sleeve',
      defaultReservePrice: 200000,
    },
    {
      code: 'SG-04',
      name: '상의 소매 좌측 (Upper Sleeve-L)',
      bodyPart: BodyPart.SHIRT_SLEEVE_LEFT,
      sizeMaxWMm: 70,
      sizeMaxHMm: 30,
      perimeterMaxMm: 200,
      recommendedWMm: 60,
      recommendedHMm: 25,
      forbiddenNotes: '소매 끝단(주름/굴곡 심함) 회피',
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'sleeve',
      defaultReservePrice: 200000,
    },
    {
      code: 'SG-05',
      name: '모자 측면 (Left Side Cap)',
      bodyPart: BodyPart.CAP_SIDE_LEFT,
      sizeMaxWMm: 50,
      sizeMaxHMm: 25,
      perimeterMaxMm: 150,
      recommendedWMm: 45,
      recommendedHMm: 20,
      forbiddenNotes: '전면 로고(메인) 회피, 카메라 반사/메탈릭 재질 제한',
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front', 'side'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 250000,
    },
    {
      code: 'SG-06',
      name: '모자 후면 (Back Cap)',
      bodyPart: BodyPart.CAP_BACK,
      sizeMaxWMm: 45,
      sizeMaxHMm: 20,
      perimeterMaxMm: 130,
      recommendedWMm: 40,
      recommendedHMm: 18,
      forbiddenNotes: '스트랩/사이즈 조절부 간섭 금지',
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 150000,
    },
  ];

  for (const template of slotTemplates) {
    await prisma.slotTemplate.upsert({
      where: { code: template.code },
      update: template,
      create: template,
    });
  }
  console.log('Slot templates created:', slotTemplates.length);

  // Create Forbidden Categories
  const forbiddenCategories = [
    { code: 'TOBACCO', name: '담배/니코틴', description: '모든 담배 및 니코틴 관련 제품' },
    { code: 'ALCOHOL', name: '주류', description: '알코올 음료 및 관련 제품' },
    { code: 'GAMBLING', name: '도박/사행', description: '도박, 카지노, 사행성 게임' },
    { code: 'ADULT', name: '성인', description: '성인용 콘텐츠 및 제품' },
    { code: 'POLITICAL', name: '정치·혐오', description: '정치 광고, 혐오 발언 관련' },
    { code: 'ILLEGAL', name: '불법·위조', description: '불법 제품, 위조품' },
    { code: 'HIGHISK_FINANCE', name: '고위험 금융', description: '고위험 투자, 불법 금융' },
  ];

  for (const category of forbiddenCategories) {
    await prisma.forbiddenCategory.upsert({
      where: { code: category.code },
      update: category,
      create: category,
    });
  }
  console.log('Forbidden categories created:', forbiddenCategories.length);

  // Create Sample Event
  const event = await prisma.event.upsert({
    where: { id: 'sample-event-1' },
    update: {},
    create: {
      id: 'sample-event-1',
      tour: 'GTOUR',
      name: '2026 신한투자증권 GTOUR 1차 대회',
      description: '2026 시즌 첫 번째 GTOUR 대회',
      dateStart: new Date('2026-02-01'),
      dateEnd: new Date('2026-02-03'),
      broadcastEpisode: 'S1E1',
      multiplier: 1.2,
      venue: '골프존 파크 하남',
      status: 'UPCOMING',
    },
  });
  console.log('Sample event created:', event.name);

  // ============================================
  // 데모용 LIVE 경매 생성
  // ============================================

  // 1. 선수 정보 가져오기
  const athlete = await prisma.athlete.findFirst({
    where: { user: { email: 'athlete@example.com' } },
  });

  // 2. 슬롯 템플릿 가져오기 (SG-01: 가슴 좌측)
  const slotTemplate = await prisma.slotTemplate.findUnique({
    where: { code: 'SG-01' },
  });

  if (athlete && slotTemplate) {
    // 추가 슬롯 템플릿 가져오기
    const allTemplates = await prisma.slotTemplate.findMany({
      take: 4,
      orderBy: { code: 'asc' },
    });

    // 여러 SlotInstance 생성 (OPEN 상태)
    for (let i = 1; i < allTemplates.length; i++) {
      const template = allTemplates[i];
      await prisma.slotInstance.upsert({
        where: {
          eventId_athleteId_slotTemplateId: {
            eventId: event.id,
            athleteId: athlete.id,
            slotTemplateId: template.id,
          },
        },
        update: {},
        create: {
          eventId: event.id,
          athleteId: athlete.id,
          slotTemplateId: template.id,
          reservePrice: template.defaultReservePrice,
          status: 'OPEN',
        },
      });
    }
    console.log(`Additional slot instances created: ${allTemplates.length - 1}`);

    // 3. SlotInstance 생성 (IN_AUCTION 상태) - 메인 LIVE 경매용
    const slotInstance = await prisma.slotInstance.upsert({
      where: {
        eventId_athleteId_slotTemplateId: {
          eventId: event.id,
          athleteId: athlete.id,
          slotTemplateId: slotTemplate.id,
        },
      },
      update: {
        status: 'IN_AUCTION',
      },
      create: {
        eventId: event.id,
        athleteId: athlete.id,
        slotTemplateId: slotTemplate.id,
        reservePrice: slotTemplate.defaultReservePrice,
        status: 'IN_AUCTION',
      },
    });

    // 4. LIVE 경매 생성 (startAt: now-2분, endAt: now+5분)
    const now = new Date();
    const startAt = new Date(now.getTime() - 2 * 60 * 1000); // 2분 전
    const endAt = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후

    const auction = await prisma.auction.upsert({
      where: { slotInstanceId: slotInstance.id },
      update: {
        status: 'LIVE',
        startAt,
        endAt,
        originalEndAt: endAt,
        currentPrice: slotInstance.reservePrice,
      },
      create: {
        slotInstanceId: slotInstance.id,
        startAt,
        endAt,
        originalEndAt: endAt,
        softCloseSec: 120,
        maxExtensionSec: 600,
        minBidIncrement: 10000,
        currentPrice: slotInstance.reservePrice,
        status: 'LIVE',
      },
    });

    // ============================================
    // 콘솔 출력: 데모 정보 요약
    // ============================================
    console.log('\n========================================');
    console.log('📦 데모 데이터 생성 완료!');
    console.log('========================================\n');

    console.log('🔐 데모 계정:');
    console.log('  관리자: admin@screengolf.com / admin123!');
    console.log('  브랜드: brand@example.com / brand123!');
    console.log('  선수: athlete@example.com / athlete123!\n');

    console.log('🎯 LIVE 경매 정보:');
    console.log(`  경매 ID: ${auction.id}`);
    console.log(`  슬롯: ${slotTemplate.name}`);
    console.log(`  선수: ${athlete.name}`);
    console.log(`  시작가: ${auction.currentPrice.toLocaleString()}원`);
    console.log(`  종료 예정: ${auction.endAt.toLocaleString()}`);
    console.log(`  \n  접속 경로: http://localhost:5173/auctions/${auction.id}\n`);

    console.log('📋 테스트 시나리오:');
    console.log('  1. brand@example.com 으로 로그인');
    console.log('  2. /auctions 페이지에서 LIVE 경매 확인');
    console.log('  3. 경매 상세에서 입찰 버튼 클릭');
    console.log('  4. 경매 종료 후 계약 자동 생성 확인');
    console.log('  5. /contracts 페이지에서 생성된 계약 확인');
    console.log('========================================\n');
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

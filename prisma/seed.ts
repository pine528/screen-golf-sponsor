import { PrismaClient, BodyPart, MaterialRule, SlotGrade, SlotCategory } from '@prisma/client';
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

  // Create Platform System User (for fee collection)
  const platformUser = await prisma.user.upsert({
    where: { id: 'PLATFORM_SYSTEM' },
    update: {},
    create: {
      id: 'PLATFORM_SYSTEM',
      email: 'platform@system.internal',
      passwordHash: '$2b$12$PLATFORM_NOT_FOR_LOGIN_PLACEHOLDER',
      role: 'ADMIN',
      isActive: false, // 로그인 불가
      admin: {
        create: {
          name: 'Platform System',
          department: 'System',
        },
      },
    },
  });
  console.log('Platform system user created:', platformUser.id);

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

  // Create Agency User
  const agencyPassword = await bcrypt.hash('agency123!', 12);
  const agencyUser = await prisma.user.upsert({
    where: { email: 'agency@example.com' },
    update: {},
    create: {
      email: 'agency@example.com',
      passwordHash: agencyPassword,
      role: 'AGENCY',
      agency: {
        create: {
          name: '프로골프 매니지먼트',
          bizNo: '987-65-43210',
          contactEmail: 'agency@example.com',
          contactPhone: '010-9876-5432',
          contactName: '박매니저',
          kycStatus: 'APPROVED',
        },
      },
    },
  });
  console.log('Agency user created:', agencyUser.email);

  // Create Fan User
  const fanPassword = await bcrypt.hash('test123!', 12);
  const fanUser = await prisma.user.upsert({
    where: { email: 'fan@example.com' },
    update: {},
    create: {
      email: 'fan@example.com',
      passwordHash: fanPassword,
      role: 'FAN',
      fan: {
        create: {
          nickname: '테스트팬',
        },
      },
    },
  });
  console.log('Fan user created:', fanUser.email);

  // 팬 초기 포인트 지급 (PointWallet)
  await prisma.pointWallet.upsert({
    where: { userId: fanUser.id },
    update: {},
    create: {
      userId: fanUser.id,
      balance: 10000,
    },
  });
  console.log('Fan initial points granted: 10,000P');

  // ============================================
  // 리워드풀 초기화 (Vote V2)
  // ============================================
  const rewardPool = await prisma.rewardPool.upsert({
    where: { id: 'main-reward-pool' },
    update: {
      // 기존 레코드가 있을 때도 일일 가용액을 리셋
      availableTodayEp: BigInt(500_000),
    },
    create: {
      id: 'main-reward-pool',
      balanceEp: BigInt(10_000_000), // 초기 1,000만 EP
      reservedEp: BigInt(0),
      availableTodayEp: BigInt(500_000), // 일일 가용액 50만 EP
      multiplierM: 1.0, // 초기 배수 1.0 (100%)
    },
  });
  console.log('RewardPool initialized:', {
    id: rewardPool.id,
    balanceEp: rewardPool.balanceEp.toString(),
    multiplierM: rewardPool.multiplierM.toString(),
  });

  // Create Slot Templates (v2 - 16 Slots with Phase Policy)
  const slotTemplates = [
    // Phase 1 - CAP (5 slots)
    {
      code: 'CAP_FRONT',
      name: '모자 정면',
      bodyPart: BodyPart.CAP_FRONT,
      sizeMaxWMm: 60,
      sizeMaxHMm: 30,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 30,
      forbiddenNotes: '반사필름 금지',
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 2500000,
      // v2 Phase Policy Fields
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.S,
      nameKr: '모자 정면',
      nameEn: 'Cap Front',
      uiHeadline: '얼굴 프레임 동시노출',
      uiCopy: "클로즈업에서 가장 자주 보이는 '메인 포지션'. 브랜드 리콜 최상.",
      tags: ['프리미엄', '클로즈업', '메인포지션'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'CAP_FRONT',
      tournamentReserved: false,
      recSizeMm: '60x30',
      material: '무광 자수/우븐패치 또는 무광 열전사 + 재봉보강(반사필름 금지)',
      reserveMinKrw: 2000000,
      reserveRecKrw: 2500000,
      reserveReason: '클로즈업 빈도+상징성(메인 스폰서 위치)',
    },
    {
      code: 'CAP_BRIM_TOP',
      name: '모자챙 상단',
      bodyPart: BodyPart.CAP_BRIM_TOP,
      sizeMaxWMm: 45,
      sizeMaxHMm: 15,
      perimeterMaxMm: 220,
      recommendedWMm: 45,
      recommendedHMm: 15,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 900000,
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.A,
      nameKr: '모자챙 상단',
      nameEn: 'Brim Top',
      uiHeadline: "시선이 '챙'으로 모인다",
      uiCopy: '어드레스/타격 직전 샷에서 자주 걸리는 포인트. 소형 로고 가독성 우수.',
      tags: ['포인트노출', '소형로고', '비용효율'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'CAP_BRIM',
      tournamentReserved: false,
      recSizeMm: '45x15',
      material: '무광 우븐 라벨/자수(슬림)',
      reserveMinKrw: 700000,
      reserveRecKrw: 900000,
      reserveReason: '클로즈업 보조 프리미엄(소형 고가독)',
    },
    {
      code: 'CAP_SIDE_L',
      name: '모자 좌측면',
      bodyPart: BodyPart.CAP_SIDE_L,
      sizeMaxWMm: 55,
      sizeMaxHMm: 25,
      perimeterMaxMm: 220,
      recommendedWMm: 55,
      recommendedHMm: 25,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 1000000,
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.A,
      nameKr: '모자 좌측면',
      nameEn: 'Cap Side Left',
      uiHeadline: '리플레이·측면샷 누적',
      uiCopy: '측면 프레이밍에서 반복 노출. 정면 대비 비용 효율이 높음.',
      tags: ['반복노출', '측면샷', '가성비'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'CAP_SIDE',
      tournamentReserved: false,
      recSizeMm: '55x25',
      material: '무광 자수/우븐패치',
      reserveMinKrw: 800000,
      reserveRecKrw: 1000000,
      reserveReason: '측면 컷 누적 노출',
    },
    {
      code: 'CAP_SIDE_R',
      name: '모자 우측면',
      bodyPart: BodyPart.CAP_SIDE_R,
      sizeMaxWMm: 55,
      sizeMaxHMm: 25,
      perimeterMaxMm: 220,
      recommendedWMm: 55,
      recommendedHMm: 25,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 1000000,
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.A,
      nameKr: '모자 우측면',
      nameEn: 'Cap Side Right',
      uiHeadline: '앵글 편차 대응',
      uiCopy: '카메라가 좌/우로 흔들려도 한쪽은 잡히는 안정 슬롯.',
      tags: ['안정노출', '측면샷', '대칭'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'CAP_SIDE',
      tournamentReserved: false,
      recSizeMm: '55x25',
      material: '무광 자수/우븐패치',
      reserveMinKrw: 800000,
      reserveRecKrw: 1000000,
      reserveReason: '측면 컷 편차 보완',
    },
    {
      code: 'CAP_BACK',
      name: '모자 뒤(후면)',
      bodyPart: BodyPart.CAP_BACK,
      sizeMaxWMm: 50,
      sizeMaxHMm: 20,
      perimeterMaxMm: 220,
      recommendedWMm: 50,
      recommendedHMm: 20,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 350000,
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.B,
      nameKr: '모자 뒤(후면)',
      nameEn: 'Cap Back',
      uiHeadline: '워킹·후면 컷 보조',
      uiCopy: '선수 이동/후면 샷에서 누적 노출. 번들 구성에 적합.',
      tags: ['보조슬롯', '워킹샷', '번들'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'CAP_BACK',
      tournamentReserved: false,
      recSizeMm: '50x20',
      material: '무광 우븐 라벨/자수',
      reserveMinKrw: 250000,
      reserveRecKrw: 350000,
      reserveReason: '보조 노출(누적형)',
    },
    // Phase 1 - TOP (9 slots)
    {
      code: 'CHEST_L',
      name: '가슴 좌',
      bodyPart: BodyPart.CHEST_L,
      sizeMaxWMm: 70,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '가슴 좌',
      nameEn: 'Chest Left',
      uiHeadline: '상체 고정 노출',
      uiCopy: '어드레스/스윙 미디움샷에서 가장 안정적. 가독성과 체류시간 우수.',
      tags: ['가독성', '안정노출', '미디움'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드/공식스폰 점유)',
      exclusivityGroup: 'CHEST',
      tournamentReserved: true,
      recSizeMm: '70x40',
      material: '무광 열전사 + 재봉보강(스트레치 원단 대응)',
      reserveMinKrw: 1500000,
      reserveRecKrw: 2000000,
      reserveReason: '상체 중심 프레임 고정 노출',
    },
    {
      code: 'CHEST_R',
      name: '가슴 우',
      bodyPart: BodyPart.CHEST_R,
      sizeMaxWMm: 70,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '가슴 우',
      nameEn: 'Chest Right',
      uiHeadline: '중앙권 노출 확률↑',
      uiCopy: '가슴 좌와 동급. 카메라 편차에도 상체 중앙권에 걸릴 확률이 높음.',
      tags: ['가독성', '안정노출', '미디움'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드/공식스폰 점유)',
      exclusivityGroup: 'CHEST',
      tournamentReserved: true,
      recSizeMm: '70x40',
      material: '무광 열전사 + 재봉보강(스트레치 원단 대응)',
      reserveMinKrw: 1500000,
      reserveRecKrw: 2000000,
      reserveReason: '상체 중심 프레임 고정 노출',
    },
    {
      code: 'COLLAR_L',
      name: '카라 좌',
      bodyPart: BodyPart.COLLAR_L,
      sizeMaxWMm: 50,
      sizeMaxHMm: 20,
      perimeterMaxMm: 220,
      recommendedWMm: 50,
      recommendedHMm: 20,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'collar',
      defaultReservePrice: 1600000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '카라 좌',
      nameEn: 'Collar Left',
      uiHeadline: '클로즈업·인터뷰 강점',
      uiCopy: '시선이 모이는 위치. 작은 로고도 또렷하고 고급감 연출에 유리.',
      tags: ['클로즈업', '인터뷰', '고급감'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'COLLAR',
      tournamentReserved: false,
      recSizeMm: '50x20',
      material: '무광 우븐 라벨/열전사(슬림)',
      reserveMinKrw: 1200000,
      reserveRecKrw: 1600000,
      reserveReason: '클로즈업 집중/가독성 프리미엄',
    },
    {
      code: 'COLLAR_R',
      name: '카라 우',
      bodyPart: BodyPart.COLLAR_R,
      sizeMaxWMm: 50,
      sizeMaxHMm: 20,
      perimeterMaxMm: 220,
      recommendedWMm: 50,
      recommendedHMm: 20,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'collar',
      defaultReservePrice: 1600000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '카라 우',
      nameEn: 'Collar Right',
      uiHeadline: '세트 구성에 최적',
      uiCopy: '프레이밍 편차 대응. 가슴/카라 세트 구성 시 인지 강화.',
      tags: ['클로즈업', '대칭', '세트추천'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'COLLAR',
      tournamentReserved: false,
      recSizeMm: '50x20',
      material: '무광 우븐 라벨/열전사(슬림)',
      reserveMinKrw: 1200000,
      reserveRecKrw: 1600000,
      reserveReason: '클로즈업 집중/가독성 프리미엄',
    },
    {
      code: 'SLEEVE_L',
      name: '소매 좌',
      bodyPart: BodyPart.SLEEVE_L,
      sizeMaxWMm: 60,
      sizeMaxHMm: 30,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 30,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'sleeve',
      defaultReservePrice: 800000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '소매 좌',
      nameEn: 'Sleeve Left (Outer)',
      uiHeadline: '스윙 동작 누적 노출',
      uiCopy: '스윙 탑/피니시에서 팔이 열리며 반복 노출. 역동적인 브랜드 연출.',
      tags: ['역동성', '동작노출', '미디움'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드 점유)',
      exclusivityGroup: 'SLEEVE',
      tournamentReserved: true,
      recSizeMm: '60x30',
      material: '무광 열전사 + 재봉보강(마찰 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 800000,
      reserveReason: '동작 기반 반복 노출',
    },
    {
      code: 'SLEEVE_R',
      name: '소매 우',
      bodyPart: BodyPart.SLEEVE_R,
      sizeMaxWMm: 60,
      sizeMaxHMm: 30,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 30,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'sleeve',
      defaultReservePrice: 800000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '소매 우',
      nameEn: 'Sleeve Right (Outer)',
      uiHeadline: '앵글 보완·대칭 효과',
      uiCopy: '다른 각도에서 보완 노출. 양팔 세트 구성 시 인지 강화.',
      tags: ['보완노출', '대칭', '세트추천'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드 점유)',
      exclusivityGroup: 'SLEEVE',
      tournamentReserved: true,
      recSizeMm: '60x30',
      material: '무광 열전사 + 재봉보강(마찰 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 800000,
      reserveReason: '앵글 편차 보완',
    },
    {
      code: 'BACK_SHOULDER_L',
      name: '등 어깨 상단 좌',
      bodyPart: BodyPart.BACK_SHOULDER_L,
      sizeMaxWMm: 70,
      sizeMaxHMm: 30,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 30,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'back_shoulder',
      defaultReservePrice: 700000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '등 어깨 상단 좌',
      nameEn: 'Upper Back/Shoulder Left',
      uiHeadline: '후면·피니시 전신샷',
      uiCopy: '피니시 후 뒤돌림/워킹샷에서 잘 보이는 상단 라인. 번들에 강함.',
      tags: ['후면', '전신', '번들'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'BACK_SHOULDER',
      tournamentReserved: false,
      recSizeMm: '70x30',
      material: '무광 열전사 + 재봉보강',
      reserveMinKrw: 500000,
      reserveRecKrw: 700000,
      reserveReason: '후면 전신 누적 노출',
    },
    {
      code: 'BACK_SHOULDER_R',
      name: '등 어깨 상단 우',
      bodyPart: BodyPart.BACK_SHOULDER_R,
      sizeMaxWMm: 70,
      sizeMaxHMm: 30,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 30,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'back_shoulder',
      defaultReservePrice: 700000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '등 어깨 상단 우',
      nameEn: 'Upper Back/Shoulder Right',
      uiHeadline: '후면 노출 보완',
      uiCopy: '좌/우 후면 앵글 편차 대응. 세트 구성 시 균형감.',
      tags: ['후면', '대칭', '번들'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'BACK_SHOULDER',
      tournamentReserved: false,
      recSizeMm: '70x30',
      material: '무광 열전사 + 재봉보강',
      reserveMinKrw: 500000,
      reserveRecKrw: 700000,
      reserveReason: '후면 전신 누적 노출',
    },
    // Phase 2 - PANTS (2 slots)
    {
      code: 'PANTS_HIP_SIDE_FACING',
      name: '하의 엉덩이 옆라인(타격방향)',
      bodyPart: BodyPart.PANTS_HIP_SIDE_FACING,
      sizeMaxWMm: 70,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'pants_side',
      defaultReservePrice: 900000,
      phase: 2,
      category: SlotCategory.PANTS,
      grade: SlotGrade.A,
      nameKr: '하의 엉덩이 옆라인(타격방향)',
      nameEn: 'Pants Hip Side (Facing)',
      uiHeadline: "전신샷 '라인 포인트'",
      uiCopy: '피니시 전신샷에서 시선이 따라가는 옆라인. 우타/좌타에 따라 노출 측면이 달라짐.',
      tags: ['피니시', '전신', '라인포인트', '우타좌타'],
      openRule: 'Phase 1 오픈 슬롯이 모두 SOLD 또는 RESERVED이면 개설 가능(자동/승인)',
      exclusivityGroup: 'PANTS_SIDE',
      tournamentReserved: false,
      recSizeMm: '70x40',
      material: '무광 열전사 + 재봉보강(마찰/주름 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 900000,
      reserveReason: '전신 피니시에서 주목도 높은 라인 노출',
    },
    {
      code: 'PANTS_THIGH_SIDE_FACING',
      name: '하의 허벅지 옆라인(타격방향)',
      bodyPart: BodyPart.PANTS_THIGH_SIDE_FACING,
      sizeMaxWMm: 70,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 70,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'pants_side',
      defaultReservePrice: 800000,
      phase: 2,
      category: SlotCategory.PANTS,
      grade: SlotGrade.A,
      nameKr: '하의 허벅지 옆라인(타격방향)',
      nameEn: 'Pants Thigh Side (Facing)',
      uiHeadline: '워킹샷 안정 가독',
      uiCopy: '전신샷·워킹샷에서 안정 노출. 평면이 넓어 로고 가독성 확보에 유리.',
      tags: ['전신', '워킹샷', '가독성', '우타좌타'],
      openRule: 'Phase 1 오픈 슬롯이 모두 SOLD 또는 RESERVED이면 개설 가능(자동/승인)',
      exclusivityGroup: 'PANTS_SIDE',
      tournamentReserved: false,
      recSizeMm: '70x40',
      material: '무광 열전사 + 재봉보강(마찰/주름 대비)',
      reserveMinKrw: 500000,
      reserveRecKrw: 800000,
      reserveReason: '전신샷에서 안정 노출',
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

  // Clean up legacy slot templates (SG-xx codes from old system)
  // Step 1: Find all legacy templates (codes not in the new v2 template list)
  const validCodes = slotTemplates.map(t => t.code);
  const legacyTemplates = await prisma.slotTemplate.findMany({
    where: {
      code: {
        notIn: validCodes,
      },
    },
    select: { id: true, code: true },
  });

  if (legacyTemplates.length > 0) {
    const legacyTemplateIds = legacyTemplates.map(t => t.id);
    console.log(`Found ${legacyTemplates.length} legacy templates to remove:`, legacyTemplates.map(t => t.code));

    // Find all slot instances connected to legacy templates
    const legacySlotInstances = await prisma.slotInstance.findMany({
      where: {
        templateId: {
          in: legacyTemplateIds,
        },
      },
      select: { id: true },
    });
    const legacySlotInstanceIds = legacySlotInstances.map(s => s.id);

    if (legacySlotInstanceIds.length > 0) {
      // Find all auctions connected to legacy slot instances
      const legacyAuctions = await prisma.auction.findMany({
        where: {
          slotInstanceId: {
            in: legacySlotInstanceIds,
          },
        },
        select: { id: true },
      });
      const legacyAuctionIds = legacyAuctions.map(a => a.id);

      if (legacyAuctionIds.length > 0) {
        // Delete bids first
        const deletedBids = await prisma.bid.deleteMany({
          where: {
            auctionId: {
              in: legacyAuctionIds,
            },
          },
        });
        if (deletedBids.count > 0) {
          console.log(`Deleted ${deletedBids.count} bids from legacy auctions`);
        }

        // Delete contracts connected to legacy auctions
        const deletedContracts = await prisma.contract.deleteMany({
          where: {
            auctionId: {
              in: legacyAuctionIds,
            },
          },
        });
        if (deletedContracts.count > 0) {
          console.log(`Deleted ${deletedContracts.count} contracts from legacy auctions`);
        }

        // Delete auctions
        const deletedAuctions = await prisma.auction.deleteMany({
          where: {
            id: {
              in: legacyAuctionIds,
            },
          },
        });
        console.log(`Deleted ${deletedAuctions.count} auctions from legacy slot instances`);
      }

      // Delete slot instances
      const deletedInstances = await prisma.slotInstance.deleteMany({
        where: {
          id: {
            in: legacySlotInstanceIds,
          },
        },
      });
      console.log(`Deleted ${deletedInstances.count} slot instances from legacy templates`);
    }

    // Delete the legacy templates themselves
    const deletedTemplates = await prisma.slotTemplate.deleteMany({
      where: {
        id: {
          in: legacyTemplateIds,
        },
      },
    });
    console.log(`Legacy slot templates removed: ${deletedTemplates.count}`);
  }

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

  // Create Sample Event with Tournament Rules (v2)
  const event = await prisma.event.upsert({
    where: { id: 'sample-event-1' },
    update: {
      tournamentRules: {
        chestReservedSide: 'LEFT',
        sleeveReservedSide: 'RIGHT',
        reservedSlotCodes: [],
        disabledSlotCodes: [],
        phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED',
        phase2UnlockMode: 'ADMIN_APPROVE',
        phase2EligibleMinDaysBefore: 2,
        creativeApprovalRequired: true,
        prohibitedCategories: ['tobacco', 'alcohol', 'adult', 'gambling'],
        maxSlotsPerBrandPerPlayer: 2,
      },
    },
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
      tournamentRules: {
        chestReservedSide: 'LEFT',
        sleeveReservedSide: 'RIGHT',
        reservedSlotCodes: [],
        disabledSlotCodes: [],
        phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED',
        phase2UnlockMode: 'ADMIN_APPROVE',
        phase2EligibleMinDaysBefore: 2,
        creativeApprovalRequired: true,
        prohibitedCategories: ['tobacco', 'alcohol', 'adult', 'gambling'],
        maxSlotsPerBrandPerPlayer: 2,
      },
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

  // 2. 슬롯 템플릿 가져오기 (CHEST_L: 가슴 좌측)
  const slotTemplate = await prisma.slotTemplate.findUnique({
    where: { code: 'CHEST_L' },
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

import { PrismaClient, BodyPart, MaterialRule, SlotGrade, SlotCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { SLOT_DISPLAY_COORDS } from './slot-display-coords';
import { seedDemoStores } from '../src/services/fanStoreDemo.service';
import { seedAboutPartners } from '../src/services/aboutDemo.service';

const prisma = new PrismaClient();

/**
 * 시드 계정 비밀번호: SEED_<ROLE>_PASSWORD 환경변수가 있으면 그 값을, 없으면 실행마다 무작위 값을 쓰고 콘솔에 출력한다.
 * (이미 존재하는 계정은 update: {} 이므로 비밀번호가 바뀌지 않는다 — 운영 배포 시드는 기존 계정에 영향 없음)
 */
const SEED_PASSWORDS: Record<string, string> = {};
function seedPassword(role: string): string {
  const fromEnv = process.env[`SEED_${role}_PASSWORD`];
  const pw = fromEnv && fromEnv.length >= 8 ? fromEnv : randomBytes(9).toString('base64url');
  SEED_PASSWORDS[role] = pw;
  return pw;
}

async function main() {
  console.log('Seeding database...');

  // Create Admin User
  const adminPassword = await bcrypt.hash(seedPassword('ADMIN'), 12);
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
  const brandPassword = await bcrypt.hash(seedPassword('BRAND'), 12);
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
  const athletePassword = await bcrypt.hash(seedPassword('ATHLETE'), 12);
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
  const agencyPassword = await bcrypt.hash(seedPassword('AGENCY'), 12);
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
  const fanPassword = await bcrypt.hash(seedPassword('FAN'), 12);
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
      sizeMaxWMm: 100,
      sizeMaxHMm: 42,
      perimeterMaxMm: 300,
      recommendedWMm: 90,
      recommendedHMm: 38,
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
      recSizeMm: '90x38',
      material: '무광 자수/우븐패치 또는 무광 열전사 + 재봉보강(반사필름 금지)',
      reserveMinKrw: 2000000,
      reserveRecKrw: 2500000,
      reserveReason: '클로즈업 빈도+상징성(메인 스폰서 위치)',
    },
    {
      code: 'CAP_BRIM_TOP',
      name: '모자챙 상단',
      bodyPart: BodyPart.CAP_BRIM_TOP,
      sizeMaxWMm: 70,
      sizeMaxHMm: 22,
      perimeterMaxMm: 200,
      recommendedWMm: 60,
      recommendedHMm: 18,
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
      recSizeMm: '60x18',
      material: '무광 우븐 라벨/자수(슬림)',
      reserveMinKrw: 700000,
      reserveRecKrw: 900000,
      reserveReason: '클로즈업 보조 프리미엄(소형 고가독)',
    },
    {
      code: 'CAP_SIDE_L',
      name: '모자 좌측면',
      bodyPart: BodyPart.CAP_SIDE_L,
      sizeMaxWMm: 75,
      sizeMaxHMm: 32,
      perimeterMaxMm: 230,
      recommendedWMm: 68,
      recommendedHMm: 28,
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
      recSizeMm: '68x28',
      material: '무광 자수/우븐패치',
      reserveMinKrw: 800000,
      reserveRecKrw: 1000000,
      reserveReason: '측면 컷 누적 노출',
    },
    {
      code: 'CAP_SIDE_R',
      name: '모자 우측면',
      bodyPart: BodyPart.CAP_SIDE_R,
      sizeMaxWMm: 75,
      sizeMaxHMm: 32,
      perimeterMaxMm: 230,
      recommendedWMm: 68,
      recommendedHMm: 28,
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
      recSizeMm: '68x28',
      material: '무광 자수/우븐패치',
      reserveMinKrw: 800000,
      reserveRecKrw: 1000000,
      reserveReason: '측면 컷 편차 보완',
    },
    {
      code: 'CAP_BACK',
      name: '모자 뒤(후면)',
      bodyPart: BodyPart.CAP_BACK,
      sizeMaxWMm: 70,
      sizeMaxHMm: 32,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 28,
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
      recSizeMm: '60x28',
      material: '무광 우븐 라벨/자수',
      reserveMinKrw: 250000,
      reserveRecKrw: 350000,
      reserveReason: '보조 노출(누적형)',
    },
    // Phase 1 - TOP (9 slots)
    {
      code: 'CHEST_L',
      name: '상의 좌측',
      bodyPart: BodyPart.CHEST_L,
      sizeMaxWMm: 110,
      sizeMaxHMm: 50,
      perimeterMaxMm: 350,
      recommendedWMm: 100,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '상의 좌측',
      nameEn: 'Chest Left',
      uiHeadline: '상체 고정 노출',
      uiCopy: '어드레스/스윙 미디움샷에서 가장 안정적. 가독성과 체류시간 우수.',
      tags: ['가독성', '안정노출', '미디움'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드/공식스폰 점유)',
      exclusivityGroup: 'CHEST',
      tournamentReserved: true,
      recSizeMm: '100x40',
      material: '무광 열전사 + 재봉보강(스트레치 원단 대응)',
      reserveMinKrw: 1500000,
      reserveRecKrw: 2000000,
      reserveReason: '상체 중심 프레임 고정 노출',
    },
    {
      code: 'CHEST_R',
      name: '상의 우측',
      bodyPart: BodyPart.CHEST_R,
      sizeMaxWMm: 110,
      sizeMaxHMm: 50,
      perimeterMaxMm: 350,
      recommendedWMm: 100,
      recommendedHMm: 40,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'chest',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '상의 우측',
      nameEn: 'Chest Right',
      uiHeadline: '중앙권 노출 확률↑',
      uiCopy: '상의 좌측과 동급. 카메라 편차에도 상체 중앙권에 걸릴 확률이 높음.',
      tags: ['가독성', '안정노출', '미디움'],
      openRule: '대회 설정에 따라 1개만 오픈될 수 있음(의류브랜드/공식스폰 점유)',
      exclusivityGroup: 'CHEST',
      tournamentReserved: true,
      recSizeMm: '100x40',
      material: '무광 열전사 + 재봉보강(스트레치 원단 대응)',
      reserveMinKrw: 1500000,
      reserveRecKrw: 2000000,
      reserveReason: '상체 중심 프레임 고정 노출',
    },
    {
      code: 'COLLAR_L',
      name: '카라 좌',
      bodyPart: BodyPart.COLLAR_L,
      sizeMaxWMm: 65,
      sizeMaxHMm: 25,
      perimeterMaxMm: 200,
      recommendedWMm: 55,
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
      recSizeMm: '55x20',
      material: '무광 우븐 라벨/열전사(슬림)',
      reserveMinKrw: 1200000,
      reserveRecKrw: 1600000,
      reserveReason: '클로즈업 집중/가독성 프리미엄',
    },
    {
      code: 'COLLAR_R',
      name: '카라 우',
      bodyPart: BodyPart.COLLAR_R,
      sizeMaxWMm: 65,
      sizeMaxHMm: 25,
      perimeterMaxMm: 200,
      recommendedWMm: 55,
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
      recSizeMm: '55x20',
      material: '무광 우븐 라벨/열전사(슬림)',
      reserveMinKrw: 1200000,
      reserveRecKrw: 1600000,
      reserveReason: '클로즈업 집중/가독성 프리미엄',
    },
    {
      code: 'SLEEVE_L',
      name: '소매 좌',
      bodyPart: BodyPart.SLEEVE_L,
      sizeMaxWMm: 100,
      sizeMaxHMm: 60,
      perimeterMaxMm: 340,
      recommendedWMm: 90,
      recommendedHMm: 50,
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
      recSizeMm: '90x50',
      material: '무광 열전사 + 재봉보강(마찰 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 800000,
      reserveReason: '동작 기반 반복 노출',
    },
    {
      code: 'SLEEVE_R',
      name: '소매 우',
      bodyPart: BodyPart.SLEEVE_R,
      sizeMaxWMm: 100,
      sizeMaxHMm: 60,
      perimeterMaxMm: 340,
      recommendedWMm: 90,
      recommendedHMm: 50,
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
      recSizeMm: '90x50',
      material: '무광 열전사 + 재봉보강(마찰 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 800000,
      reserveReason: '앵글 편차 보완',
    },
    {
      code: 'BACK_SHOULDER_L',
      name: '등 어깨 상단 좌',
      bodyPart: BodyPart.BACK_SHOULDER_L,
      sizeMaxWMm: 100,
      sizeMaxHMm: 50,
      perimeterMaxMm: 320,
      recommendedWMm: 85,
      recommendedHMm: 40,
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
      recSizeMm: '85x40',
      material: '무광 열전사 + 재봉보강',
      reserveMinKrw: 500000,
      reserveRecKrw: 700000,
      reserveReason: '후면 전신 누적 노출',
    },
    {
      code: 'BACK_SHOULDER_R',
      name: '등 어깨 상단 우',
      bodyPart: BodyPart.BACK_SHOULDER_R,
      sizeMaxWMm: 100,
      sizeMaxHMm: 50,
      perimeterMaxMm: 320,
      recommendedWMm: 85,
      recommendedHMm: 40,
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
      recSizeMm: '85x40',
      material: '무광 열전사 + 재봉보강',
      reserveMinKrw: 500000,
      reserveRecKrw: 700000,
      reserveReason: '후면 전신 누적 노출',
    },
    // v2.0 개정 — 어깨라인(쇄골) 좌/우 (A+)
    // ⚠️ 이 목록에서 빠지면 아래 '구버전 템플릿 정리'가 해당 슬롯 인스턴스를 삭제함
    //    (2026-07-28 운영 슬롯 48건 2회 소실 사고의 원인)
    {
      code: 'SHOULDER_LINE_L',
      name: '좌측 어깨라인',
      bodyPart: BodyPart.SHOULDER_LINE_L,
      sizeMaxWMm: 130,
      sizeMaxHMm: 35,
      perimeterMaxMm: 350,
      recommendedWMm: 120,
      recommendedHMm: 30,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side', 'back'],
      categoryExclusivityGroup: 'shoulder_line',
      defaultReservePrice: 900000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A_PLUS,
      nameKr: '좌측 어깨라인',
      nameEn: 'Shoulder Line Left',
      uiHeadline: '장형 워드마크 집중노출',
      uiCopy: '어깨 봉제선을 따라 길게 배치해 측면·백스윙 화면에서 브랜드명이 선명하게 노출.',
      tags: ['측면', '워드마크', '프리미엄'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'SHOULDER_LINE',
      tournamentReserved: false,
      recSizeMm: '120x30',
      material: '평자수/직조/인쇄',
      reserveMinKrw: 700000,
      reserveRecKrw: 900000,
      reserveReason: '측면·백스윙 장형 노출',
    },
    {
      code: 'SHOULDER_LINE_R',
      name: '우측 어깨라인',
      bodyPart: BodyPart.SHOULDER_LINE_R,
      sizeMaxWMm: 130,
      sizeMaxHMm: 35,
      perimeterMaxMm: 350,
      recommendedWMm: 120,
      recommendedHMm: 30,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side', 'back'],
      categoryExclusivityGroup: 'shoulder_line',
      defaultReservePrice: 900000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A_PLUS,
      nameKr: '우측 어깨라인',
      nameEn: 'Shoulder Line Right',
      uiHeadline: '장형 워드마크 집중노출',
      uiCopy: '어깨 봉제선을 따라 길게 배치해 측면·백스윙 화면에서 브랜드명이 선명하게 노출.',
      tags: ['측면', '워드마크', '프리미엄'],
      openRule: '기본 오픈(항상)',
      exclusivityGroup: 'SHOULDER_LINE',
      tournamentReserved: false,
      recSizeMm: '120x30',
      material: '평자수/직조/인쇄',
      reserveMinKrw: 700000,
      reserveRecKrw: 900000,
      reserveReason: '측면·백스윙 장형 노출',
    },
    // Phase 2 - PANTS (2 slots)
    {
      code: 'PANTS_HIP_SIDE_FACING',
      name: '하의 엉덩이 옆라인(타격방향)',
      bodyPart: BodyPart.PANTS_HIP_SIDE_FACING,
      sizeMaxWMm: 110,
      sizeMaxHMm: 65,
      perimeterMaxMm: 370,
      recommendedWMm: 95,
      recommendedHMm: 55,
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
      recSizeMm: '95x55',
      material: '무광 열전사 + 재봉보강(마찰/주름 대비)',
      reserveMinKrw: 600000,
      reserveRecKrw: 900000,
      reserveReason: '전신 피니시에서 주목도 높은 라인 노출',
    },
    {
      code: 'PANTS_THIGH_SIDE_FACING',
      name: '하의 허벅지 옆라인(타격방향)',
      bodyPart: BodyPart.PANTS_THIGH_SIDE_FACING,
      sizeMaxWMm: 115,
      sizeMaxHMm: 70,
      perimeterMaxMm: 390,
      recommendedWMm: 100,
      recommendedHMm: 60,
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
      recSizeMm: '100x60',
      material: '무광 열전사 + 재봉보강(마찰/주름 대비)',
      reserveMinKrw: 500000,
      reserveRecKrw: 800000,
      reserveReason: '전신샷에서 안정 노출',
    },
  ];

  for (const template of slotTemplates) {
    // 도식 좌표는 프론트 SlotDiagram 이미지 기준 측정값(slot-display-coords.ts)을 함께 반영한다.
    // 좌표가 없는 템플릿은 기존 값을 건드리지 않는다.
    const coord = SLOT_DISPLAY_COORDS[template.code];
    const withCoord = coord ? { ...template, displayX: coord[0], displayY: coord[1] } : template;
    await prisma.slotTemplate.upsert({
      where: { code: template.code },
      update: withCoord,
      create: withCoord,
    });
  }
  console.log('Slot templates created:', slotTemplates.length);

  // Clean up legacy slot templates (SG-xx codes from old system)
  // Wrapped in try-catch to prevent seed failure
  try {
    const validCodes = slotTemplates.map(t => t.code);
    const legacyTemplates = await prisma.slotTemplate.findMany({
      where: { code: { notIn: validCodes } },
      select: { id: true, code: true },
    });

    // ⚠️ 2026-07-28: 이 정리 로직이 운영 슬롯 인스턴스·경매·계약까지 삭제해
    //    9월 어깨라인 슬롯 48건을 두 차례 소실시켰음. 이제 '사용 중이 아닌' 템플릿만 삭제한다.
    //    사용 중(슬롯 인스턴스/선수 슬롯 설정 존재)이면 경고만 남기고 보존.
    for (const t of legacyTemplates) {
      const [instanceCount, athleteSlotCount] = await Promise.all([
        prisma.slotInstance.count({ where: { slotTemplateId: t.id } }),
        prisma.athleteSlot.count({ where: { slotTemplateId: t.id } }),
      ]);
      if (instanceCount > 0 || athleteSlotCount > 0) {
        console.warn(
          `⚠️  템플릿 ${t.code}는 seed 목록에 없지만 사용 중이라 보존합니다 ` +
          `(슬롯 ${instanceCount}건 / 선수슬롯 ${athleteSlotCount}건). seed.ts 목록에 추가하세요.`
        );
        continue;
      }
      await prisma.slotTemplate.delete({ where: { id: t.id } });
      console.log(`Legacy slot template removed: ${t.code}`);
    }
  } catch (error) {
    console.warn('Warning: Could not clean up legacy templates (non-fatal):', error);
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
  // 테스트용 캠페인 생성
  // ============================================

  // 브랜드 정보 가져오기
  const brand = await prisma.brand.findFirst({
    where: { user: { email: 'brand@example.com' } },
  });

  if (brand) {
    const campaign = await prisma.campaign.upsert({
      where: { id: 'sample-campaign-1' },
      update: {},
      create: {
        id: 'sample-campaign-1',
        brandId: brand.id,
        name: '2026 시즌 스폰서십 캠페인',
        description: 'GTOUR 선수 스폰서십 캠페인',
        budget: 50000000,
        status: 'ACTIVE',
        dateStart: new Date('2026-01-01'),
        dateEnd: new Date('2026-12-31'),
      },
    });
    console.log('Sample campaign created:', campaign.name);

    // 두 번째 캠페인
    const campaign2 = await prisma.campaign.upsert({
      where: { id: 'sample-campaign-2' },
      update: {},
      create: {
        id: 'sample-campaign-2',
        brandId: brand.id,
        name: 'Q1 프로모션 캠페인',
        description: '1분기 집중 노출 캠페인',
        budget: 20000000,
        status: 'DRAFT',
        dateStart: new Date('2026-01-01'),
        dateEnd: new Date('2026-03-31'),
      },
    });
    console.log('Sample campaign 2 created:', campaign2.name);
  }

  // ============================================
  // 데모용 LIVE 경매 생성
  // ============================================

  // 1. 선수 정보 가져오기
  const athlete = await prisma.athlete.findFirst({
    where: { user: { email: 'athlete@example.com' } },
  });

  // 2. 슬롯 템플릿 가져오기 (CHEST_L: 상의 좌측)
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
    console.log('  관리자: admin@screengolf.com /', SEED_PASSWORDS.ADMIN);
    console.log('  브랜드: brand@example.com /', SEED_PASSWORDS.BRAND);
    console.log('  선수: athlete@example.com /', SEED_PASSWORDS.ATHLETE);
    console.log('  팬: fan@example.com /', SEED_PASSWORDS.FAN);
    console.log('  (이미 있던 계정은 비밀번호가 바뀌지 않음. 고정하려면 SEED_<ROLE>_PASSWORD 환경변수)\n');

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

  // 일회성 데이터 보정 — 조건이 사라지면 자동으로 아무 것도 하지 않는다
  await mergeDuplicateAthleteAccounts();
  await fixAthleteTourInfo();
  await fixAthleteActivityFields();
  await backfillSlotInventory();

  console.log('Database seeding completed!');
}

/**
 * 선수 본인이 직접 가입해 생긴 중복 계정을 본인 계정으로 통합한다 (일회성 보정).
 *
 * 데이터(프로필·이력·슬롯·경매)가 붙어 있는 선수행의 소유 계정만 본인 계정으로 옮기고,
 * 비어 있는 선수행과 우리가 만든 placeholder 계정을 삭제한다.
 * 빈 선수행에 슬롯·입상·계약이 하나라도 있으면 건드리지 않고 경고만 남긴다.
 *
 * 통합이 끝나면 placeholder 계정이 없어져 다음 배포부터는 자동으로 건너뛴다.
 * 대상이 모두 정리되면 이 함수와 호출부를 지워도 된다.
 */
async function mergeDuplicateAthleteAccounts() {
  // [본인 실계정(유지), 우리가 만든 계정(삭제)]
  const TARGETS: [string, string][] = [
    ['duaehsdnd@naver.com', 'youmdonwoong@sponpik.com'], // 염돈웅 (2026-07-29 본인 가입)
    ['rndwltkgkd@naver.com', 'leejungwoo@sponpik.com'], // 이정우 (2026-08-11 본인 가입, 대전)
  ];

  for (const [realEmail, placeholderEmail] of TARGETS) {
    try {
      const [real, ph] = await Promise.all([
        prisma.user.findUnique({ where: { email: realEmail }, include: { athlete: true } }),
        prisma.user.findUnique({ where: { email: placeholderEmail }, include: { athlete: true } }),
      ]);
      if (!real || !ph?.athlete) continue; // 이미 통합됐거나 대상 없음 → 조용히 건너뜀

      const empty = real.athlete;
      if (empty) {
        const [slots, results, contracts] = await Promise.all([
          prisma.slotInstance.count({ where: { athleteId: empty.id } }),
          prisma.athleteEventResult.count({ where: { athleteId: empty.id } }),
          prisma.contract.count({ where: { athleteId: empty.id } }),
        ]);
        if (slots + results + contracts > 0) {
          console.warn(
            `⚠️  ${realEmail} 쪽 선수행에 데이터가 있어 자동 통합을 건너뜁니다 ` +
            `(슬롯 ${slots} / 입상 ${results} / 계약 ${contracts}). 수동 확인 필요.`
          );
          continue;
        }
        await prisma.athlete.delete({ where: { id: empty.id } });
      }

      await prisma.athlete.update({ where: { id: ph.athlete.id }, data: { userId: real.id } });
      await prisma.user.delete({ where: { id: ph.id } });
      console.log(`✅ 중복 계정 통합: ${placeholderEmail} → ${realEmail} (${ph.athlete.name})`);
    } catch (e) {
      console.warn(`Warning: ${realEmail} 계정 통합 실패 (non-fatal):`, e);
    }
  }
}

/**
 * 선수 소속협회·투어 정보 보정 (엑셀 제출본 기준)
 *
 * `tools/audit-athlete-profiles.cjs`로 '선수 프로필 엑셀/' 원본과 대조해 찾은 차이를 맞춘다.
 * tour는 목록 필터가 정확히 일치로 거르므로 대표 협회 하나만 두고,
 * 복수 소속·투어 상세는 tourQualification에 함께 적는다.
 *
 * 값이 이미 같으면 쓰지 않으므로 몇 번 배포해도 안전하다.
 */
async function fixAthleteTourInfo() {
  const FIXES: { name: string; tour?: string; qualification?: string; note: string }[] = [
    // 엑셀: 소속협회 KLPGA / 상세 'KLPGA 드림투어' — DB에 WGTOUR로 잘못 들어가 있었음
    { name: '홍지우', tour: 'KLPGA', qualification: 'KLPGA 정회원 1497 · 드림투어', note: '소속협회 정정' },
    // 엑셀: 소속협회 KAPGA / 상세 'KAPGA/2부투어' / 자격 'KLPGA/정회원'
    // → 정회원 자격이 KLPGA이므로 필터용 tour는 KLPGA로 두고 KAPGA를 상세에 남긴다
    { name: '김진아2', qualification: 'KLPGA 정회원 · KAPGA / 2부투어', note: 'KAPGA 누락 보완' },
    // 엑셀: 소속협회 'KPGA/GTOUR' — GTOUR 누락
    { name: '나승규', qualification: 'KPGA 투어프로 · GTOUR', note: 'GTOUR 누락 보완' },
    // 엑셀: 소속협회 'KLPGA / WGTOUR' / 상세 'KLPGA 드림투어 / WGTOUR' — WGTOUR 누락
    { name: '장연주', qualification: 'KLPGA 정회원 · 드림투어 · WGTOUR', note: 'WGTOUR 누락 보완' },
    // 엑셀: 소속협회 'KLPGA / WGTOUR' — WGTOUR 누락
    { name: '요코야마 미즈카', qualification: 'KLPGA 정회원 (01576) · WGTOUR', note: 'WGTOUR 누락 보완' },
  ];

  for (const f of FIXES) {
    try {
      const a = await prisma.athlete.findFirst({
        where: { name: f.name },
        select: { id: true, tour: true, tourQualification: true },
      });
      if (!a) continue;
      const data: any = {};
      if (f.tour && a.tour !== f.tour) data.tour = f.tour;
      if (f.qualification && a.tourQualification !== f.qualification) data.tourQualification = f.qualification;
      if (Object.keys(data).length === 0) continue; // 이미 반영됨
      await prisma.athlete.update({ where: { id: a.id }, data });
      console.log(`✅ ${f.name} 투어정보 보정 (${f.note})`);
    } catch (e) {
      console.warn(`Warning: ${f.name} 투어정보 보정 실패 (non-fatal):`, e);
    }
  }
}

/**
 * 활동분야·SNS 보정 (엑셀 제출본 기준)
 *
 * tools/audit-athlete-profiles.cjs 대조에서 나온 차이를 맞춘다.
 * activityFields는 부분 병합(기존 값 위에 지정한 키만 덮어씀)이라 다른 항목은 건드리지 않는다.
 * 값이 이미 같으면 쓰지 않으므로 재배포해도 안전하다.
 */
async function fixAthleteActivityFields() {
  const FIXES: { name: string; fields: Record<string, boolean>; qualification?: string; note: string }[] = [
    // 엑셀 C18='GTOUR' / D18='Y' — GTOUR 활동인데 DB에 반영 안 됨
    { name: '김다훈2', fields: { gtour: true }, note: 'GTOUR 활동 반영' },
    // 엑셀에서 GTOUR 칸을 'WGTOUR'로 고쳐 적고 Y. 그리고 SNS·유튜브 칸에 Y 대신
    // 계정명(인스타그램 / 수짱골프_김수아프로)을 적어 활동 플래그가 모두 꺼져 있었다.
    // 실제 인스타(suuuzzang 3000) · 유튜브(수짱골프_김수아프로 300)가 등록돼 있어 활동으로 본다.
    { name: '김수아2', fields: { sns: true, youtube: true },
      qualification: 'KLPGA 정회원 · WGTOUR', note: 'SNS·유튜브 활동 및 WGTOUR 반영' },
  ];

  for (const f of FIXES) {
    try {
      const a = await prisma.athlete.findFirst({
        where: { name: f.name },
        select: { id: true, activityFields: true, tourQualification: true },
      });
      if (!a) continue;
      const cur: any = (a.activityFields as any) || {};
      const next = { ...cur, ...f.fields };
      const data: any = {};
      if (JSON.stringify(cur) !== JSON.stringify(next)) data.activityFields = next;
      if (f.qualification && a.tourQualification !== f.qualification) data.tourQualification = f.qualification;
      if (Object.keys(data).length === 0) continue; // 이미 반영됨
      await prisma.athlete.update({ where: { id: a.id }, data });
      console.log(`✅ ${f.name} 활동분야 보정 (${f.note})`);
    } catch (e) {
      console.warn(`Warning: ${f.name} 활동분야 보정 실패 (non-fatal):`, e);
    }
  }
}

/**
 * 슬롯 인스턴스에 대응하는 인벤토리 보충
 *
 * 선수 상세의 구매 화면은 SlotInstance가 아니라 AthleteSlot + SlotInventory를 읽는다.
 * 관리자 화면·API로 슬롯 인스턴스만 새로 만들면 구매 화면에 나타나지 않으므로,
 * 짝이 없는 인스턴스에 대해 두 행을 만들어 준다. (prisma/backfill-phase1-inventory.ts와 같은 규칙)
 *
 * 이미 있으면 건너뛰므로 배포마다 돌아도 안전하다.
 */
async function backfillSlotInventory() {
  const STATUS_MAP: Record<string, string> = {
    OPEN: 'AVAILABLE', IN_AUCTION: 'AUCTION_ACTIVE', RESERVED: 'HELD', SOLD: 'SOLD',
  };
  try {
    const instances = await prisma.slotInstance.findMany({
      where: { isActive: true },
      include: {
        event: { select: { dateStart: true, dateEnd: true } },
        auction: { select: { id: true, status: true } },
        slotTemplate: { select: { id: true, grade: true, defaultReservePrice: true } },
      },
    });

    let slotCnt = 0, invCnt = 0;
    for (const si of instances) {
      if (!si.event) continue;
      // 1) 선수 슬롯 설정
      let as = await prisma.athleteSlot.findUnique({
        where: { athleteId_slotTemplateId: { athleteId: si.athleteId, slotTemplateId: si.slotTemplateId } },
        select: { id: true },
      });
      if (!as) {
        as = await prisma.athleteSlot.create({
          data: {
            athleteId: si.athleteId,
            slotTemplateId: si.slotTemplateId,
            basePrice: Number(si.directBuyPrice ?? si.reservePrice ?? si.slotTemplate.defaultReservePrice),
            baseGrade: si.slotTemplate.grade as any,
            saleEnabled: true,
            approvalRequired: false,
          },
          select: { id: true },
        });
        slotCnt++;
      }
      // 2) 기간별 재고
      const exists = await prisma.slotInventory.findFirst({ where: { slotInstanceId: si.id }, select: { id: true } });
      if (exists) continue;
      await prisma.slotInventory.create({
        data: {
          athleteSlotId: as.id,
          startDate: si.event.dateStart,
          endDate: si.event.dateEnd,
          status: (si.auction?.status === 'LIVE' ? 'AUCTION_ACTIVE' : STATUS_MAP[si.status] || 'AVAILABLE') as any,
          auctionId: si.auction?.id ?? null,
          slotInstanceId: si.id,
        },
      });
      invCnt++;
    }
    if (slotCnt || invCnt) console.log(`✅ 인벤토리 보충 — 선수슬롯 ${slotCnt}건 / 재고 ${invCnt}건`);
  } catch (e) {
    console.warn('Warning: 인벤토리 보충 실패 (non-fatal):', e);
  }

  /* 팬스토어 데모 카탈로그 (OREX · the GUYS · 호이베이커리) — slug 기준 멱등 */
  try {
    const r = await seedDemoStores();
    console.log('Fan store demo:', r.results.map((x) => `${x.slug}=${x.status}`).join(', '));
  } catch (e) {
    console.warn('Warning: 팬스토어 데모 시드 실패 (non-fatal):', e);
  }

  /* 소개 파트너 브랜드 · 실측 매칭사례 — slug 기준 멱등 */
  try {
    const r = await seedAboutPartners();
    console.log('About partners:', r.results.filter((x) => x.status !== 'UPDATED').map((x) => `${x.kind}:${x.slug}=${x.status}`).join(', ') || 'all up to date');
  } catch (e) {
    console.warn('Warning: 소개 파트너 시드 실패 (non-fatal):', e);
  }
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

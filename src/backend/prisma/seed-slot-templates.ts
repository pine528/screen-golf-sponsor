/**
 * 프로덕션용 슬롯 템플릿 시드
 * - 테스트 유저/데이터 없음
 * - 슬롯 템플릿 16개만 생성
 *
 * 실행: npx ts-node prisma/seed-slot-templates.ts
 * 또는: npx tsx prisma/seed-slot-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enums (Prisma에서 가져오기 어려울 경우 직접 정의)
const SlotCategory = {
  CAP: 'CAP',
  TOP: 'TOP',
  PANTS: 'PANTS',
} as const;

const SlotGrade = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
} as const;

const BodyPart = {
  CAP_FRONT: 'CAP_FRONT',
  CAP_BRIM_TOP: 'CAP_BRIM_TOP',
  CAP_SIDE_L: 'CAP_SIDE_L',
  CAP_SIDE_R: 'CAP_SIDE_R',
  CAP_BACK: 'CAP_BACK',
  CHEST_L: 'CHEST_L',
  CHEST_R: 'CHEST_R',
  COLLAR_L: 'COLLAR_L',
  COLLAR_R: 'COLLAR_R',
  SLEEVE_L: 'SLEEVE_L',
  SLEEVE_R: 'SLEEVE_R',
  BACK_SHOULDER_L: 'BACK_SHOULDER_L',
  BACK_SHOULDER_R: 'BACK_SHOULDER_R',
  PANTS_HIP_SIDE_FACING: 'PANTS_HIP_SIDE_FACING',
  PANTS_THIGH_SIDE_FACING: 'PANTS_THIGH_SIDE_FACING',
} as const;

const MaterialRule = {
  PRINTED_ONLY: 'PRINTED_ONLY',
  EMBROIDERY_OK: 'EMBROIDERY_OK',
} as const;

async function main() {
  console.log('🎯 프로덕션 슬롯 템플릿 시드 시작...\n');

  // 신버전 코드 목록
  const newCodes = [
    'CAP_FRONT', 'CAP_BRIM_TOP', 'CAP_SIDE_L', 'CAP_SIDE_R', 'CAP_BACK',
    'CHEST_L', 'CHEST_R', 'COLLAR_L', 'COLLAR_R', 'SLEEVE_L', 'SLEEVE_R',
    'BACK_SHOULDER_L', 'BACK_SHOULDER_R', 'PANTS_HIP', 'PANTS_THIGH',
  ];

  // 1. 구버전/중복 슬롯 템플릿 삭제 (신버전 코드가 아닌 것)
  console.log('🗑️  구버전 슬롯 템플릿 삭제 중...');
  const oldTemplates = await prisma.slotTemplate.findMany({
    where: {
      code: {
        notIn: newCodes,
      },
    },
  });

  if (oldTemplates.length > 0) {
    // 연결된 데이터 삭제 순서: Auction → SlotInstance → SlotTemplate
    for (const template of oldTemplates) {
      // 1. 연결된 SlotInstance 조회
      const instances = await prisma.slotInstance.findMany({
        where: { slotTemplateId: template.id },
        select: { id: true },
      });

      if (instances.length > 0) {
        const instanceIds = instances.map(i => i.id);

        // 2. 연결된 Auction 삭제 (Bid도 cascade 삭제됨)
        const auctionCount = await prisma.auction.count({
          where: { slotInstanceId: { in: instanceIds } },
        });
        if (auctionCount > 0) {
          // Bid 먼저 삭제
          await prisma.bid.deleteMany({
            where: { auction: { slotInstanceId: { in: instanceIds } } },
          });
          await prisma.auction.deleteMany({
            where: { slotInstanceId: { in: instanceIds } },
          });
          console.log(`  ⚠️  ${template.code}: ${auctionCount}개 경매 삭제`);
        }

        // 3. SlotInstance 삭제
        await prisma.slotInstance.deleteMany({
          where: { slotTemplateId: template.id },
        });
        console.log(`  ⚠️  ${template.code}: ${instances.length}개 슬롯 인스턴스 삭제`);
      }

      // 4. SlotTemplate 삭제
      await prisma.slotTemplate.delete({
        where: { id: template.id },
      });
      console.log(`  ✓ ${template.code} 삭제됨`);
    }
    console.log(`\n  총 ${oldTemplates.length}개 구버전 템플릿 삭제 완료\n`);
  } else {
    console.log('  구버전 템플릿 없음\n');
  }

  // 2. 신버전 슬롯 템플릿 생성
  const slotTemplates = [
    // ============================================
    // Phase 1 - CAP (5 slots)
    // ============================================
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
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.S,
      nameKr: '모자 정면',
      nameEn: 'Cap Front',
      uiHeadline: '얼굴 프레임 동시노출',
      uiCopy: "클로즈업에서 가장 자주 보이는 '메인 포지션'. 브랜드 리콜 최상.",
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
      uiCopy: '어드레스/타격 직전 샷에서 자주 걸리는 포인트.',
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
      uiCopy: '측면 프레이밍에서 반복 노출. 비용 효율 높음.',
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
      uiHeadline: '좌측과 대칭 노출',
      uiCopy: '좌측면과 함께 구매 시 측면 커버리지 극대화.',
    },
    {
      code: 'CAP_BACK',
      name: '모자 뒷면',
      bodyPart: BodyPart.CAP_BACK,
      sizeMaxWMm: 50,
      sizeMaxHMm: 25,
      perimeterMaxMm: 220,
      recommendedWMm: 50,
      recommendedHMm: 25,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'cap',
      defaultReservePrice: 350000,
      phase: 1,
      category: SlotCategory.CAP,
      grade: SlotGrade.B,
      nameKr: '모자 뒷면',
      nameEn: 'Cap Back',
      uiHeadline: '후방샷 보조 노출',
      uiCopy: '워킹/백샷에서 간헐적 노출. 보조 브랜딩용.',
    },

    // ============================================
    // Phase 1 - TOP (8 slots)
    // ============================================
    {
      code: 'CHEST_L',
      name: '가슴 좌측',
      bodyPart: BodyPart.CHEST_L,
      sizeMaxWMm: 80,
      sizeMaxHMm: 80,
      perimeterMaxMm: 350,
      recommendedWMm: 80,
      recommendedHMm: 80,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '가슴 좌측',
      nameEn: 'Chest Left',
      uiHeadline: '인터뷰 필수 노출',
      uiCopy: "정면 인터뷰·시상식에서 '메인 스폰서' 위치.",
    },
    {
      code: 'CHEST_R',
      name: '가슴 우측',
      bodyPart: BodyPart.CHEST_R,
      sizeMaxWMm: 80,
      sizeMaxHMm: 80,
      perimeterMaxMm: 350,
      recommendedWMm: 80,
      recommendedHMm: 80,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 2000000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '가슴 우측',
      nameEn: 'Chest Right',
      uiHeadline: '좌측과 대칭 프리미엄',
      uiCopy: '좌측과 함께 구매 시 가슴 전면 독점.',
    },
    {
      code: 'COLLAR_L',
      name: '칼라 좌측',
      bodyPart: BodyPart.COLLAR_L,
      sizeMaxWMm: 40,
      sizeMaxHMm: 25,
      perimeterMaxMm: 150,
      recommendedWMm: 40,
      recommendedHMm: 25,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 1600000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '칼라 좌측',
      nameEn: 'Collar Left',
      uiHeadline: '얼굴 인접 고급 위치',
      uiCopy: '클로즈업에서 얼굴과 함께 노출. 프리미엄 브랜드 선호.',
    },
    {
      code: 'COLLAR_R',
      name: '칼라 우측',
      bodyPart: BodyPart.COLLAR_R,
      sizeMaxWMm: 40,
      sizeMaxHMm: 25,
      perimeterMaxMm: 150,
      recommendedWMm: 40,
      recommendedHMm: 25,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['front'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 1600000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.S,
      nameKr: '칼라 우측',
      nameEn: 'Collar Right',
      uiHeadline: '좌측과 대칭',
      uiCopy: '좌측과 함께 구매 시 칼라 전체 커버.',
    },
    {
      code: 'SLEEVE_L',
      name: '소매 좌측',
      bodyPart: BodyPart.SLEEVE_L,
      sizeMaxWMm: 70,
      sizeMaxHMm: 50,
      perimeterMaxMm: 280,
      recommendedWMm: 70,
      recommendedHMm: 50,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 800000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '소매 좌측',
      nameEn: 'Sleeve Left',
      uiHeadline: '스윙 동작 노출',
      uiCopy: '스윙 시퀀스에서 팔 움직임과 함께 노출.',
    },
    {
      code: 'SLEEVE_R',
      name: '소매 우측',
      bodyPart: BodyPart.SLEEVE_R,
      sizeMaxWMm: 70,
      sizeMaxHMm: 50,
      perimeterMaxMm: 280,
      recommendedWMm: 70,
      recommendedHMm: 50,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 800000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '소매 우측',
      nameEn: 'Sleeve Right',
      uiHeadline: '좌측과 대칭',
      uiCopy: '양쪽 소매 구매 시 스윙 전체 커버.',
    },
    {
      code: 'BACK_SHOULDER_L',
      name: '등 어깨 좌측',
      bodyPart: BodyPart.BACK_SHOULDER_L,
      sizeMaxWMm: 60,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 40,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 700000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '등 어깨 좌측',
      nameEn: 'Back Shoulder Left',
      uiHeadline: '후방 카메라 노출',
      uiCopy: '워킹샷, 백샷에서 안정적 노출.',
    },
    {
      code: 'BACK_SHOULDER_R',
      name: '등 어깨 우측',
      bodyPart: BodyPart.BACK_SHOULDER_R,
      sizeMaxWMm: 60,
      sizeMaxHMm: 40,
      perimeterMaxMm: 220,
      recommendedWMm: 60,
      recommendedHMm: 40,
      materialRules: MaterialRule.EMBROIDERY_OK,
      requiredAngles: ['back'],
      categoryExclusivityGroup: 'top',
      defaultReservePrice: 700000,
      phase: 1,
      category: SlotCategory.TOP,
      grade: SlotGrade.A,
      nameKr: '등 어깨 우측',
      nameEn: 'Back Shoulder Right',
      uiHeadline: '좌측과 대칭',
      uiCopy: '양쪽 구매 시 등 상단 전체 커버.',
    },

    // ============================================
    // Phase 2 - PANTS (2 slots)
    // ============================================
    {
      code: 'PANTS_HIP',
      name: '바지 힙',
      bodyPart: BodyPart.PANTS_HIP_SIDE_FACING,
      sizeMaxWMm: 80,
      sizeMaxHMm: 50,
      perimeterMaxMm: 300,
      recommendedWMm: 80,
      recommendedHMm: 50,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'pants',
      defaultReservePrice: 900000,
      phase: 2,
      category: SlotCategory.PANTS,
      grade: SlotGrade.A,
      nameKr: '바지 힙',
      nameEn: 'Pants Hip',
      uiHeadline: '하체 측면 노출',
      uiCopy: '전신샷에서 안정적으로 노출되는 위치.',
    },
    {
      code: 'PANTS_THIGH',
      name: '바지 허벅지',
      bodyPart: BodyPart.PANTS_THIGH_SIDE_FACING,
      sizeMaxWMm: 80,
      sizeMaxHMm: 60,
      perimeterMaxMm: 320,
      recommendedWMm: 80,
      recommendedHMm: 60,
      materialRules: MaterialRule.PRINTED_ONLY,
      requiredAngles: ['side'],
      categoryExclusivityGroup: 'pants',
      defaultReservePrice: 800000,
      phase: 2,
      category: SlotCategory.PANTS,
      grade: SlotGrade.A,
      nameKr: '바지 허벅지',
      nameEn: 'Pants Thigh',
      uiHeadline: '하체 측면 보조',
      uiCopy: '전신샷에서 힙과 함께 노출.',
    },
  ];

  let created = 0;
  let updated = 0;

  for (const template of slotTemplates) {
    const result = await prisma.slotTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        sizeMaxWMm: template.sizeMaxWMm,
        sizeMaxHMm: template.sizeMaxHMm,
        perimeterMaxMm: template.perimeterMaxMm,
        recommendedWMm: template.recommendedWMm,
        recommendedHMm: template.recommendedHMm,
        forbiddenNotes: template.forbiddenNotes,
        materialRules: template.materialRules,
        requiredAngles: template.requiredAngles,
        categoryExclusivityGroup: template.categoryExclusivityGroup,
        defaultReservePrice: template.defaultReservePrice,
        phase: template.phase,
        category: template.category,
        grade: template.grade,
        nameKr: template.nameKr,
        nameEn: template.nameEn,
        uiHeadline: template.uiHeadline,
        uiCopy: template.uiCopy,
      },
      create: template as any,
    });

    // Check if it was created or updated (simple heuristic)
    const existing = await prisma.slotTemplate.findUnique({
      where: { code: template.code },
    });
    if (existing) {
      updated++;
    } else {
      created++;
    }

    console.log(`  ✓ ${template.code} (${template.nameKr})`);
  }

  console.log(`\n✅ 슬롯 템플릿 시드 완료!`);
  console.log(`   - Phase 1 CAP: 5개`);
  console.log(`   - Phase 1 TOP: 8개`);
  console.log(`   - Phase 2 PANTS: 2개`);
  console.log(`   - 총: ${slotTemplates.length}개\n`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

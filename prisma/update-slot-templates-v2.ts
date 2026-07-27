/**
 * 슬롯 패치 사이즈 명세서 v2.0 개정본 반영 — 템플릿 17개 upsert (삭제 없음)
 * 출처: SPONPIK_슬롯_패치_사이즈_명세서_v2.0_개정본.docx
 *  - 신규: SHOULDER_LINE_L/R (어깨라인·쇄골, A+ ₩900,000)
 *  - PANTS는 운영 DB 기존 코드(PANTS_HIP_SIDE_FACING 등) 유지, 스펙만 갱신 (Phase 2)
 *
 * 실행: DATABASE_URL=<url> npx ts-node prisma/update-slot-templates-v2.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type Spec = {
  code: string; name: string; bodyPart: string; category: 'CAP' | 'TOP' | 'PANTS';
  grade: 'S' | 'A_PLUS' | 'A' | 'B'; maxW: number; maxH: number; perimeter: number;
  recW: number; recH: number; material: string; materialRule: 'EMBROIDERY_OK' | 'PRINTED_ONLY';
  angles: string[]; price: number; note: string; headline: string; copy: string; phase?: number;
};

const SPECS: Spec[] = [
  // ── CAP (5) ──
  { code: 'CAP_FRONT', name: '모자 정면', bodyPart: 'CAP_FRONT', category: 'CAP', grade: 'S', maxW: 100, maxH: 42, perimeter: 300, recW: 90, recH: 38, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 2500000, note: '전면 유효폭 70~85% 활용 · 반사필름 금지', headline: '얼굴 프레임 동시노출', copy: "클로즈업에서 가장 자주 보이는 '메인 포지션'. 확대 규격으로 브랜드 리콜 최상." },
  { code: 'CAP_BRIM_TOP', name: '모자챙 상단', bodyPart: 'CAP_BRIM_TOP', category: 'CAP', grade: 'A', maxW: 70, maxH: 22, perimeter: 200, recW: 60, recH: 18, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 900000, note: '가로형 브랜드명 중심', headline: "시선이 '챙'으로 모인다", copy: '어드레스와 타격 직전 샷에서 가로형 브랜드명이 반복 노출.' },
  { code: 'CAP_SIDE_L', name: '모자 좌측면', bodyPart: 'CAP_SIDE_L', category: 'CAP', grade: 'A', maxW: 75, maxH: 32, perimeter: 230, recW: 68, recH: 28, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['side'], price: 1000000, note: '측면 곡면 실착 검수', headline: '리플레이·측면샷 누적', copy: '측면 프레이밍에서 반복 노출. 확대된 가로 폭으로 식별성 강화.' },
  { code: 'CAP_SIDE_R', name: '모자 우측면', bodyPart: 'CAP_SIDE_R', category: 'CAP', grade: 'A', maxW: 75, maxH: 32, perimeter: 230, recW: 68, recH: 28, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['side'], price: 1000000, note: '측면 곡면 실착 검수', headline: '리플레이·측면샷 누적', copy: '측면 프레이밍에서 반복 노출. 확대된 가로 폭으로 식별성 강화.' },
  { code: 'CAP_BACK', name: '모자 뒷면', bodyPart: 'CAP_BACK', category: 'CAP', grade: 'B', maxW: 70, maxH: 32, perimeter: 220, recW: 60, recH: 28, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['back'], price: 350000, note: '보조 브랜딩용', headline: '후방샷 보조 노출', copy: '워킹·백샷에서 간헐적으로 노출되는 보조 브랜딩 위치.' },
  // ── TOP (10) ──
  { code: 'CHEST_L', name: '가슴 좌측', bodyPart: 'CHEST_L', category: 'TOP', grade: 'S', maxW: 110, maxH: 50, perimeter: 350, recW: 100, recH: 40, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 2000000, note: '심벌형 권장 70×70 / 최대 80×80', headline: '인터뷰 필수 노출', copy: "정면 인터뷰·시상식에서 '메인 스폰서'로 인식되는 핵심 위치." },
  { code: 'CHEST_R', name: '가슴 우측', bodyPart: 'CHEST_R', category: 'TOP', grade: 'S', maxW: 110, maxH: 50, perimeter: 350, recW: 100, recH: 40, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 2000000, note: '심벌형 권장 70×70 / 최대 80×80', headline: '좌측과 대칭 프리미엄', copy: '좌측과 함께 구매하면 가슴 전면을 하나의 브랜드 영역으로 구성.' },
  { code: 'COLLAR_L', name: '칼라 좌측', bodyPart: 'COLLAR_L', category: 'TOP', grade: 'S', maxW: 65, maxH: 25, perimeter: 200, recW: 55, recH: 20, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 1600000, note: '심벌형 권장 28×28 / 최대 32×32', headline: '얼굴 인접 고급 위치', copy: '얼굴 클로즈업에서 함께 노출. 짧은 브랜드명·심벌형 로고에 적합.' },
  { code: 'COLLAR_R', name: '칼라 우측', bodyPart: 'COLLAR_R', category: 'TOP', grade: 'S', maxW: 65, maxH: 25, perimeter: 200, recW: 55, recH: 20, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['front'], price: 1600000, note: '심벌형 권장 28×28 / 최대 32×32', headline: '얼굴 인접 고급 위치', copy: '얼굴 클로즈업에서 함께 노출. 짧은 브랜드명·심벌형 로고에 적합.' },
  { code: 'SLEEVE_L', name: '소매 좌측', bodyPart: 'SLEEVE_L', category: 'TOP', grade: 'A', maxW: 100, maxH: 60, perimeter: 340, recW: 90, recH: 50, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['side'], price: 800000, note: '상완 평면부 중심 부착', headline: '스윙 동작 노출', copy: '스윙 시퀀스에서 팔 움직임과 함께 노출되는 활동형 슬롯.' },
  { code: 'SLEEVE_R', name: '소매 우측', bodyPart: 'SLEEVE_R', category: 'TOP', grade: 'A', maxW: 100, maxH: 60, perimeter: 340, recW: 90, recH: 50, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['side'], price: 800000, note: '상완 평면부 중심 부착', headline: '스윙 동작 노출', copy: '스윙 시퀀스에서 팔 움직임과 함께 노출되는 활동형 슬롯.' },
  { code: 'BACK_SHOULDER_L', name: '등 어깨 좌측', bodyPart: 'BACK_SHOULDER_L', category: 'TOP', grade: 'A', maxW: 100, maxH: 50, perimeter: 320, recW: 85, recH: 40, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['back'], price: 700000, note: '후면 사각형·심벌형 슬롯', headline: '후방 카메라 노출', copy: '워킹샷과 백샷에서 사각형·심벌형 로고가 안정적으로 노출.' },
  { code: 'BACK_SHOULDER_R', name: '등 어깨 우측', bodyPart: 'BACK_SHOULDER_R', category: 'TOP', grade: 'A', maxW: 100, maxH: 50, perimeter: 320, recW: 85, recH: 40, material: '자수 OK', materialRule: 'EMBROIDERY_OK', angles: ['back'], price: 700000, note: '후면 사각형·심벌형 슬롯', headline: '후방 카메라 노출', copy: '워킹샷과 백샷에서 사각형·심벌형 로고가 안정적으로 노출.' },
  { code: 'SHOULDER_LINE_L', name: '좌측 어깨라인', bodyPart: 'SHOULDER_LINE_L', category: 'TOP', grade: 'A_PLUS', maxW: 130, maxH: 35, perimeter: 350, recW: 120, recH: 30, material: '평자수/직조/인쇄', materialRule: 'EMBROIDERY_OK', angles: ['side', 'back'], price: 900000, note: '봉제선 따라 장형 배치 · 높이 35 이하 · 넥라인 8mm/소매 절개선 10mm 안전거리', headline: '장형 워드마크 집중노출', copy: '어깨 봉제선을 따라 길게 배치해 측면·백스윙 화면에서 브랜드명이 선명하게 노출.' },
  { code: 'SHOULDER_LINE_R', name: '우측 어깨라인', bodyPart: 'SHOULDER_LINE_R', category: 'TOP', grade: 'A_PLUS', maxW: 130, maxH: 35, perimeter: 350, recW: 120, recH: 30, material: '평자수/직조/인쇄', materialRule: 'EMBROIDERY_OK', angles: ['side', 'back'], price: 900000, note: '봉제선 따라 장형 배치 · 높이 35 이하 · 넥라인 8mm/소매 절개선 10mm 안전거리', headline: '장형 워드마크 집중노출', copy: '어깨 봉제선을 따라 길게 배치해 측면·백스윙 화면에서 브랜드명이 선명하게 노출.' },
  // ── PANTS (Phase 2, 기존 코드 유지) ──
  { code: 'PANTS_HIP_SIDE_FACING', name: '바지 힙 (측면)', bodyPart: 'PANTS_HIP_SIDE_FACING', category: 'PANTS', grade: 'A', maxW: 110, maxH: 65, perimeter: 370, recW: 95, recH: 55, material: '인쇄 중심', materialRule: 'PRINTED_ONLY', angles: ['side'], price: 900000, note: '실착 후 주름·포켓 간섭 확인', headline: '하체 측면 노출', copy: '전신샷에서 안정적으로 노출되며 상의 슬롯과 다른 시선 영역 확보.', phase: 2 },
  { code: 'PANTS_THIGH_SIDE_FACING', name: '바지 허벅지 (측면)', bodyPart: 'PANTS_THIGH_SIDE_FACING', category: 'PANTS', grade: 'A', maxW: 115, maxH: 70, perimeter: 390, recW: 100, recH: 60, material: '인쇄 중심', materialRule: 'PRINTED_ONLY', angles: ['side'], price: 800000, note: '동작 시 말림·주름 확인', headline: '하체 측면 보조', copy: '전신샷과 이동 장면에서 힙 슬롯과 함께 보조 노출.', phase: 2 },
];

async function main() {
  console.log('🎯 슬롯 템플릿 v2.0 upsert (', SPECS.length, '개 )');
  for (const s of SPECS) {
    const data: any = {
      name: s.name, nameKr: s.name,
      bodyPart: s.bodyPart as any,
      category: s.category as any,
      grade: s.grade as any,
      sizeMaxWMm: s.maxW, sizeMaxHMm: s.maxH, perimeterMaxMm: s.perimeter,
      recommendedWMm: s.recW, recommendedHMm: s.recH,
      recSizeMm: `${s.recW}x${s.recH}`,
      material: s.material,
      materialRules: s.materialRule as any,
      requiredAngles: s.angles,
      categoryExclusivityGroup: s.category.toLowerCase(),
      exclusivityGroup: s.category.toLowerCase(),
      defaultReservePrice: s.price,
      reserveMinKrw: s.price,
      forbiddenNotes: s.note,
      uiHeadline: s.headline,
      uiCopy: s.copy,
      phase: s.phase ?? 1,
      isActive: true,
    };
    await prisma.slotTemplate.upsert({
      where: { code: s.code },
      update: data,
      create: { code: s.code, ...data },
    });
    console.log(`  ✅ ${s.code} | ${s.name} | ${s.grade} | ₩${s.price.toLocaleString()}`);
  }
  const total = await prisma.slotTemplate.count({ where: { isActive: true } });
  console.log(`\n완료 — 활성 템플릿 ${total}개`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

/**
 * 5명 선수에게 슬롯 + 경매 + 입찰 시드
 * docx 3-1~3-4 검증용 풍부 데이터
 *
 * 실행: npx ts-node prisma/seed-slots.ts
 *      DATABASE_URL=<railway_url> npx ts-node prisma/seed-slots.ts
 */

import { PrismaClient, BodyPart, SlotCategory, SlotGrade } from '@prisma/client';

const prisma = new PrismaClient();

// 슬롯 템플릿 정의 (실제 BodyPart enum 값 사용)
const SLOT_TEMPLATES = [
  { code: 'CAP_F',     name: '모자 정면',   bodyPart: 'CAP_FRONT' as BodyPart,  category: 'CAP' as SlotCategory,   grade: 'S' as SlotGrade, sizeMaxWMm: 50, sizeMaxHMm: 30, basePrice: 5_000_000 },
  { code: 'CHEST_L',   name: '가슴 좌측',   bodyPart: 'CHEST_L' as BodyPart,    category: 'TOP' as SlotCategory,   grade: 'S' as SlotGrade, sizeMaxWMm: 80, sizeMaxHMm: 80, basePrice: 8_000_000 },
  { code: 'CHEST_R',   name: '가슴 우측',   bodyPart: 'CHEST_R' as BodyPart,    category: 'TOP' as SlotCategory,   grade: 'S' as SlotGrade, sizeMaxWMm: 80, sizeMaxHMm: 80, basePrice: 8_000_000 },
  { code: 'SLEEVE_L',  name: '소매 좌측',   bodyPart: 'SLEEVE_L' as BodyPart,   category: 'TOP' as SlotCategory,   grade: 'A' as SlotGrade, sizeMaxWMm: 60, sizeMaxHMm: 60, basePrice: 3_000_000 },
  { code: 'BELT',      name: '벨트',       bodyPart: 'CAP_BACK' as BodyPart,   category: 'PANTS' as SlotCategory, grade: 'B' as SlotGrade, sizeMaxWMm: 50, sizeMaxHMm: 30, basePrice: 2_000_000 },
];

// 5명 선수에게 부여할 슬롯 (각 선수별 3~5개)
const ATHLETE_SLOTS: Record<string, string[]> = {
  '안예인': ['CAP_F', 'CHEST_L', 'CHEST_R', 'SLEEVE_L', 'BELT'],
  '배진리': ['CAP_F', 'CHEST_L', 'SLEEVE_L'],
  '송유나': ['CAP_F', 'CHEST_R', 'BELT'],
  '오세희': ['CAP_F', 'CHEST_L', 'CHEST_R', 'BELT'],
  '이예빈': ['CAP_F', 'CHEST_L'],
};

// 가짜 입찰 브랜드명 (실제 브랜드 데이터 없으면 username만 표시)
const MOCK_BIDS = [
  { delta: 0,        timeAgoMin: 0 },
  { delta: 500_000,  timeAgoMin: 5 },
  { delta: 1_000_000, timeAgoMin: 30 },
  { delta: 2_000_000, timeAgoMin: 120 },
];

async function backfillEventIntegrity() {
  // docx 4 권장 데이터 미충족 (category=null && sportId=null && qualifyingDate=null) 이벤트 비활성
  const incompleteEvents = await prisma.event.updateMany({
    where: {
      isActive: true,
      AND: [
        { category: null },
        { sportId: null },
        { qualifyingDate: null },
      ],
    },
    data: { isActive: false },
  });
  if (incompleteEvents.count > 0) {
    console.log(`🧹 docx 4 권장 데이터 미충족 이벤트 ${incompleteEvents.count}개 자동 비활성`);
  }
}

async function backfillSlotIntegrity() {
  // docx 4 권장 데이터: 누락된 slot_name/slot_order 일괄 보강 (5명 시드 외 기존 슬롯도 정리)
  const orphans = await prisma.slotInstance.findMany({
    where: { OR: [{ slotName: null }, { slotOrder: null }] },
    include: { athlete: { select: { name: true } }, slotTemplate: { select: { name: true } } },
    take: 500,
  });
  if (orphans.length === 0) return;
  console.log(`🧹 slot_name/slot_order 누락 슬롯 ${orphans.length}개 보강 중...`);
  // athlete별 그룹화 후 순서 부여
  const grouped: Record<string, typeof orphans> = {};
  for (const s of orphans) {
    const k = s.athleteId;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(s);
  }
  for (const [aid, list] of Object.entries(grouped)) {
    let idx = 0;
    for (const s of list) {
      await prisma.slotInstance.update({
        where: { id: s.id },
        data: {
          slotName: s.slotName ?? `${s.athlete?.name ?? '선수'} · ${s.slotTemplate?.name ?? '슬롯'}`,
          slotOrder: s.slotOrder ?? (idx + 1) * 10,
        },
      });
      idx++;
    }
  }
  console.log(`✅ ${orphans.length}개 슬롯 정합성 보강 완료\n`);
}

async function main() {
  console.log('🌱 5명 선수 슬롯/경매/입찰 시드 시작...\n');

  // 0) 기존 데이터 정합성 보강 (event 미충족 + slot_name/slot_order)
  await backfillEventIntegrity();
  await backfillSlotIntegrity();

  // 1) SlotTemplate upsert
  for (const t of SLOT_TEMPLATES) {
    await prisma.slotTemplate.upsert({
      where: { code: t.code },
      update: {},
      create: {
        code: t.code,
        name: t.name,
        bodyPart: t.bodyPart,
        category: t.category,
        grade: t.grade,
        sizeMaxWMm: t.sizeMaxWMm,
        sizeMaxHMm: t.sizeMaxHMm,
        perimeterMaxMm: 2 * (t.sizeMaxWMm + t.sizeMaxHMm),
        phase: 1,
      },
    });
  }
  console.log(`✅ ${SLOT_TEMPLATES.length}개 슬롯 템플릿 준비\n`);

  // 2) 기본 Event 확보 (docx 4 권장 데이터: category/qualifying_date/display_order/sport)
  const now = new Date();
  // 골프 종목 ID 확보
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const eventStart = new Date(now.getTime() + 7 * 86400000);
  const eventEnd = new Date(now.getTime() + 10 * 86400000);
  const eventQualifying = new Date(now.getTime() + 5 * 86400000); // 본선 2일 전 예선

  let event = await prisma.event.findFirst({
    where: { name: { contains: 'GTOUR' } },
    orderBy: { dateStart: 'desc' },
  });
  if (!event) {
    event = await prisma.event.create({
      data: {
        tour: 'KLPGA',
        name: '2026 KLPGA 시즌 오픈전',
        dateStart: eventStart,
        dateEnd: eventEnd,
        status: 'UPCOMING',
        venue: '클럽D 사이판CC',
        multiplier: 1.0,
        // SPONPIK 4. 권장 데이터 항목
        category: '정규투어',
        qualifyingDate: eventQualifying,
        displayOrder: 10,
        isActive: true,
        activeDays: 14,
        sportId: golfSport?.id ?? null,
      },
    });
    console.log(`✅ 신규 Event 생성: ${event.name} [${event.category}]\n`);
  } else {
    // 기존 Event라도 docx 4 필드 누락 시 갱신
    if (!event.category || !event.qualifyingDate || !event.sportId) {
      event = await prisma.event.update({
        where: { id: event.id },
        data: {
          category: event.category ?? '정규투어',
          qualifyingDate: event.qualifyingDate ?? eventQualifying,
          displayOrder: event.displayOrder || 10,
          activeDays: event.activeDays ?? 14,
          sportId: event.sportId ?? golfSport?.id ?? null,
        },
      });
      console.log(`✅ 기존 Event 보강: ${event.name} [${event.category}]\n`);
    } else {
      console.log(`✅ 기존 Event 활용: ${event.name}\n`);
    }
  }

  // 다른 GTOUR 이벤트들도 docx 4 필드 일괄 보강 (운영 정합성)
  const otherEvents = await prisma.event.findMany({
    where: {
      name: { contains: 'GTOUR' },
      OR: [{ category: null }, { sportId: null }, { qualifyingDate: null }],
    },
  });
  for (const e of otherEvents) {
    await prisma.event.update({
      where: { id: e.id },
      data: {
        category: e.category ?? '정규투어',
        sportId: e.sportId ?? golfSport?.id ?? null,
        qualifyingDate: e.qualifyingDate ?? new Date(new Date(e.dateStart).getTime() - 2 * 86400000),
        displayOrder: e.displayOrder || 20,
        activeDays: e.activeDays ?? 14,
      },
    });
  }
  if (otherEvents.length > 0) console.log(`🧹 기존 ${otherEvents.length}개 GTOUR Event 정합성 보강\n`);

  // 3) 첫 brand (입찰 시뮬레이션용) 확보
  const brands = await prisma.brand.findMany({ take: 3 });
  if (brands.length === 0) {
    console.log('⚠️ 입찰용 브랜드가 없어 입찰은 시드하지 않습니다.');
  }

  // 4) 5명 선수에게 슬롯 + 경매 + 입찰 생성
  for (const [athleteName, slotCodes] of Object.entries(ATHLETE_SLOTS)) {
    const athlete = await prisma.athlete.findFirst({ where: { name: athleteName } });
    if (!athlete) {
      console.log(`⚠️ ${athleteName} 선수 없음, 스킵`);
      continue;
    }

    console.log(`\n📌 ${athleteName} 선수 (${athlete.id.slice(0, 8)})`);
    let slotIdx = 0;

    for (const code of slotCodes) {
      const tpl = await prisma.slotTemplate.findUnique({ where: { code } });
      if (!tpl) continue;

      // SlotInstance upsert (athleteId + slotTemplateId + eventId 조합)
      const existing = await prisma.slotInstance.findFirst({
        where: { athleteId: athlete.id, slotTemplateId: tpl.id, eventId: event.id },
      });

      // SPONPIK 4. 권장 데이터: slot_name (관리자 노출용 별칭) / slot_order (정렬 순서)
      const desiredSlotName = `${athleteName} · ${tpl.name}`;
      const desiredSlotOrder = (slotIdx + 1) * 10; // 10/20/30... (사이 추가 가능)

      let slot: any;
      if (existing) {
        // 기존 슬롯에 slot_name/slot_order 누락이면 보강
        if (existing.slotName == null || existing.slotOrder == null) {
          slot = await prisma.slotInstance.update({
            where: { id: existing.id },
            data: {
              slotName: existing.slotName ?? desiredSlotName,
              slotOrder: existing.slotOrder ?? desiredSlotOrder,
              isActive: existing.isActive ?? true,
            },
          });
        } else {
          slot = existing;
        }
      } else {
        slot = await prisma.slotInstance.create({
          data: {
            athleteId: athlete.id,
            slotTemplateId: tpl.id,
            eventId: event.id,
            status: 'IN_AUCTION',
            reservePrice: SLOT_TEMPLATES.find(s => s.code === code)?.basePrice || 1_000_000,
            enableAuction: true,
            enableDirectBuy: false,
            auctionEndAt: new Date(now.getTime() + 7 * 86400000),
            // SPONPIK 4. 권장 데이터 항목
            slotName: desiredSlotName,
            slotOrder: desiredSlotOrder,
            isActive: true,
          },
        });
      }

      // Auction upsert (slotInstance 1:1)
      let auction = await prisma.auction.findUnique({ where: { slotInstanceId: slot.id } });
      const startPrice = SLOT_TEMPLATES.find(s => s.code === code)?.basePrice || 1_000_000;
      const currentBidUp = slotIdx % 2 === 0 ? 2_000_000 : 5_000_000;
      const endAt = new Date(now.getTime() + (3 + slotIdx) * 86400000);  // 슬롯마다 다른 마감

      if (!auction) {
        auction = await prisma.auction.create({
          data: {
            slotInstanceId: slot.id,
            startAt: new Date(now.getTime() - 3600 * 1000),  // 1시간 전 시작
            endAt,
            originalEndAt: endAt,
            currentPrice: startPrice + currentBidUp,
            minBidIncrement: 500_000,
            status: 'LIVE',
          },
        });
      }

      // 입찰 시드 (브랜드가 있을 때만, 첫 슬롯에만 풍부하게)
      if (brands.length > 0 && slotIdx === 0) {
        for (let i = 0; i < Math.min(3, brands.length); i++) {
          const brand = brands[i];
          const amount = startPrice + (i + 1) * 1_000_000;
          // 멱등성: 같은 brand+auction이 이미 있으면 skip
          const existed = await prisma.bid.findFirst({ where: { auctionId: auction.id, brandId: brand.id } });
          if (existed) continue;
          await prisma.bid.create({
            data: {
              auctionId: auction.id,
              brandId: brand.id,
              maxBid: amount,
              currentProxy: amount,
              autoBid: false,
              isWinning: i === brands.length - 1,
              frozenAmount: 0,
              createdAt: new Date(now.getTime() - (3 - i) * 600 * 1000),
            },
          });
        }
        // 가장 높은 입찰가로 currentPrice 동기화
        const top = await prisma.bid.findFirst({ where: { auctionId: auction.id }, orderBy: { currentProxy: 'desc' } });
        if (top) {
          await prisma.auction.update({ where: { id: auction.id }, data: { currentPrice: top.currentProxy } });
        }
      }

      console.log(`  ✅ ${tpl.name} (${tpl.code}) — current ₩${(currentBidUp + startPrice).toLocaleString()}`);
      slotIdx++;
    }
  }

  console.log(`\n✨ 시드 완료!`);
  console.log(`👀 화면 확인: http://localhost:5173/athletes`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

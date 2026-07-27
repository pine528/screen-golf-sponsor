/**
 * 2026-09 대회 슬롯 오픈 (항목4)
 *  - 9월 GTOUR 대회 이벤트 생성 (없으면)
 *  - 엑셀 제출 선수의 sponsorSlots(Y 위치)대로 SlotInstance 생성
 *    · 모자 정면(CAP_FRONT): 경매 — Auction LIVE, 시작가 = 기준단가(₩2,500,000)
 *    · 나머지: 직접 판매 — enableDirectBuy + directBuyPrice = 명세 v2.0 기준단가
 *  - CAP_BACK(모자 뒷면)은 엑셀 양식에 없어 미생성
 *
 * 실행: DRY-RUN 기본 / 적용 APPLY=1
 *   APPLY=1 DATABASE_URL=<url> npx ts-node prisma/open-sep-event-slots.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EVENT = {
  name: '2026 신한투자증권 GTOUR 7차',
  tour: 'GTOUR',
  dateStart: new Date('2026-09-12T00:00:00+09:00'),
  dateEnd: new Date('2026-09-13T23:59:59+09:00'),
};
const AUCTION_END = new Date('2026-09-09T18:00:00+09:00'); // 대회 3일 전 18시 마감

// 엑셀 슬롯 라벨 → 템플릿 코드 매핑
const LABEL_TO_CODES: Record<string, string[]> = {
  '모자 정면': ['CAP_FRONT'],
  '모자 좌우': ['CAP_SIDE_L', 'CAP_SIDE_R'],
  '모자챙': ['CAP_BRIM_TOP'],
  '상의 좌우측': ['CHEST_L', 'CHEST_R'],
  '카라 좌우측': ['COLLAR_L', 'COLLAR_R'],
  '어깨 좌우측': ['SLEEVE_L', 'SLEEVE_R'],
  '어깨/쇄골 좌우측': ['SHOULDER_LINE_L', 'SHOULDER_LINE_R'],
  '등어깨 상단 좌우측': ['BACK_SHOULDER_L', 'BACK_SHOULDER_R'],
  '기타 슬롯': ['PANTS_HIP_SIDE_FACING', 'PANTS_THIGH_SIDE_FACING'], // Phase 2 (허리·하의)
};

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN (적용: APPLY=1) ###');

  // 1) 이벤트
  let event = await prisma.event.findFirst({ where: { name: EVENT.name } });
  if (!event) {
    console.log(`이벤트 생성: ${EVENT.name} (${EVENT.dateStart.toISOString().slice(0, 10)})`);
    if (apply) event = await prisma.event.create({ data: { ...EVENT, status: 'UPCOMING', category: '정규투어', isActive: true } });
  } else {
    console.log(`이벤트 존재: ${EVENT.name}`);
  }

  // 2) 템플릿 맵
  const tpls = await prisma.slotTemplate.findMany({ where: { isActive: true } });
  const tplByCode = new Map(tpls.map((t) => [t.code, t]));

  // 3) sponsorSlots 있는 선수
  const athletes = await prisma.athlete.findMany({
    where: { sponsorSlots: { not: null as any } },
    select: { id: true, name: true, sponsorSlots: true },
    orderBy: { name: 'asc' },
  });

  let created = 0, auctions = 0, skipped = 0;
  const summary: string[] = [];
  for (const a of athletes) {
    const slots = (a.sponsorSlots || {}) as Record<string, boolean>;
    const codes = new Set<string>();
    for (const [label, yes] of Object.entries(slots)) {
      if (!yes) continue;
      for (const c of LABEL_TO_CODES[label] || []) codes.add(c);
    }
    if (codes.size === 0) { summary.push(`  - ${a.name}: (Y 슬롯 없음 — 스킵)`); continue; }

    let cnt = 0, auc = 0;
    for (const code of codes) {
      const tpl = tplByCode.get(code);
      if (!tpl) { console.log(`⚠️ 템플릿 없음: ${code}`); continue; }
      const isAuction = code === 'CAP_FRONT';
      if (apply && event) {
        const exists = await prisma.slotInstance.findFirst({
          where: { eventId: event.id, athleteId: a.id, slotTemplateId: tpl.id },
        });
        if (exists) { skipped++; continue; }
        const inst = await prisma.slotInstance.create({
          data: {
            eventId: event.id,
            athleteId: a.id,
            slotTemplateId: tpl.id,
            reservePrice: tpl.defaultReservePrice,
            status: isAuction ? 'IN_AUCTION' : 'OPEN',
            enableAuction: isAuction,
            enableDirectBuy: !isAuction,
            directBuyPrice: !isAuction ? tpl.defaultReservePrice : null,
            auctionMinBid: isAuction ? tpl.defaultReservePrice : null,
            auctionEndAt: isAuction ? AUCTION_END : null,
            isActive: true,
          },
        });
        if (isAuction) {
          await prisma.auction.create({
            data: {
              slotInstanceId: inst.id,
              startAt: new Date(),
              endAt: AUCTION_END,
              originalEndAt: AUCTION_END,
              minBidIncrement: 100000,
              currentPrice: tpl.defaultReservePrice, // 시작가 ₩2,500,000
              status: 'LIVE',
            },
          });
          auc++; auctions++;
        }
      }
      cnt++; created += apply ? 1 : 0;
      if (!apply) created++;
    }
    summary.push(`  - ${a.name}: 슬롯 ${cnt}개${auc || codes.has('CAP_FRONT') ? ' (모자정면 경매)' : ''}`);
  }

  console.log(`\n선수 ${athletes.length}명:`);
  summary.forEach((s) => console.log(s));
  console.log(`\n합계 — 슬롯 ${created}개 생성${apply ? '' : ' 예정'} / 경매 ${apply ? auctions : '(dry)'}건 / 중복스킵 ${skipped}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

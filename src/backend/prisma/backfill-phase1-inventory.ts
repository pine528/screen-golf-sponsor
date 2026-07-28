/**
 * 개편 Phase 1 백필 — 기존 데이터 → 신규 인벤토리·상품 체계
 *  1) SlotTemplate 도식 좌표(display_x/y) 시드 (Phase 2 착장 도식용)
 *  2) AthleteSlot: 선수 sponsorSlots(엑셀 Y) → 선수별 슬롯 설정
 *  3) SlotInventory: 9월 SlotInstance 347건 → 기간별 재고 (상태 매핑 + 브릿지)
 *  4) SponsorshipProduct: 선수별 '단일 출전 후원 캠페인' (경매형/바로구매형) 백필
 *
 * 실행: APPLY=1 DATABASE_URL=<url> npx ts-node prisma/backfill-phase1-inventory.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 표준 착장 도식 좌표 (%)
const COORDS: Record<string, [number, number]> = {
  CAP_BRIM_TOP: [50, 3], CAP_FRONT: [50, 8], CAP_SIDE_L: [37, 9], CAP_SIDE_R: [63, 9], CAP_BACK: [50, 13],
  COLLAR_L: [44, 21], COLLAR_R: [56, 21],
  SHOULDER_LINE_L: [31, 24], SHOULDER_LINE_R: [69, 24],
  BACK_SHOULDER_L: [36, 27], BACK_SHOULDER_R: [64, 27],
  CHEST_L: [41, 33], CHEST_R: [59, 33],
  SLEEVE_L: [21, 36], SLEEVE_R: [79, 36],
  PANTS_HIP_SIDE_FACING: [62, 55], PANTS_THIGH_SIDE_FACING: [62, 66],
};

// 엑셀 슬롯 라벨 → 템플릿 코드 (open-sep-event-slots와 동일)
const LABEL_TO_CODES: Record<string, string[]> = {
  '모자 정면': ['CAP_FRONT'], '모자 좌우': ['CAP_SIDE_L', 'CAP_SIDE_R'], '모자챙': ['CAP_BRIM_TOP'],
  '상의 좌우측': ['CHEST_L', 'CHEST_R'], '카라 좌우측': ['COLLAR_L', 'COLLAR_R'],
  '어깨 좌우측': ['SLEEVE_L', 'SLEEVE_R'], '어깨/쇄골 좌우측': ['SHOULDER_LINE_L', 'SHOULDER_LINE_R'],
  '등어깨 상단 좌우측': ['BACK_SHOULDER_L', 'BACK_SHOULDER_R'],
  '기타 슬롯': ['PANTS_HIP_SIDE_FACING', 'PANTS_THIGH_SIDE_FACING'],
};

const STATUS_MAP: Record<string, string> = {
  OPEN: 'AVAILABLE', IN_AUCTION: 'AUCTION_ACTIVE', RESERVED: 'HELD', SOLD: 'SOLD', CLOSED: 'UNAVAILABLE',
};

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN (APPLY=1) ###');

  // 1) 도식 좌표
  const tpls = await prisma.slotTemplate.findMany();
  const tplByCode = new Map(tpls.map((t) => [t.code, t]));
  let coordCnt = 0;
  for (const [code, [x, y]] of Object.entries(COORDS)) {
    const t = tplByCode.get(code);
    if (!t) continue;
    if (apply) await prisma.slotTemplate.update({ where: { id: t.id }, data: { displayX: x, displayY: y } });
    coordCnt++;
  }
  console.log(`1) 도식 좌표: ${coordCnt}개`);

  // 2) AthleteSlot (sponsorSlots Y 기준)
  const athletes = await prisma.athlete.findMany({
    where: { sponsorSlots: { not: null as any } },
    select: { id: true, name: true, sponsorSlots: true },
  });
  let asCnt = 0;
  for (const a of athletes) {
    const slots = (a.sponsorSlots || {}) as Record<string, boolean>;
    const codes = new Set<string>();
    for (const [label, yes] of Object.entries(slots)) if (yes) for (const c of LABEL_TO_CODES[label] || []) codes.add(c);
    for (const code of codes) {
      const tpl = tplByCode.get(code);
      if (!tpl) continue;
      if (apply) {
        await prisma.athleteSlot.upsert({
          where: { athleteId_slotTemplateId: { athleteId: a.id, slotTemplateId: tpl.id } },
          update: {},
          create: {
            athleteId: a.id, slotTemplateId: tpl.id,
            basePrice: tpl.defaultReservePrice, baseGrade: tpl.grade as any,
            saleEnabled: true,
            approvalRequired: false,
          },
        });
      }
      asCnt++;
    }
  }
  console.log(`2) AthleteSlot: ${athletes.length}명 / ${asCnt}건`);

  // 3) SlotInventory ← 9월 SlotInstance
  const instances = await prisma.slotInstance.findMany({
    where: { isActive: true },
    include: { event: { select: { dateStart: true, dateEnd: true } }, auction: { select: { id: true, status: true } } },
  });
  let invCnt = 0, invSkip = 0;
  for (const si of instances) {
    const as = await prisma.athleteSlot.findUnique({
      where: { athleteId_slotTemplateId: { athleteId: si.athleteId, slotTemplateId: si.slotTemplateId } },
    });
    if (!as) { invSkip++; continue; }
    const exists = await prisma.slotInventory.findFirst({ where: { slotInstanceId: si.id } });
    if (exists) { invSkip++; continue; }
    const status = si.auction?.status === 'LIVE' ? 'AUCTION_ACTIVE' : (STATUS_MAP[si.status] || 'AVAILABLE');
    if (apply) {
      await prisma.slotInventory.create({
        data: {
          athleteSlotId: as.id,
          startDate: si.event.dateStart, endDate: si.event.dateEnd,
          status: status as any,
          auctionId: si.auction?.id ?? null,
          slotInstanceId: si.id,
        },
      });
    }
    invCnt++;
  }
  console.log(`3) SlotInventory: ${invCnt}건 생성, ${invSkip}건 스킵`);

  // 4) SponsorshipProduct — 선수별 단일 출전 캠페인 (§17.2 권장 상품명)
  let prodCnt = 0;
  for (const a of athletes) {
    const athleteSlots = await prisma.athleteSlot.findMany({ where: { athleteId: a.id }, include: { slotTemplate: true } });
    if (athleteSlots.length === 0) continue;
    const auctionSlots = athleteSlots.filter((s) => s.slotTemplate.code === 'CAP_FRONT');
    const buySlots = athleteSlots.filter((s) => s.slotTemplate.code !== 'CAP_FRONT');

    const mkProduct = async (name: string, tx: 'AUCTION' | 'BUY_NOW', slotList: typeof athleteSlots) => {
      if (slotList.length === 0) return;
      const exists = await prisma.sponsorshipProduct.findFirst({ where: { athleteId: a.id, productName: name }, include: { productSlots: true } });
      if (exists) {
        // 재실행 시: 새로 생긴 AthleteSlot을 기존 상품에 링크 보충
        if (apply) {
          const linked = new Set(exists.productSlots.map((ps) => ps.athleteSlotId));
          for (const s of slotList) {
            if (linked.has(s.id)) continue;
            await prisma.productSlot.create({
              data: { productId: exists.id, athleteSlotId: s.id, isPrimary: false, additionalPrice: s.basePrice },
            });
          }
        }
        return;
      }
      if (!apply) { prodCnt++; return; }
      const base = slotList[0].basePrice;
      const p = await prisma.sponsorshipProduct.create({
        data: {
          athleteId: a.id, productName: name,
          durationType: 'SINGLE_EVENT', productType: 'APPAREL', transactionType: tx,
          basePrice: base,
          buyNowPrice: tx === 'BUY_NOW' ? base : null,
          auctionStartPrice: tx === 'AUCTION' ? base : null,
          minBidIncrement: tx === 'AUCTION' ? 100000 : null,
          replacementPolicy: '차기 출전 이월 · 동일 등급 슬롯 변경 · SNS 콘텐츠 대체 · 부분/전액 환불',
          approvalStatus: 'APPROVED', publicationStatus: 'PUBLIC',
        },
      });
      for (let i = 0; i < slotList.length; i++) {
        await prisma.productSlot.create({
          data: { productId: p.id, athleteSlotId: slotList[i].id, isPrimary: i === 0, additionalPrice: i === 0 ? 0 : slotList[i].basePrice },
        });
      }
      prodCnt++;
    };
    await mkProduct('단일 출전 후원 캠페인 (경매)', 'AUCTION', auctionSlots);
    await mkProduct('단일 출전 후원 캠페인', 'BUY_NOW', buySlots);
  }
  console.log(`4) SponsorshipProduct: ${prodCnt}건`);

  if (apply) {
    const [as1, inv1, pr1] = await Promise.all([
      prisma.athleteSlot.count(), prisma.slotInventory.count(), prisma.sponsorshipProduct.count(),
    ]);
    console.log(`\n✅ 합계 — AthleteSlot ${as1} / SlotInventory ${inv1} / Product ${pr1}`);
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

/**
 * 명세서 v2.0에 없는 레거시 슬롯 템플릿 정리
 *
 *  - CAP_F  : CAP_FRONT와 중복인 옛 코드 → 사용 중인 데이터를 CAP_FRONT로 옮긴 뒤 삭제
 *  - BELT   : v2.0 슬롯 구성에 없는 위치 → 사용 중이면 판매 중지(isActive=false)만 하고 보존,
 *             사용 중이 아니면 삭제
 *
 * 유니크 제약(SlotInstance: event+athlete+template / AthleteSlot: athlete+template) 때문에
 * 옮기려는 자리에 이미 정상 레코드가 있으면 옮기지 않고 레거시 쪽을 버린다.
 * 단, 경매·입찰이 걸린 레코드는 절대 건드리지 않고 남긴다.
 *
 * 실행: npx ts-node --transpile-only prisma/cleanup-legacy-slot-templates.ts [--apply]
 *       (--apply 없이 실행하면 무엇을 바꿀지 출력만 하고 끝난다)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const log = (...a: any[]) => console.log(...a);

async function mergeCapF() {
  const from = await prisma.slotTemplate.findUnique({ where: { code: 'CAP_F' } });
  const to = await prisma.slotTemplate.findUnique({ where: { code: 'CAP_FRONT' } });
  if (!from) return log('· CAP_F 템플릿 없음 — 건너뜀');
  if (!to) return log('⚠️  CAP_FRONT 템플릿이 없어 CAP_F를 옮길 수 없습니다 — 중단');

  // 1) 슬롯 인스턴스
  const insts = await prisma.slotInstance.findMany({
    where: { slotTemplateId: from.id },
    select: { id: true, eventId: true, athleteId: true, auction: { select: { id: true, _count: { select: { bids: true } } } } },
  });
  let moved = 0, dropped = 0, kept = 0;
  for (const i of insts) {
    const bids = i.auction?._count.bids ?? 0;
    if (bids > 0) { kept++; log(`   · 인스턴스 ${i.id} 입찰 ${bids}건 — 보존`); continue; }
    const clash = await prisma.slotInstance.findFirst({
      where: { eventId: i.eventId, athleteId: i.athleteId, slotTemplateId: to.id },
      select: { id: true },
    });
    if (clash) {
      if (APPLY) {
        if (i.auction) await prisma.auction.delete({ where: { id: i.auction.id } });
        await prisma.slotInstance.delete({ where: { id: i.id } });
      }
      dropped++;
    } else {
      if (APPLY) await prisma.slotInstance.update({ where: { id: i.id }, data: { slotTemplateId: to.id } });
      moved++;
    }
  }
  log(`· CAP_F 슬롯 인스턴스: 이동 ${moved} / 중복 제거 ${dropped} / 보존 ${kept}`);

  // 2) 선수 슬롯
  const aSlots = await prisma.athleteSlot.findMany({ where: { slotTemplateId: from.id }, select: { id: true, athleteId: true } });
  let aMoved = 0, aDropped = 0;
  for (const a of aSlots) {
    const clash = await prisma.athleteSlot.findFirst({ where: { athleteId: a.athleteId, slotTemplateId: to.id }, select: { id: true } });
    if (clash) { if (APPLY) await prisma.athleteSlot.delete({ where: { id: a.id } }); aDropped++; }
    else { if (APPLY) await prisma.athleteSlot.update({ where: { id: a.id }, data: { slotTemplateId: to.id } }); aMoved++; }
  }
  log(`· CAP_F 선수슬롯: 이동 ${aMoved} / 중복 제거 ${aDropped}`);

  // 3) 남은 참조가 없으면 템플릿 삭제
  const [restI, restA] = await Promise.all([
    prisma.slotInstance.count({ where: { slotTemplateId: from.id } }),
    prisma.athleteSlot.count({ where: { slotTemplateId: from.id } }),
  ]);
  if (restI === 0 && restA === 0) {
    if (APPLY) await prisma.slotTemplate.delete({ where: { id: from.id } });
    log('· CAP_F 템플릿 삭제');
  } else {
    log(`⚠️  CAP_F에 아직 참조가 남아 삭제하지 않음 (인스턴스 ${restI} / 선수슬롯 ${restA})`);
  }
}

async function retireBelt() {
  const belt = await prisma.slotTemplate.findUnique({ where: { code: 'BELT' } });
  if (!belt) return log('· BELT 템플릿 없음 — 건너뜀');
  const [instCount, aCount] = await Promise.all([
    prisma.slotInstance.count({ where: { slotTemplateId: belt.id } }),
    prisma.athleteSlot.count({ where: { slotTemplateId: belt.id } }),
  ]);
  if (instCount === 0 && aCount === 0) {
    if (APPLY) await prisma.slotTemplate.delete({ where: { id: belt.id } });
    log('· BELT 템플릿 삭제 (사용 없음)');
  } else {
    if (APPLY) await prisma.slotTemplate.update({ where: { id: belt.id }, data: { isActive: false } });
    log(`· BELT는 사용 중이라 삭제하지 않고 판매 중지 처리 (인스턴스 ${instCount} / 선수슬롯 ${aCount})`);
  }
}

async function main() {
  log(APPLY ? '=== 정리 실행 ===' : '=== 미리보기 (실제 변경 없음) — 적용하려면 --apply ===');
  await mergeCapF();
  await retireBelt();
  const left = await prisma.slotTemplate.findMany({ select: { code: true, isActive: true }, orderBy: { code: 'asc' } });
  log(`\n남은 템플릿 ${left.length}개:`, left.map((t) => t.code + (t.isActive ? '' : '(중지)')).join(', '));
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

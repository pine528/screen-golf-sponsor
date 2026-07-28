/**
 * 2026-07-28 사고 정리 — 중복 9월 이벤트 제거
 *
 * 원인: Phase 0 대회명 중립화로 운영 이벤트명이 '2026년 9월 출전 경기 (단일 출전)'로
 *       변경된 상태에서 open-sep-event-slots.ts가 옛 명칭('2026 신한투자증권 GTOUR 7차')으로
 *       조회 → 미발견 → 이벤트+슬롯 347개+경매 21개를 통째로 중복 생성.
 *
 * 이 스크립트: 중복 이벤트(옛 GTOUR 명칭, 입찰·계약 0건인 것만)를 경매→인벤토리→슬롯→이벤트
 * 순으로 삭제. 입찰이나 계약이 하나라도 있으면 중단.
 *
 * 실행: DRY-RUN 기본 / 적용 APPLY=1
 *   APPLY=1 DATABASE_URL=<url> npx ts-node prisma/cleanup-duplicate-sep-event.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DUP_EVENT_NAME = '2026 신한투자증권 GTOUR 7차';

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN (적용: APPLY=1) ###');

  const event = await prisma.event.findFirst({ where: { name: DUP_EVENT_NAME } });
  if (!event) { console.log('중복 이벤트 없음 — 이미 정리됨'); return; }

  const bids = await prisma.bid.count({ where: { auction: { slotInstance: { eventId: event.id } } } });
  const contracts = await prisma.contract.count({ where: { auction: { slotInstance: { eventId: event.id } } } });
  const slotIds = (await prisma.slotInstance.findMany({ where: { eventId: event.id }, select: { id: true } })).map((s) => s.id);
  const auctionCnt = await prisma.auction.count({ where: { slotInstanceId: { in: slotIds } } });
  console.log(`대상: 이벤트 "${event.name}" / 슬롯 ${slotIds.length} / 경매 ${auctionCnt} / 입찰 ${bids} / 계약 ${contracts}`);
  if (bids > 0 || contracts > 0) { console.log('⛔ 입찰/계약 존재 — 삭제 중단 (수동 확인 필요)'); return; }
  if (!apply) return;

  const inv = await prisma.slotInventory.deleteMany({ where: { slotInstanceId: { in: slotIds } } });
  const auc = await prisma.auction.deleteMany({ where: { slotInstanceId: { in: slotIds } } });
  const slt = await prisma.slotInstance.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });
  console.log(`✅ 삭제 — 인벤토리 ${inv.count} / 경매 ${auc.count} / 슬롯 ${slt.count} / 이벤트 1`);
  console.log('남은 인스턴스:', await prisma.slotInstance.count(), '/ LIVE 경매:', await prisma.auction.count({ where: { status: 'LIVE' } }));
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

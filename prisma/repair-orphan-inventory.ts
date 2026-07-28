/**
 * 고아 SlotInventory 정리 — 존재하지 않는 slotInstance를 참조하는 재고 행 삭제
 *
 * 배경: slot_inventories.slot_instance_id에는 FK가 없어(기존 체계 브릿지용 느슨한 참조)
 *       슬롯 인스턴스가 삭제돼도 재고 행이 남는다. 계약/경매가 연결된 행은 보존한다.
 *
 * 실행: DRY-RUN 기본 / 적용 APPLY=1
 *   APPLY=1 DATABASE_URL=<url> npx ts-node prisma/repair-orphan-inventory.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN (적용: APPLY=1) ###');

  const orphans: Array<{ id: string; status: string; contract_id: string | null }> = await prisma.$queryRawUnsafe(`
    SELECT si.id, si.status::text AS status, si.contract_id
    FROM slot_inventories si
    WHERE si.slot_instance_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM slot_instances x WHERE x.id = si.slot_instance_id)
  `);
  const keep = orphans.filter((o) => o.contract_id || o.status === 'SOLD');
  const removable = orphans.filter((o) => !o.contract_id && o.status !== 'SOLD');
  console.log(`고아 인벤토리 ${orphans.length}건 — 삭제 대상 ${removable.length} / 계약·판매완료로 보존 ${keep.length}`);
  if (!apply || removable.length === 0) return;

  const res = await prisma.slotInventory.deleteMany({ where: { id: { in: removable.map((o) => o.id) } } });
  console.log(`✅ 삭제 ${res.count}건 / 남은 인벤토리 ${await prisma.slotInventory.count()}건`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

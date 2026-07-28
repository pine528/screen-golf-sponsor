import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function count() {
  const t = await p.slotTemplate.findMany({ where: { code: { startsWith: 'SHOULDER_LINE' } }, select: { id: true } });
  const inst = await p.slotInstance.count({ where: { slotTemplateId: { in: t.map(x => x.id) } } });
  const total = await p.slotInstance.count();
  const inv = await p.slotInventory.count();
  return `어깨슬롯 ${inst} / 전체슬롯 ${total} / 인벤토리 ${inv} / 템플릿 ${t.length}`;
}
async function main() {
  for (let i = 0; i < 14; i++) {
    console.log(new Date().toISOString().slice(11, 19), await count());
    await new Promise(r => setTimeout(r, 60000));
  }
}
main().finally(() => p.$disconnect());

/**
 * 슬롯 도식 좌표(displayX/Y) 갱신 — 프론트 SlotDiagram 실루엣과 맞춘다.
 * 실행: DATABASE_URL=<url> npx ts-node prisma/update-slot-display-coords.ts
 */
import { PrismaClient } from '@prisma/client';
import { SLOT_DISPLAY_COORDS } from './slot-display-coords';

const prisma = new PrismaClient();

async function main() {
  const tpls = await prisma.slotTemplate.findMany({ select: { id: true, code: true } });
  let updated = 0;
  const missing: string[] = [];
  for (const [code, [x, y]] of Object.entries(SLOT_DISPLAY_COORDS)) {
    const t = tpls.find((v) => v.code === code);
    if (!t) { missing.push(code); continue; }
    await prisma.slotTemplate.update({ where: { id: t.id }, data: { displayX: x, displayY: y } });
    updated++;
  }
  const noCoord = tpls.filter((t) => !SLOT_DISPLAY_COORDS[t.code]).map((t) => t.code);
  console.log(`✅ 좌표 갱신 ${updated}개`);
  if (missing.length) console.log(`⚠️ DB에 없는 템플릿 코드: ${missing.join(', ')}`);
  if (noCoord.length) console.log(`⚠️ 좌표 미정의 템플릿: ${noCoord.join(', ')}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

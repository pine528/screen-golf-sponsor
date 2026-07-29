/**
 * 슬롯 규격 대조 — `SPONPIK_슬롯_패치_사이즈_명세서_v2.0_개정본.docx` 기준
 * 실행: npx ts-node --transpile-only prisma/verify-slot-spec.ts
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

/** 명세서 표 값: 코드 → [최대W, 최대H, 둘레max, 권장W, 권장H, 시작가] (mm / 원) */
const SPEC: Record<string, [number, number, number, number, number, number]> = {
  CAP_FRONT:       [100, 42, 300,  90, 38, 2_500_000],
  CAP_BRIM_TOP:    [ 70, 22, 200,  60, 18,   900_000],
  CAP_SIDE_L:      [ 75, 32, 230,  68, 28, 1_000_000],
  CAP_SIDE_R:      [ 75, 32, 230,  68, 28, 1_000_000],
  CAP_BACK:        [ 70, 32, 220,  60, 28,   350_000],
  CHEST_L:         [110, 50, 350, 100, 40, 2_000_000],
  CHEST_R:         [110, 50, 350, 100, 40, 2_000_000],
  COLLAR_L:        [ 65, 25, 200,  55, 20, 1_600_000],
  COLLAR_R:        [ 65, 25, 200,  55, 20, 1_600_000],
  SLEEVE_L:        [100, 60, 340,  90, 50,   800_000],
  SLEEVE_R:        [100, 60, 340,  90, 50,   800_000],
  BACK_SHOULDER_L: [100, 50, 320,  85, 40,   700_000],
  BACK_SHOULDER_R: [100, 50, 320,  85, 40,   700_000],
  SHOULDER_LINE_L: [130, 35, 350, 120, 30,   900_000],
  SHOULDER_LINE_R: [130, 35, 350, 120, 30,   900_000],
  PANTS_HIP:       [110, 65, 370,  95, 55,   900_000],
  PANTS_THIGH:     [115, 70, 390, 100, 60,   800_000],
};

/** DB 코드 ↔ 명세서 코드 (하의는 명칭이 다름) */
const ALIAS: Record<string, string> = {
  PANTS_HIP_SIDE_FACING: 'PANTS_HIP',
  PANTS_THIGH_SIDE_FACING: 'PANTS_THIGH',
};

async function main() {
  const tpls = await p.slotTemplate.findMany({
    select: {
      code: true, name: true, sizeMaxWMm: true, sizeMaxHMm: true, perimeterMaxMm: true,
      recommendedWMm: true, recommendedHMm: true, defaultReservePrice: true,
    },
    orderBy: { code: 'asc' },
  });

  const seen = new Set<string>();
  let bad = 0;
  for (const t of tpls) {
    const key = ALIAS[t.code] || t.code;
    const spec = SPEC[key];
    if (!spec) { console.log(`❓ ${t.code.padEnd(24)} 명세서에 없는 템플릿 (${t.name})`); continue; }
    seen.add(key);
    const [mw, mh, per, rw, rh, price] = spec;
    const diffs: string[] = [];
    if (t.sizeMaxWMm !== mw || t.sizeMaxHMm !== mh) diffs.push(`최대 ${t.sizeMaxWMm}×${t.sizeMaxHMm} → ${mw}×${mh}`);
    if (t.perimeterMaxMm !== per) diffs.push(`둘레 ${t.perimeterMaxMm} → ${per}`);
    if (t.recommendedWMm !== rw || t.recommendedHMm !== rh) diffs.push(`권장 ${t.recommendedWMm}×${t.recommendedHMm} → ${rw}×${rh}`);
    if (t.defaultReservePrice !== price) diffs.push(`시작가 ${t.defaultReservePrice?.toLocaleString()} → ${price.toLocaleString()}`);
    if (diffs.length) { bad++; console.log(`❌ ${t.code.padEnd(24)} ${diffs.join(' / ')}`); }
    else console.log(`✅ ${t.code.padEnd(24)} 일치`);
  }
  const missing = Object.keys(SPEC).filter((k) => !seen.has(k));
  console.log(`\n불일치 ${bad}건 / 대조 ${tpls.length}건`);
  if (missing.length) console.log('DB에 없는 명세 코드:', missing.join(', '));
  if (bad > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => p.$disconnect());

/**
 * 2026-07 항목2 — 선수 수정/추천 지정 일괄 적용
 *  1) 개명: 이서윤→이서윤3, 김다훈→김다훈2, 김수아→김수아2 (KLPGA 동명이인 구분)
 *  2) 사진: 김시윤 kim-siyoon.jpg, 홍지우 hong-jiwoo.jpg
 *  3) 홍지우 KYC 승인 + 활성화 (공개 노출)
 *  4) 추천선수 지정: 배진리·김수아2·염돈웅·이성훈·장정우·장연주·이용희·강채린·홍지우 (recommendOrder 순)
 *
 * 실행: APPLY=1 DATABASE_URL=<url> npx ts-node prisma/apply-item2-changes.ts (APPLY 없으면 dry-run)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RENAMES: [string, string][] = [
  ['이서윤', '이서윤3'],
  ['김다훈', '김다훈2'],
  ['김수아', '김수아2'],
];
const PHOTOS: [string, string][] = [
  ['김시윤', '/golfers/kim-siyoon.jpg'],
  ['홍지우', '/golfers/hong-jiwoo.jpg'],
];
// 개명 후 이름 기준
const RECOMMENDED = ['배진리', '김수아2', '염돈웅', '이성훈', '장정우', '장연주', '이용희', '강채린', '홍지우'];

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN ###');

  const find = (n: string) => prisma.athlete.findFirst({ where: { name: n } });

  for (const [from, to] of RENAMES) {
    const a = await find(from);
    if (!a) { console.log(`⚠️ ${from} 없음 (이미 개명?)`); continue; }
    console.log(`개명: ${from} → ${to}`);
    if (apply) await prisma.athlete.update({ where: { id: a.id }, data: { name: to } });
  }

  for (const [n, url] of PHOTOS) {
    const a = await find(n);
    if (!a) { console.log(`⚠️ ${n} 없음`); continue; }
    console.log(`사진: ${n} → ${url}`);
    if (apply) await prisma.athlete.update({ where: { id: a.id }, data: { profileImageUrl: url } });
  }

  {
    const a = await find('홍지우');
    if (a) {
      console.log('홍지우 KYC 승인 + 활성화');
      if (apply) await prisma.athlete.update({ where: { id: a.id }, data: { kycStatus: 'APPROVED', isActive: true } });
    }
  }

  // 추천 초기화 후 재지정
  if (apply) await prisma.athlete.updateMany({ data: { isRecommended: false, recommendOrder: null } });
  for (let i = 0; i < RECOMMENDED.length; i++) {
    const a = await find(RECOMMENDED[i]);
    if (!a) { console.log(`⚠️ 추천대상 없음: ${RECOMMENDED[i]}`); continue; }
    console.log(`추천 #${i + 1}: ${RECOMMENDED[i]}`);
    if (apply) await prisma.athlete.update({ where: { id: a.id }, data: { isRecommended: true, recommendOrder: i + 1 } });
  }

  if (apply) {
    const rec = await prisma.athlete.count({ where: { isRecommended: true } });
    console.log(`\n✅ 완료 — 추천 선수 ${rec}명`);
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

/**
 * 선수 인스타그램 핸들 일괄 반영 (socialLinks.instagram)
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/update-instagram.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const UPDATES = [
  { name: '김하림', instagram: 'hari._.moo' },
  { name: '이하민', instagram: 'hamin_1.5' },
  { name: '요코야마 미즈카', instagram: 'mizukaaaa_eyo' },
  { name: '황지현', instagram: 'golfairy_jihyun' },
  { name: '최서영', instagram: 'seo_yong_00' },
  { name: '이정우', instagram: 'l.j.w_leo' },
  { name: '정윤경', instagram: 'yxxnk_0' },
  { name: '김은채', instagram: 'eun.__.0529' },
  { name: '문준혁', instagram: '183.7cm___' },
  { name: '안준혁', instagram: 'junm0_' },
  { name: '김진아2', instagram: 'z.5aa._04' },
  { name: '박은수', instagram: 'teana0106' },
  { name: '장정우', instagram: 'j.j.w.9.9' },
  { name: '금동호', instagram: 'pro.keum_1209' },
];

async function main() {
  for (const u of UPDATES) {
    const a = await prisma.athlete.findFirst({ where: { name: u.name }, select: { id: true, name: true, socialLinks: true } });
    if (!a) { console.log(`⚠️ ${u.name} 없음 — 스킵`); continue; }
    const social = { ...(a.socialLinks as any || {}), instagram: u.instagram };
    await prisma.athlete.update({ where: { id: a.id }, data: { socialLinks: social } });
    console.log(`✅ ${a.name} → instagram: ${u.instagram}`);
  }
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

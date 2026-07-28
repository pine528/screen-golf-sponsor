/**
 * 김다훈 프로 — 기존 자가가입 계정(dhk7422@naver.com)에 프로필+입상내역 통합
 * 출처: 사용자 제공 경력 + 김다훈.jpg
 * ※ 신규 계정 생성 X — 본인 가입 계정을 enrich (중복 방지 규칙)
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-dahoon.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEEP_EMAIL = 'dhk7422@naver.com';
const PROFILE = {
  tour: 'KPGA',
  bio: 'KPGA 투어프로 · 2016 KPGA 투어프로 자격 취득 · 2017 JTBC 파운더스 컵 우승 · 2017 코리안투어 활동 · 현재 GTOUR 활동중',
  profileImageUrl: '/golfers/kim-dahoon.jpg',
  debutYear: 2016,
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: 'GTOUR 활동', eventDate: '2026-01-01', tour: 'GTOUR', category: '시즌기록', rank: null, summary: '현재 GTOUR 활동중.' },
  { eventName: '2017 JTBC 파운더스 컵', eventDate: '2017-05-01', tour: 'KPGA', category: '정규투어', rank: 1, summary: 'JTBC 파운더스 컵 우승.' },
  { eventName: '2017 KPGA 코리안투어', eventDate: '2017-01-01', tour: 'KPGA', category: '시즌기록', rank: null, summary: '코리안투어 활동.' },
  { eventName: '2016 KPGA 투어프로 자격 취득', eventDate: '2016-03-01', tour: 'KPGA', category: '선발전', rank: null, summary: 'KPGA 투어프로 자격 취득.' },
  { eventName: '2014 코리아 윈터투어 우수 아마추어 선발', eventDate: '2014-12-01', tour: '아마추어', category: '아마추어', rank: null, summary: '우수 아마추어 선발.' },
];

async function main() {
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const user = await prisma.user.findUnique({ where: { email: KEEP_EMAIL }, include: { athlete: true } });
  if (!user?.athlete) { console.error(`❌ ${KEEP_EMAIL} 계정/선수 없음`); process.exit(1); }
  const athleteId = user.athlete.id;

  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      tour: PROFILE.tour, bio: PROFILE.bio, profileImageUrl: PROFILE.profileImageUrl,
      debutYear: PROFILE.debutYear, sportType: PROFILE.sportType,
      sportId: golfSport?.id ?? null, kycStatus: 'APPROVED', isActive: true,
    },
  });
  console.log(`♻️  김다훈 자가가입 계정 통합 (id=${athleteId.slice(0, 8)}, email=${KEEP_EMAIL})`);

  await prisma.athleteEventResult.deleteMany({ where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({ data: { athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, summary: r.summary, source: 'MANUAL' } });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

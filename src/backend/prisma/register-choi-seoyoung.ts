/**
 * 최서영 프로 — 기존 자가가입 계정(tjdud0213@naver.com)에 프로필+입상내역 통합
 * 출처: 최서영 프로필.pdf + 최서영.jpg
 * ※ 신규 계정 생성 X — 본인 가입 계정 enrich (중복 방지 규칙)
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-choi-seoyoung.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEEP_EMAIL = 'tjdud0213@naver.com';
const PROFILE = {
  tour: 'KLPGA',
  bio: 'KLPGA 정회원 · 홍익대 산업스포츠학과 · KYGA 볼빅배 국제대회 우승 · 2020 솔라고 점프투어 9차전 준우승 · 2021 호반 드림투어 3위',
  profileImageUrl: '/golfers/choi-seoyoung.jpg',
  sportType: 'GOLF',
};
// 입상내역 (KLPGA 최신 + KYGA 아마추어). KYGA/경인일보 연도 미상 → 추정(확인 필요).
const RESULTS = [
  { eventName: 'KLPGA 2021 호반 드림투어', eventDate: '2021-04-01', tour: 'KLPGA 드림투어', category: '드림투어', rank: 3, summary: '드림투어 3위.' },
  { eventName: 'KLPGA 2020 파워풀엑스 솔라고 점프투어 9차전', eventDate: '2020-09-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '점프투어 9차전 준우승.' },
  { eventName: 'KYGA 제10회 볼빅배 국제 골프대회', eventDate: '2018-07-01', tour: '아마추어', category: '주니어', rank: 1, summary: 'KYGA 국제대회 우승.' },
  { eventName: 'KD운송그룹배 제11회 경인일보 골프대회', eventDate: '2017-07-01', tour: '아마추어', category: '아마추어', rank: 3, summary: '3위.' },
  { eventName: 'KYGA 제8회 JAMA 골프배 전국 골프대회', eventDate: '2016-07-01', tour: '아마추어', category: '주니어', rank: 2, summary: 'KYGA 전국대회 준우승.' },
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
      sportType: PROFILE.sportType, sportId: golfSport?.id ?? null, kycStatus: 'APPROVED', isActive: true,
    },
  });
  console.log(`♻️  최서영 자가가입 계정 통합 (id=${athleteId.slice(0, 8)}, email=${KEEP_EMAIL})`);

  await prisma.athleteEventResult.deleteMany({ where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({ data: { athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, summary: r.summary, source: 'MANUAL' } });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

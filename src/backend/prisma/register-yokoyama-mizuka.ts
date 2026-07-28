/**
 * 요코야마 미즈카 프로 — 기존 자가가입 계정(hyj5299@naver.com)에 프로필+입상내역 통합
 * 출처: 이력서2026 1.pdf (요코야마 미즈카 이력서) + 요코야마 미즈카.jpg
 * ※ 신규 계정 생성 X (중복 방지 규칙)
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-yokoyama-mizuka.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEEP_EMAIL = 'hyj5299@naver.com';
const PROFILE = {
  name: '요코야마 미즈카',
  tour: 'KLPGA',
  bio: '1998년생 · KLPGA 정회원(프로번호 01576) · 전주예술고·원광대 경영학과 · 전북 익산 · SNS골프스튜디오 소속 프로 · 2026 WGTOUR 활동',
  profileImageUrl: '/golfers/yokoyama-mizuka.jpg',
  region: '전북 익산시',
  debutYear: 2022,
  affiliation: 'SNS골프스튜디오',
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '2026 WGTOUR 활동', eventDate: '2026-01-01', tour: 'WGTOUR', category: '시즌기록', rank: null, summary: '2026 WGTOUR 활동.' },
  { eventName: '2023~ KLPGA 드림투어 활동', eventDate: '2023-01-01', tour: 'KLPGA 드림투어', category: '시즌기록', rank: null, summary: 'KLPGA 드림투어 활동.' },
  { eventName: '2022 KLPGA 정회원 선발전 합격', eventDate: '2022-10-28', tour: 'KLPGA', category: '선발전', rank: 8, summary: '정회원 선발전 합격 (프로번호 01576), 8위.' },
  { eventName: '2022 모아저축은행ㆍ석정힐CC 점프투어', eventDate: '2022-09-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 8, summary: '점프투어 8위.' },
  { eventName: '2019 KLPGA 준회원 선발전 합격', eventDate: '2019-07-12', tour: 'KLPGA', category: '선발전', rank: 9, summary: '준회원 선발전 합격, 9위.' },
  { eventName: '2019 JLPGA 다이킨 오키드 레이디스 아마추어 골프선수권', eventDate: '2019-01-01', tour: '아마추어', category: '아마추어', rank: 10, summary: '일본 아마추어 선수권 10위.' },
  { eventName: '2018 오키나와 여자 골프 선수권', eventDate: '2018-10-01', tour: '아마추어', category: '아마추어', rank: 6, summary: '오키나와 여자 골프 선수권 6위.' },
];

async function main() {
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const user = await prisma.user.findUnique({ where: { email: KEEP_EMAIL }, include: { athlete: true } });
  if (!user?.athlete) { console.error(`❌ ${KEEP_EMAIL} 계정/선수 없음`); process.exit(1); }
  const athleteId = user.athlete.id;
  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      name: PROFILE.name, tour: PROFILE.tour, bio: PROFILE.bio, profileImageUrl: PROFILE.profileImageUrl,
      region: PROFILE.region, debutYear: PROFILE.debutYear, affiliation: PROFILE.affiliation,
      sportType: PROFILE.sportType, sportId: golfSport?.id ?? null, kycStatus: 'APPROVED', isActive: true,
    },
  });
  console.log(`♻️  요코야마 미즈카 통합 (id=${athleteId.slice(0, 8)}, email=${KEEP_EMAIL})`);
  await prisma.athleteEventResult.deleteMany({ where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({ data: { athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, summary: r.summary, source: 'MANUAL' } });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

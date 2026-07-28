/**
 * 김은채 (KIM EUN CHAE) 프로 등록 (KLPGA 정회원 · 2026 WGTOUR)
 * 출처: 김은채프로 지원서 pdf
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-eunchae.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'kimeunchae@sponpik.com',
  password: 'kimeunchae2026!',
  name: '김은채',
  tour: 'KLPGA',
  bio: '2001년생 · 2019 KLPGA 정회원(회원번호 01351) · 홍익대 산업스포츠학과 졸업 · 2026 WGTOUR 선수 · 광교 카카오프렌즈 소속 · 영어 가능',
  profileImageUrl: '/golfers/kim-eunchae.jpg',
  socialLinks: { instagram: 'eun.__.0529' } as Record<string, string>,
  primarySponsors: ['루베로(LUVERO)'] as string[],
  height: null as number | null,
  region: '경기도 수원시',
  debutYear: 2019,
  affiliation: '광교 카카오프렌즈',
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '2026 WGTOUR 활동', eventDate: '2026-01-01', tour: 'WGTOUR', category: '시즌기록', rank: null, summary: '2026 WGTOUR 선수 활동.' },
  { eventName: '2021 호반 드림투어 1차전', eventDate: '2021-04-01', tour: 'KLPGA 드림투어', category: '드림투어', rank: 3, summary: '드림투어 1차전 3위.' },
  { eventName: '2019 KLPGA 정회원 입회', eventDate: '2019-10-01', tour: 'KLPGA', category: '자격', rank: null, summary: 'KLPGA 정회원 입회(회원번호 01351).' },
  { eventName: '2019 솔라고 파워플렉스 점프투어 10차전', eventDate: '2019-09-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 3, summary: '점프투어 10차전 3위.' },
  { eventName: '2019 솔라고 파워플렉스 점프투어 9차전', eventDate: '2019-08-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 6, summary: '점프투어 9차전 6위.' },
  { eventName: '2019 KLPGA 준회원 선발전', eventDate: '2019-03-01', tour: 'KLPGA', category: '선발전', rank: 4, summary: '준회원 선발전 4위.' },
];

async function main() {
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const passwordHash = await bcrypt.hash(ATH.password, 12);
  const result = await prisma.user.upsert({
    where: { email: ATH.email },
    update: { athlete: { update: { name: ATH.name, tour: ATH.tour, bio: ATH.bio, profileImageUrl: ATH.profileImageUrl, socialLinks: ATH.socialLinks, primarySponsors: ATH.primarySponsors as any, height: ATH.height, region: ATH.region, debutYear: ATH.debutYear, affiliation: ATH.affiliation, sportType: ATH.sportType, sportId: golfSport?.id ?? null, isActive: true } } },
    create: { email: ATH.email, passwordHash, role: 'ATHLETE', athlete: { create: { name: ATH.name, tour: ATH.tour, bio: ATH.bio, profileImageUrl: ATH.profileImageUrl, socialLinks: ATH.socialLinks, primarySponsors: ATH.primarySponsors as any, kycStatus: 'APPROVED', height: ATH.height, region: ATH.region, debutYear: ATH.debutYear, affiliation: ATH.affiliation, sportType: ATH.sportType, sportId: golfSport?.id ?? null, isActive: true } } },
    include: { athlete: true },
  });
  const athleteId = result.athlete!.id;
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId}`);
  await prisma.athleteEventResult.deleteMany({ where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({ data: { athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, summary: r.summary, source: 'MANUAL' } });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

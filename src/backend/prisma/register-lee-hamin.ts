/**
 * 이하민 프로 등록 (KLPGA 준회원 · 점프투어/WGTOUR 활동)
 * 출처: 사용자 제공 경력 + 이하민.jpg
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-lee-hamin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'leehamin@sponpik.com',
  password: 'leehamin2026!',
  name: '이하민',
  tour: 'KLPGA',
  bio: 'KLPGA 준회원 · 현 점프투어·WGTOUR 활동중 · 2019 FUTURE CHAMPIONS 우승 · 2017 SCPGA Hansen Dam Spring Classic 3위 · 2023 KLPGA 솔라고 점프투어 12차전 8위',
  profileImageUrl: '/golfers/lee-hamin.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: null as number | null,
  affiliation: null as string | null,
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '점프투어·WGTOUR 활동', eventDate: '2026-01-01', tour: 'KLPGA', category: '시즌기록', rank: null, summary: '현재 점프투어·WGTOUR 활동중.' },
  { eventName: 'KLPGA 2023 솔라고 점프투어 12차전', eventDate: '2023-08-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 8, summary: '점프투어 12차전 8위.' },
  { eventName: '2019 FUTURE CHAMPIONS', eventDate: '2019-06-01', tour: '아마추어', category: '주니어', rank: 1, summary: 'Future Champions 우승.' },
  { eventName: '2017 SCPGA Hansen Dam Spring Classic', eventDate: '2017-04-01', tour: '아마추어', category: '아마추어', rank: 3, summary: 'SCPGA Hansen Dam Spring Classic 3위.' },
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

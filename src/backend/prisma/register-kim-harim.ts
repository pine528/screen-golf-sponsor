/**
 * 김하림 프로 등록 (KLPGA 정회원 · 중앙대 골프전공)
 * 출처: 사용자 제공 경력 + 김하림.jpg
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-harim.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'kimharim@sponpik.com',
  password: 'kimharim2026!',
  name: '김하림',
  tour: 'KLPGA',
  bio: 'KLPGA 정회원 · 중앙대학교 골프전공 재학 · 2025 KCGF 전국대학 선수권 개인전 우승 · 2020 파워풀엑스·모아저축은행 점프투어 준우승',
  profileImageUrl: '/golfers/kim-harim.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: null as number | null,
  affiliation: null as string | null,
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '2025 KCGF 전국대학 선수권대회 개인전', eventDate: '2025-05-01', tour: '아마추어', category: '대학', rank: 1, summary: '전국대학 선수권 개인전 우승.' },
  { eventName: '2022 엠씨스퀘어 드림투어 6차전', eventDate: '2022-06-01', tour: 'KLPGA 드림투어', category: '드림투어', rank: 5, summary: '드림투어 6차전 5위.' },
  { eventName: '2020 모아저축은행 점프투어 13차전', eventDate: '2020-09-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '점프투어 13차전 준우승.' },
  { eventName: '2020 파워풀엑스 점프투어 9차전', eventDate: '2020-07-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '점프투어 9차전 준우승.' },
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

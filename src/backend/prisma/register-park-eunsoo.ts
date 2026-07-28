/**
 * 박은수 (Taena Park) 프로 등록 (KLPGA 정회원 · CLPGA 차이나투어)
 * 출처: 뉴)박은수 프로필-1-1.pdf
 *
 * 실행:
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/register-park-eunsoo.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'parkeunsoo@sponpik.com',
  password: 'parkeunsoo2026!',
  name: '박은수',
  tour: 'KLPGA',
  bio: '168cm · 1989년생 · 2015년 KLPGA 정회원(회원번호 1092) · 비거리 평균 230m · 2016 WGTOUR 루키상 · CLPGA 차이나투어(2013~2018) · 호주 골프유학 5년 · 골프/운동 자격증 12개 보유, VVIP 필드레슨 전문',
  profileImageUrl: '/golfers/park-eunsoo.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: ['1879와인', '조아제약', '플렉스파워'] as string[],
  height: 168,
  region: '제주특별자치도',
  debutYear: 2015,
  affiliation: 'Artisan Golf',
  sportType: 'GOLF',
};

// 입상내역 (이미지 → 최신순)
const RESULTS = [
  { eventName: 'CLPGA 차이나투어 (2013~2018)', eventDate: '2018-06-01', tour: 'CLPGA', category: '투어활동', rank: null, summary: '2013~2018 CLPGA 차이나투어 프로 활동.' },
  { eventName: '2016 WGTOUR 루키상', eventDate: '2016-11-01', tour: 'WGTOUR', category: '수상', rank: null, summary: 'WGTOUR 루키상 수상.' },
  { eventName: '2015 KLPGA 정회원 입회', eventDate: '2015-10-01', tour: 'KLPGA', category: '자격', rank: null, summary: 'KLPGA 정회원 입회 (회원번호 1092).' },
  { eventName: '2015 킹스데일 점프투어 13차전', eventDate: '2015-08-15', tour: 'KLPGA', category: '점프투어', rank: 2, summary: '점프투어 13차전 준우승.' },
  { eventName: '2009 KLPGA 입회', eventDate: '2009-06-01', tour: 'KLPGA', category: '자격', rank: null, summary: 'KLPGA 입회.' },
  { eventName: '2007 PATTERSON RIVER CUP', eventDate: '2007-08-01', tour: '아마추어', category: '주니어', rank: 1, summary: '호주 PATTERSON RIVER CUP 우승.' },
  { eventName: '2007 HIDALEBURG CUP', eventDate: '2007-06-01', tour: '아마추어', category: '주니어', rank: 1, summary: '호주 HIDALEBURG CUP 우승.' },
  { eventName: '2007 호주 MGA 스쿨 주니어 대표', eventDate: '2007-03-01', tour: '아마추어', category: '국가대표', rank: null, summary: '호주 MGA 스쿨 주니어 대표.' },
];

async function main() {
  console.log('🌱 박은수 프로 등록 시작...\n');

  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const passwordHash = await bcrypt.hash(ATH.password, 12);

  const result = await prisma.user.upsert({
    where: { email: ATH.email },
    update: {
      athlete: {
        update: {
          name: ATH.name, tour: ATH.tour, bio: ATH.bio,
          profileImageUrl: ATH.profileImageUrl, socialLinks: ATH.socialLinks,
          primarySponsors: ATH.primarySponsors as any,
          height: ATH.height, region: ATH.region, debutYear: ATH.debutYear,
          affiliation: ATH.affiliation, sportType: ATH.sportType,
          sportId: golfSport?.id ?? null, isActive: true,
        },
      },
    },
    create: {
      email: ATH.email, passwordHash, role: 'ATHLETE',
      athlete: {
        create: {
          name: ATH.name, tour: ATH.tour, bio: ATH.bio,
          profileImageUrl: ATH.profileImageUrl, socialLinks: ATH.socialLinks,
          primarySponsors: ATH.primarySponsors as any, kycStatus: 'APPROVED',
          height: ATH.height, region: ATH.region, debutYear: ATH.debutYear,
          affiliation: ATH.affiliation, sportType: ATH.sportType,
          sportId: golfSport?.id ?? null, isActive: true,
        },
      },
    },
    include: { athlete: true },
  });

  const athleteId = result.athlete!.id;
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.height}cm · ${ATH.region} · ${ATH.debutYear}년`);

  await prisma.athleteEventResult.deleteMany({
    where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } },
  });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({
      data: {
        athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate),
        tour: r.tour, category: r.category, rank: r.rank, summary: r.summary, source: 'MANUAL',
      },
    });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건 등록 완료`);
  console.log(`\n✨ 완료. 👀 http://localhost:5173/athletes`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

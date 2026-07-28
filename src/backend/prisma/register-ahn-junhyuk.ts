/**
 * 안준혁 프로 등록 (2025 프로 입회 · 뉴질랜드 주니어 대표 출신)
 * 출처: 안준혁 프로필 이미지
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-ahn-junhyuk.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'ahnjunhyuk@sponpik.com',
  password: 'ahnjunhyuk2026!',
  name: '안준혁',
  tour: 'KPGA',
  bio: '1999년생 · 2025년 프로 입회 · 뉴질랜드 캔터베리/크라이스트처치 주니어 대표 출신 · Russley U18 2013·2014 우승 · Terrace Down U16 챔피언십 우승 · 서인이앤씨 후원',
  profileImageUrl: '/golfers/ahn-junhyuk.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: ['서인이앤씨'] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: 2025,
  affiliation: null as string | null,
  sportType: 'GOLF',
};

// 입상내역 (이미지 → 최신순). NZ 주니어 아마추어 경력.
const RESULTS = [
  { eventName: '2014 Christchurch International Championship', eventDate: '2014-12-01', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승 (2nd).' },
  { eventName: '2014 Russley U18', eventDate: '2014-09-01', tour: '아마추어', category: '주니어', rank: 1, summary: 'U18 우승.' },
  { eventName: '2014 Golf NZ Cup U18 Boys', eventDate: '2014-06-01', tour: '아마추어', category: '주니어', rank: 4, summary: 'U18 Boys 4위.' },
  { eventName: '2013 Harewood GC U18', eventDate: '2013-09-01', tour: '아마추어', category: '주니어', rank: 6, summary: 'U18 공동 6위(T6).' },
  { eventName: '2013 Russley U18', eventDate: '2013-08-01', tour: '아마추어', category: '주니어', rank: 1, summary: 'U18 우승.' },
  { eventName: '2012 North Island U19 Boys', eventDate: '2012-07-01', tour: '아마추어', category: '주니어', rank: 3, summary: 'U19 Boys 공동 3위(T3).' },
  { eventName: '2012 Terrace Down Championship U16', eventDate: '2012-05-01', tour: '아마추어', category: '주니어', rank: 1, summary: 'U16 챔피언십 우승.' },
  { eventName: '2011 Canterbury 대표 선발전', eventDate: '2011-06-01', tour: '아마추어', category: '국가대표', rank: 2, summary: '캔터베리 대표 선발전 공동 2위(T2).' },
  { eventName: 'Canterbury Junior 대표팀 (2010~2013)', eventDate: '2013-01-01', tour: '아마추어', category: '국가대표', rank: null, summary: '캔터베리 주니어 대표팀 / 크라이스트처치 대표(2012~2013).' },
];

async function main() {
  console.log('🌱 안준혁 프로 등록 시작...\n');

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
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.debutYear}년 프로 입회`);

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
  console.log(`\n✨ 완료. (사진 ahn-junhyuk.jpg 추후 추가 필요)`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

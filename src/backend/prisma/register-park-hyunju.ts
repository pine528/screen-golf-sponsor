/**
 * 박현주 프로 등록 (KLPGA 준회원 · GTOUR)
 * 출처: 박현주프로 프로필 이미지
 *
 * - User(ATHLETE) + Athlete 프로필 upsert (idempotent)
 * - AthleteEventResult(입상내역) 재시드
 *
 * 실행:
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/register-park-hyunju.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'parkhyunju@sponpik.com',
  password: 'parkhyunju2026!',
  name: '박현주',
  tour: 'KLPGA',
  bio: '1996년생 · KLPGA 준회원 · GTOUR 입회 2012 · 레슨 11년차 · 2017 GTOUR 상금랭킹 2위 · 2017 롯데렌터카 WGTOUR 4차·챔피언십 우승. 골프 크리에이터/레슨프로(유튜브 박푸로)',
  profileImageUrl: '/golfers/park-hyunju.jpg',
  socialLinks: { instagram: 'hyun._.juuuu', youtube: '박푸로', tiktok: 'hjttgolf' } as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: '경기도 파주시 운정신도시',
  debutYear: 2012,
  affiliation: '파주 청해골프',
  sportType: 'GOLF',
};

// 입상내역 (이미지 → 최신순)
const RESULTS = [
  { eventName: '2019 롯데렌터카 WGTOUR 3차', eventDate: '2019-05-25', tour: 'WGTOUR', category: '정규투어', rank: 4, summary: 'WGTOUR 3차 4위.' },
  { eventName: '2019 롯데렌터카 CHAMPIONSHIP', eventDate: '2019-11-16', tour: 'WGTOUR', category: '챔피언십', rank: 3, summary: 'WGTOUR 챔피언십 3위.' },
  { eventName: '2019 롯데렌터카 WGTOUR 3차 (봄)', eventDate: '2019-04-13', tour: 'WGTOUR', category: '정규투어', rank: 2, summary: 'WGTOUR 3차 준우승.' },
  { eventName: '2018 롯데렌터카 WGTOUR 8차', eventDate: '2018-09-15', tour: 'WGTOUR', category: '정규투어', rank: 3, summary: 'WGTOUR 8차 3위.' },
  { eventName: '2017 롯데렌터카 CHAMPIONSHIP', eventDate: '2017-11-18', tour: 'WGTOUR', category: '챔피언십', rank: 1, summary: 'WGTOUR 챔피언십 우승.' },
  { eventName: '2017 롯데렌터카 WGTOUR 4차', eventDate: '2017-06-10', tour: 'WGTOUR', category: '정규투어', rank: 1, summary: 'WGTOUR 4차 우승.' },
  { eventName: '2017 GTOUR 상금랭킹', eventDate: '2017-12-31', tour: 'GTOUR', category: '시즌랭킹', rank: 2, summary: '2017 시즌 GTOUR 상금랭킹 2위.' },
  { eventName: '2014 금호렌터카 GTOUR SUMMER 3차', eventDate: '2014-07-12', tour: 'GTOUR', category: '정규투어', rank: 3, summary: 'GTOUR SUMMER 3차 3위.' },
  { eventName: '2013 금호렌터카 GTOUR WINTER 1차', eventDate: '2013-12-07', tour: 'GTOUR', category: '정규투어', rank: 2, summary: 'GTOUR WINTER 1차 준우승.' },
  { eventName: '2013 금호렌터카 GTOUR SUMMER 4차', eventDate: '2013-08-17', tour: 'GTOUR', category: '정규투어', rank: 2, summary: 'GTOUR SUMMER 4차 준우승.' },
];

async function main() {
  console.log('🌱 박현주 프로 등록 시작...\n');

  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const passwordHash = await bcrypt.hash(ATH.password, 12);

  const result = await prisma.user.upsert({
    where: { email: ATH.email },
    update: {
      athlete: {
        update: {
          name: ATH.name,
          tour: ATH.tour,
          bio: ATH.bio,
          profileImageUrl: ATH.profileImageUrl,
          socialLinks: ATH.socialLinks,
          primarySponsors: ATH.primarySponsors as any,
          height: ATH.height,
          region: ATH.region,
          debutYear: ATH.debutYear,
          affiliation: ATH.affiliation,
          sportType: ATH.sportType,
          sportId: golfSport?.id ?? null,
          isActive: true,
        },
      },
    },
    create: {
      email: ATH.email,
      passwordHash,
      role: 'ATHLETE',
      athlete: {
        create: {
          name: ATH.name,
          tour: ATH.tour,
          bio: ATH.bio,
          profileImageUrl: ATH.profileImageUrl,
          socialLinks: ATH.socialLinks,
          primarySponsors: ATH.primarySponsors as any,
          kycStatus: 'APPROVED',
          height: ATH.height,
          region: ATH.region,
          debutYear: ATH.debutYear,
          affiliation: ATH.affiliation,
          sportType: ATH.sportType,
          sportId: golfSport?.id ?? null,
          isActive: true,
        },
      },
    },
    include: { athlete: true },
  });

  const athleteId = result.athlete!.id;
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.region} · ${ATH.debutYear}년 입회`);

  await prisma.athleteEventResult.deleteMany({
    where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } },
  });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({
      data: {
        athleteId,
        eventName: r.eventName,
        eventDate: new Date(r.eventDate),
        tour: r.tour,
        category: r.category,
        rank: r.rank,
        summary: r.summary,
        source: 'MANUAL',
      },
    });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건 등록 완료`);
  console.log(`\n✨ 완료. 👀 http://localhost:5173/athletes`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

/**
 * 장정우 프로 등록 (KPGA TOUR PRO)
 * PDF: TalkFile_장정우프로 프로필.pdf
 *
 * - User(ATHLETE) + Athlete 프로필 upsert (idempotent)
 * - AthleteEventResult(입상내역) 재시드
 *
 * 실행:
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/register-jang-jeongwoo.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'jangjeongwoo@sponpik.com',
  password: 'jangjeongwoo2026!',
  name: '장정우',
  tour: 'KPGA',
  bio: '182cm · 1999년생 · 2021년 KPGA 투어프로 수석합격 · 스릭슨투어(2021~2024) · 2026 신한투자증권 GTOUR 2차 우승',
  profileImageUrl: '/golfers/jang-jeongwoo.jpeg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: 182,
  region: '경기도 성남시',
  debutYear: 2021,
  affiliation: '분당그린피아골프연습장',
  sportType: 'GOLF',
};

// 입상내역 (PDF 순 → 최신순 정렬)
const RESULTS = [
  { eventName: '2026 GTOUR 상금 순위', eventDate: '2026-06-01', tour: 'GTOUR', category: '시즌랭킹', rank: 2, summary: '2026 시즌 GTOUR 상금 순위 2위.' },
  { eventName: '2026 GTOUR 대상포인트', eventDate: '2026-06-01', tour: 'GTOUR', category: '시즌랭킹', rank: 2, summary: '2026 시즌 GTOUR 대상포인트 2위.' },
  { eventName: '2026 GTOUR 시즌 TOP10', eventDate: '2026-06-01', tour: 'GTOUR', category: '시즌기록', rank: null, summary: '2026 시즌 TOP10 진입 5회.' },
  { eventName: '2026 신한투자증권 GTOUR 2차', eventDate: '2026-03-15', tour: 'GTOUR', category: '정규투어', rank: 1, summary: 'GTOUR 2차 대회 우승.' },
  { eventName: '2025 샤브올데이 GTOUR MIXED 2차', eventDate: '2025-09-20', tour: 'GTOUR', category: '믹스드', rank: 2, summary: 'GTOUR MIXED 2차 준우승.' },
  { eventName: '2021 KPGA 투어프로 선발전', eventDate: '2021-06-01', tour: 'KPGA', category: '선발전', rank: 1, summary: 'KPGA 투어프로 수석합격.' },
  { eventName: '2014 한국중고골프연맹 전국대회 스포츠조선배', eventDate: '2014-09-10', tour: '아마추어', category: '주니어', rank: 1, summary: '전국대회 우승.' },
  { eventName: '2014 청주MBC 전국 주니어 골프대회', eventDate: '2014-07-12', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
  { eventName: '2014 충북주니어 선수권대회', eventDate: '2014-05-18', tour: '아마추어', category: '주니어', rank: 1, summary: '우승.' },
  { eventName: '2014 충청북도 지사배', eventDate: '2014-06-08', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
  { eventName: '2014 한국중고골프연맹 전국대회 그린배', eventDate: '2014-04-20', tour: '아마추어', category: '주니어', rank: 3, summary: '3위.' },
];

async function main() {
  console.log('🌱 장정우 프로 등록 시작...\n');

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
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.height}cm · ${ATH.region} · ${ATH.debutYear}년`);

  // 입상내역 재시드 (중복 방지)
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

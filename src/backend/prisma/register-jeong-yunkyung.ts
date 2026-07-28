/**
 * 정윤경 프로 등록 (KLPGA 정회원 · Dream Tour Player · 2025 루키)
 * 출처: 정윤경 후원 제안용 선수 프로필
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-jeong-yunkyung.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'jeongyunkyung@sponpik.com',
  password: 'jeongyunkyung2026!',
  name: '정윤경',
  tour: 'KLPGA',
  bio: '2006년생 · 162cm · 2025.09 KLPGA 정회원(회원번호 01745) · 2025 KLPGA 점프투어 15차전 우승 · 현재 KLPGA 드림투어 활동 · 안정적인 드라이버 샷과 침착한 경기 운영',
  profileImageUrl: '/golfers/jeong-yunkyung.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: 162,
  region: null as string | null,
  debutYear: 2025,
  affiliation: null as string | null,
  sportType: 'GOLF',
};

// 핵심 이력 + 주요 성적 (최신순)
const RESULTS = [
  { eventName: '2025 KLPGA 그랜드·삼대인 홍삼볼 점프투어 15차전', eventDate: '2025-09-16', tour: 'KLPGA 점프투어', category: '점프투어', rank: 1, summary: '점프투어 15차전 우승.' },
  { eventName: '2024 경기도체육회장배 골프대회', eventDate: '2024-08-27', tour: '아마추어', category: '아마추어', rank: 5, summary: '5위.' },
  { eventName: 'GA KOREA 제21회 경인일보배', eventDate: '2024-07-22', tour: '아마추어', category: '아마추어', rank: 5, summary: '5위.' },
  { eventName: '발롱블랑 전국 청소년골프대회', eventDate: '2024-03-07', tour: '아마추어', category: '주니어', rank: 3, summary: '3위.' },
  { eventName: 'GA KOREA 제20회 경인일보배', eventDate: '2023-07-17', tour: '아마추어', category: '아마추어', rank: 4, summary: '4위.' },
  { eventName: '제5회 오토파워배 KYGA 전국청소년대회', eventDate: '2023-07-07', tour: '아마추어', category: '주니어', rank: 3, summary: '전국청소년대회 3위.' },
  { eventName: '경기도지사배 골프대회', eventDate: '2023-05-24', tour: '아마추어', category: '아마추어', rank: 1, summary: '우승.' },
];

async function main() {
  console.log('🌱 정윤경 프로 등록 시작...\n');

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
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.height}cm · ${ATH.debutYear}년 입회`);

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
  console.log(`\n✨ 완료.`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

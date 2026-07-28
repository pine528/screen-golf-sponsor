/**
 * 강채린 프로 등록 (KLPGA 정회원 · WGTOUR 2026 루키)
 * 출처: 강채린 프로필.pdf
 *
 * - User(ATHLETE) + Athlete 프로필 upsert (idempotent)
 * - AthleteEventResult(수상 이력) 재시드
 *
 * 실행:
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/register-kang-chaerin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'kangchaerin@sponpik.com',
  password: 'kangchaerin2026!',
  name: '강채린',
  tour: 'KLPGA',
  bio: '2001년생 · 2022년 KLPGA 정회원(회원번호 1530) · WGTOUR 2026 루키 · 중앙대학교 골프전공 수석 졸업 · 미즈노/브리지스톤 계약, 탱크샤프트 후원',
  profileImageUrl: '/golfers/kang-chaerin.png',
  socialLinks: {} as Record<string, string>,
  primarySponsors: ['미즈노', '브리지스톤', '탱크샤프트'] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: 2022,
  affiliation: null as string | null,
  sportType: 'GOLF',
};

// 수상 이력 (이미지 → 최신순)
const RESULTS = [
  { eventName: '2026 WGTOUR 롯데렌터카 4차', eventDate: '2026-05-20', tour: 'WGTOUR', category: '정규투어', rank: 29, summary: 'WGTOUR 4차 29위.' },
  { eventName: '2025 KLPGA 정규투어 시즌 본선', eventDate: '2025-05-15', tour: 'KLPGA', category: '정규투어', rank: null, summary: 'KLPGA 정규투어 시즌 본선 진출.' },
  { eventName: '2022 KLPGA 정회원 자격 취득', eventDate: '2022-11-01', tour: 'KLPGA', category: '자격', rank: null, summary: 'KLPGA 정회원 자격 취득.' },
  { eventName: '2022 KLPGA 그랜드-삼대인 점프투어 상금 순위', eventDate: '2022-10-15', tour: 'KLPGA', category: '시즌랭킹', rank: 5, summary: '점프투어 시즌 상금 순위 5위.' },
  { eventName: '2022 KLPGA 그랜드-삼대인 점프투어 8차전', eventDate: '2022-09-12', tour: 'KLPGA', category: '점프투어', rank: 6, summary: '점프투어 8차전 6위.' },
  { eventName: '2022 KLPGA 그랜드-삼대인 점프투어 7차전', eventDate: '2022-08-22', tour: 'KLPGA', category: '점프투어', rank: 25, summary: '점프투어 7차전 25위.' },
  { eventName: '2022 KLPGA 그랜드-삼대인 점프투어 6차전', eventDate: '2022-07-18', tour: 'KLPGA', category: '점프투어', rank: 2, summary: '점프투어 6차전 준우승.' },
  { eventName: '2022 KLPGA 그랜드-삼대인 점프투어 5차전', eventDate: '2022-06-13', tour: 'KLPGA', category: '점프투어', rank: 20, summary: '점프투어 5차전 20위.' },
  { eventName: '2019 KLPGA 준회원 자격 취득', eventDate: '2019-06-01', tour: 'KLPGA', category: '자격', rank: null, summary: 'KLPGA 준회원 자격 취득.' },
];

async function main() {
  console.log('🌱 강채린 프로 등록 시작...\n');

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
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.debutYear}년 입회 · WGTOUR 2026 루키`);

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
  console.log(`✅ 수상 이력 ${RESULTS.length}건 등록 완료`);
  console.log(`\n✨ 완료. 👀 http://localhost:5173/athletes`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

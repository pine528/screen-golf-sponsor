/**
 * 김단아 (KIM Dana) 프로 등록 (KLPGA 정회원 · 2024 정회원 획득)
 * 출처: 김단아 프로필 카드 (2003.01.31생 · 용인대 골프학부 · KLPGA 드림투어)
 *
 * ※ 등록 전 중복 계정 확인 완료 (name~"김단아" 0건, email~"dana" 0건) — 신규 등록
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-dana.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'kimdana@sponpik.com',
  password: 'kimdana2026!',
  name: '김단아',
  tour: 'KLPGA',
  bio: '2003년생 · KLPGA 정회원(2024) · 용인대학교 골프학부 재학 · TPI Level 1 수료 · 현 KLPGA 드림투어 활동 · 2024 점프투어 상금순위 16위',
  // 구조화 필드 (소속/학력/수상/경력)
  affiliation: 'KLPGA 정회원',
  education: '용인대학교 골프학부 재학 · TPI Level 1 교육 수료',
  awards: 'KLPGA 그랜드 점프투어 14차전 4위 · KLPGA 솔라고 점프투어 9차전 10위 · 2024 점프투어 상금순위 16위 · 제21대 경기도교육감배 우승',
  career: '현) KLPGA 드림투어 활동',
  profileImageUrl: '/golfers/kim-dana.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: 2024,
  affiliationSport: 'GOLF',
};

// 수상 경력 (카드 기준, 최신순). 연도별 대표일자(근사) 사용 — eventName에 연도 명시.
const RESULTS = [
  { eventName: 'KLPGA 2024 점프투어 상금순위', eventDate: '2024-11-30', tour: 'KLPGA 점프투어', category: '점프투어', rank: 16, summary: '2024 점프투어 상금순위 16위.' },
  { eventName: 'KLPGA 2024 그랜드 점프투어 14차전', eventDate: '2024-09-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 4, summary: '공동 4위(T4).' },
  { eventName: 'KLPGA 2024 솔라고 점프투어 9차전', eventDate: '2024-07-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 10, summary: '공동 10위(T10).' },
  { eventName: '제33회 경기도 전국대회', eventDate: '2019-06-15', tour: '아마추어', category: '아마추어', rank: 6, summary: '6위.' },
  { eventName: '제11회 KYGA 자마골프배', eventDate: '2019-05-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
  { eventName: 'KLPGA 삼천리 투게더 대회', eventDate: '2017-08-15', tour: 'KLPGA', category: '아마추어', rank: 3, summary: '3위.' },
  { eventName: 'FSCA 플로리다 주니어 투어', eventDate: '2017-03-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승 2회.' },
  { eventName: '제21대 경기도교육감배', eventDate: '2015-06-15', tour: '아마추어', category: '주니어', rank: 1, summary: '우승.' },
  { eventName: '대한주니어골프협회 제6회 켄이치골프컵', eventDate: '2015-05-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
  { eventName: '용인대학교 16대 총장배', eventDate: '2015-04-15', tour: '아마추어', category: '아마추어', rank: 4, summary: '4위.' },
];

async function main() {
  console.log('🌱 김단아 프로 등록 시작...\n');
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const passwordHash = await bcrypt.hash(ATH.password, 12);

  const athleteData = {
    name: ATH.name, tour: ATH.tour, bio: ATH.bio,
    profileImageUrl: ATH.profileImageUrl, socialLinks: ATH.socialLinks,
    primarySponsors: ATH.primarySponsors as any,
    height: ATH.height, region: ATH.region, debutYear: ATH.debutYear,
    affiliation: ATH.affiliation, education: ATH.education, awards: ATH.awards, career: ATH.career,
    sportType: ATH.affiliationSport, sportId: golfSport?.id ?? null, isActive: true,
  };

  const result = await prisma.user.upsert({
    where: { email: ATH.email },
    update: { athlete: { update: athleteData } },
    create: {
      email: ATH.email, passwordHash, role: 'ATHLETE',
      athlete: { create: { ...athleteData, kycStatus: 'APPROVED' } },
    },
    include: { athlete: true },
  });

  const athleteId = result.athlete!.id;
  console.log(`✅ ${ATH.name} (${ATH.tour}) - id: ${athleteId} | ${ATH.debutYear}년 정회원`);

  await prisma.athleteEventResult.deleteMany({ where: { athleteId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of RESULTS) {
    await prisma.athleteEventResult.create({
      data: {
        athleteId, eventName: r.eventName, eventDate: new Date(r.eventDate),
        tour: r.tour, category: r.category, rank: r.rank, score: null,
        summary: r.summary, source: 'MANUAL',
      },
    });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건 등록 완료`);
  console.log('\n✨ 완료. id:', athleteId);
}

main().catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); }).finally(() => prisma.$disconnect());

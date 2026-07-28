/**
 * 김진아2 (KIM Jina) 프로 등록 (KLPGA 정회원 · 2025 루키)
 * 출처: 김진아2 프로필 카드 + KLPGA 2025 드림투어 성적
 * ※ KLPGA 등록명이 '김진아2' (동명이인 구분)
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-jina.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'kimjina2@sponpik.com',
  password: 'kimjina2026!',
  name: '김진아2',
  tour: 'KLPGA',
  bio: '2007년생 · 172cm · 2025.08 KLPGA 정회원(회원번호 01737) · 2025 프로 데뷔 루키 · 2026 정규투어 시드순위전 본선 진출 · 미즈노 메인 스폰서 · 끝까지 포기하지 않는 스윙',
  profileImageUrl: '/golfers/kim-jina.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: ['미즈노'] as string[],
  height: 172,
  region: null as string | null,
  debutYear: 2025,
  affiliation: null as string | null,
  sportType: 'GOLF',
};

// KLPGA 2025 점프투어/드림투어 + 2026 시드순위전 (최신순). CUT = 컷 탈락(rank null).
const RESULTS = [
  { eventName: 'KLPGA 2026 정규투어 시드순위전', eventDate: '2025-11-15', tour: 'KLPGA', category: '시드순위전', rank: null, score: null, summary: '2026 정규투어 시드순위전 본선 진출.' },
  { eventName: 'KLPGA 2025 무안CC 욜로존 드림투어 18차전', eventDate: '2025-10-13', tour: 'KLPGA 드림투어', category: '드림투어', rank: 51, score: '-3 (70-71)', summary: '공동 51위(T51).' },
  { eventName: '연수정 KLPGA 2025 드림투어 17차전', eventDate: '2025-09-29', tour: 'KLPGA 드림투어', category: '드림투어', rank: 30, score: '-4 (71-69)', summary: '공동 30위(T30) · 상금 616,000원.' },
  { eventName: 'KLPGA 2025 군산 드림투어 16차전', eventDate: '2025-09-22', tour: 'KLPGA 드림투어', category: '드림투어', rank: null, score: '+2 (73-73)', summary: '컷 탈락.' },
  { eventName: 'KLPGA 2025 스카이밸리CC 세기P&C 드림투어 (with SBS골프) 15차전', eventDate: '2025-09-15', tour: 'KLPGA 드림투어', category: '드림투어', rank: null, score: '+4 (68-80)', summary: '컷 탈락.' },
  { eventName: '제주공항렌트카 KLPGA 2025 드림투어 14차전', eventDate: '2025-09-08', tour: 'KLPGA 드림투어', category: '드림투어', rank: 18, score: '-4', summary: '공동 18위(T18) · 시즌 최고 성적 · 상금 661,889원.' },
  { eventName: 'KLPGA 2025 모나CC 에스라이언케팅 드림투어 13차전', eventDate: '2025-08-25', tour: 'KLPGA 드림투어', category: '드림투어', rank: null, score: '-3 (70-71)', summary: '컷 탈락.' },
  { eventName: 'KLPGA 2025 솔라고 점프투어 12차전', eventDate: '2025-08-10', tour: 'KLPGA 점프투어', category: '점프투어', rank: 6, score: null, summary: '공동 6위(T6).' },
  { eventName: 'KLPGA 2025 솔라고 점프투어 10차전', eventDate: '2025-07-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, score: null, summary: '공동 2위(T2).' },
];

async function main() {
  console.log('🌱 김진아2 프로 등록 시작...\n');

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
        tour: r.tour, category: r.category, rank: r.rank, score: (r as any).score ?? null,
        summary: r.summary, source: 'MANUAL',
      },
    });
  }
  console.log(`✅ 입상내역 ${RESULTS.length}건 등록 완료`);
  console.log(`\n✨ 완료.`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

/**
 * 문준혁 (Jun Hyuk Moon) 프로 등록 (KPGA 코리안투어 1부)
 * 출처: 문준혁 프로 프로필 요약.docx + KPGA 공식기록(memberId 00042826)
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-moon-junhyuk.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATH = {
  email: 'moonjunhyuk@sponpik.com',
  password: 'moonjunhyuk2026!',
  name: '문준혁',
  tour: 'KPGA',
  bio: '182cm · 1996년생 · 제주 출신 · 경희대 골프산업학과 · KPGA 정회원(2016 선발전 수석) · 2016 챌린지투어 우승 · 2023 스릭슨투어 우승 · 2026 KPGA 코리안투어(1부) 활동 · JGTO Q-School 4위 · 주니어 통산 30회 우승',
  profileImageUrl: '/golfers/moon-junhyuk.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: ['스릭슨'] as string[],
  height: 182,
  region: '제주특별자치도 제주시',
  debutYear: 2016,
  affiliation: null as string | null,
  sportType: 'GOLF',
};

// 입상내역 (docx 수상경력 + KPGA 공식 시즌기록, 최신순)
const RESULTS = [
  { eventName: '2026 KPGA 코리안투어 (1부)', eventDate: '2026-06-01', tour: 'KPGA', category: '시즌기록', rank: null, summary: '2026 시즌 7경기 · 상금랭킹 42위 (시즌 진행중).' },
  { eventName: '2024 KPGA 코리안투어', eventDate: '2024-11-01', tour: 'KPGA', category: '시즌기록', rank: null, summary: '12경기 · TOP10 1회 · 상금랭킹 49위.' },
  { eventName: '2023 스릭슨투어 우승', eventDate: '2023-09-01', tour: '스릭슨투어', category: '정규투어', rank: 1, summary: '스릭슨투어 우승.' },
  { eventName: '2023 KPGA 코리안투어', eventDate: '2023-06-01', tour: 'KPGA', category: '시즌기록', rank: null, summary: '상금랭킹 26위 · TOP10 1회.' },
  { eventName: 'JGTO(일본투어) Q-School', eventDate: '2023-12-01', tour: 'JGTO', category: 'Q스쿨', rank: 4, summary: '일본투어 Q-School 4위 · 아시안투어/일본투어 Q-스쿨 파이널 진출.' },
  { eventName: '2016 챌린지투어 우승', eventDate: '2016-07-01', tour: 'KPGA', category: '챌린지투어', rank: 1, summary: 'KPGA 챌린지투어 우승.' },
  { eventName: '2016 KPGA 코리안투어', eventDate: '2016-10-01', tour: 'KPGA', category: '시즌기록', rank: null, summary: '상금랭킹 11위 · 포인트랭킹 4위 · TOP10 1회.' },
  { eventName: '2016 KPGA 투어프로 선발전', eventDate: '2016-03-01', tour: 'KPGA', category: '선발전', rank: 1, summary: 'KPGA 투어프로 선발 수석 합격.' },
  { eventName: '주니어 통산 30회 우승', eventDate: '2014-01-01', tour: '아마추어', category: '주니어', rank: null, summary: '전국주니어골프선수권(대한골프협회), IJGT 아시아 챔피언십, 정관장배, 경인일보배 등 중고연맹 포함 전국대회 통산 30회 우승.' },
];

async function main() {
  console.log('🌱 문준혁 프로 등록 시작...\n');

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

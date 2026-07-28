/**
 * 황지현 (Hwang Ji hyun) 프로 등록 (KLPGA 정회원 · 부산)
 * 출처: 황지현 프로필 이미지
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-hwang-jihyun.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'hwangjihyun@sponpik.com',
  password: 'hwangjihyun2026!',
  name: '황지현',
  tour: 'KLPGA',
  bio: "KLPGA 정회원(2022.05) · 단국대 국제스포츠학부 골프전공 · 부산진여고 골프부 · 2022 점프투어 상금랭킹 6위 · 유튜브 '공치는 명훈이'·'골신골덕' 출연",
  profileImageUrl: '/golfers/hwang-jihyun.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: '부산광역시',
  debutYear: 2022,
  affiliation: null as string | null,
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '2022 KLPGA 점프투어 상금랭킹', eventDate: '2022-10-15', tour: 'KLPGA 점프투어', category: '시즌랭킹', rank: 6, summary: '점프투어 시즌 상금랭킹 6위.' },
  { eventName: '2022 KLPGA XGOLF 점프투어 3차', eventDate: '2022-07-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 7, summary: '점프투어 3차 7위.' },
  { eventName: '2021 KLPGA 정회원 선발전 A조', eventDate: '2021-06-01', tour: 'KLPGA', category: '선발전', rank: 2, summary: '정회원 선발전 A조 2위.' },
  { eventName: '2020 KLPGA 삼대인 점프투어 2차', eventDate: '2020-06-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 8, summary: '점프투어 2차 8위.' },
  { eventName: '2018 전국체전 부산대표', eventDate: '2018-10-01', tour: '아마추어', category: '국가대표', rank: null, summary: '전국체전 부산 대표.' },
  { eventName: '2018 부산광역시협회장배 학생 선수권', eventDate: '2018-05-01', tour: '아마추어', category: '주니어', rank: 2, summary: '학생 선수권 2위 외 다수 입상.' },
  { eventName: '2015 전국소년체전 부산대표', eventDate: '2015-05-01', tour: '아마추어', category: '국가대표', rank: null, summary: '전국소년체전 부산 대표.' },
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

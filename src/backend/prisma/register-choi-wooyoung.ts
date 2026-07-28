/**
 * 최우영 (Wooyoung Choi) 프로 등록 (KPGA 투어프로 · 미국 대학골프 출신)
 * 출처: 최우영 이력서 docx
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-choi-wooyoung.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'choiwooyoung@sponpik.com',
  password: 'choiwooyoung2026!',
  name: '최우영',
  tour: 'KPGA',
  bio: 'KPGA 투어프로 · 미국 톨레도대 졸업/한국체대 대학원 · 미국 뉴멕시코·톨레도대 골프팀 장학생 · 2017 LA 매치플레이 우승 · 2019 NCAA Mountain West 단체전 우승 · 미국PGA Class A 준비 중 · 영어 레슨 가능(우영프로)',
  profileImageUrl: '/golfers/choi-wooyoung.jpg',
  socialLinks: { instagram: 'heyimwy_cc_7', youtube: '우영프로' } as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: null as string | null,
  debutYear: null as number | null,
  affiliation: null as string | null,
  sportType: 'GOLF',
};
const RESULTS = [
  { eventName: '2019 NCAA Mountain West 리그 단체전', eventDate: '2019-05-01', tour: 'NCAA', category: '대학', rank: 1, summary: 'NCAA Mountain West 단체전 우승.' },
  { eventName: '2018 미국 남가주 오픈', eventDate: '2018-07-01', tour: '아마추어', category: '오픈', rank: 11, summary: '공동 11위.' },
  { eventName: '2018 미국 뉴멕시코 아마추어 대표팀', eventDate: '2018-03-01', tour: '아마추어', category: '국가대표', rank: null, summary: '뉴멕시코 아마추어 대표팀.' },
  { eventName: '2017 Los Angeles 매치플레이', eventDate: '2017-06-01', tour: '아마추어', category: '아마추어', rank: 1, summary: 'LA 매치플레이 우승.' },
  { eventName: '2016 캘리포니아 주니어 대표팀', eventDate: '2016-03-01', tour: '아마추어', category: '국가대표', rank: null, summary: '캘리포니아 주니어 대표팀.' },
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

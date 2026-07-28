/**
 * 이정우 프로 등록 (KPGA PRO · 대전)
 * 출처: 사용자 제공 경력 + 이정우.jpg
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-lee-jungwoo.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATH = {
  email: 'leejungwoo@sponpik.com',
  password: 'leejungwoo2026!',
  name: '이정우',
  tour: 'KPGA',
  bio: 'KPGA 투어프로 · 공주대 교육대학원 석사 · 중등 2급 정교사(체육) · 대전체육고 골프부 출신 · 대전광역시장배 준우승 · KPGA 프론티어투어 4위 · 전 GDR아카데미 대전스마트시티점 프로',
  profileImageUrl: '/golfers/lee-jungwoo.jpg',
  socialLinks: {} as Record<string, string>,
  primarySponsors: [] as string[],
  height: null as number | null,
  region: '대전광역시',
  debutYear: null as number | null,
  affiliation: null as string | null,
  sportType: 'GOLF',
};
// 입상내역 (연도 미상 → 추정 날짜, 확인 후 보정 필요)
const RESULTS = [
  { eventName: 'KPGA 프론티어 투어', eventDate: '2023-06-01', tour: 'KPGA', category: '프론티어투어', rank: 4, summary: '프론티어 투어 4위.' },
  { eventName: '대전광역시장배 골프대회', eventDate: '2022-09-01', tour: '아마추어', category: '아마추어', rank: 2, summary: '준우승.' },
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

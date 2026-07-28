/**
 * 이동미 프로 등록 (KLPGA 준회원)
 * - 등록 전 중복 확인 완료 (name~"이동미" 0건) → 신규 등록
 * - 이메일 미제공 → sponpik placeholder
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-lee-dongmi.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const A = {
  email: 'leedongmi@sponpik.com', password: 'leedongmi2026!',
  name: '이동미', tour: 'KLPGA',
  bio: 'KLPGA 준회원 · 2021년~현재 KLPGA 점프투어 활동 · 現 WGTOUR 활동중 · 現 아이리스골프클럽 소속프로. 청봉배골프대회 우승.',
  affiliation: 'KLPGA 준회원 · 아이리스골프클럽 소속프로',
  education: null as string | null,
  awards: '2026 롯데렌터카 WGTOUR 4차 예선전 3위 · 2026 롯데렌터카 WGTOUR 1차 26위 · 청봉배골프대회 우승',
  career: '2021년~현재 KLPGA 점프투어 활동 · 現 WGTOUR 활동중 · 現 아이리스골프클럽 소속프로',
  profileImageUrl: '/golfers/lee-dongmi.jpg',
  socialLinks: {} as Record<string, string>,
  region: null as string | null, debutYear: null as number | null,
  results: [
    { eventName: '2026 롯데렌터카 WGTOUR 4차 예선전', eventDate: '2026-04-15', tour: 'WGTOUR', category: 'WGTOUR', rank: 3, summary: '예선전 3위.' },
    { eventName: '2026 롯데렌터카 WGTOUR 1차', eventDate: '2026-03-15', tour: 'WGTOUR', category: 'WGTOUR', rank: 26, summary: '26위.' },
    { eventName: '청봉배 골프대회', eventDate: '2020-06-15', tour: '아마추어', category: '아마추어', rank: 1, summary: '우승.' },
  ],
};

async function main() {
  const golf = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const passwordHash = await bcrypt.hash(A.password, 12);
  const athleteData: any = {
    name: A.name, tour: A.tour, bio: A.bio,
    profileImageUrl: A.profileImageUrl, socialLinks: A.socialLinks, primarySponsors: [],
    height: null, region: A.region, debutYear: A.debutYear,
    affiliation: A.affiliation, education: A.education, awards: A.awards, career: A.career,
    sportType: 'GOLF', sportId: golf?.id ?? null, isActive: true, kycStatus: 'APPROVED',
  };
  const res = await prisma.user.upsert({
    where: { email: A.email },
    update: { athlete: { update: athleteData } },
    create: { email: A.email, passwordHash, role: 'ATHLETE', athlete: { create: athleteData } },
    include: { athlete: true },
  });
  const id = res.athlete!.id;
  await prisma.athleteEventResult.deleteMany({ where: { athleteId: id, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of A.results) {
    await prisma.athleteEventResult.create({
      data: { athleteId: id, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, score: null, summary: r.summary, source: 'MANUAL' },
    });
  }
  console.log(`✅ ${A.name} (${A.email}) id=${id} | 입상 ${A.results.length}건`);
  console.log('현재 선수 수:', await prisma.athlete.count());
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

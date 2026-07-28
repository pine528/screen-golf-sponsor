/**
 * 김영민 프로 등록 (KPGA TOUR PRO) — 엑셀 양식 기반
 * - 중복 확인: 기존 계정 dudalsef@naver.com 존재(빈 자가가입) → 업데이트 (신규 생성 X)
 * - 출처: SPONPIK_선수프로필_정보수집_엑셀양식_김영민.xlsx
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-kim-youngmin.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const A = {
  email: 'dudalsef@naver.com', // 본인 실계정
  name: '김영민', tour: 'KPGA',
  bio: "1996년생 · 광주 출신 · KPGA TOUR PRO(2024 1차 차석합격) · 2024~ G-TOUR 활동중 · 유튜브 '롱거스윙 김영민'.",
  affiliation: 'KPGA TOUR PRO',
  education: '광주고등학교',
  awards: '2024 1차 KPGA 투어프로 차석합격 · 2부투어 본선 다수 진출',
  career: '2024~ G-TOUR 활동중 · 2021~2024 타이틀리스트 소속 프로 · 대전 쓰리콘즈 아카데미 소속 프로',
  profileImageUrl: '/golfers/kim-youngmin.jpg',
  socialLinks: { instagram: 'longerswing', youtube: '롱거스윙 김영민' } as Record<string, string>,
  height: 178, region: '광주광역시', debutYear: 2024,
  results: [
    { eventName: '2024 KPGA 투어프로 선발전 (1차)', eventDate: '2024-03-15', tour: 'KPGA', category: '선발전', rank: 2, summary: '차석합격.' },
  ],
};

async function main() {
  const golf = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const user = await prisma.user.findUnique({ where: { email: A.email }, include: { athlete: true } });
  if (!user?.athlete) { console.log('❌ 기존 계정 없음 — 중단'); return; }
  const athleteData: any = {
    name: A.name, tour: A.tour, bio: A.bio,
    profileImageUrl: A.profileImageUrl, socialLinks: A.socialLinks, primarySponsors: [],
    height: A.height, region: A.region, debutYear: A.debutYear,
    affiliation: A.affiliation, education: A.education, awards: A.awards, career: A.career,
    sportType: 'GOLF', sportId: golf?.id ?? null, isActive: true, kycStatus: 'APPROVED',
  };
  await prisma.athlete.update({ where: { id: user.athlete.id }, data: athleteData });
  const id = user.athlete.id;
  await prisma.athleteEventResult.deleteMany({ where: { athleteId: id, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of A.results) {
    await prisma.athleteEventResult.create({
      data: { athleteId: id, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, score: null, summary: r.summary, source: 'MANUAL', status: 'APPROVED' },
    });
  }
  console.log(`✅ 김영민 (${A.email}) id=${id} | 입상 ${A.results.length}건 (기존 계정 업데이트)`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

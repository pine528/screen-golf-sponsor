/**
 * 문서영 프로 등록 (KLPGA 정회원)
 * - 중복 확인: 기존 계정 sola011226@naver.com 존재(빈 자가가입) → 업데이트 (신규 생성 X)
 * - 인스타 hi_im_seoyoung. 사진 /golfers/moon-seoyoung.jpg
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-moon-seoyoung.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const A = {
  email: 'sola011226@naver.com', // 본인 실계정
  name: '문서영', tour: 'KLPGA',
  bio: '건국대학교 골프산업학과 재학 · KLPGA TOUR PRO(정회원) · 2022 KLPGA 입회 · 2025 다산베아채cc 점프투어 8차전 우승.',
  affiliation: 'KLPGA TOUR PRO (정회원)',
  education: '건국대학교 골프산업학과 재학중',
  awards: '2025 KLPGA 다산베아채cc 점프투어 8차전 우승 · 2024 KLPGA 백제cc 점프투어 시드순위전 2위 · 이지스카이cc 3위 · 그랜드cc 5위 · 2024 전국 대학 골프 선수권 T5',
  career: '2022 KLPGA 입회 · KLPGA 점프투어 다수입상',
  profileImageUrl: '/golfers/moon-seoyoung.jpg',
  socialLinks: { instagram: 'hi_im_seoyoung' } as Record<string, string>,
  region: null as string | null, debutYear: 2022,
  results: [
    { eventName: '2025 KLPGA 다산베아채cc 점프투어 8차전', eventDate: '2025-08-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 1, summary: '우승.' },
    { eventName: '2024 KLPGA 백제cc 점프투어 시드순위전', eventDate: '2024-11-15', tour: 'KLPGA 점프투어', category: '시드순위전', rank: 2, summary: '시드순위전 2위.' },
    { eventName: '2024 KLPGA 이지스카이cc 점프투어 시드순위전', eventDate: '2024-11-08', tour: 'KLPGA 점프투어', category: '시드순위전', rank: 3, summary: '시드순위전 3위.' },
    { eventName: '2024 KLPGA 그랜드cc 점프투어 시드순위전', eventDate: '2024-11-01', tour: 'KLPGA 점프투어', category: '시드순위전', rank: 5, summary: '시드순위전 5위.' },
    { eventName: '2024 전국 대학 골프 선수권 대회', eventDate: '2024-06-15', tour: '아마추어', category: '대학', rank: 5, summary: '공동 5위(T5).' },
    { eventName: '2019 Adam Scott Junior Classic', eventDate: '2019-06-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
    { eventName: '2018 HSBC Youth Golf Championship', eventDate: '2018-06-15', tour: '아마추어', category: '주니어', rank: 4, summary: '4위.' },
  ],
};

async function main() {
  const golf = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  const athleteData: any = {
    name: A.name, tour: A.tour, bio: A.bio,
    profileImageUrl: A.profileImageUrl, socialLinks: A.socialLinks, primarySponsors: [],
    height: null, region: A.region, debutYear: A.debutYear,
    affiliation: A.affiliation, education: A.education, awards: A.awards, career: A.career,
    sportType: 'GOLF', sportId: golf?.id ?? null, isActive: true, kycStatus: 'APPROVED',
  };
  const res = await prisma.user.findUnique({ where: { email: A.email }, include: { athlete: true } });
  if (!res?.athlete) { console.log('❌ 기존 계정 없음 — 중단'); return; }
  await prisma.athlete.update({ where: { id: res.athlete.id }, data: athleteData });
  const id = res.athlete.id;
  await prisma.athleteEventResult.deleteMany({ where: { athleteId: id, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  for (const r of A.results) {
    await prisma.athleteEventResult.create({
      data: { athleteId: id, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, score: null, summary: r.summary, source: 'MANUAL', status: 'APPROVED' },
    });
  }
  console.log(`✅ 문서영 (${A.email}) id=${id} | 입상 ${A.results.length}건 (기존 계정 업데이트)`);
  console.log('현재 선수 수:', await prisma.athlete.count());
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

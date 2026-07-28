/**
 * 나승규 프로 등록 (KPGA) — 엑셀 양식 + 기존 자가입력 병합
 * - 중복 확인: 기존 계정 seungkyu6790@gmail.com 존재 (본인이 이미 bio/학력/경력 입력) → 병합 업데이트
 * - 기존 bio/학력/경력/키/지역 보존 + 엑셀의 소속·수상·입회연도(2018)·사진·인스타 정규화 추가
 * - 주요이력(엑셀): 2018 KPGA 프론티어투어 5위 / 2부투어 본선 다수 / GTOUR·챌린지투어 활동
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-na-seunggyu.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const A = {
  email: 'seungkyu6790@gmail.com',
  name: '나승규', tour: 'KPGA',
  bio: '안녕하세요. 전남 순천에서 활동중인 나승규프로입니다.',
  affiliation: 'KPGA 정회원 · KPGA 투어프로',
  education: '동일전자정보고 골프특기생 · 전남과학대 골프산업과 졸업',
  awards: '2018 KPGA 프론티어투어 5위 · 2부투어 본선 다수 진출',
  career: '2024~ GTOUR·KPGA 챌린지투어 활동 중 · 前 금정골프라운지 헤드프로 · 現 QED골프아카데미 순천점 메인프로',
  profileImageUrl: '/golfers/na-seunggyu.jpg',
  socialLinks: { instagram: 'ggyu_pro' } as Record<string, string>,
  height: 181, region: '전남 순천시', debutYear: 2018,
  results: [
    { eventName: '2018 KPGA 프론티어투어', eventDate: '2018-06-15', tour: 'KPGA', category: '프론티어투어', rank: 5, summary: '5위.' },
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
  console.log(`✅ 나승규 (${A.email}) id=${id} | 입상 ${A.results.length}건 (기존 계정 병합 업데이트)`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

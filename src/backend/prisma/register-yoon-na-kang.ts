/**
 * 윤지영 / 나동한 / 강혜란 프로 등록 (KLPGA/KPGA)
 * - 등록 전 중복 확인: 윤지영·나동한 없음(신규), 강혜란 기존 계정 hrka0418@naver.com 존재 → 업데이트
 * - 윤지영: 이메일 미제공 → sponpik placeholder / 나동한: 실이메일 / 강혜란: 본인 실계정 업데이트
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-yoon-na-kang.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATHLETES = [
  {
    email: 'yoonjiyoung@sponpik.com', password: 'yoonjiyoung2026!',
    name: '윤지영', tour: 'KLPGA',
    bio: 'KLPGA 정회원 · KLPGA TOUR PRO · 現 건주병원 후원 협약 프로 · KLPGA 2부 드림투어 활동. 2023 솔라고 점프투어 12차전 우승.',
    affiliation: 'KLPGA 정회원 · KLPGA TOUR PRO',
    education: null as string | null,
    awards: 'KLPGA 2023 솔라고 점프투어 12차전 우승 · 11차전 9위',
    career: '前 한성에프아이 주니어 장학생 · 現 건주병원 후원 협약 프로 · KLPGA 2부 드림투어 활동',
    profileImageUrl: '/golfers/yoon-jiyoung.jpg',
    socialLinks: {} as Record<string, string>,
    region: null as string | null, debutYear: null as number | null,
    results: [
      { eventName: 'KLPGA 2023 솔라고 점프투어 12차전', eventDate: '2023-08-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 1, summary: '우승.' },
      { eventName: 'KLPGA 2023 솔라고 점프투어 11차전', eventDate: '2023-08-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 9, summary: '9위.' },
    ],
  },
  {
    email: 'altena1243@gmail.com', password: 'nadonghan2026!',
    name: '나동한', tour: 'KPGA',
    bio: 'KPGA TOUR PRO · 건국대 골프산업학과 · 2023~2025 스릭슨 투어팀 · 現 G투어·데이비드 투어 활동중.',
    affiliation: 'KPGA TOUR PRO',
    education: '건국대학교 골프산업학과 스포츠지도전공 (중퇴)',
    awards: '2025 신한투자증권 GTOUR 5차 13위 · 2022 KPGA 스릭슨투어 22위 · 2013 KPGA 프론티어투어 준우승 · 2011 건국대학교총장배 준우승 · 2010 경희대학교총장배 3위',
    career: '2023~2025 스릭슨 투어팀 · 2008 박카스배 시·도대항전 경기도대표 · 現 G투어 및 데이비드 투어 활동중',
    profileImageUrl: '/golfers/na-donghan.jpg',
    socialLinks: { instagram: 'nadonghankpga', youtube: '나동한투어프로' } as Record<string, string>,
    region: null as string | null, debutYear: null as number | null,
    results: [
      { eventName: '2025 신한투자증권 GTOUR 5차전', eventDate: '2025-09-15', tour: 'GTOUR', category: 'GTOUR', rank: 13, summary: '13위.' },
      { eventName: 'KPGA 2022 스릭슨투어', eventDate: '2022-07-15', tour: 'KPGA', category: '스릭슨투어', rank: 22, summary: '10회전 22위.' },
      { eventName: 'KPGA 2016 챌린지투어', eventDate: '2016-07-15', tour: 'KPGA', category: '챌린지투어', rank: 16, summary: '8회전 16위.' },
      { eventName: 'KPGA 2013 프론티어투어 (준우승)', eventDate: '2013-06-15', tour: 'KPGA', category: '프론티어투어', rank: 2, summary: '준우승.' },
      { eventName: 'KPGA 2013 프론티어투어', eventDate: '2013-05-15', tour: 'KPGA', category: '프론티어투어', rank: 6, summary: '6위.' },
      { eventName: '2011 건국대학교총장배', eventDate: '2011-06-15', tour: '아마추어', category: '아마추어', rank: 2, summary: '준우승.' },
      { eventName: '2010 경희대학교총장배', eventDate: '2010-06-15', tour: '아마추어', category: '아마추어', rank: 3, summary: '3위 · 데일리베스트 65타(-7).' },
    ],
  },
  {
    email: 'hrka0418@naver.com', password: null, // 기존 계정 — 비밀번호 변경 안 함
    name: '강혜란', tour: 'KLPGA',
    bio: '2001년생 · KLPGA 투어프로(회원번호 01414) · 홍익대학교 재학 · 2020~2026 드림투어 활동.',
    affiliation: 'KLPGA 투어프로 (회원번호 No.01414)',
    education: '홍익대학교 재학',
    awards: '2020 솔라고 파워풀엑스 점프투어 9차전 2위 · 12차전 2위 · 2019 10차전 7위 · 2022 노랑통닭 드림챌린지 10위',
    career: '2020~2026 드림투어 활동 · 2016 전국 소년체전 중등부 서울시 대표',
    profileImageUrl: '/golfers/kang-hyeran.jpg',
    socialLinks: {} as Record<string, string>,
    region: '경기도 용인시', debutYear: 2020,
    results: [
      { eventName: 'KLPGA 2022 큐캐피탈 노랑통닭 드림챌린지', eventDate: '2022-06-15', tour: 'KLPGA 드림투어', category: '드림투어', rank: 10, summary: '단일대회 10위.' },
      { eventName: 'KLPGA 2020 솔라고 파워풀엑스 점프투어 12차전', eventDate: '2020-08-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '준우승.' },
      { eventName: 'KLPGA 2020 솔라고 파워풀엑스 점프투어 9차전', eventDate: '2020-07-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '준우승.' },
      { eventName: 'KLPGA 2019 솔라고 파워풀엑스 점프투어 10차전', eventDate: '2019-07-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 7, summary: '7위.' },
      { eventName: '2017 이경훈배 서울특별시 학생골프대회', eventDate: '2017-06-15', tour: '아마추어', category: '학생부', rank: 5, summary: '개인전 5위.' },
      { eventName: '2016 유소년배 서울특별시 종별골프대회', eventDate: '2016-06-15', tour: '아마추어', category: '유소년부', rank: 2, summary: '개인전 2위.' },
      { eventName: '2016 전국 소년체전 (중등부)', eventDate: '2016-05-15', tour: '아마추어', category: '소년체전', rank: null, summary: '서울시 대표출전.' },
      { eventName: '2013 KLPGA 여자아마추어 골프선수권대회 (초등부)', eventDate: '2013-06-15', tour: '아마추어', category: '아마추어', rank: 7, summary: '초등부 7위.' },
    ],
  },
];

async function main() {
  const golf = await prisma.sport.findUnique({ where: { code: 'GOLF' } });
  for (const A of ATHLETES) {
    const athleteData: any = {
      name: A.name, tour: A.tour, bio: A.bio,
      profileImageUrl: A.profileImageUrl, socialLinks: A.socialLinks, primarySponsors: [],
      height: null, region: A.region, debutYear: A.debutYear,
      affiliation: A.affiliation, education: A.education, awards: A.awards, career: A.career,
      sportType: 'GOLF', sportId: golf?.id ?? null, isActive: true, kycStatus: 'APPROVED',
    };
    const create: any = { email: A.email, role: 'ATHLETE', athlete: { create: athleteData } };
    if (A.password) create.passwordHash = await bcrypt.hash(A.password, 12);
    else create.passwordHash = await bcrypt.hash('placeholder-' + Date.now(), 12); // 신규생성 대비(기존계정이면 update만 사용)

    const res = await prisma.user.upsert({
      where: { email: A.email },
      update: { athlete: { update: athleteData } },
      create,
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
  }
  console.log('\n✨ 완료. 현재 선수 수:', await prisma.athlete.count());
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

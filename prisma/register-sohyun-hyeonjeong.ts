/**
 * 이소현 / 신현정 프로 등록 (KLPGA)
 * - 본인 실이메일로 등록(향후 중복 예방). 등록 전 중복 확인 완료(이름·이메일 0건).
 * - 신현정은 사진 파일 미확보 → profileImageUrl null (추후 추가)
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-sohyun-hyeonjeong.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ATHLETES = [
  {
    email: 'sohyun-021223@naver.com',
    password: 'leesohyun2026!',
    name: '이소현',
    tour: 'KLPGA',
    bio: '현재 KLPGA 점프투어에서 활동 중인 이소현 프로. 2024년 KLPGA 준회원 입회. 성실하고 밝은 성격과 좋은 친화력으로 회원들이 골프의 매력에 빠질 수 있도록 지도하는 프로.',
    affiliation: 'KLPGA 준회원',
    education: null as string | null,
    awards: '2020 경북도지사배 여고부 2위 · 2024 SBS골프 이지스카이 6차전 탑20 · 2024 솔라고 점프투어 1위 통과 · 솔라고 9~12차전 탑20 이내 다수',
    career: '2021년~현재 KLPGA 점프투어 활동 중',
    profileImageUrl: '/golfers/lee-sohyun.jpg',
    socialLinks: {} as Record<string, string>,
    region: '경기도 화성시',
    debutYear: 2024,
    results: [
      { eventName: 'KLPGA 2024 솔라고 점프투어 (1위 통과)', eventDate: '2024-08-01', tour: 'KLPGA 점프투어', category: '점프투어', rank: 1, summary: '1위 통과.' },
      { eventName: 'KLPGA 2024 SBS골프 이지스카이 6차전', eventDate: '2024-06-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 20, summary: '탑 20위.' },
      { eventName: 'KLPGA 2024 솔라고 점프투어 9~12차전', eventDate: '2024-09-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: null, summary: '탑 20위 이내 다수.' },
      { eventName: '2020 경북도지사배 여고부', eventDate: '2020-06-15', tour: '아마추어', category: '아마추어', rank: 2, summary: '여고부 2위.' },
    ],
  },
  {
    email: 'qwer5488@naver.com',
    password: 'shinhyeonjeong2026!',
    name: '신현정',
    tour: 'KLPGA',
    bio: '홍익대학교 산업스포츠학과 졸업 · KLPGA TOUR PRO · KLPGA Master Professional 교습가. 서울시장배·서울시협회장배 우승 등 다수 입상.',
    affiliation: 'KLPGA 정회원 · KLPGA TOUR PRO',
    education: '홍익대학교 산업스포츠학과 졸업',
    awards: '제30회 서울시장배 우승 · 제31회 서울시협회장배 우승 · KLPGA 그랜드 삼대인 점프투어 3차전 준우승 · 파워풀엑스 솔라고 9차전 준우승 · 10차전 4위',
    career: 'KLPGA Master Professional 교습가 · 2015 서울특별시 대표 · 前 대방건설 소속단 투어 프로 · 前 팀 레노마 소속 투어프로',
    profileImageUrl: null as string | null,
    socialLinks: { instagram: '_hyeonjeongg' } as Record<string, string>,
    region: '경기도 하남시',
    debutYear: null as number | null,
    results: [
      { eventName: '제30회 서울시장배', eventDate: '2015-06-15', tour: '아마추어', category: '아마추어', rank: 1, summary: '우승.' },
      { eventName: '제31회 서울시협회장배', eventDate: '2016-06-15', tour: '아마추어', category: '아마추어', rank: 1, summary: '우승.' },
      { eventName: 'KLPGA 그랜드 삼대인 점프투어 3차전', eventDate: '2022-05-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '준우승.' },
      { eventName: 'KLPGA 파워풀엑스 솔라고 점프투어 9차전', eventDate: '2022-07-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 2, summary: '준우승.' },
      { eventName: 'KLPGA 파워풀엑스 솔라고 점프투어 10차전', eventDate: '2022-07-29', tour: 'KLPGA 점프투어', category: '점프투어', rank: 4, summary: '4위.' },
    ],
  },
];

async function main() {
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });

  for (const A of ATHLETES) {
    const passwordHash = await bcrypt.hash(A.password, 12);
    const athleteData = {
      name: A.name, tour: A.tour, bio: A.bio,
      profileImageUrl: A.profileImageUrl, socialLinks: A.socialLinks,
      primarySponsors: [] as any,
      height: null, region: A.region, debutYear: A.debutYear,
      affiliation: A.affiliation, education: A.education, awards: A.awards, career: A.career,
      sportType: 'GOLF', sportId: golfSport?.id ?? null, isActive: true,
    };
    const res = await prisma.user.upsert({
      where: { email: A.email },
      update: { athlete: { update: athleteData } },
      create: { email: A.email, passwordHash, role: 'ATHLETE', athlete: { create: { ...athleteData, kycStatus: 'APPROVED' } } },
      include: { athlete: true },
    });
    const id = res.athlete!.id;
    await prisma.athleteEventResult.deleteMany({ where: { athleteId: id, source: { in: ['MANUAL', 'GTOUR_API'] } } });
    for (const r of A.results) {
      await prisma.athleteEventResult.create({
        data: { athleteId: id, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, score: null, summary: r.summary, source: 'MANUAL' },
      });
    }
    console.log(`✅ ${A.name} (${A.email}) id=${id} | 입상 ${A.results.length}건 | 사진=${A.profileImageUrl || '없음'}`);
  }
  console.log('\n✨ 완료. 현재 선수 수:', await prisma.athlete.count());
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

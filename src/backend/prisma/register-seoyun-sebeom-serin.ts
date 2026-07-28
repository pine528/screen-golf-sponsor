/**
 * 이서윤 / 이세범 / 김세린 프로 등록
 * - 중복 확인: 이서윤·김세린 없음(신규), 이세범 기존 계정 joy5026@nate.com 존재 → 업데이트
 * - 이메일 미제공자는 sponpik placeholder. 이세범은 본인 실계정 enrich.
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/register-seoyun-sebeom-serin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const ATHLETES = [
  {
    email: 'leeseoyun@sponpik.com', password: 'leeseoyun2026!',
    name: '이서윤', tour: 'KLPGA',
    bio: 'KLPGA TOUR PRO(정회원) · W GOLF STUDIO 소속프로. 부산광역시 골프협회·교육감배 선수권 우승.',
    affiliation: 'KLPGA 정회원 · W GOLF STUDIO 소속프로',
    education: null as string | null,
    awards: '부산광역시 골프협회 선수권 대회 우승 · 부산광역시 교육감배 선수권 대회 우승 · KLPGA 협회장배 여자 아마추어선수권 TOP 3',
    career: '前 신세계 골프 레인지 · 前 퍼스트 골프 라운지 · 前 롯데호텔 골프연습장 · TPI Level 1 수료 · 골프 저널 레슨 칼럼 연재',
    profileImageUrl: '/golfers/lee-seoyun.jpg',
    socialLinks: { instagram: 'seo.yun.pro' } as Record<string, string>,
    region: null as string | null, debutYear: null as number | null,
    results: [
      { eventName: '부산광역시 골프협회 선수권 대회', eventDate: '2019-06-15', tour: '아마추어', category: '선수권', rank: 1, summary: '우승.' },
      { eventName: '부산광역시 교육감배 선수권 대회', eventDate: '2018-06-15', tour: '아마추어', category: '선수권', rank: 1, summary: '우승.' },
      { eventName: 'KLPGA 협회장배 여자 아마추어선수권 대회', eventDate: '2017-06-15', tour: 'KLPGA', category: '아마추어', rank: 3, summary: 'TOP 3.' },
    ],
  },
  {
    email: 'joy5026@nate.com', password: null, // 기존 계정 — 비밀번호 변경 안 함
    name: '이세범', tour: 'KPGA',
    bio: 'KPGA TOUR PRO(특전) · 前 스릭슨 소속(2021~2023) · 2부투어 본선 다수 진출. TrackMan·바이오메카닉스 기반 데이터 레슨 전문.',
    affiliation: 'KPGA TOUR PRO (특전)',
    education: null as string | null,
    awards: null as string | null,
    career: '前 스릭슨 소속(2021~2023) · 2부투어 본선 다수 진출 · ROTEX MOTION 인증 교습가 · TrackMan 데이터 분석 과정 이수 · Dr. Kwon\'s Golf Biomechanics Instructor LV.1 · Steve & Lee Cox 지면반력 비거리 레슨 · Body Swing Connection LV.1/LV.2',
    profileImageUrl: '/golfers/lee-sebeom.jpg',
    socialLinks: { instagram: 'lee_sb0000' } as Record<string, string>,
    region: null as string | null, debutYear: null as number | null,
    results: [] as any[],
  },
  {
    email: 'kimserin@sponpik.com', password: 'kimserin2026!',
    name: '김세린', tour: 'KLPGA',
    bio: 'KLPGA 정회원 · 2020 점프투어 시드순위전 1위 · 주니어부터 다수 입상.',
    affiliation: 'KLPGA 정회원',
    education: null as string | null,
    awards: '2020 KLPGA 점프투어 시드순위전 1위 · 2021 백제cc 점프투어 4차 3위 · 2013 KYGA 배스컨배 우승 외 입상 다수',
    career: null as string | null,
    profileImageUrl: '/golfers/kim-serin.jpg',
    socialLinks: { instagram: 'allbyselin' } as Record<string, string>,
    region: null as string | null, debutYear: null as number | null,
    results: [
      { eventName: '2021 KLPGA XGOLF 백제cc 점프투어 4차', eventDate: '2021-05-15', tour: 'KLPGA 점프투어', category: '점프투어', rank: 3, summary: '3위.' },
      { eventName: '2020 KLPGA 파워풀엑스·솔라고 점프투어 시드순위전', eventDate: '2020-11-15', tour: 'KLPGA 점프투어', category: '시드순위전', rank: 1, summary: '1위.' },
      { eventName: '2017 중고골프연맹 제28회 그린배', eventDate: '2017-06-15', tour: '아마추어', category: '아마추어', rank: 5, summary: '5위.' },
      { eventName: '2016 KYGA 제5회 배스컨배', eventDate: '2016-06-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
      { eventName: '2015 KYGA 제10회 회장배', eventDate: '2015-07-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
      { eventName: '2015 KYGA 제7회 자마골프배', eventDate: '2015-06-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
      { eventName: '2013 KLPGA 회장배', eventDate: '2013-08-15', tour: 'KLPGA', category: '아마추어', rank: 3, summary: '3위.' },
      { eventName: '2013 KYGA 제2회 제임스밀러배', eventDate: '2013-06-15', tour: '아마추어', category: '주니어', rank: 2, summary: '준우승.' },
      { eventName: '2013 KYGA 제2회 배스컨배', eventDate: '2013-05-15', tour: '아마추어', category: '주니어', rank: 1, summary: '우승.' },
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
    create.passwordHash = await bcrypt.hash(A.password || ('ph-' + A.email), 12);
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
        data: { athleteId: id, eventName: r.eventName, eventDate: new Date(r.eventDate), tour: r.tour, category: r.category, rank: r.rank, score: null, summary: r.summary, source: 'MANUAL', status: 'APPROVED' },
      });
    }
    console.log(`✅ ${A.name} (${A.email}) id=${id} | 입상 ${A.results.length}건`);
  }
  console.log('\n현재 선수 수:', await prisma.athlete.count());
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

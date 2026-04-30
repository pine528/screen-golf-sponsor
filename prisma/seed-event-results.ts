/**
 * 5명 선수 경기결과 시드 (docx 3-6)
 * PDF 이력 정보 + 가상의 GTOUR 경기결과
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RESULTS: Record<string, any[]> = {
  '안예인': [
    { eventName: '2026 KLPGA 시즌 오픈전', eventDate: '2026-04-12', category: '정규투어', rank: 14, score: '-3 (69-72-71-71)', totalRounds: 4, summary: '바람 영향에도 안정적인 아이언샷으로 컷 통과 후 14위 마무리.', source: 'MANUAL' },
    { eventName: '2026 SBSGOLF 골프클리닉 시범경기', eventDate: '2026-03-08', category: '시범경기', rank: 3, score: 'E', totalRounds: 1, summary: '드라이버 평균 235m, 그린 적중률 78%로 3위.', source: 'GTOUR_API' },
    { eventName: '2025 KLPGA 챔피언십', eventDate: '2025-09-21', category: '메이저', rank: 28, score: '+2', totalRounds: 4, summary: '메이저 첫 출전 컷 통과.', source: 'MANUAL' },
    { eventName: '2018 KLPGA 점프투어 4차전', eventDate: '2018-07-14', category: '점프투어', rank: 3, score: '-5', totalRounds: 3, summary: '데뷔 시즌 첫 톱10 진입.', source: 'MANUAL' },
  ],
  '배진리': [
    { eventName: '2025 WGTOUR 1차', eventDate: '2025-11-05', category: '정규투어', rank: 2, score: '-9 (66-67-67)', totalRounds: 3, summary: '최종일 -3 마무리, 아쉬운 2위.', source: 'GTOUR_API' },
    { eventName: '2024 골프존방송 뉴페이스', eventDate: '2024-10-15', category: '시범경기', rank: 6, score: 'E', totalRounds: 1, summary: '신인 종합 6위.', source: 'MANUAL' },
    { eventName: '2023 KLPGA 드림투어 5차전', eventDate: '2023-06-22', category: '드림투어', rank: 7, score: '-2', totalRounds: 2, summary: '꾸준한 톱10권 성적.', source: 'MANUAL' },
  ],
  '송유나': [
    { eventName: '2026 르꼬끄 골프 앰버서더 인비테이셔널', eventDate: '2026-04-02', category: '시범경기', rank: 5, score: '-4', totalRounds: 2, summary: '앰버서더 자격으로 출전, 5위.', source: 'MANUAL' },
    { eventName: '2021 KLPGA 그랜드삼대인 점프투어 8차', eventDate: '2021-08-30', category: '점프투어', rank: 2, score: '-6', totalRounds: 3, summary: '준우승, 시드권 확보.', source: 'MANUAL' },
    { eventName: '2016 용인대총장배', eventDate: '2016-05-20', category: '아마추어', rank: 1, score: '-7', totalRounds: 2, summary: '대회 우승.', source: 'MANUAL' },
  ],
  '오세희': [
    { eventName: '2024 SG 펀펀매치', eventDate: '2024-12-10', category: '예능경기', rank: 1, score: '-3', totalRounds: 1, summary: '시즌 펀펀매치 우승.', source: 'MANUAL' },
    { eventName: '2024 SBSGOLF 더매치', eventDate: '2024-08-05', category: '예능경기', rank: 4, score: 'E', totalRounds: 1, summary: '4강 진출.', source: 'MANUAL' },
    { eventName: '2016 Hurricane 미국 전국 시합', eventDate: '2016-07-12', category: '주니어', rank: 1, score: '-12', totalRounds: 3, summary: '미국 주니어 전국 우승.', source: 'MANUAL' },
  ],
  '이예빈': [
    { eventName: '2026 SG 펀펀매치 8차', eventDate: '2026-04-15', category: '예능경기', rank: 8, score: '+1', totalRounds: 1, summary: '8회차 진출.', source: 'MANUAL' },
    { eventName: '2025 SG 더매치 챔피언십', eventDate: '2025-11-20', category: '챔피언십', rank: 12, score: 'E', totalRounds: 2, summary: '컷 통과 후 12위.', source: 'MANUAL' },
    { eventName: '2022 KLPGA 솔라고 점프투어', eventDate: '2022-09-08', category: '점프투어', rank: 3, score: '-4', totalRounds: 2, summary: '톱3 진입, 다음 시즌 시드 확보.', source: 'MANUAL' },
  ],
};

async function main() {
  console.log('🌱 5명 선수 경기결과 시드 시작...\n');

  let totalCount = 0;
  for (const [athleteName, results] of Object.entries(RESULTS)) {
    const athlete = await prisma.athlete.findFirst({ where: { name: athleteName } });
    if (!athlete) {
      console.log(`⚠️ ${athleteName} 없음, 스킵`);
      continue;
    }

    // 기존 시드된 결과 모두 삭제 후 재생성 (중복 방지 + 깔끔)
    await prisma.athleteEventResult.deleteMany({
      where: { athleteId: athlete.id, source: { in: ['MANUAL', 'GTOUR_API'] } },
    });

    for (const r of results) {
      await prisma.athleteEventResult.create({
        data: {
          athleteId: athlete.id,
          eventName: r.eventName,
          eventDate: new Date(r.eventDate),
          category: r.category,
          rank: r.rank,
          score: r.score,
          totalRounds: r.totalRounds,
          summary: r.summary,
          source: r.source,
        },
      });
      totalCount++;
    }
    console.log(`✅ ${athleteName} → ${results.length}건`);
  }

  console.log(`\n✨ 총 ${totalCount}건 시드 완료`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

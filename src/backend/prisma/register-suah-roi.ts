/**
 * 김수아 × 엘렌실라 방송 노출 ROI → AthleteMediaExposure 등록
 * 출처: 2026 S-OIL SEVEN GTOUR MIXED 4차 파이널 라운드 중계 영상
 *       InsightFace 얼굴인식 + 전구간 육안 검증 (3시간38분 / 13,065프레임)
 *
 * 멱등: 동일 기간(periodStart~End) + source=AI_VIDEO 레코드 있으면 갱신, 없으면 생성
 *
 * 실행:
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/register-suah-roi.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ATHLETE_NAME = '김수아';
const DATA = {
  broadcastCount: 11,            // 검증 확정 11구간
  broadcastSeconds: 40,          // 40초
  patchExposureEstimate: 11,     // 모자 정면 엘렌실라 (전 구간 착용)
  articleMentions: 0,
  highlightCount: 2,             // 정면 클로즈업 2개 (18:27, 3:07:13)
  periodStart: '2026-05-30',
  periodEnd: '2026-05-30',
  source: 'AI_VIDEO',
  notes: '2026 S-OIL SEVEN GTOUR MIXED 4차 파이널 라운드 중계. 엘렌실라 모자정면 로고. 3시간38분 방송 중 0.31% 노출. InsightFace 얼굴인식 + 전구간 육안검증(11구간 확정).',
};

async function main() {
  console.log(`🌱 ${ATHLETE_NAME} ROI → 미디어노출지수 등록...\n`);

  const athlete = await prisma.athlete.findFirst({ where: { name: ATHLETE_NAME }, select: { id: true } });
  if (!athlete) { console.error(`❌ ${ATHLETE_NAME} 없음`); process.exit(1); }

  // 멱등: 동일 기간 + AI_VIDEO 레코드 있으면 갱신
  const existing = await prisma.athleteMediaExposure.findFirst({
    where: {
      athleteId: athlete.id,
      source: DATA.source,
      periodStart: new Date(DATA.periodStart),
      periodEnd: new Date(DATA.periodEnd),
    },
  });

  if (existing) {
    await prisma.athleteMediaExposure.update({
      where: { id: existing.id },
      data: {
        broadcastCount: DATA.broadcastCount,
        broadcastSeconds: DATA.broadcastSeconds,
        patchExposureEstimate: DATA.patchExposureEstimate,
        articleMentions: DATA.articleMentions,
        highlightCount: DATA.highlightCount,
        notes: DATA.notes,
      },
    });
    console.log(`♻️  기존 레코드 갱신 (id: ${existing.id})`);
  } else {
    const rec = await prisma.athleteMediaExposure.create({
      data: {
        athleteId: athlete.id,
        broadcastCount: DATA.broadcastCount,
        broadcastSeconds: DATA.broadcastSeconds,
        patchExposureEstimate: DATA.patchExposureEstimate,
        articleMentions: DATA.articleMentions,
        highlightCount: DATA.highlightCount,
        periodStart: new Date(DATA.periodStart),
        periodEnd: new Date(DATA.periodEnd),
        source: DATA.source,
        notes: DATA.notes,
      },
    });
    console.log(`✅ 신규 등록 (id: ${rec.id})`);
  }

  console.log(`   중계 ${DATA.broadcastCount}회 · ${DATA.broadcastSeconds}초 · 패치 ${DATA.patchExposureEstimate}회 · 하이라이트 ${DATA.highlightCount}회`);
  console.log(`\n✨ 완료. 선수 상세 → 미디어노출지수 카드에 반영됨.`);
}

main()
  .catch((e) => { console.error('❌ 등록 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

/**
 * FollowerSnapshot 서비스 (docx §6 C-3 팬덤지수 - 최근 증가율)
 *
 * - 일 1회 cron 으로 모든 active 선수의 YouTube 구독자 수 스냅샷 저장
 * - 증가율 계산: (현재 - 7일 전) / 7일 전 * 100
 *
 * 향후 Instagram, Twitter 등 source 확장 가능.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type FollowerSource = 'YOUTUBE' | 'INSTAGRAM' | 'TWITTER';

export async function captureSnapshot(athleteId: string, source: FollowerSource, followerCount: number, totalViews?: number | bigint) {
  // 같은 시각 중복 저장 방지 (시간을 분 단위로 자르기)
  const now = new Date();
  now.setSeconds(0, 0);
  return prisma.athleteFollowerSnapshot.upsert({
    where: {
      athleteId_source_capturedAt: { athleteId, source, capturedAt: now },
    },
    update: { followerCount, totalViews: totalViews ? BigInt(totalViews) : null },
    create: {
      athleteId,
      source,
      followerCount,
      totalViews: totalViews ? BigInt(totalViews) : null,
      capturedAt: now,
    },
  });
}

/**
 * 최근 N일 동안의 팔로워 증가율 계산 (%)
 * 비교 대상: 가장 최근 스냅샷 vs N일 전 스냅샷
 */
export async function getGrowthRate(athleteId: string, source: FollowerSource = 'YOUTUBE', daysAgo = 7): Promise<number | null> {
  const latest = await prisma.athleteFollowerSnapshot.findFirst({
    where: { athleteId, source },
    orderBy: { capturedAt: 'desc' },
  });
  if (!latest) return null;

  const cutoff = new Date(latest.capturedAt.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const past = await prisma.athleteFollowerSnapshot.findFirst({
    where: { athleteId, source, capturedAt: { lte: cutoff } },
    orderBy: { capturedAt: 'desc' },
  });
  if (!past || past.followerCount === 0) return null;

  const growth = ((latest.followerCount - past.followerCount) / past.followerCount) * 100;
  return Number(growth.toFixed(2));
}

/**
 * cron job - 모든 active 선수의 YouTube 구독자 수 스냅샷
 */
export async function captureAllAthleteFollowers() {
  const athletes = await prisma.athlete.findMany({
    where: { isActive: true, kycStatus: 'APPROVED' },
    include: { youtubeChannel: true },
  });

  let captured = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    if (athlete.youtubeChannel?.subscriberCount != null) {
      try {
        await captureSnapshot(
          athlete.id,
          'YOUTUBE',
          athlete.youtubeChannel.subscriberCount,
          athlete.youtubeChannel.totalViews ?? undefined,
        );
        captured++;
      } catch (e) {
        console.error(`[followerSnapshot] ${athlete.id} 실패:`, e);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`[followerSnapshot] 캡처 ${captured}명, 건너뜀 ${skipped}명`);
  return { captured, skipped };
}

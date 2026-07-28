/**
 * MediaExposure 서비스 (docx §6 C-1 미구현 항목 보강)
 *
 * - 관리자가 수동 입력 (방송 중계, 패치 노출, 하이라이트 등)
 * - 또는 GTOUR API / 크롤러 / AI 영상 분석 결과 누적
 *
 * ROI 대시보드의 mediaExposure 항목은 모든 active 레코드의 합계로 계산.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface MediaExposureInput {
  athleteId: string;
  broadcastCount?: number;
  broadcastSeconds?: number;
  patchExposureEstimate?: number;
  articleMentions?: number;
  highlightCount?: number;
  periodStart: Date | string;
  periodEnd: Date | string;
  source?: string;  // MANUAL | GTOUR_API | CRAWLER | AI_VIDEO
  notes?: string;
}

export async function createMediaExposure(input: MediaExposureInput) {
  return prisma.athleteMediaExposure.create({
    data: {
      athleteId: input.athleteId,
      broadcastCount: input.broadcastCount ?? 0,
      broadcastSeconds: input.broadcastSeconds ?? 0,
      patchExposureEstimate: input.patchExposureEstimate ?? 0,
      articleMentions: input.articleMentions ?? 0,
      highlightCount: input.highlightCount ?? 0,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      source: input.source ?? 'MANUAL',
      notes: input.notes,
    },
  });
}

export async function listMediaExposures(athleteId: string) {
  return prisma.athleteMediaExposure.findMany({
    where: { athleteId },
    orderBy: { periodEnd: 'desc' },
  });
}

export async function updateMediaExposure(id: string, input: Partial<MediaExposureInput>) {
  const data: any = {};
  if (input.broadcastCount != null) data.broadcastCount = input.broadcastCount;
  if (input.broadcastSeconds != null) data.broadcastSeconds = input.broadcastSeconds;
  if (input.patchExposureEstimate != null) data.patchExposureEstimate = input.patchExposureEstimate;
  if (input.articleMentions != null) data.articleMentions = input.articleMentions;
  if (input.highlightCount != null) data.highlightCount = input.highlightCount;
  if (input.periodStart) data.periodStart = new Date(input.periodStart);
  if (input.periodEnd) data.periodEnd = new Date(input.periodEnd);
  if (input.source) data.source = input.source;
  if (input.notes !== undefined) data.notes = input.notes;
  return prisma.athleteMediaExposure.update({ where: { id }, data });
}

export async function deleteMediaExposure(id: string) {
  return prisma.athleteMediaExposure.delete({ where: { id } });
}

/**
 * ROI 대시보드 — 미디어노출 누적 합계
 * 모든 레코드를 합산 (시기별 누적)
 */
export async function aggregateMediaExposure(athleteId: string) {
  const agg = await prisma.athleteMediaExposure.aggregate({
    where: { athleteId },
    _sum: {
      broadcastCount: true,
      broadcastSeconds: true,
      patchExposureEstimate: true,
      articleMentions: true,
      highlightCount: true,
    },
    _count: { _all: true },
  });

  if (agg._count._all === 0) {
    return null;  // 데이터 없음 (수집 전)
  }

  return {
    broadcastCount: agg._sum.broadcastCount ?? 0,
    broadcastSeconds: agg._sum.broadcastSeconds ?? 0,
    patchExposureEstimate: agg._sum.patchExposureEstimate ?? 0,
    articleMentions: agg._sum.articleMentions ?? 0,
    highlightCount: agg._sum.highlightCount ?? 0,
    recordCount: agg._count._all,
  };
}

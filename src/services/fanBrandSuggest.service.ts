/**
 * 팬의 브랜드 추천 (핸드오프 v1.0 §9.1)
 *
 *  - 추천 이유 50~500자, 제품·선수 적합성 중심
 *  - 이해관계(본인/가족/소속) 자가표시 필수
 *  - 기본 비공개, 승인된 요약만 공개
 *  - 상태: 접수 → 검토 → 전달 → 관심 → 채택/보류/종료
 */
import { PrismaClient } from '@prisma/client';
import { record } from './fanHub.service';

const prisma = new PrismaClient();

export const SUGGEST_CATEGORIES = [
  '건강 · 뷰티', '골프 · 스포츠', '라이프스타일', '푸드', '테크', '패션 · 잡화',
];

/** 이해관계 자가표시 (§9.1) */
export const INTERESTS = [
  { code: 'NONE', label: '해당 없음', desc: '추천 브랜드와 아무 관계가 없습니다' },
  { code: 'SELF', label: '본인 사업', desc: '제가 운영하거나 지분을 가진 브랜드입니다' },
  { code: 'FAMILY', label: '가족·지인', desc: '가족이나 가까운 지인이 운영합니다' },
  { code: 'AFFILIATED', label: '소속·거래', desc: '재직 중이거나 거래 관계가 있습니다' },
] as const;

/** 파이프라인 (§9.1) */
export const PIPELINE = [
  { code: 'RECEIVED', label: '접수', desc: '추천이 등록되었습니다' },
  { code: 'REVIEWING', label: '검토', desc: '운영팀이 적합성을 확인하고 있습니다' },
  { code: 'DELIVERED', label: '브랜드 전달', desc: '브랜드 담당자에게 전달되었습니다' },
  { code: 'INTERESTED', label: '브랜드 관심', desc: '브랜드가 검토 의사를 밝혔습니다' },
  { code: 'ADOPTED', label: '채택', desc: '실제 제안·계약으로 이어졌습니다' },
] as const;

const TERMINAL: Record<string, string> = { HOLD: '보류', CLOSED: '종료' };

/** 구 데이터 호환 */
const normalize = (s: string) =>
  s === 'PENDING' ? 'RECEIVED' : s === 'ACCEPTED' ? 'ADOPTED' : s === 'REJECTED' ? 'CLOSED' : s;

const MIN_REASON = 50;
const MAX_REASON = 500;
const MONTHLY_LIMIT = 3;

export async function getOptions(userId?: string) {
  let used = 0;
  if (userId) {
    const monthStart = new Date(`${new Date().toISOString().slice(0, 7)}-01`);
    used = await prisma.fanBrandSuggestion.count({
      where: { fanUserId: userId, createdAt: { gte: monthStart } },
    });
  }
  return {
    categories: SUGGEST_CATEGORIES,
    interests: INTERESTS,
    pipeline: PIPELINE,
    reason: { min: MIN_REASON, max: MAX_REASON },
    quota: { used, limit: MONTHLY_LIMIT, remaining: Math.max(0, MONTHLY_LIMIT - used) },
    notices: [
      '추천은 브랜드에게 익명 인사이트로 전달되며, 팬의 개인정보는 제공되지 않습니다.',
      '추천이 곧 계약을 보장하지는 않습니다. 브랜드의 검토 결과에 따라 종료될 수 있습니다.',
      '이해관계를 사실과 다르게 표시하면 추천이 무효 처리되고 포인트가 회수될 수 있습니다.',
    ],
  };
}

export async function create(input: {
  userId: string; athleteId: string; category: string;
  brandName?: string; reason: string; interest: string; isPublic?: boolean;
}) {
  if (!input.category) throw Object.assign(new Error('카테고리를 선택해주세요'), { status: 400 });
  if (!INTERESTS.some((i) => i.code === input.interest)) {
    throw Object.assign(new Error('이해관계 여부를 선택해주세요'), { status: 400 });
  }
  const reason = (input.reason || '').trim();
  if (reason.length < MIN_REASON) {
    throw Object.assign(new Error(`추천 이유를 ${MIN_REASON}자 이상 작성해주세요`), { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId }, select: { id: true } });
  if (!athlete) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });

  const monthStart = new Date(`${new Date().toISOString().slice(0, 7)}-01`);
  const used = await prisma.fanBrandSuggestion.count({
    where: { fanUserId: input.userId, createdAt: { gte: monthStart } },
  });
  if (used >= MONTHLY_LIMIT) {
    throw Object.assign(new Error(`브랜드 추천은 월 ${MONTHLY_LIMIT}건까지 가능합니다`), { status: 429, code: 'MONTHLY_LIMIT' });
  }

  /* 같은 선수 · 같은 브랜드 중복 추천 방지 (§9.1 중복 자동검사) */
  if (input.brandName?.trim()) {
    const dup = await prisma.fanBrandSuggestion.findFirst({
      where: {
        athleteId: input.athleteId, fanUserId: input.userId,
        brandName: input.brandName.trim().slice(0, 60),
      },
    });
    if (dup) throw Object.assign(new Error('이미 같은 브랜드를 추천했습니다'), { status: 409, code: 'DUPLICATE' });
  }

  const suggestion = await prisma.fanBrandSuggestion.create({
    data: {
      athleteId: input.athleteId,
      fanUserId: input.userId,
      category: input.category,
      brandName: input.brandName?.trim().slice(0, 60),
      reason: reason.slice(0, MAX_REASON),
      interest: input.interest,
      isPublic: input.isPublic ?? false,
      status: 'RECEIVED',
    },
  });

  /* 이해관계가 있는 추천은 검토 전까지 온도·포인트에 반영하지 않는다 */
  const res = input.interest === 'NONE'
    ? await record({
        userId: input.userId, athleteId: input.athleteId,
        source: 'BRAND_SUGGEST', refType: 'BRAND_SUGGESTION', refId: suggestion.id,
        pointCode: 'BRAND_SUGGEST',
      })
    : { logged: false, point: { earned: 0, reason: 'REVIEW_REQUIRED' as const } };

  return {
    suggestion: shape(suggestion),
    point: res.point,
    remaining: MONTHLY_LIMIT - used - 1,
    reviewRequired: input.interest !== 'NONE',
  };
}

function shape(s: any) {
  const status = normalize(s.status);
  const stageIndex = PIPELINE.findIndex((p) => p.code === status);
  return {
    id: s.id,
    category: s.category,
    brandName: s.brandName,
    reason: s.reason,
    interest: s.interest,
    isPublic: s.isPublic,
    status,
    statusLabel: PIPELINE.find((p) => p.code === status)?.label ?? TERMINAL[status] ?? status,
    statusNote: s.statusNote,
    stageIndex, // -1 이면 보류·종료
    totalStages: PIPELINE.length,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
  };
}

/** 내가 낸 추천 목록 (F14) */
export async function listMine(userId: string) {
  const rows = await prisma.fanBrandSuggestion.findMany({
    where: { fanUserId: userId },
    orderBy: { createdAt: 'desc' },
    include: { athlete: { select: { id: true, name: true, profileImageUrl: true, tour: true } } },
  });
  return {
    suggestions: rows.map((r) => ({ ...shape(r), athlete: r.athlete })),
    pipeline: PIPELINE,
  };
}

/** 선수별 추천 현황 — 공개 요약만 (§9.1 공개범위) */
export async function summaryFor(athleteId: string) {
  const rows = await prisma.fanBrandSuggestion.groupBy({
    by: ['category'],
    where: { athleteId, status: { in: ['DELIVERED', 'INTERESTED', 'ADOPTED', 'ACCEPTED'] } },
    _count: { _all: true },
  });
  const total = await prisma.fanBrandSuggestion.count({ where: { athleteId } });
  return {
    /* 검토를 통과해 브랜드에 전달된 건만 카테고리별로 공개한다 */
    categories: rows
      .map((r) => ({ category: r.category, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    total,
    notice: '접수 직후의 추천은 공개되지 않으며, 검토를 통과해 브랜드에 전달된 건만 집계에 표시됩니다.',
  };
}

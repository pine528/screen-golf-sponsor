/**
 * 팬 참여 허브 — Fan VOTE · 응원편지 · 브랜드 추천 · 연말 캠페인 · 내 팬활동
 * (핸드오프 v1.0 2026-08-22 §5 · §9 · §18)
 *
 * 팬 참여는 네 개의 메뉴가 아니라 하나의 순환 시스템이다.
 * 모든 활동은 FanTemperatureEvent(활동 원장)에 기록되고,
 * 팬온도 · 팬포인트 · 기여도가 각각 다른 규칙으로 파생된다 (§3.1).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { earn } from './fanPoint.service';
import { recomputeContribution, getTemperatureView, tierOf, computeTemperature } from './fanTemperature.service';

const prisma = new PrismaClient();

/** VOTE 유형 (§5.1) */
export const VOTE_TYPES = [
  { code: 'OX', label: '일반 OX', desc: '단일 질문', earn: 2, correctBonus: 0 },
  { code: 'MULTI', label: '4지선다', desc: '선호·의견', earn: 2, correctBonus: 0 },
  { code: 'PREDICT', label: '경기예측', desc: '순위·기록 범위', earn: 2, correctBonus: 5 },
  { code: 'BRAND', label: '브랜드 설문', desc: '제품·협업 선호', earn: 3, correctBonus: 0 },
  { code: 'PICK', label: '팬선정', desc: '응원문구·콘텐츠', earn: 2, correctBonus: 0 },
] as const;

/** 결과 공개 방식 (§5.3) */
export const RESULT_POLICIES = [
  { code: 'INSTANT', label: '즉시 공개' },
  { code: 'AFTER_VOTE', label: '투표 후 공개' },
  { code: 'AFTER_CLOSE', label: '종료 후 공개' },
] as const;

/** 초기 득표 숨김 (§5.5) — 30분 또는 30표 */
const HIDE_MINUTES = 30;
const HIDE_MIN_BALLOTS = 30;

const typeOf = (v: any): string => {
  const t = String(v.templateCode || '');
  if (t.startsWith('T1')) return 'OX';
  if (t.startsWith('T2')) return 'MULTI';
  if (t.startsWith('T3') || t.startsWith('T4')) return 'PREDICT';
  if (t.startsWith('T5')) return 'BRAND';
  if (t.startsWith('T6')) return 'PICK';
  return 'OX';
};
/** 팬 생성 VOTE 유형 → templateCode (기존 T1~T4 + 브랜드 설문·팬선정) */
const TEMPLATE_OF: Record<string, string> = { OX: 'T1-YesNo', MULTI: 'T2-MC', PREDICT: 'T3-TopN', BRAND: 'T5-Brand', PICK: 'T6-Pick' };

/** 팬 VOTE 생성 규칙 — 예전 사용자 투표 한도(하루 5개·최소 1시간)를 그대로 쓴다. 시드머니는 무료 참여 모델에서 받지 않는다 */
export const VOTE_CREATE_RULES = {
  maxDailyCreates: 5,
  minCloseHours: 1,
  maxCloseDays: 30,
  minOptions: 2,
  maxOptions: 6,
  titleMax: 80,
  hostPointsPerParticipant: 1,
  hostPerVoteCap: 50,   // 투표당 적립되는 참여자 수 상한
  hostDailyCap: 20,     // EARN_RULES.VOTE_HOST.dailyCap 와 같은 값
};

const optionLabel = (o: any) => (typeof o === 'string' ? o : o?.label ?? o?.id ?? '');

/** 결과를 지금 공개할 수 있는가 (§5.5) */
function canRevealResult(vote: any, ballots: number, voted: boolean) {
  if (vote.status === 'SETTLED' || vote.status === 'CLOSED') return true;
  const openedMin = (Date.now() - new Date(vote.createdAt).getTime()) / 60000;
  if (openedMin < HIDE_MINUTES && ballots < HIDE_MIN_BALLOTS) return false;
  return voted;
}

/* ── F02 VOTE 목록 ──────────────────────────────────── */

export async function listVotes(params: {
  tab?: string; athleteId?: string; type?: string; sort?: string; userId?: string; limit?: number; favorites?: boolean;
}) {
  const now = new Date();
  const tab = params.tab || 'OPEN';

  const where: Prisma.VoteV2WhereInput =
    tab === 'OPEN' ? { status: 'OPEN', closeAt: { gt: now } }
    : tab === 'UPCOMING' ? { status: 'OPEN', closeAt: { gt: new Date(now.getTime() + 30 * 86400_000) } }
    : tab === 'CLOSED' ? { OR: [{ status: { in: ['CLOSED', 'SETTLED'] } }, { status: 'OPEN', closeAt: { lte: now } }] }
    : {};

  const rows = await prisma.voteV2.findMany({
    where,
    orderBy: params.sort === 'CLOSING' ? { closeAt: 'asc' } : params.sort === 'LATEST' ? { createdAt: 'desc' } : { closeAt: 'desc' },
    take: Math.min(params.limit ?? 30, 60),
    include: { _count: { select: { participations: true } } },
  });

  /* 내 참여 탭 */
  let myVoteIds: string[] = [];
  if (params.userId) {
    const mine = await prisma.voteParticipationV2.findMany({
      where: { userId: params.userId }, select: { voteId: true },
    });
    myVoteIds = mine.map((m) => m.voteId);
  }

  let list = rows;
  if (tab === 'MINE') {
    list = await prisma.voteV2.findMany({
      where: { id: { in: myVoteIds } },
      orderBy: { closeAt: 'desc' },
      include: { _count: { select: { participations: true } } },
      take: 60,
    });
  }

  /* 대상 선수 붙이기 */
  const athleteIds = [...new Set(list.map((v) => (v.target as any)?.playerId).filter(Boolean))] as string[];
  const athletes = athleteIds.length
    ? await prisma.athlete.findMany({
        where: { id: { in: athleteIds } },
        select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true },
      })
    : [];
  const aMap = new Map(athletes.map((a) => [a.id, a]));

  let shaped = list.map((v) => {
    const t = typeOf(v);
    const def = VOTE_TYPES.find((x) => x.code === t)!;
    const athleteId = (v.target as any)?.playerId as string | undefined;
    const closed = v.status !== 'OPEN' || new Date(v.closeAt) <= now;
    return {
      id: v.id,
      title: v.title,
      description: v.description,
      type: t,
      typeLabel: def.label,
      athlete: athleteId ? aMap.get(athleteId) ?? null : null,
      options: (v.options as any[]).map(optionLabel),
      closeAt: v.closeAt,
      closed,
      remainMs: Math.max(0, new Date(v.closeAt).getTime() - now.getTime()),
      participants: v._count.participations,
      earnPoints: def.earn,
      correctBonus: def.correctBonus,
      resultPolicy: t === 'PREDICT' ? 'AFTER_CLOSE' : 'AFTER_CLOSE',
      voted: myVoteIds.includes(v.id),
      createdByMe: !!params.userId && v.createdBy === params.userId,
      status: v.status,
    };
  });

  if (params.athleteId) shaped = shaped.filter((v) => v.athlete?.id === params.athleteId);
  if (params.type && params.type !== 'ALL') shaped = shaped.filter((v) => v.type === params.type);
  /* 관심선수 필터 — 계정 단위 관심 선수 */
  if (params.favorites && params.userId) {
    const favs = await prisma.userFavoriteAthlete.findMany({ where: { userId: params.userId }, select: { athleteId: true } });
    const set = new Set(favs.map((f) => f.athleteId));
    shaped = shaped.filter((v) => v.athlete && set.has(v.athlete.id));
  }
  if (params.sort === 'POPULAR') shaped.sort((a, b) => b.participants - a.participants);

  /* 탭 카운트 */
  const [openCount, closedCount] = await Promise.all([
    prisma.voteV2.count({ where: { status: 'OPEN', closeAt: { gt: now } } }),
    prisma.voteV2.count({ where: { OR: [{ status: { in: ['CLOSED', 'SETTLED'] } }, { status: 'OPEN', closeAt: { lte: now } }] } }),
  ]);

  const createdCount = params.userId ? await prisma.voteV2.count({ where: { createdBy: params.userId, status: { not: 'CANCELED' } } }) : 0;
  return {
    votes: shaped,
    counts: { OPEN: openCount, UPCOMING: 0, CLOSED: closedCount, MINE: myVoteIds.length, CREATED: createdCount },
    types: VOTE_TYPES,
    notice: '공정한 팬 참여를 위해 1인 1표 원칙을 지킵니다. 예측형 투표는 변경 마감 시간 이후 수정이 불가합니다.',
  };
}

/* ── F03 VOTE 상세 · F04 결과 ───────────────────────── */

export async function getVote(voteId: string, userId?: string) {
  const vote = await prisma.voteV2.findUnique({
    where: { id: voteId },
    include: { _count: { select: { participations: true } } },
  });
  if (!vote) return null;

  const t = typeOf(vote);
  const def = VOTE_TYPES.find((x) => x.code === t)!;
  const athleteId = (vote.target as any)?.playerId as string | undefined;
  const now = new Date();
  const closed = vote.status !== 'OPEN' || new Date(vote.closeAt) <= now;

  const [athlete, mine, tally] = await Promise.all([
    athleteId
      ? prisma.athlete.findUnique({
          where: { id: athleteId },
          select: { id: true, name: true, tour: true, profileImageUrl: true, region: true, sportType: true },
        })
      : Promise.resolve(null),
    userId
      ? prisma.voteParticipationV2.findUnique({ where: { voteId_userId: { voteId, userId } } })
      : Promise.resolve(null),
    prisma.voteParticipationV2.groupBy({ by: ['answer'], where: { voteId }, _count: { _all: true } }),
  ]);

  const options = (vote.options as any[]).map(optionLabel);
  const total = vote._count.participations;
  const reveal = canRevealResult(vote, total, !!mine);

  const results = reveal
    ? options.map((label, i) => {
        const c = tally.find((x) => JSON.stringify(x.answer) === JSON.stringify(label) || JSON.stringify(x.answer) === JSON.stringify(i));
        const n = c?._count._all ?? 0;
        return { label, count: n, percent: total ? Math.round((n / total) * 1000) / 10 : 0 };
      })
    : null;

  /* 선수 팬온도 · 최근 성적 (§F03 시안) */
  let temperature: any = null;
  let recentResults: any[] = [];
  if (athleteId) {
    const [tv, rs] = await Promise.all([
      getTemperatureView(athleteId).catch(() => null),
      prisma.athleteEventResult.findMany({
        where: { athleteId, status: 'APPROVED' },
        orderBy: { eventDate: 'desc' }, take: 5,
        select: { eventName: true, eventDate: true, rank: true },
      }),
    ]);
    temperature = tv ? { score: tv.score, tier: tv.tier, lowSample: tv.lowSample } : null;
    recentResults = rs;
  }

  const ranked = recentResults.filter((r) => r.rank != null);

  return {
    id: vote.id,
    title: vote.title,
    description: vote.description,
    type: t,
    typeLabel: def.label,
    options,
    athlete,
    temperature,
    closeAt: vote.closeAt,
    closed,
    remainMs: Math.max(0, new Date(vote.closeAt).getTime() - now.getTime()),
    participants: total,
    earnPoints: def.earn,
    correctBonus: def.correctBonus,
    /* 예측형은 티오프 전까지 1회 변경 가능 (§5.5) */
    changeable: t === 'PREDICT' && !closed,
    myAnswer: mine ? optionLabel(mine.answer) : null,
    myCorrect: mine?.isCorrect ?? null,
    voted: !!mine,
    results,
    resultHidden: !reveal,
    resultHiddenReason: !reveal
      ? (mine ? '최소 표본 충족 후 결과가 공개됩니다.' : '투표에 참여하면 결과를 확인할 수 있습니다.')
      : null,
    correctAnswer: vote.status === 'SETTLED' ? optionLabel(vote.correctAnswer) : null,
    recentSummary: ranked.length
      ? {
          avgRank: Math.round(ranked.reduce((s, r) => s + r.rank!, 0) / ranked.length * 10) / 10,
          top10: ranked.filter((r) => r.rank! <= 10).length,
          results: recentResults,
        }
      : null,
    guides: [
      { title: '1계정 1회 투표 원칙', desc: '하나의 계정으로 한 번만 투표할 수 있습니다.' },
      { title: t === 'PREDICT' ? '투표 변경 가능' : '투표 변경 불가', desc: t === 'PREDICT' ? '해당 대회 티오프 전까지 선택을 변경할 수 있습니다.' : '제출 후에는 선택을 변경할 수 없습니다.' },
      { title: '결과 검증 후 포인트 지급', desc: '공식 기록 기준으로 결과가 확정된 후 포인트가 지급됩니다.' },
    ],
  };
}

/* ── 팬 VOTE 생성 · 내가 만든 투표 (시안 2026-09-15 "투표 만들기") ─────────────────────
 * 예전 사용자 투표 기능(voteV2 createUserVote)의 한도(하루 5개·최소 1시간 뒤 마감)와
 * "다른 팬이 참여하면 개설자에게 적립 + 한계치" 규칙을 무료 참여 모델에 맞게 옮겼다.
 * 시드머니·에스크로는 받지 않는다. 예측형 정답은 개설자가 종료 후 입력하고, 정답자에게 VOTE_CORRECT가 적립된다.
 */

/** 개설자 적립 — 참여자당 +1P, 투표당 50명·일 20건 상한. 중복은 (refType, refId) 유니크로 막힌다 */
async function rewardHost(vote: any, participantUserId: string) {
  if (!vote.createdBy || vote.createdBy === participantUserId) return { earned: 0, reason: 'SKIP' };
  const perVote = await prisma.pointLedgerTx.count({
    where: { userId: vote.createdBy, refType: 'VOTE_HOST', refId: { startsWith: `${vote.id}:` }, delta: { gt: 0 } },
  });
  if (perVote >= VOTE_CREATE_RULES.hostPerVoteCap) return { earned: 0, reason: 'VOTE_CAP' };
  return earn({
    userId: vote.createdBy, code: 'VOTE_HOST', refType: 'VOTE_HOST', refId: `${vote.id}:${participantUserId}`,
    description: `내가 만든 VOTE에 참여: ${vote.title}`,
  });
}

const BAD_TEXT: { re: RegExp; reason: string }[] = [
  { re: /01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/, reason: '전화번호는 넣을 수 없습니다' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: '이메일 주소는 넣을 수 없습니다' },
  { re: /(카톡|카카오톡|텔레그램|디엠|dm)\s*(아이디|id|주세요|알려)/i, reason: '외부 연락처 요청은 넣을 수 없습니다' },
  { re: /(돈|현금|송금|후원금)\s*(주세요|보내|요구)/, reason: '금전 요구는 넣을 수 없습니다' },
];

export async function getCreateOptions(userId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const created = await prisma.voteV2.count({ where: { createdBy: userId, createdAt: { gte: today }, status: { not: 'CANCELED' } } });
  const hostRule = (await import('./fanPoint.service')).EARN_RULES.find((r) => r.code === 'VOTE_HOST');
  return {
    types: VOTE_TYPES,
    rules: VOTE_CREATE_RULES,
    todayCreated: created,
    remainingToday: Math.max(0, VOTE_CREATE_RULES.maxDailyCreates - created),
    hostRule: hostRule ? { points: hostRule.points, limit: hostRule.limit } : null,
    presets: {
      PREDICT: [['1위', '2~5위', '6~10위', '11위 이하'], ['TOP 10 진입', 'TOP 10 실패'], ['컷 통과', '컷 탈락']],
      OX: [['O', 'X']],
    },
  };
}

export async function createFanVote(userId: string, input: {
  type: string; title: string; description?: string; options?: string[]; athleteId?: string; closeAt: string;
}) {
  const type = String(input.type || '').toUpperCase();
  const def = VOTE_TYPES.find((t) => t.code === type);
  if (!def) throw Object.assign(new Error('투표 유형을 선택해주세요'), { status: 400 });

  const title = String(input.title || '').trim();
  if (title.length < 5 || title.length > VOTE_CREATE_RULES.titleMax) {
    throw Object.assign(new Error(`질문은 5~${VOTE_CREATE_RULES.titleMax}자로 적어주세요`), { status: 400 });
  }
  const description = input.description ? String(input.description).trim().slice(0, 300) : null;
  for (const p of BAD_TEXT) {
    if (p.re.test(title) || (description && p.re.test(description))) throw Object.assign(new Error(p.reason), { status: 400 });
  }

  let options: { id: string; label: string }[];
  if (type === 'OX') {
    options = [{ id: 'O', label: 'O' }, { id: 'X', label: 'X' }];
  } else {
    const labels = (input.options || []).map((o) => String(o || '').trim()).filter(Boolean);
    const uniq = [...new Set(labels)];
    if (uniq.length < VOTE_CREATE_RULES.minOptions || uniq.length > VOTE_CREATE_RULES.maxOptions) {
      throw Object.assign(new Error(`선택지는 ${VOTE_CREATE_RULES.minOptions}~${VOTE_CREATE_RULES.maxOptions}개여야 합니다`), { status: 400 });
    }
    if (uniq.some((l) => l.length > 30)) throw Object.assign(new Error('선택지는 30자 이내로 적어주세요'), { status: 400 });
    options = uniq.map((label, i) => ({ id: String(i + 1), label }));
  }

  const closeAt = new Date(input.closeAt);
  if (Number.isNaN(closeAt.getTime())) throw Object.assign(new Error('마감 시간을 선택해주세요'), { status: 400 });
  const now = Date.now();
  if (closeAt.getTime() < now + VOTE_CREATE_RULES.minCloseHours * 3600_000) {
    throw Object.assign(new Error(`마감은 최소 ${VOTE_CREATE_RULES.minCloseHours}시간 뒤여야 합니다`), { status: 400 });
  }
  if (closeAt.getTime() > now + VOTE_CREATE_RULES.maxCloseDays * 86400_000) {
    throw Object.assign(new Error(`마감은 최대 ${VOTE_CREATE_RULES.maxCloseDays}일 안이어야 합니다`), { status: 400 });
  }

  let target: any = {};
  if (input.athleteId) {
    const a = await prisma.athlete.findFirst({ where: { id: input.athleteId, isActive: true }, select: { id: true } });
    if (!a) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });
    target = { playerId: a.id };
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const created = await prisma.voteV2.count({ where: { createdBy: userId, createdAt: { gte: today }, status: { not: 'CANCELED' } } });
  if (created >= VOTE_CREATE_RULES.maxDailyCreates) {
    throw Object.assign(new Error(`하루 최대 ${VOTE_CREATE_RULES.maxDailyCreates}개까지 투표를 만들 수 있습니다. 내일 다시 시도해주세요.`), { status: 429 });
  }

  const vote = await prisma.voteV2.create({
    data: {
      templateCode: TEMPLATE_OF[type],
      title, description,
      options: options as any,
      status: 'OPEN',
      fundingSource: 'USER_POINTS', // 무료 참여 — 리워드풀 소액 보상을 쓰지 않는다
      rewardBudgetEp: 0n, escrowEp: 0n, maxPerWinnerEp: 0n,
      target,
      outcomeSource: 'creator',
      closeAt,
      createdBy: userId,
    },
  });
  return { id: vote.id, title: vote.title, type, closeAt: vote.closeAt };
}

export async function listMyVotes(userId: string) {
  const rows = await prisma.voteV2.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { participations: true } } },
  });
  const athleteIds = [...new Set(rows.map((v) => (v.target as any)?.playerId).filter(Boolean))] as string[];
  const athletes = athleteIds.length
    ? await prisma.athlete.findMany({ where: { id: { in: athleteIds } }, select: { id: true, name: true, tour: true, profileImageUrl: true } })
    : [];
  const aMap = new Map(athletes.map((a) => [a.id, a]));
  const hostTx = await prisma.pointLedgerTx.groupBy({
    by: ['refId'], where: { userId, refType: 'VOTE_HOST', delta: { gt: 0 } }, _sum: { delta: true },
  });
  const earnedBy = new Map<string, number>();
  for (const t of hostTx) {
    const voteId = String(t.refId).split(':')[0];
    earnedBy.set(voteId, (earnedBy.get(voteId) || 0) + Number(t._sum.delta || 0));
  }
  const now = Date.now();
  const votes = rows.map((v) => {
    const t = typeOf(v);
    const def = VOTE_TYPES.find((x) => x.code === t)!;
    const closed = v.status !== 'OPEN' || new Date(v.closeAt).getTime() <= now;
    return {
      id: v.id, title: v.title, type: t, typeLabel: def.label,
      athlete: (v.target as any)?.playerId ? aMap.get((v.target as any).playerId) ?? null : null,
      options: (v.options as any[]).map(optionLabel),
      closeAt: v.closeAt, createdAt: v.createdAt, closed, status: v.status,
      participants: v._count.participations,
      hostEarned: earnedBy.get(v.id) || 0,
      hostCapReached: (earnedBy.get(v.id) || 0) >= VOTE_CREATE_RULES.hostPerVoteCap * VOTE_CREATE_RULES.hostPointsPerParticipant,
      needsAnswer: t === 'PREDICT' && closed && v.status !== 'SETTLED' && v.status !== 'CANCELED',
      correctAnswer: v.status === 'SETTLED' ? optionLabel(v.correctAnswer) : null,
      canCancel: v.status === 'OPEN' && v._count.participations === 0,
    };
  });
  return {
    votes,
    summary: {
      total: votes.filter((v) => v.status !== 'CANCELED').length,
      open: votes.filter((v) => !v.closed && v.status === 'OPEN').length,
      participants: votes.reduce((s, v) => s + v.participants, 0),
      hostEarned: votes.reduce((s, v) => s + v.hostEarned, 0),
      needsAnswer: votes.filter((v) => v.needsAnswer).length,
    },
    rules: VOTE_CREATE_RULES,
  };
}

/** 예측형 정답 입력 → 정답자 VOTE_CORRECT 적립, 상태 SETTLED */
export async function settleMyVote(userId: string, voteId: string, correctAnswer: string) {
  const vote = await prisma.voteV2.findUnique({ where: { id: voteId }, include: { participations: true } });
  if (!vote) throw Object.assign(new Error('투표를 찾을 수 없습니다'), { status: 404 });
  if (vote.createdBy !== userId) throw Object.assign(new Error('내가 만든 투표만 정산할 수 있습니다'), { status: 403 });
  if (typeOf(vote) !== 'PREDICT') throw Object.assign(new Error('예측형 투표만 정답을 입력합니다'), { status: 400 });
  if (new Date(vote.closeAt).getTime() > Date.now()) throw Object.assign(new Error('마감 후에 정답을 입력할 수 있습니다'), { status: 409 });
  if (vote.status === 'SETTLED') throw Object.assign(new Error('이미 정산된 투표입니다'), { status: 409 });
  const labels = (vote.options as any[]).map(optionLabel);
  const answer = String(correctAnswer || '').trim();
  const idx = labels.indexOf(answer);
  if (idx < 0) throw Object.assign(new Error('선택지 중에서 정답을 골라주세요'), { status: 400 });

  const isCorrect = (p: any) => JSON.stringify(p.answer) === JSON.stringify(answer) || JSON.stringify(p.answer) === JSON.stringify(idx);
  const winners = vote.participations.filter(isCorrect);
  await prisma.$transaction(async (tx) => {
    await tx.voteV2.update({ where: { id: voteId }, data: { status: 'SETTLED', correctAnswer: answer, settleAt: new Date() } });
    for (const p of vote.participations) {
      await tx.voteParticipationV2.update({ where: { voteId_userId: { voteId, userId: p.userId } }, data: { isCorrect: isCorrect(p) } });
    }
  });
  let rewarded = 0;
  for (const w of winners) {
    const r = await earn({ userId: w.userId, code: 'VOTE_CORRECT', refType: 'VOTE_CORRECT', refId: voteId }).catch(() => null);
    if (r && (r as any).earned > 0) rewarded++;
  }
  return { id: voteId, status: 'SETTLED', correctAnswer: answer, winners: winners.length, rewarded };
}

export async function cancelMyVote(userId: string, voteId: string) {
  const vote = await prisma.voteV2.findUnique({ where: { id: voteId }, include: { _count: { select: { participations: true } } } });
  if (!vote) throw Object.assign(new Error('투표를 찾을 수 없습니다'), { status: 404 });
  if (vote.createdBy !== userId) throw Object.assign(new Error('내가 만든 투표만 취소할 수 있습니다'), { status: 403 });
  if (vote.status !== 'OPEN') throw Object.assign(new Error('진행 중인 투표만 취소할 수 있습니다'), { status: 409 });
  if (vote._count.participations > 0) throw Object.assign(new Error('이미 참여한 팬이 있어 취소할 수 없습니다'), { status: 409 });
  await prisma.voteV2.update({ where: { id: voteId }, data: { status: 'CANCELED' } });
  return { id: voteId, status: 'CANCELED' };
}

/* ── 활동 기록 (§3.1 공통 원장) ─────────────────────── */

/**
 * 활동 1건을 원장에 기록하고 포인트를 적립한다.
 * 원장과 포인트는 각각 다른 규칙으로 파생되므로 실패를 서로 전파하지 않는다.
 */
export async function record(input: {
  userId: string; athleteId: string; source: string; refType: string; refId: string;
  pointCode?: string; amount?: number; validity?: string;
}) {
  let logged = false;
  try {
    await prisma.fanTemperatureEvent.create({
      data: {
        athleteId: input.athleteId, userId: input.userId, source: input.source,
        deltaMilli: 0, // v1.0 산식은 이벤트 수·다양성으로 계산한다 (누적 ℃ 아님)
        refType: input.refType, refId: input.refId,
        validity: input.validity ?? 'VALID',
        amount: input.amount ?? null,
      },
    });
    logged = true;
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e;
  }

  let point: any = { earned: 0, reason: 'SKIP' };
  if (logged && input.pointCode) {
    point = await earn({
      userId: input.userId, code: input.pointCode,
      refType: input.pointCode, refId: input.refId,
      athleteId: input.athleteId, amount: input.amount,
    }).catch(() => ({ earned: 0, reason: 'ERROR' as const }));
  }

  if (logged) await recomputeContribution(input.userId, input.athleteId).catch(() => null);
  return { logged, point };
}

/** 투표 제출 (§5.4) */
export async function submitBallot(voteId: string, userId: string, answer: any) {
  const { voteV2Service } = await import('./voteV2.service');
  const vote = await prisma.voteV2.findUnique({ where: { id: voteId } });
  if (!vote) throw Object.assign(new Error('투표를 찾을 수 없습니다'), { status: 404 });

  const t = typeOf(vote);
  const athleteId = (vote.target as any)?.playerId as string | undefined;
  const existing = await prisma.voteParticipationV2.findUnique({ where: { voteId_userId: { voteId, userId } } });

  /* 예측형은 마감 전 1회 변경 가능, 그 외 유형은 중복 불가 (§5.5) */
  if (existing) {
    if (t !== 'PREDICT' || new Date(vote.closeAt) <= new Date()) {
      throw Object.assign(new Error('이미 참여한 투표입니다'), { status: 409, code: 'ALREADY_VOTED' });
    }
    await prisma.voteParticipationV2.update({
      where: { voteId_userId: { voteId, userId } }, data: { answer },
    });
    return { changed: true, point: { earned: 0, reason: 'ALREADY' } };
  }

  if (vote.createdBy === userId) {
    throw Object.assign(new Error('내가 만든 투표에는 참여할 수 없습니다'), { status: 403, code: 'OWN_VOTE' });
  }

  await voteV2Service.participate(voteId, userId, { answer });
  await rewardHost(vote, userId).catch(() => null);

  const point = athleteId
    ? (await record({
        userId, athleteId, source: 'VOTE', refType: 'VOTE', refId: voteId, pointCode: 'VOTE',
      })).point
    : await earn({ userId, code: 'VOTE', refType: 'VOTE', refId: voteId });

  return { changed: false, point };
}

/* ── F01 팬 참여 허브 ───────────────────────────────── */

export async function getHub(userId?: string) {
  const now = new Date();

  const [openVotes, myFavorites, campaign] = await Promise.all([
    prisma.voteV2.findMany({
      where: { status: 'OPEN', closeAt: { gt: now } },
      orderBy: { closeAt: 'asc' }, take: 3,
      include: { _count: { select: { participations: true } } },
    }),
    /* 관심 선수는 계정 단위 저장(UserFavoriteAthlete)을 본다 — 브랜드·팬 모두 (선수 메뉴 v1.0 §7.1) */
    userId
      ? prisma.userFavoriteAthlete.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true } } },
          take: 5,
        }).catch(() => [])
      : Promise.resolve([]),
    prisma.fanAdCampaign.findFirst({ where: { status: 'OPEN' }, orderBy: { startAt: 'desc' } }),
  ]);

  /* 내가 응원하는 선수 — 즐겨찾기가 없으면 활동 이력으로 채운다 */
  let athletes = myFavorites.map((f: any) => f.athlete);
  if (userId && !athletes.length) {
    const acts = await prisma.fanContribution.findMany({
      where: { userId }, orderBy: { score: 'desc' }, take: 3,
      include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true } } },
    });
    athletes = acts.map((a) => a.athlete);
  }

  const supported = await Promise.all(
    athletes.slice(0, 3).map(async (a: any) => {
      const tv = await getTemperatureView(a.id, { userId }).catch(() => null);
      return {
        athlete: a,
        score: tv?.score ?? 0,
        tier: tv?.tier ?? tierOf(0),
        weeklyDelta: tv?.weeklyDelta ?? null,
        lowSample: tv?.lowSample ?? true,
      };
    }),
  );

  const voteAthleteIds = [...new Set(openVotes.map((v) => (v.target as any)?.playerId).filter(Boolean))] as string[];
  const voteAthletes = voteAthleteIds.length
    ? await prisma.athlete.findMany({
        where: { id: { in: voteAthleteIds } },
        select: { id: true, name: true, profileImageUrl: true, tour: true },
      })
    : [];
  const vaMap = new Map(voteAthletes.map((a) => [a.id, a]));

  let points: any = null;
  if (userId) {
    const { getMyPoints } = await import('./fanPoint.service');
    points = await getMyPoints(userId).catch(() => null);
  }

  /* 팬스토어 콜라보 — 발행된 상품 중 팬 대상 */
  const collabs = await prisma.offer.findMany({
    where: { status: { in: ['PUBLISHED', 'LOW_STOCK'] } },
    orderBy: { publishedAt: 'desc' }, take: 3,
    include: {
      athletes: { include: { athlete: { select: { id: true, name: true, profileImageUrl: true } } }, take: 1 },
    },
  });

  return {
    votes: openVotes.map((v) => {
      const t = typeOf(v);
      const aid = (v.target as any)?.playerId;
      return {
        id: v.id, title: v.title, type: t,
        typeLabel: VOTE_TYPES.find((x) => x.code === t)!.label,
        athlete: aid ? vaMap.get(aid) ?? null : null,
        closeAt: v.closeAt,
        participants: v._count.participations,
        earnPoints: VOTE_TYPES.find((x) => x.code === t)!.earn,
      };
    }),
    supported,
    points: points
      ? {
          balance: points.balance, pending: points.pending, expiringSoon: points.expiringSoon,
          badge: points.badge, nextBadge: points.nextBadge,
        }
      : null,
    collabs: collabs.map((o) => ({
      id: o.id, title: o.title, summary: o.summary, heroImageUrl: o.heroImageUrl,
      athlete: o.athletes[0]?.athlete ?? null,
    })),
    campaign: campaign
      ? { id: campaign.id, title: campaign.title, description: campaign.description, endAt: campaign.endAt }
      : null,
    /* 4축 진입 (§18.1 F01) */
    entries: [
      { key: 'VOTE', label: 'Fan VOTE', sub: '의견과 예측 참여', desc: '경기 예측, 주제 투표 등 다양한 참여로 선수에게 힘을 더해요.', to: '/fan/vote' },
      { key: 'TEMPERATURE', label: '팬온도', sub: '함께 만든 응원 지수', desc: '팬들의 응원이 모여 선수의 팬온도가 올라가요.', to: '/fan/temperature' },
      { key: 'POINT', label: '팬포인트', sub: '활동하고 받는 혜택', desc: '참여할수록 포인트가 쌓여 다양한 혜택으로 돌아와요.', to: '/fan/points' },
      { key: 'STORE', label: '팬스토어', sub: '선수×브랜드 상생마켓', desc: '선수와 브랜드가 함께 만드는 특별한 상품을 만나보세요.', to: '/fan/store' },
    ],
  };
}

/* ── F06 응원편지 (§9.2) ────────────────────────────── */

const LETTER_MONTHLY_LIMIT = 2;

/** AutoMod — 연락처·금전요구·비방은 자동 보류한다 (§10.2) */
const BLOCK_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/, reason: '전화번호가 포함되어 있습니다' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: '이메일 주소가 포함되어 있습니다' },
  { re: /\d{2,3}-\d{2,6}-\d{2,6}/, reason: '계좌번호로 보이는 숫자가 포함되어 있습니다' },
  { re: /(카톡|카카오톡|인스타|텔레그램|디엠|dm)\s*(아이디|id|주세요|알려)/i, reason: '외부 메신저 연락 요청은 보낼 수 없습니다' },
  { re: /(만나|만남|사귀|사랑해줘|집\s*주소)/, reason: '만남·사적 접촉 요청은 보낼 수 없습니다' },
  { re: /(돈|현금|송금|후원금)\s*(주세요|보내|요구)/, reason: '금전 요구는 보낼 수 없습니다' },
];

export function moderateLetter(content: string) {
  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(content)) return { status: 'PENDING' as const, note: p.reason };
  }
  return { status: 'PUBLISHED' as const, note: null };
}

export async function sendLetter(input: {
  userId: string; athleteId: string; title?: string; content: string; isPublic: boolean; imageUrl?: string;
}) {
  const content = (input.content || '').trim();
  if (content.length < 50) throw Object.assign(new Error('응원 내용은 50자 이상 작성해주세요'), { status: 400 });
  if (content.length > 500) throw Object.assign(new Error('500자 이내로 작성해주세요'), { status: 400 });

  const monthStart = new Date(`${new Date().toISOString().slice(0, 7)}-01`);
  const sent = await prisma.fanLetter.count({
    where: { userId: input.userId, createdAt: { gte: monthStart } },
  });
  if (sent >= LETTER_MONTHLY_LIMIT) {
    throw Object.assign(new Error(`응원편지는 월 ${LETTER_MONTHLY_LIMIT}통까지 보낼 수 있습니다`), { status: 429, code: 'MONTHLY_LIMIT' });
  }

  const mod = moderateLetter(content);
  const letter = await prisma.fanLetter.create({
    data: {
      athleteId: input.athleteId, userId: input.userId,
      title: input.title?.slice(0, 50), content, imageUrl: input.imageUrl,
      isPublic: input.isPublic, status: mod.status, moderationNote: mod.note,
    },
  });

  /* 보류된 편지는 온도·포인트에 반영하지 않는다 (§10.2) */
  const res = mod.status === 'PUBLISHED'
    ? await record({
        userId: input.userId, athleteId: input.athleteId,
        source: 'LETTER', refType: 'LETTER', refId: letter.id, pointCode: 'POST',
      })
    : { logged: false, point: { earned: 0, reason: 'PENDING' } };

  return { letter, moderation: mod, point: res.point, remaining: LETTER_MONTHLY_LIMIT - sent - 1 };
}

export async function getLetterQuota(userId: string) {
  const monthStart = new Date(`${new Date().toISOString().slice(0, 7)}-01`);
  const sent = await prisma.fanLetter.count({ where: { userId, createdAt: { gte: monthStart } } });
  return { sent, limit: LETTER_MONTHLY_LIMIT, remaining: Math.max(0, LETTER_MONTHLY_LIMIT - sent) };
}

/* ── F16 내 팬활동 ──────────────────────────────────── */

export async function getMyActivity(userId: string) {
  const { getMyPoints } = await import('./fanPoint.service');
  const { getMyContributions } = await import('./fanTemperature.service');

  const [points, contributions, votes, posts, letters, suggestions, events] = await Promise.all([
    getMyPoints(userId).catch(() => null),
    getMyContributions(userId).catch(() => ({ contributions: [] as any[] })),
    prisma.voteParticipationV2.count({ where: { userId } }),
    prisma.athleteCommunityPost.count({ where: { authorUserId: userId } }),
    prisma.fanLetter.count({ where: { userId } }),
    prisma.fanBrandSuggestion.findMany({
      where: { fanUserId: userId }, orderBy: { createdAt: 'desc' }, take: 5,
      include: { athlete: { select: { id: true, name: true, profileImageUrl: true } } },
    }),
    prisma.fanTemperatureEvent.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 10,
      include: { athlete: { select: { id: true, name: true, profileImageUrl: true } } },
    }),
  ]);

  const SOURCE_LABEL: Record<string, string> = {
    VOTE: 'VOTE 참여', COMMUNITY: '커뮤니티 활동', LETTER: '응원 편지',
    STORE: '팬스토어 활동', BRAND_SUGGEST: '브랜드 추천', FAVORITE: '관심선수 등록',
  };

  return {
    summary: {
      votes, posts, letters,
      balance: points?.balance ?? 0,
      pending: points?.pending ?? 0,
      athletes: contributions.contributions.length,
      suggestions: suggestions.length,
    },
    contributions: contributions.contributions,
    suggestions: suggestions.map((s) => ({
      id: s.id, athlete: s.athlete, category: s.category, brandName: s.brandName,
      status: s.status, createdAt: s.createdAt,
    })),
    timeline: events.map((e) => ({
      id: e.id,
      label: SOURCE_LABEL[e.source] ?? e.source,
      athlete: e.athlete,
      at: e.createdAt,
      validity: e.validity,
    })),
    points: points ? { balance: points.balance, pending: points.pending, badge: points.badge, nextBadge: points.nextBadge } : null,
  };
}

/* ── F15 연말 응원광고 (§9.3) ───────────────────────── */

/** 심사 가중치 — 구매액이 아니라 활동 다양성·지속성·편지·공익미션 */
export const AD_CRITERIA = [
  { key: 'activity', label: '선수 팬 활동', desc: '팬 온도, 활동 다양성, 참여도', weight: 40 },
  { key: 'continuity', label: '활동 지속성', desc: '꾸준한 응원과 참여 기간', weight: 30 },
  { key: 'letter', label: '응원 편지', desc: '진심이 담긴 응원 메시지', weight: 20 },
  { key: 'mission', label: '공익 미션 참여', desc: '선한 영향력 실천 및 공유', weight: 10 },
] as const;

export async function getAdCampaign(userId?: string) {
  const campaign = await prisma.fanAdCampaign.findFirst({
    where: { status: { in: ['OPEN', 'JUDGING'] } }, orderBy: { startAt: 'desc' },
  });

  /* 후보 선수 — 팬온도와 활동 지표로 산출한다 (순위가 아니라 현황) */
  const snapshots = await prisma.fanTemperatureSnapshot.findMany({
    orderBy: [{ date: 'desc' }, { score: 'desc' }],
    take: 60,
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true } } },
  });
  const seen = new Set<string>();
  const candidates = [];
  for (const s of snapshots) {
    if (seen.has(s.athleteId)) continue;
    seen.add(s.athleteId);
    const [letters, contribs] = await Promise.all([
      prisma.fanLetter.count({ where: { athleteId: s.athleteId, status: 'PUBLISHED' } }),
      prisma.fanContribution.aggregate({ where: { athleteId: s.athleteId }, _avg: { streakWeeks: true, diversity: true } }),
    ]);
    const activity = (s.score / 100) * 40;
    const continuity = ((contribs._avg.streakWeeks ?? 0) / 4) * 30;
    const letter = Math.min(1, letters / 20) * 20;
    const mission = (contribs._avg.diversity ?? 0) >= 3 ? 10 : 0;
    const total = Math.round(activity + continuity + letter + mission);
    candidates.push({
      athlete: s.athlete,
      index: total,
      remaining: Math.max(0, 100 - total),
      marks: {
        activity: s.score >= 40 ? '활발' : s.score >= 20 ? '보통' : '낮음',
        continuity: (contribs._avg.streakWeeks ?? 0) >= 3 ? '좋음' : '보통',
        letter: letters > 0 ? '있음' : '없음',
        mission: mission > 0 ? '참여' : '미참여',
      },
    });
    if (candidates.length >= 3) break;
  }

  let mine: any = null;
  if (userId) {
    const { getMyContributions } = await import('./fanTemperature.service');
    const c = await getMyContributions(userId);
    mine = c.contributions[0]?.campaign ?? null;
  }

  return {
    campaign: campaign
      ? {
          id: campaign.id, title: campaign.title, description: campaign.description,
          startAt: campaign.startAt, endAt: campaign.endAt, status: campaign.status, notice: campaign.notice,
        }
      : null,
    criteria: AD_CRITERIA,
    candidates: candidates.sort((a, b) => b.index - a.index),
    mine,
    notices: [
      '연말 응원광고는 모든 후보 선수에게 보장되지 않습니다.',
      '예산, 광고 매체, 운영 상황에 따라 광고 집행 여부 및 규모가 변경되거나 취소될 수 있습니다.',
      '팬 이름은 닉네임이 기본이며, 실명 표기는 별도 동의를 받습니다.',
    ],
  };
}

export { computeTemperature };

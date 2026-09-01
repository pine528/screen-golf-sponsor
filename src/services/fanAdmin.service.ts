/**
 * 팬 운영 관리자 A01~A05 · A12 (핸드오프 v1.0 2026-08-22 §18.2)
 *
 * 원칙
 *  - 측정되지 않은 지표는 만들지 않는다. 분모가 0이면 비율 대신 null 을 돌려준다 (LEG-06).
 *  - 관리자 조치는 사유·조치자·시각이 함께 남는다 (§17.1 A-01).
 *  - 팬온도 점수와 포인트 잔액은 여기서 직접 수정하지 않는다.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 86400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);

/** 분모가 0이거나 비율이 성립하지 않으면 null — 화면은 "집계 중"으로 표시한다 */
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export const RISK_LEVELS = [
  { code: 'P0', label: '긴급', slaMinutes: 60 },
  { code: 'P1', label: '높음', slaMinutes: 240 },
  { code: 'P2', label: '보통', slaMinutes: 1440 },
  { code: 'P3', label: '낮음', slaMinutes: 4320 },
] as const;

export const MODERATION_DECISIONS = [
  { code: 'APPROVED', label: '승인', desc: '정책 위반이 아니며 그대로 게시합니다' },
  { code: 'HIDDEN', label: '숨김', desc: '게시물을 비공개 처리합니다' },
  { code: 'EDIT_REQUESTED', label: '수정 요청', desc: '작성자에게 수정을 요청합니다' },
  { code: 'SANCTION_REVIEW', label: '제재 검토', desc: '신고·제재 절차로 넘깁니다' },
] as const;

export const DECISION_REASONS = [
  '개인정보 노출', '외부 연락 유도', '욕설·비하', '혐오·차별', '성적 표현',
  '스팸·도배', '광고·리퍼럴', '선수 사생활', '허위 정보', '오탐 (정상 콘텐츠)',
];

export const SANCTION_LEVELS = [
  { code: 'WARNING', label: '경고', desc: '경고 메시지 발송 및 기록', needsDays: false, needsTwoApprovals: false },
  { code: 'FEATURE_LIMIT', label: '기능 제한', desc: '특정 기능 사용 제한', needsDays: true, needsTwoApprovals: false },
  { code: 'SUSPEND', label: '일시 정지', desc: '계정 일시 정지', needsDays: true, needsTwoApprovals: false },
  { code: 'PERMANENT', label: '영구 정지', desc: '계정 영구 정지 및 접근 차단', needsDays: false, needsTwoApprovals: true },
] as const;

export const BATCH_JOBS = [
  { job: 'FAN_TEMPERATURE', label: '팬온도 계산', schedule: '매일 03:00' },
  { job: 'POINT_CONFIRM', label: '포인트 확정', schedule: '매시 정각' },
  { job: 'POINT_EXPIRY', label: '포인트 만료', schedule: '매일 00:10' },
  { job: 'MODERATION_SWEEP', label: '검수 SLA 점검', schedule: '10분마다' },
] as const;

/* ── A01 팬 운영 대시보드 ───────────────────────────── */

export async function getDashboard() {
  const now = new Date();
  const m30 = ago(30);
  const m60 = ago(60);

  const [
    fansNow, fansPrev, openVotes, pendingPoints,
    clicksTotal, clicksConfirmed, modTotal, modAuto,
    modQueue, reportQueue, batchRuns, recentActions, tempRuns,
  ] = await Promise.all([
    prisma.fanTemperatureEvent.findMany({
      where: { createdAt: { gte: m30 }, validity: 'VALID' }, select: { userId: true }, distinct: ['userId'],
    }),
    prisma.fanTemperatureEvent.findMany({
      where: { createdAt: { gte: m60, lt: m30 }, validity: 'VALID' }, select: { userId: true }, distinct: ['userId'],
    }),
    prisma.voteV2.count({ where: { status: 'OPEN', closeAt: { gt: now } } }),
    prisma.pointLedgerTx.count({ where: { status: 'PENDING' } }),
    prisma.fanStoreClick.count({ where: { createdAt: { gte: m30 } } }),
    prisma.fanStoreClick.count({ where: { createdAt: { gte: m30 }, confirmedAt: { not: null } } }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: m30 } } }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: m30 }, autoResult: { not: 'PENDING' } } }),
    prisma.fanModerationItem.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ risk: 'asc' }, { slaDueAt: 'asc' }],
      take: 10,
    }),
    prisma.fanReport.findMany({
      where: { status: { in: ['RECEIVED', 'CLASSIFIED'] } },
      orderBy: [{ risk: 'asc' }, { createdAt: 'asc' }],
      take: 10,
    }),
    latestBatchRuns(),
    prisma.adminActionLog.findMany({
      where: { targetType: { in: ['FAN_MODERATION', 'FAN_REPORT', 'FAN_SANCTION', 'POINT_ADJUSTMENT', 'VOTE'] } },
      orderBy: { createdAt: 'desc' }, take: 8,
    }),
    prisma.fanBatchRun.findMany({
      where: { job: 'FAN_TEMPERATURE', startedAt: { gte: ago(7) } },
      select: { status: true, processed: true, succeeded: true },
    }),
  ]);

  /* 팬온도 계산 성공률 — 배치 기록이 없으면 비율을 만들지 않는다 */
  const tempProcessed = tempRuns.reduce((s, r) => s + r.processed, 0);
  const tempSucceeded = tempRuns.reduce((s, r) => s + r.succeeded, 0);

  const pendingSum = await pendingPointSum();

  const kpis = [
    {
      key: 'monthlyFans', label: '월간 참여팬', value: fansNow.length, unit: '명',
      delta: fansPrev.length > 0
        ? Math.round(((fansNow.length - fansPrev.length) / fansPrev.length) * 1000) / 10
        : null,
      deltaLabel: fansPrev.length > 0 ? '전월 대비' : '비교 데이터 없음',
    },
    { key: 'openVotes', label: '진행 VOTE', value: openVotes, unit: '건', delta: null, deltaLabel: '진행 중인 VOTE 수' },
    {
      key: 'tempSuccess', label: '팬온도 계산 성공', value: rate(tempSucceeded, tempProcessed), unit: '%',
      delta: null, deltaLabel: tempProcessed > 0 ? '최근 7일 배치 기준' : '배치 기록 없음',
    },
    { key: 'pendingPoints', label: '포인트 미확정', value: pendingSum, unit: 'P', delta: null, deltaLabel: `${pendingPoints}건 대기` },
    {
      key: 'storeConversion', label: '팬스토어 전환', value: rate(clicksConfirmed, clicksTotal), unit: '%',
      delta: null, deltaLabel: clicksTotal > 0 ? `이동 ${clicksTotal}건 기준` : '이동 기록 없음',
    },
    {
      key: 'autoRate', label: '자동처리율', value: rate(modAuto, modTotal), unit: '%',
      delta: null, deltaLabel: modTotal > 0 ? '최근 30일 검수 기준' : '검수 기록 없음',
    },
  ];

  /* 예외 처리 큐 — SLA 초과·미처리 순 */
  const queue = [
    ...reportQueue.map((r) => ({
      id: r.id, kind: '신고', risk: r.risk, title: r.reason,
      sub: `신고자: ${maskUser(r.reporterId)}`,
      at: r.createdAt, slaDueAt: r.slaDueAt,
      overdue: r.slaDueAt ? r.slaDueAt < now : false,
      to: `/admin/fan/reports?id=${r.id}`, action: '처리하기',
    })),
    ...modQueue.map((m) => ({
      id: m.id, kind: '콘텐츠 검수', risk: m.risk, title: m.excerpt?.slice(0, 40) || '콘텐츠 검수 요청',
      sub: TARGET_LABEL[m.targetType] ?? m.targetType,
      at: m.createdAt, slaDueAt: m.slaDueAt,
      overdue: m.slaDueAt ? m.slaDueAt < now : false,
      to: `/admin/fan/moderation?id=${m.id}`, action: '검수하기',
    })),
  ].sort((a, b) => (a.risk === b.risk ? +new Date(a.at) - +new Date(b.at) : a.risk.localeCompare(b.risk)));

  return {
    kpis,
    queue: queue.slice(0, 8),
    queueTotal: queue.length,
    modules: await moduleHealth(),
    batches: batchRuns,
    activities: recentActions.map((a) => ({
      id: a.id, at: a.createdAt, action: a.action,
      module: MODULE_OF_TARGET[a.targetType] ?? a.targetType,
      actor: a.actorId, reason: a.reason,
    })),
    notice: '수치는 실제 기록으로만 산출합니다. 집계할 데이터가 없는 항목은 비율을 만들지 않고 비워 둡니다.',
  };
}

const TARGET_LABEL: Record<string, string> = {
  POST: '커뮤니티 글', COMMENT: '댓글', LETTER: '응원편지', BRAND_SUGGEST: '브랜드 추천', USER: '사용자',
};
const MODULE_OF_TARGET: Record<string, string> = {
  FAN_MODERATION: '콘텐츠 검수', FAN_REPORT: '신고·제재', FAN_SANCTION: '신고·제재',
  POINT_ADJUSTMENT: '팬포인트', VOTE: 'VOTE',
};

const maskUser = (id: string) => `user_${id.slice(0, 4)}`;

async function pendingPointSum() {
  const rows = await prisma.pointLedgerTx.findMany({
    where: { status: 'PENDING' }, select: { refType: true, delta: true },
  });
  const { EARN_RULES } = await import('./fanPoint.service');
  return rows.reduce((s, r) => {
    const rule = EARN_RULES.find((x) => x.code === r.refType);
    return s + (rule ? ((rule as any).rate ? Number(r.delta) : rule.points) : Number(r.delta));
  }, 0);
}

async function latestBatchRuns() {
  const out = [];
  for (const j of BATCH_JOBS) {
    const last = await prisma.fanBatchRun.findFirst({
      where: { job: j.job }, orderBy: { startedAt: 'desc' },
    });
    out.push({
      job: j.job, label: j.label, schedule: j.schedule,
      lastRunAt: last?.startedAt ?? null,
      status: last?.status ?? null,
      nextRunAt: last?.nextRunAt ?? null,
      processed: last?.processed ?? null,
      succeeded: last?.succeeded ?? null,
      failed: last?.failed ?? null,
      durationMs: last?.durationMs ?? null,
      message: last?.message ?? (last ? null : '아직 실행된 적이 없습니다'),
    });
  }
  return out;
}

/**
 * 모듈별 헬스 — 24시간 내 실패/전체 비율로만 판정한다.
 * 표본이 없으면 '정상'이라고 말하지 않고 '데이터 없음'으로 둔다.
 */
async function moduleHealth() {
  const from = ago(1);
  const [voteN, modN, modFail, reportN, tempRun, pointN, pointFail, storeN, letterN, letterHold] =
    await Promise.all([
      prisma.voteParticipationV2.count({ where: { createdAt: { gte: from } } }),
      prisma.fanModerationItem.count({ where: { createdAt: { gte: from } } }),
      prisma.fanModerationItem.count({ where: { createdAt: { gte: from }, status: 'PENDING', slaDueAt: { lt: new Date() } } }),
      prisma.fanReport.count({ where: { createdAt: { gte: from } } }),
      prisma.fanBatchRun.findFirst({ where: { job: 'FAN_TEMPERATURE' }, orderBy: { startedAt: 'desc' } }),
      prisma.pointLedgerTx.count({ where: { createdAt: { gte: from } } }),
      prisma.pointLedgerTx.count({ where: { createdAt: { gte: from }, status: 'REVERSED' } }),
      prisma.fanStoreClick.count({ where: { createdAt: { gte: from } } }),
      prisma.fanLetter.count({ where: { createdAt: { gte: from } } }),
      prisma.fanLetter.count({ where: { createdAt: { gte: from }, status: 'PENDING' } }),
    ]);

  const health = (label: string, total: number, bad: number, note?: string) => ({
    label,
    ok: total === 0 ? null : bad === 0,
    healthRate: total > 0 ? Math.round(((total - bad) / total) * 1000) / 10 : null,
    total,
    note: total === 0 ? (note ?? '최근 24시간 처리 내역 없음') : null,
  });

  return [
    health('VOTE', voteN, 0),
    health('콘텐츠 검수', modN, modFail),
    health('신고·제재', reportN, 0),
    {
      label: '팬온도',
      ok: tempRun ? tempRun.status === 'SUCCESS' : null,
      healthRate: tempRun && tempRun.processed > 0
        ? Math.round((tempRun.succeeded / tempRun.processed) * 1000) / 10 : null,
      total: tempRun?.processed ?? 0,
      note: tempRun ? null : '배치가 아직 실행되지 않았습니다',
    },
    health('팬포인트', pointN, pointFail),
    health('팬스토어', storeN, 0),
    health('응원편지', letterN, letterHold),
  ];
}

/* ── A02 VOTE 목록 · 캘린더 ─────────────────────────── */

export async function listVotes(params: {
  status?: string; athleteId?: string; q?: string; from?: string; to?: string;
  page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 10);
  const now = new Date();

  const where: Prisma.VoteV2WhereInput = {
    ...(params.status && params.status !== 'ALL' ? { status: params.status as any } : {}),
    ...(params.q ? { OR: [{ title: { contains: params.q, mode: 'insensitive' } }, { id: params.q }] } : {}),
    ...(params.from || params.to
      ? { closeAt: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
      : {}),
  };

  const [rows, total, monthRows] = await Promise.all([
    prisma.voteV2.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
      include: { _count: { select: { participations: true } } },
    }),
    prisma.voteV2.count({ where }),
    prisma.voteV2.findMany({
      where: { closeAt: { gte: ago(45), lte: new Date(Date.now() + 45 * DAY) } },
      select: { id: true, title: true, status: true, createdAt: true, closeAt: true, target: true },
    }),
  ]);

  const athleteIds = [...new Set([...rows, ...monthRows].map((v: any) => (v.target as any)?.playerId).filter(Boolean))] as string[];
  const athletes = athleteIds.length
    ? await prisma.athlete.findMany({ where: { id: { in: athleteIds } }, select: { id: true, name: true, profileImageUrl: true } })
    : [];
  const aMap = new Map(athletes.map((a) => [a.id, a]));

  /* 같은 선수 · 기간 중복 감지 (§17.1 운영 경고) */
  const overlaps: any[] = [];
  const byAthlete = new Map<string, any[]>();
  for (const v of monthRows) {
    const aid = (v.target as any)?.playerId;
    if (!aid) continue;
    const list = byAthlete.get(aid) ?? [];
    list.push(v);
    byAthlete.set(aid, list);
  }
  for (const [aid, list] of byAthlete) {
    const sorted = [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    for (let i = 1; i < sorted.length; i += 1) {
      if (new Date(sorted[i].createdAt) < new Date(sorted[i - 1].closeAt)) {
        overlaps.push({
          athlete: aMap.get(aid) ?? null,
          votes: [
            { id: sorted[i - 1].id, title: sorted[i - 1].title },
            { id: sorted[i].id, title: sorted[i].title },
          ],
        });
      }
    }
  }

  const shape = (v: any) => {
    const aid = (v.target as any)?.playerId;
    return {
      id: v.id,
      title: v.title,
      athlete: aid ? aMap.get(aid) ?? null : null,
      status: v.status,
      statusLabel: v.status === 'OPEN'
        ? (new Date(v.closeAt) > now ? '진행 중' : '마감 처리 대기')
        : v.status === 'SETTLED' ? '결과확정' : '종료',
      openAt: v.createdAt,
      closeAt: v.closeAt,
      participants: v._count?.participations ?? null,
      points: v.rewardPerWinner ?? null,
    };
  };

  return {
    votes: rows.map(shape),
    total, page, limit,
    calendar: monthRows.map((v: any) => ({
      id: v.id, title: v.title, status: v.status,
      athlete: (v.target as any)?.playerId ? aMap.get((v.target as any).playerId) ?? null : null,
      openAt: v.createdAt, closeAt: v.closeAt,
    })),
    overlaps,
    statuses: [
      { code: 'ALL', label: '전체' }, { code: 'OPEN', label: '진행 중' },
      { code: 'CLOSED', label: '종료' }, { code: 'SETTLED', label: '결과확정' },
    ],
  };
}

/* ── A03 VOTE 결과 확정 ─────────────────────────────── */

/** 결과 확정 전 검증 — 최소 표본과 의심표를 함께 보여준다 (§5.5) */
export async function getVoteSettlement(voteId: string) {
  const vote = await prisma.voteV2.findUnique({
    where: { id: voteId },
    include: { _count: { select: { participations: true } } },
  });
  if (!vote) return null;

  const [tally, suspicious] = await Promise.all([
    prisma.voteParticipationV2.groupBy({ by: ['answer'], where: { voteId }, _count: { _all: true } }),
    /* 같은 사용자의 다중 참여는 유니크로 막혀 있으므로, 여기서는 보류 표만 센다 */
    prisma.fanTemperatureEvent.count({
      where: { refType: 'VOTE', refId: voteId, validity: { not: 'VALID' } },
    }),
  ]);

  const total = vote._count.participations;
  const options = (vote.options as any[]).map((o) => (typeof o === 'string' ? o : o?.label ?? ''));

  return {
    id: vote.id,
    title: vote.title,
    status: vote.status,
    options,
    closeAt: vote.closeAt,
    results: options.map((label) => {
      const c = tally.find((x) => JSON.stringify(x.answer) === JSON.stringify(label));
      const n = c?._count._all ?? 0;
      return { label, count: n, percent: rate(n, total) };
    }),
    validParticipants: total - suspicious,
    suspiciousCount: suspicious,
    settled: vote.status === 'SETTLED',
    correctAnswer: vote.correctAnswer ?? null,
    warnings: [
      '결과를 확정하면 수정할 수 없습니다.',
      '공식 기록 출처를 확인한 뒤 진행해주세요.',
      '확정 시 정답 보상 포인트가 적립 예정 상태로 생성됩니다.',
    ],
  };
}

/* ── A04 콘텐츠 검수함 ──────────────────────────────── */

export async function listModeration(params: {
  tab?: string; risk?: string; status?: string; page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);
  const now = new Date();
  const m1 = ago(1);

  const where: Prisma.FanModerationItemWhereInput = {
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : { status: 'PENDING' }),
    ...(params.tab && params.tab !== 'ALL' ? { targetType: params.tab } : {}),
    ...(params.risk && params.risk !== 'ALL' ? { risk: params.risk } : {}),
  };

  const [items, total, autoApproved, autoBlocked, pending, overdue, riskCounts] = await Promise.all([
    prisma.fanModerationItem.findMany({
      where, orderBy: [{ risk: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.fanModerationItem.count({ where }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: m1 }, autoResult: 'AUTO_APPROVED' } }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: m1 }, autoResult: 'AUTO_BLOCKED' } }),
    prisma.fanModerationItem.count({ where: { status: 'PENDING' } }),
    prisma.fanModerationItem.count({ where: { status: 'PENDING', slaDueAt: { lt: now } } }),
    prisma.fanModerationItem.groupBy({ by: ['risk'], where: { status: 'PENDING' }, _count: { _all: true } }),
  ]);

  const dayTotal = autoApproved + autoBlocked + pending;

  return {
    items: items.map((i) => ({
      id: i.id, targetType: i.targetType, targetTypeLabel: TARGET_LABEL[i.targetType] ?? i.targetType,
      targetId: i.targetId, excerpt: i.excerpt, risk: i.risk,
      riskLabel: RISK_LEVELS.find((r) => r.code === i.risk)?.label ?? i.risk,
      aiScore: i.aiScore, policies: i.policies, status: i.status,
      slaDueAt: i.slaDueAt,
      slaRemainMs: i.slaDueAt ? +i.slaDueAt - Date.now() : null,
      overdue: i.slaDueAt ? i.slaDueAt < now : false,
      createdAt: i.createdAt,
    })),
    total, page, limit,
    kpis: {
      autoApprovedRate: rate(autoApproved, dayTotal),
      autoBlockedRate: rate(autoBlocked, dayTotal),
      pending, overdue,
      window: '최근 24시간',
    },
    riskCounts: RISK_LEVELS.map((r) => ({
      ...r, count: riskCounts.find((x) => x.risk === r.code)?._count._all ?? 0,
    })),
    tabs: [
      { code: 'ALL', label: '전체' }, { code: 'POST', label: '게시글' },
      { code: 'COMMENT', label: '댓글' }, { code: 'LETTER', label: '응원편지' },
      { code: 'BRAND_SUGGEST', label: '브랜드 추천' },
    ],
    decisions: MODERATION_DECISIONS,
    reasons: DECISION_REASONS,
    /* 일괄 승인은 위험도가 가장 낮은 항목에만 허용한다 (§17.1) */
    bulkApproveRisk: 'P3',
  };
}

export async function getModerationItem(id: string) {
  const item = await prisma.fanModerationItem.findUnique({ where: { id } });
  if (!item) return null;

  const [author, history, athlete] = await Promise.all([
    item.authorUserId
      ? prisma.user.findUnique({
          where: { id: item.authorUserId },
          select: { id: true, createdAt: true, fan: { select: { nickname: true } } },
        })
      : Promise.resolve(null),
    item.authorUserId
      ? Promise.all([
          prisma.athleteCommunityPost.count({ where: { authorUserId: item.authorUserId } }),
          prisma.fanReport.count({ where: { targetUserId: item.authorUserId } }),
          prisma.fanSanction.count({ where: { userId: item.authorUserId } }),
        ])
      : Promise.resolve([0, 0, 0]),
    item.athleteId
      ? prisma.athlete.findUnique({ where: { id: item.athleteId }, select: { id: true, name: true, profileImageUrl: true } })
      : Promise.resolve(null),
  ]);

  return {
    id: item.id,
    targetType: item.targetType,
    targetTypeLabel: TARGET_LABEL[item.targetType] ?? item.targetType,
    targetId: item.targetId,
    excerpt: item.excerpt,
    risk: item.risk,
    riskLabel: RISK_LEVELS.find((r) => r.code === item.risk)?.label ?? item.risk,
    aiScore: item.aiScore,
    policies: item.policies,
    autoResult: item.autoResult,
    status: item.status,
    slaDueAt: item.slaDueAt,
    slaRemainMs: item.slaDueAt ? +item.slaDueAt - Date.now() : null,
    createdAt: item.createdAt,
    athlete,
    author: author
      ? {
          id: author.id, nickname: author.fan?.nickname ?? maskUser(author.id),
          joinedAt: author.createdAt,
          posts: history[0], reports: history[1], sanctions: history[2],
        }
      : null,
    decisions: MODERATION_DECISIONS,
    reasons: DECISION_REASONS,
  };
}

/** 검수 조치 — 사유는 필수다 */
export async function decideModeration(input: {
  id: string; decision: string; reason: string; note?: string; adminId: string;
}) {
  if (!MODERATION_DECISIONS.some((d) => d.code === input.decision)) {
    throw Object.assign(new Error('알 수 없는 조치입니다'), { status: 400 });
  }
  if (!input.reason) throw Object.assign(new Error('사유를 선택해주세요'), { status: 400 });

  const item = await prisma.fanModerationItem.update({
    where: { id: input.id },
    data: {
      status: input.decision,
      decisionCode: input.reason,
      decisionNote: input.note,
      decidedBy: input.adminId,
      decidedAt: new Date(),
    },
  });

  /* 숨김 조치는 원본에도 반영한다 */
  if (input.decision === 'HIDDEN') {
    if (item.targetType === 'POST') {
      await prisma.athleteCommunityPost.update({ where: { id: item.targetId }, data: { isHidden: true } }).catch(() => null);
    } else if (item.targetType === 'LETTER') {
      await prisma.fanLetter.update({ where: { id: item.targetId }, data: { status: 'BLOCKED' } }).catch(() => null);
    }
    /* 무효 처리된 활동은 팬온도에서 제외한다 (§6.4 — 점수 직접 수정 대신 이벤트 제외) */
    await prisma.fanTemperatureEvent.updateMany({
      where: { refId: item.targetId }, data: { validity: 'INVALID' },
    }).catch(() => null);
  }
  if (input.decision === 'APPROVED') {
    await prisma.fanTemperatureEvent.updateMany({
      where: { refId: item.targetId, validity: 'PENDING_REVIEW' }, data: { validity: 'VALID' },
    }).catch(() => null);
    if (item.targetType === 'LETTER') {
      await prisma.fanLetter.update({ where: { id: item.targetId }, data: { status: 'PUBLISHED' } }).catch(() => null);
    }
  }

  await logAdmin(input.adminId, 'FAN_MODERATION_DECIDE', 'FAN_MODERATION', item.id, input.reason, {
    decision: input.decision, note: input.note,
  });

  return { item, decision: input.decision };
}

/** P3(낮음) 일괄 승인 — 그 외 위험도는 거부한다 */
export async function bulkApproveModeration(ids: string[], adminId: string, reason: string) {
  const items = await prisma.fanModerationItem.findMany({ where: { id: { in: ids } } });
  const blocked = items.filter((i) => i.risk !== 'P3');
  if (blocked.length) {
    throw Object.assign(
      new Error(`일괄 승인은 위험도 P3 항목에만 가능합니다 (${blocked.length}건 제외 필요)`),
      { status: 400, code: 'RISK_TOO_HIGH' },
    );
  }
  const res = await prisma.fanModerationItem.updateMany({
    where: { id: { in: ids }, risk: 'P3' },
    data: { status: 'APPROVED', decisionCode: reason, decidedBy: adminId, decidedAt: new Date() },
  });
  await logAdmin(adminId, 'FAN_MODERATION_BULK_APPROVE', 'FAN_MODERATION', ids.join(','), reason, { count: res.count });
  return { approved: res.count };
}

/* ── A05 신고 · 제재 · 이의제기 ─────────────────────── */

export async function listReports(params: { tab?: string; risk?: string; page?: number; limit?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 20);
  const now = new Date();

  const statusOf: Record<string, string[]> = {
    RECEIVED: ['RECEIVED'],
    CLASSIFIED: ['CLASSIFIED'],
    ACTIONED: ['ACTIONED', 'CLOSED'],
  };
  const tab = params.tab || 'RECEIVED';

  const where: Prisma.FanReportWhereInput = {
    ...(tab === 'APPEAL' ? {} : { status: { in: statusOf[tab] ?? ['RECEIVED'] } }),
    ...(params.risk && params.risk !== 'ALL' ? { risk: params.risk } : {}),
  };

  const [rows, total, open, p0, overdue, appeals] = await Promise.all([
    tab === 'APPEAL'
      ? Promise.resolve([])
      : prisma.fanReport.findMany({
          where, orderBy: [{ risk: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit, take: limit,
        }),
    prisma.fanReport.count({ where }),
    prisma.fanReport.count({ where: { status: { in: ['RECEIVED', 'CLASSIFIED'] } } }),
    prisma.fanReport.count({ where: { status: { in: ['RECEIVED', 'CLASSIFIED'] }, risk: 'P0' } }),
    prisma.fanReport.count({ where: { status: { in: ['RECEIVED', 'CLASSIFIED'] }, slaDueAt: { lt: now } } }),
    prisma.fanAppeal.findMany({
      where: { status: { in: ['RECEIVED', 'REVIEWING'] } },
      orderBy: { createdAt: 'desc' }, take: tab === 'APPEAL' ? limit : 5,
    }),
  ]);

  return {
    reports: rows.map((r) => ({
      id: r.id, code: r.code, reason: r.reason,
      targetType: r.targetType, targetTypeLabel: TARGET_LABEL[r.targetType] ?? r.targetType,
      targetUser: r.targetUserId ? maskUser(r.targetUserId) : null,
      risk: r.risk, status: r.status,
      slaDueAt: r.slaDueAt, overdue: r.slaDueAt ? r.slaDueAt < now : false,
      createdAt: r.createdAt,
    })),
    appeals: appeals.map((a) => ({
      id: a.id, code: a.code, user: maskUser(a.userId),
      statement: a.statement, status: a.status, createdAt: a.createdAt,
    })),
    total, page, limit,
    kpis: { open, p0, overdue, appeals: appeals.length },
    tabs: [
      { code: 'RECEIVED', label: '접수' }, { code: 'CLASSIFIED', label: '분류완료' },
      { code: 'ACTIONED', label: '조치완료' }, { code: 'APPEAL', label: '이의제기' },
    ],
    sanctionLevels: SANCTION_LEVELS,
  };
}

export async function getReport(id: string) {
  const r = await prisma.fanReport.findUnique({
    where: { id },
    include: { sanctions: true, appeals: true },
  });
  if (!r) return null;

  const history = r.targetUserId
    ? await prisma.fanSanction.findMany({
        where: { userId: r.targetUserId }, orderBy: { createdAt: 'desc' }, take: 10,
      })
    : [];

  const logs = await prisma.adminActionLog.findMany({
    where: { targetType: { in: ['FAN_REPORT', 'FAN_SANCTION'] }, targetId: r.id },
    orderBy: { createdAt: 'asc' },
  });

  return {
    id: r.id, code: r.code, reason: r.reason, detail: r.detail,
    targetType: r.targetType, targetTypeLabel: TARGET_LABEL[r.targetType] ?? r.targetType,
    targetId: r.targetId,
    /* 조치 대상은 실제 ID 가 필요하다. 익명 처리 대상은 신고자다 */
    targetUserId: r.targetUserId,
    targetUser: r.targetUserId ? maskUser(r.targetUserId) : null,
    /* 신고자는 익명 처리한다 (§10.3) */
    reporter: maskUser(r.reporterId),
    reporterProtected: true,
    evidenceUrls: r.evidenceUrls,
    risk: r.risk, status: r.status, memo: r.memo,
    slaDueAt: r.slaDueAt,
    slaRemainMs: r.slaDueAt ? +r.slaDueAt - Date.now() : null,
    createdAt: r.createdAt,
    sanctions: r.sanctions.map(shapeSanction),
    appeals: r.appeals.map((a) => ({
      id: a.id, code: a.code, statement: a.statement, status: a.status,
      decision: a.decision, createdAt: a.createdAt,
    })),
    history: history.map(shapeSanction),
    auditLogs: logs.map((l) => ({ at: l.createdAt, actor: l.actorId, action: l.action, reason: l.reason })),
    sanctionLevels: SANCTION_LEVELS,
    notice: '감사 로그는 수정 및 삭제가 불가능합니다.',
  };
}

function shapeSanction(s: any) {
  const def = SANCTION_LEVELS.find((l) => l.code === s.level);
  return {
    id: s.id, level: s.level, levelLabel: def?.label ?? s.level,
    days: s.days, reason: s.reason, status: s.status,
    createdAt: s.createdAt, expiresAt: s.expiresAt,
    approvedBy: s.approvedBy, liftedAt: s.liftedAt, liftReason: s.liftReason,
  };
}

/** 제재 부과 — 영구 정지는 2인 승인 대기 상태로 만든다 */
export async function createSanction(input: {
  reportId?: string; userId: string; level: string; days?: number; reason: string; adminId: string;
}) {
  const def = SANCTION_LEVELS.find((l) => l.code === input.level);
  if (!def) throw Object.assign(new Error('알 수 없는 제재 단계입니다'), { status: 400 });
  if (!input.reason?.trim()) throw Object.assign(new Error('조치 사유를 입력해주세요'), { status: 400 });
  if (def.needsDays && !input.days) throw Object.assign(new Error('제재 기간을 선택해주세요'), { status: 400 });

  const expiresAt = input.days ? new Date(Date.now() + input.days * DAY) : null;

  const sanction = await prisma.fanSanction.create({
    data: {
      reportId: input.reportId, userId: input.userId, level: input.level,
      days: input.days, reason: input.reason,
      status: def.needsTwoApprovals ? 'PENDING_APPROVAL' : 'ACTIVE',
      createdBy: input.adminId, expiresAt,
    },
  });

  if (input.reportId) {
    await prisma.fanReport.update({
      where: { id: input.reportId },
      data: { status: 'ACTIONED', closedAt: def.needsTwoApprovals ? null : new Date() },
    });
  }

  await logAdmin(input.adminId, 'FAN_SANCTION_CREATE', 'FAN_SANCTION', sanction.id, input.reason, {
    level: input.level, days: input.days, userId: input.userId,
  });

  return {
    sanction: shapeSanction(sanction),
    pendingApproval: def.needsTwoApprovals,
    message: def.needsTwoApprovals ? '영구 정지는 관리자 2인 승인이 필요합니다' : null,
  };
}

/** 2인 승인 — 부과자와 승인자가 같으면 거부한다 */
export async function approveSanction(id: string, adminId: string) {
  const s = await prisma.fanSanction.findUnique({ where: { id } });
  if (!s) throw Object.assign(new Error('제재를 찾을 수 없습니다'), { status: 404 });
  if (s.status !== 'PENDING_APPROVAL') return { approved: false, reason: 'NOT_PENDING' };
  if (s.createdBy === adminId) {
    throw Object.assign(new Error('부과한 관리자는 승인할 수 없습니다'), { status: 403, code: 'SAME_ADMIN' });
  }

  const updated = await prisma.fanSanction.update({
    where: { id }, data: { status: 'ACTIVE', approvedBy: adminId, approvedAt: new Date() },
  });
  await logAdmin(adminId, 'FAN_SANCTION_APPROVE', 'FAN_SANCTION', id, '영구 정지 2인 승인', {});
  return { approved: true, sanction: shapeSanction(updated) };
}

/** 이의제기 처리 — 유지 / 감경 / 해제 */
export async function decideAppeal(input: {
  id: string; decision: 'UPHELD' | 'REDUCED' | 'LIFTED'; note: string; adminId: string; days?: number;
}) {
  if (!input.note?.trim()) throw Object.assign(new Error('판단 사유를 입력해주세요'), { status: 400 });

  const appeal = await prisma.fanAppeal.update({
    where: { id: input.id },
    data: { status: input.decision, decision: input.note, decidedBy: input.adminId, decidedAt: new Date() },
  });

  if (appeal.sanctionId && input.decision !== 'UPHELD') {
    await prisma.fanSanction.update({
      where: { id: appeal.sanctionId },
      data: input.decision === 'LIFTED'
        ? { status: 'LIFTED', liftedBy: input.adminId, liftedAt: new Date(), liftReason: input.note }
        : { days: input.days, expiresAt: input.days ? new Date(Date.now() + input.days * DAY) : null },
    }).catch(() => null);
  }

  await logAdmin(input.adminId, `FAN_APPEAL_${input.decision}`, 'FAN_REPORT', appeal.reportId ?? appeal.id, input.note, {});
  return { appeal };
}

/* ── A12 통합 성과 리포트 ───────────────────────────── */

export async function getReport12(params: { from?: string; to?: string }) {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from ? new Date(params.from) : new Date(+to - 30 * DAY);
  const span = Math.max(1, Math.round((+to - +from) / DAY));
  const prevFrom = new Date(+from - span * DAY);

  const [
    activeFans, prevFans, ballots, openedVotes,
    earned, spent, clicks, confirmedClicks,
    suggestions, adoptedSuggestions, modTotal, modAuto,
  ] = await Promise.all([
    prisma.fanTemperatureEvent.findMany({
      where: { createdAt: { gte: from, lte: to }, validity: 'VALID' }, select: { userId: true }, distinct: ['userId'],
    }),
    prisma.fanTemperatureEvent.findMany({
      where: { createdAt: { gte: prevFrom, lt: from }, validity: 'VALID' }, select: { userId: true }, distinct: ['userId'],
    }),
    prisma.voteParticipationV2.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.voteV2.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.pointLedgerTx.aggregate({
      where: { createdAt: { gte: from, lte: to }, delta: { gt: 0 } }, _sum: { delta: true },
    }),
    prisma.pointLedgerTx.aggregate({
      where: { createdAt: { gte: from, lte: to }, delta: { lt: 0 } }, _sum: { delta: true },
    }),
    prisma.fanStoreClick.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.fanStoreClick.count({ where: { createdAt: { gte: from, lte: to }, confirmedAt: { not: null } } }),
    prisma.fanBrandSuggestion.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.fanBrandSuggestion.count({
      where: { createdAt: { gte: from, lte: to }, status: { in: ['ADOPTED', 'ACCEPTED'] } },
    }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.fanModerationItem.count({ where: { createdAt: { gte: from, lte: to }, autoResult: { not: 'PENDING' } } }),
  ]);

  /* 팬온도 평균 변화 — 스냅샷이 있어야만 계산한다 */
  const [snapNow, snapPrev] = await Promise.all([
    prisma.fanTemperatureSnapshot.aggregate({ where: { date: { gte: from, lte: to } }, _avg: { score: true } }),
    prisma.fanTemperatureSnapshot.aggregate({ where: { date: { gte: prevFrom, lt: from } }, _avg: { score: true } }),
  ]);
  const tempDelta = snapNow._avg.score != null && snapPrev._avg.score != null
    ? Math.round((snapNow._avg.score - snapPrev._avg.score) * 10) / 10
    : null;

  /* 선수별 성과 — 스냅샷과 활동 원장이 있는 선수만 */
  const topAthletes = await topAthletePerformance(from, to);
  const funnel = [
    { key: 'visit', label: '방문 (스토어 상세)', value: await prisma.fanStore.aggregate({ _sum: { viewCount: true } }).then((r) => r._sum.viewCount ?? 0) },
    { key: 'exit', label: '외부 이동', value: clicks },
    { key: 'confirmed', label: '구매 확정', value: confirmedClicks },
  ].map((s, i, arr) => ({ ...s, rate: i === 0 ? null : rate(s.value, arr[0].value) }));

  return {
    period: { from, to, days: span },
    kpis: [
      {
        key: 'activeFans', label: '활성 팬', value: activeFans.length, unit: '명',
        delta: prevFans.length > 0
          ? Math.round(((activeFans.length - prevFans.length) / prevFans.length) * 1000) / 10 : null,
      },
      { key: 'ballots', label: 'VOTE 참여', value: ballots, unit: '건', delta: null, sub: `개설 ${openedVotes}건` },
      { key: 'tempDelta', label: '팬온도 변화', value: tempDelta, unit: '℃', delta: null, sub: tempDelta === null ? '스냅샷 부족' : '평균 기준' },
      { key: 'pointIssued', label: '포인트 발행', value: Number(earned._sum.delta ?? 0), unit: 'P', delta: null, sub: `사용 ${Math.abs(Number(spent._sum.delta ?? 0)).toLocaleString()}P` },
      { key: 'storeConversion', label: '스토어 전환율', value: rate(confirmedClicks, clicks), unit: '%', delta: null, sub: clicks > 0 ? `이동 ${clicks}건` : '이동 기록 없음' },
      { key: 'suggestAdopt', label: '브랜드 추천 채택률', value: rate(adoptedSuggestions, suggestions), unit: '%', delta: null, sub: suggestions > 0 ? `추천 ${suggestions}건` : '추천 없음' },
      { key: 'autoModeration', label: '검수 자동화율', value: rate(modAuto, modTotal), unit: '%', delta: null, sub: modTotal > 0 ? `검수 ${modTotal}건` : '검수 없음' },
    ],
    funnel,
    topAthletes,
    privacy: {
      notice: '본 리포트의 모든 데이터는 집계·익명화되어 제공됩니다. 개별 팬을 식별할 수 있는 항목은 포함하지 않습니다.',
      minAggregate: 1000,
    },
    generatedAt: new Date(),
  };
}

async function topAthletePerformance(from: Date, to: Date) {
  const grouped = await prisma.fanTemperatureEvent.groupBy({
    by: ['athleteId'],
    where: { createdAt: { gte: from, lte: to }, validity: 'VALID' },
    _count: { _all: true },
    orderBy: { _count: { athleteId: 'desc' } },
    take: 5,
  });
  if (!grouped.length) return [];

  const ids = grouped.map((g) => g.athleteId);
  const [athletes, snapshots] = await Promise.all([
    prisma.athlete.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, profileImageUrl: true, tour: true } }),
    prisma.fanTemperatureSnapshot.findMany({
      where: { athleteId: { in: ids } }, orderBy: { date: 'desc' },
      select: { athleteId: true, score: true, date: true },
    }),
  ]);
  const aMap = new Map(athletes.map((a) => [a.id, a]));
  const sMap = new Map<string, number>();
  for (const s of snapshots) if (!sMap.has(s.athleteId)) sMap.set(s.athleteId, s.score);

  const rows = await Promise.all(grouped.map(async (g) => {
    const [fans, points] = await Promise.all([
      prisma.fanTemperatureEvent.findMany({
        where: { athleteId: g.athleteId, createdAt: { gte: from, lte: to }, validity: 'VALID' },
        select: { userId: true }, distinct: ['userId'],
      }),
      prisma.pointLedgerTx.aggregate({
        where: { athleteId: g.athleteId, createdAt: { gte: from, lte: to }, delta: { gt: 0 } }, _sum: { delta: true },
      }),
    ]);
    return {
      athlete: aMap.get(g.athleteId) ?? null,
      activities: g._count._all,
      activeFans: fans.length,
      temperature: sMap.get(g.athleteId) ?? null,
      pointsIssued: Number(points._sum.delta ?? 0),
    };
  }));
  return rows;
}

/* ── 공통 감사 로그 ─────────────────────────────────── */

export async function logAdmin(
  actorId: string, action: string, targetType: string, targetId: string,
  reason?: string, body?: any,
) {
  return prisma.adminActionLog.create({
    data: { actorId, action, targetType, targetId, reason, requestBody: body ?? undefined },
  }).catch(() => null);
}

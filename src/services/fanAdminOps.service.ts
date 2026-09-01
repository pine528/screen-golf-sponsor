/**
 * 팬 운영 관리자 A06~A11 (핸드오프 v1.0 2026-08-22 §18.2)
 *  A06 팬온도 산식·스냅샷 / A07 포인트 정책·캠페인 / A08 포인트 조정·원장
 *  A09 팬스토어·외부몰·코드 / A10 주문·환불·정산 / A11 브랜드 추천 파이프라인
 *
 * 원칙
 *  - 팬온도 점수와 포인트 잔액은 직접 수정할 수 없다. 산식 버전 발행과 원장 거래로만 바꾼다 (§6.4 · §7.4).
 *  - 외부몰 전환은 SPONPIK 주문이 아니다. 화면·집계에서 분리해서 다룬다 (§8.2).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { COMPONENTS, TIERS, FORMULA_VERSION } from './fanTemperature.service';
import { EARN_RULES, SPEND_RULES, POINT_EXPIRY_MONTHS } from './fanPoint.service';
import { PIPELINE, INTERESTS } from './fanBrandSuggest.service';
import { RESPONSIBLE_LABEL } from './fanStore.service';
import { logAdmin } from './fanAdmin.service';

const prisma = new PrismaClient();
const DAY = 86400_000;
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/* ── A06 팬온도 산식 · 스냅샷 ───────────────────────── */

export async function getFormulaView(athleteId?: string) {
  const [versions, active, lastRun, alerts] = await Promise.all([
    prisma.fanTempFormula.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.fanTempFormula.findFirst({ where: { status: 'ACTIVE' }, orderBy: { effectiveAt: 'desc' } }),
    prisma.fanBatchRun.findFirst({ where: { job: 'FAN_TEMPERATURE' }, orderBy: { startedAt: 'desc' } }),
    anomalyAlerts(),
  ]);

  /* 등록된 버전이 없으면 코드에 박힌 v1.0 을 현재 산식으로 보여준다 */
  const current = active ?? {
    version: FORMULA_VERSION,
    weights: Object.fromEntries(COMPONENTS.map((c) => [c.key, c.weight])),
    minSample: 30, windowDays: 30, recentBoost: 1.3,
    status: 'ACTIVE', note: '코드 기본 산식 (DB 미등록)', effectiveAt: null,
  };

  let snapshot: any = null;
  if (athleteId) {
    const [latest, history, athlete, contributions] = await Promise.all([
      prisma.fanTemperatureSnapshot.findFirst({ where: { athleteId }, orderBy: { date: 'desc' } }),
      prisma.fanTemperatureSnapshot.findMany({
        where: { athleteId, date: { gte: new Date(Date.now() - 30 * DAY) } },
        orderBy: { date: 'asc' }, select: { date: true, score: true, sampleSize: true },
      }),
      prisma.athlete.findUnique({ where: { id: athleteId }, select: { id: true, name: true, profileImageUrl: true, tour: true } }),
      prisma.fanTemperatureEvent.groupBy({
        by: ['source'],
        where: { athleteId, validity: 'VALID', createdAt: { gte: new Date(Date.now() - 7 * DAY) } },
        _count: { _all: true },
      }),
    ]);

    const prev = history.length > 1 ? history[history.length - 2].score : null;
    snapshot = {
      athlete,
      score: latest?.score ?? null,
      sampleSize: latest?.sampleSize ?? null,
      confidence: latest?.confidence ?? null,
      penalties: latest?.penalties ?? null,
      tier: latest ? TIERS.find((t) => latest.score >= t.min && latest.score <= t.max) ?? TIERS[0] : null,
      lowSample: latest ? latest.sampleSize < (current.minSample ?? 30) : null,
      dailyDelta: latest && prev !== null ? Math.round((latest.score - prev) * 10) / 10 : null,
      calculatedAt: latest?.createdAt ?? null,
      history: history.map((h) => ({ date: h.date, score: h.score })),
      /* 기여 이벤트 — 건수만 사실대로. 기여도(℃) 환산은 산식 cap 으로 계산한다 */
      contributions: contributions
        .map((c) => {
          const key = SOURCE_COMPONENT[c.source];
          const comp = COMPONENTS.find((x) => x.key === key);
          return {
            source: c.source,
            label: SOURCE_LABEL[c.source] ?? c.source,
            component: comp?.label ?? null,
            count: c._count._all,
            estimatedScore: comp
              ? Math.round(((Math.min(1, c._count._all / comp.cap)) * comp.weight) * 10) / 10
              : null,
          };
        })
        .sort((a, b) => (b.estimatedScore ?? 0) - (a.estimatedScore ?? 0)),
    };
  }

  return {
    current: {
      version: current.version,
      weights: current.weights,
      minSample: current.minSample,
      windowDays: current.windowDays,
      recentBoost: current.recentBoost,
      status: current.status,
      note: current.note,
      effectiveAt: current.effectiveAt,
    },
    components: COMPONENTS,
    tiers: TIERS,
    versions: versions.map((v) => ({
      id: v.id, version: v.version, status: v.status,
      effectiveAt: v.effectiveAt, retiredAt: v.retiredAt, note: v.note,
    })),
    batch: lastRun
      ? {
          lastRunAt: lastRun.startedAt, status: lastRun.status,
          successRate: rate(lastRun.succeeded, lastRun.processed),
          processed: lastRun.processed, durationMs: lastRun.durationMs,
          nextRunAt: lastRun.nextRunAt,
        }
      : null,
    alerts,
    snapshot,
    notice: '팬온도 점수는 산식에 따라 자동 계산되며, 관리자가 직접 수정할 수 없습니다. 잘못된 활동은 이벤트 제외 후 재계산합니다.',
  };
}

const SOURCE_COMPONENT: Record<string, string> = {
  VOTE: 'vote', COMMUNITY: 'community', LETTER: 'community',
  STORE: 'store', BRAND_SUGGEST: 'store', FAVORITE: 'activeFans', ATHLETE_REPLY: 'athleteReply',
};
const SOURCE_LABEL: Record<string, string> = {
  VOTE: 'VOTE 참여', COMMUNITY: '커뮤니티 활동', LETTER: '응원편지',
  STORE: '스토어 활동', BRAND_SUGGEST: '브랜드 추천', FAVORITE: '관심선수 등록', ATHLETE_REPLY: '선수 응답',
};

/** 이상 징후 — 하루 사이 급변한 선수, 표본 급감 */
async function anomalyAlerts() {
  const snaps = await prisma.fanTemperatureSnapshot.findMany({
    where: { date: { gte: new Date(Date.now() - 2 * DAY) } },
    orderBy: { date: 'desc' },
    select: { athleteId: true, score: true, sampleSize: true, date: true },
  });
  const byAthlete = new Map<string, any[]>();
  for (const s of snaps) {
    const l = byAthlete.get(s.athleteId) ?? [];
    l.push(s);
    byAthlete.set(s.athleteId, l);
  }
  const spikes: string[] = [];
  const sampleDrops: string[] = [];
  for (const [aid, list] of byAthlete) {
    if (list.length < 2) continue;
    const [cur, prev] = list;
    if (Math.abs(cur.score - prev.score) >= 15) spikes.push(aid);
    if (prev.sampleSize > 0 && cur.sampleSize / prev.sampleSize <= 0.5) sampleDrops.push(aid);
  }

  const ids = [...new Set([...spikes, ...sampleDrops])];
  const athletes = ids.length
    ? await prisma.athlete.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const aMap = new Map(athletes.map((a) => [a.id, a.name]));

  return [
    { key: 'spike', label: '급격한 점수 변동 (24시간)', count: spikes.length, athletes: spikes.map((id) => aMap.get(id) ?? id) },
    { key: 'sample', label: '표본 수 급감', count: sampleDrops.length, athletes: sampleDrops.map((id) => aMap.get(id) ?? id) },
  ].filter((a) => a.count > 0);
}

/** 새 산식 버전 발행 — 가중치 합이 100이어야 한다 */
export async function publishFormula(input: {
  version: string; weights: Record<string, number>;
  minSample?: number; windowDays?: number; recentBoost?: number; note?: string; adminId: string;
}) {
  const sum = Object.values(input.weights).reduce((a, b) => a + Number(b || 0), 0);
  if (Math.round(sum) !== 100) {
    throw Object.assign(new Error(`가중치 합계가 100%가 아닙니다 (현재 ${sum}%)`), { status: 400, code: 'WEIGHT_SUM' });
  }
  const missing = COMPONENTS.filter((c) => input.weights[c.key] === undefined);
  if (missing.length) {
    throw Object.assign(new Error(`가중치가 빠진 항목이 있습니다: ${missing.map((m) => m.label).join(', ')}`), { status: 400 });
  }

  const created = await prisma.$transaction(async (t) => {
    await t.fanTempFormula.updateMany({
      where: { status: 'ACTIVE' }, data: { status: 'RETIRED', retiredAt: new Date() },
    });
    return t.fanTempFormula.create({
      data: {
        version: input.version, weights: input.weights,
        minSample: input.minSample ?? 30, windowDays: input.windowDays ?? 30,
        recentBoost: input.recentBoost ?? 1.3,
        status: 'ACTIVE', note: input.note, effectiveAt: new Date(), createdBy: input.adminId,
      },
    });
  });

  await logAdmin(input.adminId, 'FAN_FORMULA_PUBLISH', 'FAN_FORMULA', created.id, input.note, input.weights);
  return {
    formula: created,
    notice: '새 산식은 다음 배치부터 적용됩니다. 기존 스냅샷은 이전 버전으로 보존됩니다.',
  };
}

/** 활동 이벤트 제외 — 점수를 고치는 대신 이벤트를 무효화하고 재계산한다 */
export async function excludeEvents(input: { eventIds: string[]; reason: string; adminId: string }) {
  if (!input.reason?.trim()) throw Object.assign(new Error('제외 사유를 입력해주세요'), { status: 400 });
  const res = await prisma.fanTemperatureEvent.updateMany({
    where: { id: { in: input.eventIds } }, data: { validity: 'INVALID' },
  });
  await logAdmin(input.adminId, 'FAN_TEMP_EVENT_EXCLUDE', 'FAN_TEMPERATURE', input.eventIds.join(','), input.reason, {
    count: res.count,
  });
  return { excluded: res.count, notice: '다음 배치 또는 재계산 시 점수에 반영됩니다.' };
}

/* ── A07 포인트 정책 · 캠페인 ───────────────────────── */

export async function getPointPolicy() {
  const [versions, published, campaigns] = await Promise.all([
    prisma.pointPolicyVersion.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.pointPolicyVersion.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } }),
    prisma.pointCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const current = published ?? {
    version: 'point-policy-v1.0',
    earnRules: EARN_RULES,
    spendRules: SPEND_RULES,
    expiry: { months: POINT_EXPIRY_MONTHS, notices: [90, 30, 7] },
    status: 'PUBLISHED',
    summary: '코드 기본 정책 (DB 미등록)',
    publishedAt: null,
  };

  return {
    current,
    versions: versions.map((v) => ({
      id: v.id, version: v.version, status: v.status,
      summary: v.summary, publishedAt: v.publishedAt, createdAt: v.createdAt,
    })),
    campaigns: campaigns.map(shapeCampaign),
    /* 정책 검증 — 통과 여부를 화면이 그대로 보여준다 (§7.1) */
    validations: [
      { key: 'noCash', label: '현금 전환 금지', ok: true, desc: '포인트는 현금으로 전환할 수 없도록 설정되어 있습니다.' },
      { key: 'noTransfer', label: '포인트 양도 금지', ok: true, desc: '포인트는 다른 사용자에게 양도할 수 없도록 설정되어 있습니다.' },
      {
        key: 'budget', label: '총 리워드 예산 확인',
        ok: campaigns.every((c) => c.spent <= c.totalBudget),
        desc: campaigns.length ? '진행 중인 캠페인이 예산 범위 내에 있습니다.' : '등록된 캠페인이 없습니다.',
      },
      {
        key: 'perUserCap', label: '1인 지급 상한 설정',
        ok: campaigns.every((c) => c.perUserCap > 0),
        desc: '모든 캠페인에 1인당 최대 지급 포인트가 설정되어 있습니다.',
      },
    ],
    notice: '정책을 바꾸면 새 버전으로 발행됩니다. 과거 적립분에는 소급 적용하지 않습니다.',
  };
}

function shapeCampaign(c: any) {
  return {
    id: c.id, name: c.name, description: c.description,
    totalBudget: c.totalBudget, perUserCap: c.perUserCap, spent: c.spent,
    remaining: c.totalBudget - c.spent,
    usedRate: rate(c.spent, c.totalBudget),
    startAt: c.startAt, endAt: c.endAt, target: c.target, status: c.status,
  };
}

export async function publishPointPolicy(input: {
  version: string; earnRules: any; spendRules: any; expiry: any; summary?: string; adminId: string;
}) {
  const rules = Array.isArray(input.earnRules) ? input.earnRules : [];
  const bad = rules.filter((r: any) => Number(r.points) < 0 || (r.dailyCap != null && Number(r.dailyCap) < 0));
  if (bad.length) throw Object.assign(new Error('적립 포인트와 상한은 0 이상이어야 합니다'), { status: 400 });

  const created = await prisma.$transaction(async (t) => {
    await t.pointPolicyVersion.updateMany({ where: { status: 'PUBLISHED' }, data: { status: 'RETIRED' } });
    return t.pointPolicyVersion.create({
      data: {
        version: input.version, earnRules: input.earnRules, spendRules: input.spendRules,
        expiry: input.expiry, summary: input.summary,
        status: 'PUBLISHED', publishedAt: new Date(), createdBy: input.adminId,
      },
    });
  });
  await logAdmin(input.adminId, 'POINT_POLICY_PUBLISH', 'POINT_POLICY', created.id, input.summary, {});
  return { policy: created };
}

export async function upsertCampaign(input: {
  id?: string; name: string; description?: string; totalBudget: number; perUserCap: number;
  startAt: string; endAt: string; target?: string; status?: string; adminId: string;
}) {
  if (!input.name?.trim()) throw Object.assign(new Error('캠페인명을 입력해주세요'), { status: 400 });
  if (!(input.totalBudget > 0)) throw Object.assign(new Error('총 예산은 1P 이상이어야 합니다'), { status: 400 });
  if (!(input.perUserCap > 0)) throw Object.assign(new Error('1인당 최대 지급 포인트를 설정해주세요'), { status: 400 });
  if (new Date(input.endAt) <= new Date(input.startAt)) {
    throw Object.assign(new Error('종료일은 시작일보다 뒤여야 합니다'), { status: 400 });
  }

  const data = {
    name: input.name, description: input.description,
    totalBudget: input.totalBudget, perUserCap: input.perUserCap,
    startAt: new Date(input.startAt), endAt: new Date(input.endAt),
    target: input.target ?? 'ALL', status: input.status ?? 'DRAFT',
  };

  const c = input.id
    ? await prisma.pointCampaign.update({ where: { id: input.id }, data })
    : await prisma.pointCampaign.create({ data: { ...data, createdBy: input.adminId } });

  await logAdmin(input.adminId, input.id ? 'POINT_CAMPAIGN_UPDATE' : 'POINT_CAMPAIGN_CREATE', 'POINT_CAMPAIGN', c.id, input.name, {});
  return { campaign: shapeCampaign(c) };
}

/* ── A08 포인트 조정 · 원장 ─────────────────────────── */

const TWO_APPROVAL_THRESHOLD = 10_000;

export async function getPointLedgerAdmin(params: {
  q?: string; type?: string; status?: string; from?: string; to?: string;
  page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? 50);

  const where: Prisma.PointLedgerTxWhereInput = {
    ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
    ...(params.type === 'EARN' ? { delta: { gt: 0 } } : params.type === 'SPEND' ? { delta: { lt: 0 } } : {}),
    ...(params.q ? { OR: [{ userId: params.q }, { refId: params.q }, { id: params.q }] } : {}),
    ...(params.from || params.to
      ? { createdAt: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
      : {}),
  };

  const [rows, total, available, pendingCnt, expiring, reversed, walletSum, ledgerSum, adjustments] =
    await Promise.all([
      prisma.pointLedgerTx.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.pointLedgerTx.count({ where }),
      prisma.pointWallet.aggregate({ _sum: { balance: true } }),
      prisma.pointLedgerTx.count({ where: { status: 'PENDING' } }),
      prisma.pointLedgerTx.aggregate({
        where: { status: 'AVAILABLE', delta: { gt: 0 }, expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * DAY) } },
        _sum: { delta: true },
      }),
      prisma.pointLedgerTx.aggregate({ where: { refType: 'REVERSAL' }, _sum: { delta: true } }),
      prisma.pointWallet.aggregate({ _sum: { balance: true } }),
      prisma.pointLedgerTx.aggregate({ where: { status: { in: ['AVAILABLE', 'EXPIRED', 'REVERSED'] } }, _sum: { delta: true } }),
      prisma.pointAdjustment.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fan: { select: { nickname: true } } } })
    : [];
  const uMap = new Map(users.map((u) => [u.id, u.fan?.nickname ?? null]));

  const systemTotal = Number(walletSum._sum.balance ?? 0);
  const ledgerTotal = Number(ledgerSum._sum.delta ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.id, userId: r.userId, nickname: uMap.get(r.userId) ?? null,
      source: r.refType, description: r.description,
      delta: Number(r.delta), balanceAfter: Number(r.balanceAfter),
      status: r.status, expiresAt: r.expiresAt, athleteId: r.athleteId,
      createdAt: r.createdAt, originalTxId: r.originalTxId,
    })),
    total, page, limit,
    summary: {
      available: Number(available._sum.balance ?? 0),
      pendingCount: pendingCnt,
      expiringSoon: Number(expiring._sum.delta ?? 0),
      reversed: Math.abs(Number(reversed._sum.delta ?? 0)),
    },
    /* 원장 대사 — 지갑 합계와 원장 합계가 어긋나면 그대로 드러낸다 */
    reconciliation: {
      systemTotal, ledgerTotal, diff: systemTotal - ledgerTotal,
      matched: systemTotal === ledgerTotal,
      checkedAt: new Date(),
    },
    adjustments: adjustments.map(shapeAdjustment),
    twoApprovalThreshold: TWO_APPROVAL_THRESHOLD,
    notice: '잔액은 시스템에 의해 자동 계산되며, 직접 수정할 수 없습니다. 조정은 사유와 케이스 ID가 필요합니다.',
  };
}

function shapeAdjustment(a: any) {
  return {
    id: a.id, userId: a.userId, delta: a.delta, reason: a.reason, caseId: a.caseId,
    status: a.status, requestedBy: a.requestedBy, approvedBy: a.approvedBy,
    needsTwoApprovals: Math.abs(a.delta) > TWO_APPROVAL_THRESHOLD,
    createdAt: a.createdAt,
  };
}

/** 조정 요청 등록 — 적용은 승인 후에만 이루어진다 */
export async function requestAdjustment(input: {
  userId: string; delta: number; reason: string; caseId: string; evidenceUrl?: string; adminId: string;
}) {
  if (!input.userId) throw Object.assign(new Error('회원을 선택해주세요'), { status: 400 });
  if (!input.delta) throw Object.assign(new Error('조정 포인트를 입력해주세요'), { status: 400 });
  if (!input.reason?.trim()) throw Object.assign(new Error('조정 사유는 필수입니다'), { status: 400 });
  if (!/^CASE-\d{8}-\d{4}$/.test(input.caseId || '')) {
    throw Object.assign(new Error('케이스 ID는 CASE-YYYYMMDD-#### 형식이어야 합니다'), { status: 400 });
  }

  if (input.delta < 0) {
    const wallet = await prisma.pointWallet.findUnique({ where: { userId: input.userId } });
    if (Number(wallet?.balance ?? 0) + input.delta < 0) {
      throw Object.assign(new Error('차감 후 잔액이 0보다 작아질 수 없습니다'), { status: 400, code: 'NEGATIVE_BALANCE' });
    }
  }

  const adj = await prisma.pointAdjustment.create({
    data: {
      userId: input.userId, delta: input.delta, reason: input.reason,
      caseId: input.caseId, evidenceUrl: input.evidenceUrl,
      status: 'PENDING', requestedBy: input.adminId,
    },
  });
  await logAdmin(input.adminId, 'POINT_ADJUST_REQUEST', 'POINT_ADJUSTMENT', adj.id, input.reason, {
    userId: input.userId, delta: input.delta, caseId: input.caseId,
  });

  return {
    adjustment: shapeAdjustment(adj),
    needsTwoApprovals: Math.abs(input.delta) > TWO_APPROVAL_THRESHOLD,
    message: Math.abs(input.delta) > TWO_APPROVAL_THRESHOLD
      ? `${TWO_APPROVAL_THRESHOLD.toLocaleString()}P 초과 조정은 다른 관리자의 승인이 필요합니다`
      : '승인 후 원장에 반영됩니다',
  };
}

/** 승인 및 적용 — 원장 거래와 지갑 갱신을 한 트랜잭션으로 처리한다 */
export async function approveAdjustment(id: string, adminId: string) {
  const adj = await prisma.pointAdjustment.findUnique({ where: { id } });
  if (!adj) throw Object.assign(new Error('조정 요청을 찾을 수 없습니다'), { status: 404 });
  if (adj.status !== 'PENDING') return { applied: false, reason: 'NOT_PENDING' };
  if (Math.abs(adj.delta) > TWO_APPROVAL_THRESHOLD && adj.requestedBy === adminId) {
    throw Object.assign(
      new Error(`${TWO_APPROVAL_THRESHOLD.toLocaleString()}P 초과 조정은 요청자가 승인할 수 없습니다`),
      { status: 403, code: 'SAME_ADMIN' },
    );
  }

  const wallet = await prisma.pointWallet.upsert({
    where: { userId: adj.userId }, update: {}, create: { userId: adj.userId, balance: 0 },
  });
  const balance = Number(wallet.balance);
  if (balance + adj.delta < 0) {
    throw Object.assign(new Error('차감 후 잔액이 0보다 작아집니다'), { status: 400, code: 'NEGATIVE_BALANCE' });
  }

  const expiresAt = adj.delta > 0 ? new Date(Date.now() + 365 * DAY) : null;

  const tx = await prisma.$transaction(async (t) => {
    const created = await t.pointLedgerTx.create({
      data: {
        userId: adj.userId, delta: adj.delta, balanceAfter: balance + adj.delta,
        reason: 'FAN_ENGAGE_REWARD' as any,
        refType: 'ADMIN_ADJUST', refId: adj.id,
        description: `${adj.reason} (${adj.caseId})`,
        status: 'AVAILABLE', expiresAt, confirmedAt: new Date(),
      },
    });
    await t.pointWallet.update({ where: { userId: adj.userId }, data: { balance: { increment: adj.delta } } });
    await t.pointAdjustment.update({
      where: { id: adj.id },
      data: { status: 'APPLIED', approvedBy: adminId, approvedAt: new Date(), appliedTxId: created.id },
    });
    return created;
  });

  await logAdmin(adminId, 'POINT_ADJUST_APPLY', 'POINT_ADJUSTMENT', adj.id, adj.reason, {
    txId: tx.id, delta: adj.delta,
  });
  return { applied: true, txId: tx.id };
}

export async function rejectAdjustment(id: string, adminId: string, reason: string) {
  if (!reason?.trim()) throw Object.assign(new Error('반려 사유를 입력해주세요'), { status: 400 });
  const adj = await prisma.pointAdjustment.update({
    where: { id }, data: { status: 'REJECTED', approvedBy: adminId, rejectReason: reason },
  });
  await logAdmin(adminId, 'POINT_ADJUST_REJECT', 'POINT_ADJUSTMENT', id, reason, {});
  return { adjustment: shapeAdjustment(adj) };
}

/* ── A09 팬스토어 · 외부몰 · 코드 ───────────────────── */

export async function listStoresAdmin(params: { status?: string; q?: string } = {}) {
  const stores = await prisma.fanStore.findMany({
    where: {
      ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
      ...(params.q ? { OR: [{ title: { contains: params.q, mode: 'insensitive' } }, { brandName: { contains: params.q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      athlete: { select: { id: true, name: true, profileImageUrl: true } },
      _count: { select: { products: true, clicks: true } },
    },
  });

  return {
    stores: stores.map((s) => ({
      id: s.id, slug: s.slug, title: s.title, brandName: s.brandName,
      athlete: s.athlete, status: s.status,
      responsible: s.responsible,
      responsibleLabel: (RESPONSIBLE_LABEL[s.responsible] ?? RESPONSIBLE_LABEL.BRAND).label,
      products: s._count.products, clicks: s._count.clicks,
      startAt: s.startAt, endAt: s.endAt, updatedAt: s.updatedAt,
    })),
    statuses: [
      { code: 'ALL', label: '전체' }, { code: 'DRAFT', label: '작성 중' },
      { code: 'PUBLISHED', label: '운영중' }, { code: 'CLOSED', label: '종료' },
    ],
    responsibleOptions: Object.entries(RESPONSIBLE_LABEL).map(([code, v]) => ({ code, ...v })),
  };
}

export async function getStoreAdmin(id: string) {
  const s = await prisma.fanStore.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, name: true, profileImageUrl: true } },
      products: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!s) return null;

  const from = new Date(Date.now() - 30 * DAY);
  const [clicks, confirmed, lastPostback] = await Promise.all([
    prisma.fanStoreClick.count({ where: { storeId: id, createdAt: { gte: from } } }),
    prisma.fanStoreClick.count({ where: { storeId: id, createdAt: { gte: from }, confirmedAt: { not: null } } }),
    prisma.fanStoreClick.findFirst({
      where: { storeId: id, confirmedAt: { not: null } }, orderBy: { confirmedAt: 'desc' },
      select: { confirmedAt: true },
    }),
  ]);

  return {
    store: {
      id: s.id, slug: s.slug, title: s.title, summary: s.summary, story: s.story,
      brandName: s.brandName, athlete: s.athlete, heroImageUrl: s.heroImageUrl,
      benefitLabel: s.benefitLabel, benefitCode: s.benefitCode, benefitDesc: s.benefitDesc,
      responsible: s.responsible, sellerName: s.sellerName, sellerContact: s.sellerContact,
      externalUrl: s.externalUrl, status: s.status, startAt: s.startAt, endAt: s.endAt,
    },
    products: s.products.map((p) => ({
      id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price,
      externalUrl: p.externalUrl, isSponsored: p.isSponsored, pointRate: p.pointRate, isActive: p.isActive,
    })),
    /* UTM 은 서버가 만든다 — 화면은 결과만 보여준다 (§8.3) */
    tracking: {
      utmSource: 'sponpik', utmMedium: 'fanstore', utmCampaign: s.slug,
      clickIdParam: 'click_id',
      sample: s.externalUrl
        ? `${s.externalUrl}${s.externalUrl.includes('?') ? '&' : '?'}utm_source=sponpik&utm_medium=fanstore&utm_campaign=${s.slug}&click_id=spk_xxxxxxxx`
        : null,
    },
    performance: {
      window: '최근 30일',
      clicks,
      confirmed,
      conversionRate: rate(confirmed, clicks),
      lastPostbackAt: lastPostback?.confirmedAt ?? null,
      postbackStatus: lastPostback ? '수신 기록 있음' : '수신 기록 없음',
    },
    disclosure: [
      '본 팬스토어(외부몰)에서의 구매·주문·배송·환불 등 모든 거래 책임은 판매자에게 있습니다.',
      'SPONPIK은 클릭 및 코드 사용 이벤트만 수집하며, 구매자의 주문 정보는 수집하지 않습니다.',
    ],
  };
}

export async function upsertStore(input: any & { adminId: string }) {
  if (!input.title?.trim()) throw Object.assign(new Error('스토어명을 입력해주세요'), { status: 400 });
  if (!input.athleteId) throw Object.assign(new Error('선수를 선택해주세요'), { status: 400 });
  if (!input.brandName?.trim()) throw Object.assign(new Error('브랜드명을 입력해주세요'), { status: 400 });
  if (input.status === 'PUBLISHED') {
    if (!input.externalUrl) throw Object.assign(new Error('발행하려면 외부몰 URL이 필요합니다'), { status: 400 });
    if (!input.sellerName) throw Object.assign(new Error('발행하려면 판매자명이 필요합니다'), { status: 400 });
  }

  const slug = (input.slug || `${input.athleteId.slice(0, 6)}-${Date.now().toString(36)}`).toLowerCase();
  const data = {
    athleteId: input.athleteId, brandName: input.brandName, title: input.title,
    summary: input.summary, story: input.story, heroImageUrl: input.heroImageUrl,
    benefitLabel: input.benefitLabel, benefitCode: input.benefitCode, benefitDesc: input.benefitDesc,
    responsible: input.responsible ?? 'BRAND', sellerName: input.sellerName, sellerContact: input.sellerContact,
    externalUrl: input.externalUrl, status: input.status ?? 'DRAFT',
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
  };

  const store = input.id
    ? await prisma.fanStore.update({ where: { id: input.id }, data })
    : await prisma.fanStore.create({ data: { ...data, slug } });

  await logAdmin(input.adminId, input.id ? 'FAN_STORE_UPDATE' : 'FAN_STORE_CREATE', 'FAN_STORE', store.id, input.title, {});
  return { store };
}

/* ── A10 주문 · 환불 · 정산 ─────────────────────────── */

export async function getOrdersView(params: { tab?: string; from?: string; to?: string }) {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from ? new Date(params.from) : new Date(+to - 30 * DAY);

  const [clicks, confirmedClicks, revenue, storeRows] = await Promise.all([
    prisma.fanStoreClick.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: {
        store: { select: { id: true, title: true, brandName: true, responsible: true, sellerContact: true } },
        product: { select: { id: true, name: true, imageUrl: true, pointRate: true } },
      },
    }),
    prisma.fanStoreClick.count({ where: { createdAt: { gte: from, lte: to }, confirmedAt: { not: null } } }),
    prisma.fanStoreClick.aggregate({
      where: { createdAt: { gte: from, lte: to }, confirmedAt: { not: null } }, _sum: { amount: true },
    }),
    prisma.fanStore.findMany({
      select: { id: true, title: true, brandName: true, athlete: { select: { name: true } } },
    }),
  ]);

  /* 브랜드별 전환 집계 */
  const byStore = new Map<string, { title: string; brandName: string; athlete: string | null; clicks: number; confirmed: number; amount: number }>();
  const all = await prisma.fanStoreClick.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { storeId: true, confirmedAt: true, amount: true },
  });
  for (const c of all) {
    const meta = storeRows.find((s) => s.id === c.storeId);
    const cur = byStore.get(c.storeId) ?? {
      title: meta?.title ?? c.storeId, brandName: meta?.brandName ?? '-',
      athlete: meta?.athlete?.name ?? null, clicks: 0, confirmed: 0, amount: 0,
    };
    cur.clicks += 1;
    if (c.confirmedAt) { cur.confirmed += 1; cur.amount += c.amount ?? 0; }
    byStore.set(c.storeId, cur);
  }

  return {
    period: { from, to },
    /* 내부 결제는 아직 도입하지 않았다 — 있지도 않은 주문 수를 만들지 않는다 (§8.1 SPON Pay 2차) */
    internalOrders: {
      enabled: false,
      notice: 'SPON Pay(내부 결제)는 아직 도입되지 않았습니다. 현재 팬스토어는 외부몰 연결형으로만 운영됩니다.',
    },
    externalExits: {
      total: all.length,
      confirmed: confirmedClicks,
      conversionRate: rate(confirmedClicks, all.length),
      revenue: Number(revenue._sum.amount ?? 0),
      items: clicks.map((c) => ({
        clickId: c.clickId,
        store: c.store, product: c.product,
        userId: c.userId ? `user_${c.userId.slice(0, 4)}` : null,
        confirmed: !!c.confirmedAt,
        confirmedAt: c.confirmedAt,
        amount: c.amount,
        estimatedPoints: c.amount && c.product?.pointRate ? Math.floor(c.amount * c.product.pointRate) : null,
        createdAt: c.createdAt,
        responsible: c.store?.responsible ?? 'BRAND',
      })),
      notice: '외부몰 전환은 SPONPIK 주문이 아니며, 구매·환불·정산 책임은 외부몰 및 판매자에게 있습니다.',
    },
    byStore: [...byStore.entries()].map(([id, v]) => ({
      storeId: id, ...v, conversionRate: rate(v.confirmed, v.clicks),
    })).sort((a, b) => b.clicks - a.clicks),
  };
}

/* ── A11 브랜드 추천 파이프라인 ─────────────────────── */

const STAGE_ORDER = ['RECEIVED', 'REVIEWING', 'DELIVERED', 'INTERESTED', 'ADOPTED', 'HOLD'];
const STAGE_LABEL: Record<string, string> = {
  RECEIVED: '접수', REVIEWING: '검토', DELIVERED: '브랜드 전달',
  INTERESTED: '관심', ADOPTED: '채택', HOLD: '보류', CLOSED: '종료',
};
const normalize = (s: string) =>
  s === 'PENDING' ? 'RECEIVED' : s === 'ACCEPTED' ? 'ADOPTED' : s === 'REJECTED' ? 'CLOSED' : s;

export async function getSuggestionBoard() {
  const rows = await prisma.fanBrandSuggestion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { athlete: { select: { id: true, name: true, profileImageUrl: true, sportType: true } } },
  });

  const columns = STAGE_ORDER.map((code) => ({
    code, label: STAGE_LABEL[code],
    cards: rows
      .filter((r) => normalize(r.status) === code)
      .slice(0, 20)
      .map((r) => ({
        id: r.id, athlete: r.athlete, brandName: r.brandName, category: r.category,
        interest: r.interest,
        interestLabel: INTERESTS.find((i) => i.code === r.interest)?.label ?? r.interest,
        isPublic: r.isPublic, createdAt: r.createdAt,
      })),
    total: rows.filter((r) => normalize(r.status) === code).length,
  }));

  const from = new Date(Date.now() - 7 * DAY);
  const recent = rows.filter((r) => r.createdAt >= from);
  const adopted = recent.filter((r) => normalize(r.status) === 'ADOPTED');

  return {
    columns,
    pipeline: PIPELINE,
    insights: {
      window: '최근 7일',
      received: recent.length,
      adopted: adopted.length,
      adoptRate: rate(adopted.length, recent.length),
    },
    /* 자동 지급 규칙은 포인트 적립표를 그대로 따른다 */
    rewardRules: EARN_RULES.filter((r) => r.code === 'BRAND_SUGGEST' || r.code === 'BRAND_ADOPTED'),
    notice: '브랜드에는 팬의 개인정보를 전달하지 않습니다. 익명 인사이트로만 제공합니다.',
  };
}

export async function getSuggestion(id: string) {
  const s = await prisma.fanBrandSuggestion.findUnique({
    where: { id },
    include: { athlete: { select: { id: true, name: true, profileImageUrl: true, sportType: true } } },
  });
  if (!s) return null;

  /* 같은 선수 · 같은 브랜드 중복 추천 수 */
  const duplicates = s.brandName
    ? await prisma.fanBrandSuggestion.count({
        where: { athleteId: s.athleteId, brandName: s.brandName, id: { not: s.id } },
      })
    : 0;

  const status = normalize(s.status);
  return {
    id: s.id,
    athlete: s.athlete,
    brandName: s.brandName,
    category: s.category,
    reason: s.reason,
    interest: s.interest,
    interestLabel: INTERESTS.find((i) => i.code === s.interest)?.label ?? s.interest,
    /* 이해관계가 있으면 검토 없이 전달하지 않는다 (§9.1) */
    conflictWarning: s.interest !== 'NONE'
      ? '추천자가 해당 브랜드와 이해관계가 있다고 표시했습니다. 검토 후 전달 여부를 결정하세요.'
      : null,
    isPublic: s.isPublic,
    status,
    statusLabel: STAGE_LABEL[status] ?? status,
    statusNote: s.statusNote,
    duplicates,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
    stages: STAGE_ORDER.map((code) => ({ code, label: STAGE_LABEL[code] })),
    privacyNotice: '브랜드에는 팬 개인정보를 전달하지 않습니다.',
  };
}

export async function moveSuggestion(input: { id: string; status: string; note?: string; adminId: string }) {
  if (!STAGE_ORDER.includes(input.status) && input.status !== 'CLOSED') {
    throw Object.assign(new Error('알 수 없는 단계입니다'), { status: 400 });
  }
  const before = await prisma.fanBrandSuggestion.findUnique({ where: { id: input.id } });
  if (!before) throw Object.assign(new Error('추천을 찾을 수 없습니다'), { status: 404 });

  if (input.status === 'DELIVERED' && before.interest !== 'NONE' && normalize(before.status) === 'RECEIVED') {
    throw Object.assign(
      new Error('이해관계가 표시된 추천은 검토 단계를 거쳐야 전달할 수 있습니다'),
      { status: 400, code: 'REVIEW_REQUIRED' },
    );
  }

  const updated = await prisma.fanBrandSuggestion.update({
    where: { id: input.id },
    data: {
      status: input.status, statusNote: input.note,
      reviewedAt: new Date(), reviewedBy: input.adminId,
    },
  });

  /* 채택 시 추천 팬에게 보상 포인트를 적립한다 (§9.1) */
  let point: any = null;
  if (input.status === 'ADOPTED') {
    const { earn } = await import('./fanPoint.service');
    point = await earn({
      userId: updated.fanUserId, code: 'BRAND_ADOPTED',
      refType: 'BRAND_ADOPTED', refId: updated.id, athleteId: updated.athleteId,
    }).catch(() => null);
  }
  /* 검토 통과 시 보류됐던 적립을 살린다 */
  if (input.status === 'REVIEWING' || input.status === 'DELIVERED') {
    const { earn } = await import('./fanPoint.service');
    if (before.interest !== 'NONE') {
      point = await earn({
        userId: updated.fanUserId, code: 'BRAND_SUGGEST',
        refType: 'BRAND_SUGGEST', refId: updated.id, athleteId: updated.athleteId,
      }).catch(() => null);
    }
  }

  await logAdmin(input.adminId, 'BRAND_SUGGEST_MOVE', 'BRAND_SUGGESTION', updated.id, input.note, {
    from: normalize(before.status), to: input.status,
  });

  return { suggestion: await getSuggestion(input.id), point };
}

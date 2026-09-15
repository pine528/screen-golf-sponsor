/**
 * 팬포인트 v1.0 (핸드오프 v1.0 2026-08-22 §7)
 *
 * 원칙
 *  - 무상 발행 폐쇄형 리워드. 현금 환전·회원 간 양도·구매 불가 (§7.1).
 *  - 잔액 필드 직접 수정 금지. 모든 변화는 point_ledger 거래로 기록한다.
 *  - 적립은 즉시 확정하지 않고 pending → available 단계를 둔다 (§7.1).
 *  - 유효기간 12개월. 소멸 예고 알림 (§7.5).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const POINT_EXPIRY_MONTHS = 12;

/** 기본 적립표 v1.0 (§7.2) — 화면·적립이 모두 이 표만 본다 */
export const EARN_RULES = [
  { code: 'FAVORITE', label: '관심선수 최초 등록', points: 3, limit: '선수당 1회', dailyCap: null, monthlyCap: null, confirm: 'INSTANT' },
  { code: 'VOTE', label: 'Fan VOTE 참여', points: 2, limit: '일 5건', dailyCap: 5, monthlyCap: null, confirm: 'AFTER_CLOSE' },
  { code: 'VOTE_CORRECT', label: '예측 정답', points: 5, limit: 'VOTE별 1회', dailyCap: null, monthlyCap: null, confirm: 'AFTER_RESULT' },
  { code: 'VOTE_HOST', label: '내가 만든 VOTE에 다른 팬 참여', points: 1, limit: '일 20건 · 투표당 50명', dailyCap: 20, monthlyCap: null, confirm: 'INSTANT' },
  { code: 'COMMENT', label: '유효 댓글', points: 1, limit: '일 5건', dailyCap: 5, monthlyCap: null, confirm: 'AFTER_24H' },
  { code: 'POST', label: '유효 게시글', points: 3, limit: '주 3건', dailyCap: null, monthlyCap: 12, confirm: 'AFTER_24H' },
  { code: 'BRAND_SUGGEST', label: '브랜드 추천', points: 5, limit: '월 3건', dailyCap: null, monthlyCap: 3, confirm: 'AFTER_REVIEW' },
  { code: 'BRAND_ADOPTED', label: '추천 채택', points: 30, limit: '월 1건', dailyCap: null, monthlyCap: 1, confirm: 'AFTER_BRAND' },
  { code: 'STORE_PURCHASE', label: '팬스토어 구매', points: 0, rate: 0.01, limit: '월 5,000P', dailyCap: null, monthlyCap: 5000, confirm: 'AFTER_CONFIRM' },
] as const;

/** 사용처 (§7.3) */
export const SPEND_RULES = [
  { code: 'STORE_DISCOUNT', label: '팬스토어 할인', desc: '주문금액 최대 10%, 최소 100P', available: true },
  { code: 'VOTE_BADGE', label: 'VOTE 특별 배지', desc: '결과에 영향 없는 장식', available: false },
  { code: 'FAN_PROJECT', label: '선수 응원 프로젝트', desc: '포인트 기부형, 환불 불가 사전 고지', available: false },
  { code: 'YEAR_END_AD', label: '연말 광고 프로젝트', desc: '팬 기여도 조건 충족 시 자동 응모', available: false },
  { code: 'CASH', label: '현금·상품권 교환', desc: '도입하지 않습니다', available: false },
] as const;

/** 팬 배지 — 단일 등급으로 시작한다 (§벤치마크 Patreon) */
export const BADGES = [
  { code: 'STARTER', label: '팬스타터', min: 0 },
  { code: 'CHAMPION', label: '팬챔피언', min: 2000 },
] as const;

const startOfDay = (d = new Date()) => new Date(d.toISOString().slice(0, 10));
const startOfMonth = (d = new Date()) => new Date(`${d.toISOString().slice(0, 7)}-01`);

/**
 * 적립 — 상한을 넘으면 조용히 0P로 기록하지 않고 적립 자체를 건너뛴다.
 * (source, refType, refId) 유니크로 중복 적립을 막는다.
 */
export async function earn(input: {
  userId: string;
  code: string;
  refType: string;
  refId: string;
  athleteId?: string;
  amount?: number; // STORE_PURCHASE 결제액
  description?: string;
}) {
  const rule = EARN_RULES.find((r) => r.code === input.code);
  if (!rule) throw Object.assign(new Error('알 수 없는 적립 항목입니다'), { status: 400 });

  const points = (rule as any).rate
    ? Math.floor((input.amount ?? 0) * (rule as any).rate)
    : rule.points;
  if (points <= 0) return { earned: 0, reason: 'ZERO' as const };

  /* 상한 검사 (§7.2) */
  if (rule.dailyCap) {
    const n = await prisma.pointLedgerTx.count({
      where: { userId: input.userId, refType: input.code, createdAt: { gte: startOfDay() }, delta: { gt: 0 } },
    });
    if (n >= rule.dailyCap) return { earned: 0, reason: 'DAILY_CAP' as const, limit: rule.limit };
  }
  if (rule.monthlyCap) {
    const agg = await prisma.pointLedgerTx.aggregate({
      where: { userId: input.userId, refType: input.code, createdAt: { gte: startOfMonth() }, delta: { gt: 0 } },
      _sum: { delta: true }, _count: { _all: true },
    });
    const usedCount = agg._count._all;
    const usedPoints = Number(agg._sum.delta ?? 0);
    /* 건수 상한과 포인트 상한을 항목 성격에 맞게 나눠 본다 */
    const overCount = rule.code !== 'STORE_PURCHASE' && usedCount >= rule.monthlyCap;
    const overPoints = rule.code === 'STORE_PURCHASE' && usedPoints >= rule.monthlyCap;
    if (overCount || overPoints) return { earned: 0, reason: 'MONTHLY_CAP' as const, limit: rule.limit };
  }

  const instant = rule.confirm === 'INSTANT';
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + POINT_EXPIRY_MONTHS);

  try {
    const wallet = await prisma.pointWallet.upsert({
      where: { userId: input.userId },
      update: {},
      create: { userId: input.userId, balance: 0 },
    });

    const tx = await prisma.$transaction(async (t) => {
      const created = await t.pointLedgerTx.create({
        data: {
          userId: input.userId,
          delta: instant ? points : 0, // pending은 가용잔액에 영향을 주지 않는다 (§7.4)
          balanceAfter: instant ? Number(wallet.balance) + points : Number(wallet.balance),
          reason: 'FAN_ENGAGE_REWARD' as any,
          refType: input.code,
          refId: input.refId,
          description: input.description ?? rule.label,
          status: instant ? 'AVAILABLE' : 'PENDING',
          expiresAt,
          confirmedAt: instant ? new Date() : null,
          athleteId: input.athleteId,
        },
      });
      if (instant) {
        await t.pointWallet.update({
          where: { userId: input.userId },
          data: { balance: { increment: points } },
        });
      }
      return created;
    });

    return { earned: points, status: tx.status, txId: tx.id, reason: 'OK' as const };
  } catch (e: any) {
    if (e?.code === 'P2002') return { earned: 0, reason: 'DUPLICATE' as const };
    throw e;
  }
}

/** pending → available 확정 (매시간 배치 / 결과 확정 시) */
export async function confirmPending(filter: { userId?: string; refType?: string; refId?: string; before?: Date }) {
  const rows = await prisma.pointLedgerTx.findMany({
    where: {
      status: 'PENDING',
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.refType ? { refType: filter.refType } : {}),
      ...(filter.refId ? { refId: filter.refId } : {}),
      ...(filter.before ? { createdAt: { lte: filter.before } } : {}),
    },
    take: 500,
  });

  let confirmed = 0;
  for (const r of rows) {
    const rule = EARN_RULES.find((x) => x.code === r.refType);
    const points = rule ? ((rule as any).rate ? Number(r.delta) || 0 : rule.points) : Number(r.delta) || 0;
    if (points <= 0) continue;
    await prisma.$transaction([
      prisma.pointLedgerTx.update({
        where: { id: r.id },
        data: { status: 'AVAILABLE', delta: points, confirmedAt: new Date() },
      }),
      prisma.pointWallet.update({ where: { userId: r.userId }, data: { balance: { increment: points } } }),
    ]).then(() => { confirmed += 1; }).catch(() => null);
  }
  return { confirmed, scanned: rows.length };
}

/** 회수 — 삭제하지 않고 원거래를 참조하는 reversal을 남긴다 (§5.5 · §7.4) */
export async function reverse(txId: string, reason: string) {
  const orig = await prisma.pointLedgerTx.findUnique({ where: { id: txId } });
  if (!orig) throw Object.assign(new Error('원거래를 찾을 수 없습니다'), { status: 404 });
  if (orig.status === 'REVERSED') return { reversed: false, reason: 'ALREADY' };

  const amount = Number(orig.delta);
  const wallet = await prisma.pointWallet.findUnique({ where: { userId: orig.userId } });
  const balance = Number(wallet?.balance ?? 0);

  await prisma.$transaction([
    prisma.pointLedgerTx.update({ where: { id: txId }, data: { status: 'REVERSED' } }),
    prisma.pointLedgerTx.create({
      data: {
        userId: orig.userId,
        delta: -amount,
        balanceAfter: balance - amount,
        reason: 'FAN_ENGAGE_REWARD' as any,
        refType: 'REVERSAL',
        refId: txId,
        description: reason,
        status: 'AVAILABLE',
        originalTxId: txId,
        athleteId: orig.athleteId,
      },
    }),
    prisma.pointWallet.update({ where: { userId: orig.userId }, data: { balance: { decrement: amount } } }),
  ]);
  return { reversed: true, amount };
}

/** 만료 배치 (매일 00:10) */
export async function expirePoints(now = new Date()) {
  const rows = await prisma.pointLedgerTx.findMany({
    where: { status: 'AVAILABLE', delta: { gt: 0 }, expiresAt: { lte: now } },
    take: 1000,
  });
  let expired = 0;
  for (const r of rows) {
    const amount = Number(r.delta);
    const wallet = await prisma.pointWallet.findUnique({ where: { userId: r.userId } });
    const balance = Number(wallet?.balance ?? 0);
    if (balance < amount) continue; // 이미 쓴 포인트는 만료 대상이 아니다
    await prisma.$transaction([
      prisma.pointLedgerTx.update({ where: { id: r.id }, data: { status: 'EXPIRED' } }),
      prisma.pointLedgerTx.create({
        data: {
          userId: r.userId, delta: -amount, balanceAfter: balance - amount,
          reason: 'FAN_ENGAGE_REWARD' as any, refType: 'EXPIRY', refId: r.id,
          description: '유효기간 만료', status: 'AVAILABLE', originalTxId: r.id,
        },
      }),
      prisma.pointWallet.update({ where: { userId: r.userId }, data: { balance: { decrement: amount } } }),
    ]).then(() => { expired += 1; }).catch(() => null);
  }
  return { expired, scanned: rows.length };
}

/* ── 조회 (F09 · F10) ────────────────────────────────── */

export async function getMyPoints(userId: string) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400_000);

  const [wallet, pending, expiring, recent, monthEarned] = await Promise.all([
    prisma.pointWallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.pointLedgerTx.aggregate({ where: { userId, status: 'PENDING' }, _count: { _all: true } }),
    prisma.pointLedgerTx.findMany({
      where: { userId, status: 'AVAILABLE', delta: { gt: 0 }, expiresAt: { gte: now, lte: in30 } },
      select: { delta: true, expiresAt: true },
      orderBy: { expiresAt: 'asc' },
    }),
    prisma.pointLedgerTx.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, delta: true, refType: true, description: true, status: true, createdAt: true },
    }),
    prisma.pointLedgerTx.aggregate({
      where: { userId, delta: { gt: 0 }, createdAt: { gte: startOfMonth() } }, _sum: { delta: true },
    }),
  ]);

  /* pending 포인트는 규칙표에서 금액을 되짚는다 (원장 delta는 0) */
  const pendingRows = await prisma.pointLedgerTx.findMany({
    where: { userId, status: 'PENDING' }, select: { refType: true, delta: true },
  });
  const pendingPoints = pendingRows.reduce((s, r) => {
    const rule = EARN_RULES.find((x) => x.code === r.refType);
    return s + (rule ? ((rule as any).rate ? Number(r.delta) : rule.points) : Number(r.delta));
  }, 0);

  const balance = Number(wallet?.balance ?? 0);
  const expiringSoon = expiring.reduce((s, e) => s + Number(e.delta), 0);
  const badge = [...BADGES].reverse().find((b) => balance >= b.min) ?? BADGES[0];
  const next = BADGES.find((b) => b.min > balance) ?? null;

  return {
    balance,
    available: balance,
    pending: pendingPoints,
    pendingCount: pending._count._all,
    expiringSoon,
    expirySchedule: expiring.slice(0, 5).map((e) => ({ amount: Number(e.delta), expiresAt: e.expiresAt })),
    monthEarned: Number(monthEarned._sum.delta ?? 0),
    badge,
    nextBadge: next ? { ...next, remaining: next.min - balance } : null,
    earnRules: EARN_RULES,
    spendRules: SPEND_RULES,
    recent: recent.map(shapeTx),
    notice: '팬포인트는 현금이 아니며 SPONPIK 팬 참여 혜택에만 사용됩니다. 현금 전환과 타인 양도는 불가합니다.',
  };
}

const TX_LABEL: Record<string, string> = {
  FAVORITE: '관심선수 등록', VOTE: 'VOTE 참여', VOTE_CORRECT: '예측 성공 보상',
  COMMENT: '유효 댓글 작성', POST: '게시글 작성', BRAND_SUGGEST: '브랜드 추천',
  BRAND_ADOPTED: '추천 채택', STORE_PURCHASE: '팬스토어 구매 적립',
  REVERSAL: '적립 회수', EXPIRY: '유효기간 만료', REDEEM_GOODS: '포인트 사용',
};

function shapeTx(t: any) {
  const rule = EARN_RULES.find((x) => x.code === t.refType);
  const amount = t.status === 'PENDING' && rule ? ((rule as any).rate ? Number(t.delta) : rule.points) : Number(t.delta);
  return {
    id: t.id,
    amount,
    kind: amount > 0 ? (t.status === 'PENDING' ? 'PENDING' : 'EARN') : t.refType === 'EXPIRY' ? 'EXPIRE' : t.refType === 'REVERSAL' ? 'REVERSE' : 'SPEND',
    label: TX_LABEL[t.refType] ?? t.description ?? t.refType,
    description: t.description,
    status: t.status,
    refType: t.refType,
    refId: t.refId,
    expiresAt: t.expiresAt,
    athleteId: t.athleteId,
    createdAt: t.createdAt,
  };
}

export async function getLedger(userId: string, params: {
  kind?: string; from?: string; to?: string; athleteId?: string; page?: number; limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, params.limit ?? 10);

  const statusFilter =
    params.kind === 'EARN' ? { status: 'AVAILABLE', delta: { gt: 0 } }
    : params.kind === 'SPEND' ? { delta: { lt: 0 } }
    : params.kind === 'PENDING' ? { status: 'PENDING' }
    : params.kind === 'EXPIRED' ? { status: 'EXPIRED' }
    : {};

  const where: Prisma.PointLedgerTxWhereInput = {
    userId,
    ...(statusFilter as any),
    ...(params.athleteId ? { athleteId: params.athleteId } : {}),
    ...(params.from || params.to
      ? { createdAt: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
      : {}),
  };

  const [rows, total, summary] = await Promise.all([
    prisma.pointLedgerTx.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.pointLedgerTx.count({ where }),
    getMyPoints(userId),
  ]);

  /* 선수명 붙이기 */
  const ids = [...new Set(rows.map((r) => r.athleteId).filter(Boolean))] as string[];
  const athletes = ids.length
    ? await prisma.athlete.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, profileImageUrl: true } })
    : [];
  const map = new Map(athletes.map((a) => [a.id, a]));

  return {
    items: rows.map((r) => ({ ...shapeTx(r), athlete: r.athleteId ? map.get(r.athleteId) ?? null : null })),
    total, page, limit,
    summary: {
      available: summary.available,
      pending: summary.pending,
      expiringSoon: summary.expiringSoon,
      expirySchedule: summary.expirySchedule,
    },
    policy: {
      expiryMonths: POINT_EXPIRY_MONTHS,
      notice: '포인트는 현금으로 환불이 불가하며, 타인에게 양도할 수 없습니다. 부정 사용이 확인될 경우 포인트 회수 및 서비스 이용이 제한될 수 있습니다.',
    },
  };
}

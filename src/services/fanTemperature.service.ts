/**
 * 팬온도 산식 v1.0 (핸드오프 v1.0 2026-08-22 §6)
 *
 * 정의: 최근 30일 동안 특정 선수에게 발생한 **유효 팬 활동**의 강도·다양성·지속성을
 *       0~100으로 환산한 활성도 지표. 선수의 가치나 실력 점수가 아니다 (§6.1).
 *
 * 규칙
 *  - 구성요소를 각각 0~100으로 정규화한 뒤 가중합하고, 신뢰도 계수와 감점을 적용한다 (§6.2).
 *  - 최근 7일 활동에 1.3배 가중, 표본 30명 미만은 '데이터 축적 중' 라벨 (§6.4).
 *  - 관리자 수동 숫자 입력 금지. 제외 이벤트·보정 사유만 등록하고 재계산한다 (§6.4).
 *  - 산식 변경 시 version·effective_at을 보존하고 과거 스냅샷을 덮어쓰지 않는다.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const FORMULA_VERSION = 'fan-temp-v1.0-2026-08-22';
const WINDOW_DAYS = 30;
const RECENT_DAYS = 7;
const RECENT_BOOST = 1.3;
const MIN_SAMPLE = 30;

/** 구성요소 가중치 (§6.2) — 합계 100 */
export const COMPONENTS = [
  { key: 'activeFans', label: '활동 팬 수', desc: '팬 활동에 참여한 고유 팬 수', weight: 30, cap: 120 },
  { key: 'vote', label: 'Fan VOTE', desc: '투표 및 응원 참여', weight: 20, cap: 300 },
  { key: 'community', label: '커뮤니티 참여', desc: '게시글, 댓글, 좋아요 등', weight: 20, cap: 300 },
  { key: 'store', label: '스토어/스폰서십 액션', desc: '스토어 이용, 스폰서십 응원 등', weight: 15, cap: 60 },
  { key: 'continuity', label: '활동 지속성', desc: '꾸준한 방문과 활동', weight: 10, cap: 4 },
  { key: 'athleteReply', label: '선수와의 소통 (응답)', desc: '댓글·DM 응답, 콘텐츠 상호작용', weight: 5, cap: 8 },
] as const;

/** 표시 구간 (§6.3) */
export const TIERS = [
  { min: 0, max: 19.9, label: '새싹', meaning: '데이터 축적 초기', tone: 'sprout' },
  { min: 20, max: 39.9, label: '따뜻함', meaning: '팬 활동 형성', tone: 'warm' },
  { min: 40, max: 59.9, label: '활발함', meaning: '지속적 참여', tone: 'active' },
  { min: 60, max: 79.9, label: '뜨거움', meaning: '높은 활성도', tone: 'hot' },
  { min: 80, max: 100, label: '열광', meaning: '매우 높은 활성도', tone: 'blazing' },
] as const;

export function tierOf(score: number) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[0];
}

/** 활동 source → 구성요소 매핑 */
const SOURCE_TO_COMPONENT: Record<string, string> = {
  VOTE: 'vote',
  COMMUNITY: 'community',
  LETTER: 'community',
  STORE: 'store',
  BRAND_SUGGEST: 'store',
  FAVORITE: 'activeFans',
  ATHLETE_REPLY: 'athleteReply',
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const weekKey = (d: Date) => {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // 월요일 시작
  return t.toISOString().slice(0, 10);
};

/**
 * 선수 1명의 팬온도를 계산한다. 저장은 하지 않는다.
 * 최근 7일 활동에 1.3배 가중치를 준다 (§6.4).
 */
export async function computeTemperature(athleteId: string, asOf = new Date()) {
  const from = new Date(asOf.getTime() - WINDOW_DAYS * 86400_000);
  const recentFrom = new Date(asOf.getTime() - RECENT_DAYS * 86400_000);

  const events = await prisma.fanTemperatureEvent.findMany({
    where: { athleteId, createdAt: { gte: from, lte: asOf } },
    select: { userId: true, source: true, amount: true, validity: true, riskScore: true, createdAt: true },
  });

  /* 유효표만 센다. 보류·무효는 감점 근거로만 쓴다 (§5.5 · §6.2) */
  const valid = events.filter((e) => e.validity === 'VALID');
  const invalid = events.length - valid.length;

  const raw: Record<string, number> = {
    activeFans: 0, vote: 0, community: 0, store: 0, continuity: 0, athleteReply: 0,
  };

  /* 활동 팬 규모 — 동일 팬은 주 1회만 센다 (§6.2 상한) */
  const fanWeeks = new Set<string>();
  const fans = new Set<string>();
  /* VOTE는 팬당 일 5회 상한 */
  const votePerFanDay = new Map<string, number>();
  const weeksActive = new Set<string>();

  for (const e of valid) {
    const w = weekKey(e.createdAt);
    const boost = e.createdAt >= recentFrom ? RECENT_BOOST : 1;
    fans.add(e.userId);
    fanWeeks.add(`${e.userId}:${w}`);
    weeksActive.add(w);

    const comp = SOURCE_TO_COMPONENT[e.source];
    if (!comp || comp === 'activeFans') continue;

    if (comp === 'vote') {
      const k = `${e.userId}:${dayKey(e.createdAt)}`;
      const n = (votePerFanDay.get(k) ?? 0) + 1;
      votePerFanDay.set(k, n);
      if (n > 5) continue; // 일 5회 상한
      raw.vote += boost;
    } else if (comp === 'store') {
      /* 금액은 로그 스케일 — 고액 1인의 영향을 제한한다 (§8.5) */
      const amt = Math.max(0, e.amount ?? 0);
      raw.store += boost * (amt > 0 ? Math.log10(1 + amt / 1000) : 1);
    } else {
      raw[comp] += boost;
    }
  }

  raw.activeFans = fanWeeks.size;
  raw.continuity = Math.min(4, weeksActive.size);

  /* 0~100 정규화 */
  const components: Record<string, number> = {};
  let weighted = 0;
  for (const c of COMPONENTS) {
    const score = Math.min(100, (raw[c.key] / c.cap) * 100);
    components[c.key] = Math.round(score * 10) / 10;
    weighted += (score * c.weight) / 100;
  }

  /* 표본 신뢰도 — 30명 미만이면 비례 축소 (§6.4) */
  const sampleSize = fans.size;
  const confidence = sampleSize >= MIN_SAMPLE ? 1 : Math.max(0.3, sampleSize / MIN_SAMPLE);

  /* 감점 — 보류·무효 비율 (§6.2) */
  const penalties = events.length ? Math.min(15, (invalid / events.length) * 30) : 0;

  const score = Math.round(Math.min(100, Math.max(0, weighted * confidence - penalties)) * 10) / 10;

  return {
    score,
    components,
    rawComponents: raw,
    sampleSize,
    confidence: Math.round(confidence * 100) / 100,
    penalties: Math.round(penalties * 10) / 10,
    formulaVersion: FORMULA_VERSION,
    windowFrom: from,
    windowTo: asOf,
    /* 표본이 적으면 숫자는 보여주되 라벨을 붙인다 (§6.4) */
    lowSample: sampleSize < MIN_SAMPLE,
  };
}

/** 일배치 저장 — 같은 날·같은 버전이면 덮어쓴다(멱등, QA T-01) */
export async function snapshotTemperature(athleteId: string, asOf = new Date()) {
  const r = await computeTemperature(athleteId, asOf);
  const date = new Date(dayKey(asOf));
  await prisma.fanTemperatureSnapshot.upsert({
    where: { athleteId_date_formulaVersion: { athleteId, date, formulaVersion: FORMULA_VERSION } },
    update: {
      score: r.score,
      components: r.components as Prisma.InputJsonValue,
      sampleSize: r.sampleSize,
      confidence: r.confidence,
      penalties: r.penalties,
    },
    create: {
      athleteId, date, formulaVersion: FORMULA_VERSION,
      score: r.score,
      components: r.components as Prisma.InputJsonValue,
      sampleSize: r.sampleSize,
      confidence: r.confidence,
      penalties: r.penalties,
    },
  });
  return r;
}

/** 전 선수 일배치 (매일 03:00 KST) */
export async function runDailySnapshot(asOf = new Date()) {
  const athletes = await prisma.athlete.findMany({ where: { isActive: true }, select: { id: true } });
  let done = 0;
  for (const a of athletes) {
    await snapshotTemperature(a.id, asOf).catch(() => null);
    done += 1;
  }
  return { athletes: athletes.length, done, formulaVersion: FORMULA_VERSION, asOf };
}

/**
 * 화면용 팬온도 — 스냅샷이 있으면 쓰고, 없으면 즉시 계산한다.
 * 추이는 저장된 스냅샷만 쓴다 (없는 날은 만들지 않는다 — LEG-06).
 */
export async function getTemperatureView(athleteId: string, opts?: { days?: number; userId?: string }) {
  const days = Math.min(90, Math.max(7, opts?.days ?? 30));
  const today = new Date(dayKey(new Date()));

  const [snapshot, history] = await Promise.all([
    prisma.fanTemperatureSnapshot.findFirst({
      where: { athleteId, formulaVersion: FORMULA_VERSION },
      orderBy: { date: 'desc' },
    }),
    prisma.fanTemperatureSnapshot.findMany({
      where: {
        athleteId, formulaVersion: FORMULA_VERSION,
        date: { gte: new Date(today.getTime() - days * 86400_000) },
      },
      orderBy: { date: 'asc' },
      select: { date: true, score: true, sampleSize: true },
    }),
  ]);

  /* 오늘 스냅샷이 없으면 즉시 계산해 보여준다 (배치 전 첫 조회) */
  const live = !snapshot || snapshot.date.getTime() < today.getTime()
    ? await computeTemperature(athleteId)
    : null;

  const score = live ? live.score : snapshot!.score;
  const components = (live ? live.components : snapshot!.components) as Record<string, number>;
  const sampleSize = live ? live.sampleSize : snapshot!.sampleSize;
  const calculatedAt = live ? new Date() : snapshot!.createdAt;

  /* 이전 30일 대비 변화 — 스냅샷이 있을 때만 (§6.4) */
  const prev = history.length > 1 ? history[0].score : null;
  const weekAgo = history.find((h) => h.date.getTime() <= today.getTime() - 7 * 86400_000);

  /* 최근 상승 요인 — 지난 7일과 그 이전 7일의 구성요소 차이 */
  const risers = await risingFactors(athleteId);

  let mine: any = null;
  if (opts?.userId) {
    const c = await prisma.fanContribution.findUnique({
      where: { userId_athleteId: { userId: opts.userId, athleteId } },
    });
    mine = c ? { score: c.score, level: c.level, diversity: c.diversity, streakWeeks: c.streakWeeks } : null;
  }

  const [activeFans, athlete] = await Promise.all([
    prisma.fanTemperatureEvent.findMany({
      where: { athleteId, createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 86400_000) }, validity: 'VALID' },
      select: { userId: true }, distinct: ['userId'],
    }),
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true, region: true },
    }),
  ]);

  return {
    athlete,
    score,
    tier: tierOf(score),
    components: COMPONENTS.map((c) => ({
      key: c.key, label: c.label, desc: c.desc, weight: c.weight, score: components?.[c.key] ?? 0,
    })),
    sampleSize,
    lowSample: sampleSize < MIN_SAMPLE,
    activeFanCount: activeFans.length,
    weeklyDelta: weekAgo != null ? Math.round((score - weekAgo.score) * 10) / 10 : null,
    prevWindowScore: prev,
    windowDelta: prev != null ? Math.round((score - prev) * 10) / 10 : null,
    history: history.map((h) => ({ date: h.date, score: h.score })),
    risingFactors: risers,
    formulaVersion: FORMULA_VERSION,
    calculatedAt,
    windowDays: WINDOW_DAYS,
    mine,
    /* 화면이 "무엇이 온도를 만드는지" 설명할 수 있도록 규칙표를 함께 준다 (§18.3) */
    notice: '팬온도는 최근 30일 팬 활동을 종합한 활성도 지표이며, 선수의 실력이나 성적을 평가하지 않습니다.',
  };
}

/** 지난 7일 vs 그 이전 7일 구성요소 증가분 (§6.3 최근 상승요인) */
async function risingFactors(athleteId: string) {
  const now = Date.now();
  const [cur, prev] = await Promise.all([
    prisma.fanTemperatureEvent.groupBy({
      by: ['source'],
      where: { athleteId, validity: 'VALID', createdAt: { gte: new Date(now - 7 * 86400_000) } },
      _count: { _all: true },
    }),
    prisma.fanTemperatureEvent.groupBy({
      by: ['source'],
      where: {
        athleteId, validity: 'VALID',
        createdAt: { gte: new Date(now - 14 * 86400_000), lt: new Date(now - 7 * 86400_000) },
      },
      _count: { _all: true },
    }),
  ]);

  const prevMap = new Map(prev.map((p) => [p.source, p._count._all]));
  const labels: Record<string, string> = {
    VOTE: '투표 참여 증가', COMMUNITY: '커뮤니티 활동 증가', LETTER: '응원 편지 증가',
    STORE: '스토어/스폰서십 액션 증가', BRAND_SUGGEST: '브랜드 추천 증가', FAVORITE: '신규 팬 유입',
  };

  return cur
    .map((c) => {
      const diff = c._count._all - (prevMap.get(c.source) ?? 0);
      const comp = COMPONENTS.find((x) => x.key === SOURCE_TO_COMPONENT[c.source]);
      /* 증가분이 온도에 준 영향(추정)을 같은 산식으로 환산한다 */
      const delta = comp ? Math.round(((diff / comp.cap) * 100 * comp.weight) / 100 * 10) / 10 : 0;
      return { source: c.source, label: labels[c.source] ?? c.source, count: diff, delta };
    })
    .filter((x) => x.count > 0 && x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
}

/* ── 팬 기여도 (§12 fan_contribution) ────────────────── */

/** 활동 영역 4종 — 구매액이 아니라 다양성·지속성이 중심이다 (§9.3) */
const AREAS = ['VOTE', 'COMMUNITY', 'STORE', 'BRAND_SUGGEST'] as const;

export async function recomputeContribution(userId: string, athleteId: string) {
  const from = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  const [events, letters] = await Promise.all([
    prisma.fanTemperatureEvent.findMany({
      where: { userId, athleteId, validity: 'VALID' },
      select: { source: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.fanLetter.count({ where: { userId, athleteId, status: { not: 'BLOCKED' } } }),
  ]);
  if (!events.length && !letters) return null;

  const recent = events.filter((e) => e.createdAt >= from);
  const areaSet = new Set(recent.map((e) => (e.source === 'LETTER' ? 'COMMUNITY' : e.source)).filter((s) => (AREAS as readonly string[]).includes(s)));

  /* 최근 4주 중 활동한 주 수 */
  const weeks = new Set(recent.map((e) => weekKey(e.createdAt)));
  const last4 = [0, 1, 2, 3].map((i) => weekKey(new Date(Date.now() - i * 7 * 86400_000)));
  const streakWeeks = last4.filter((w) => weeks.has(w)).length;

  const voteCount = events.filter((e) => e.source === 'VOTE').length;
  const postCount = events.filter((e) => e.source === 'COMMUNITY').length;
  const storeCount = events.filter((e) => e.source === 'STORE').length;
  const recommendCount = events.filter((e) => e.source === 'BRAND_SUGGEST').length;

  /* 연말 캠페인 심사와 같은 가중치 (§9.3): 다양성 40 · 지속성 30 · 편지 20 · 공익미션 10 */
  const diversityScore = (areaSet.size / AREAS.length) * 40;
  const continuityScore = (streakWeeks / 4) * 30;
  const letterScore = Math.min(1, letters / 2) * 20;
  const missionScore = recommendCount > 0 ? 10 : 0;
  const score = Math.round((diversityScore + continuityScore + letterScore + missionScore) * 10) / 10;

  const saved = await prisma.fanContribution.upsert({
    where: { userId_athleteId: { userId, athleteId } },
    update: {
      score, level: score >= 75 ? 3 : score >= 40 ? 2 : 1,
      diversity: areaSet.size, streakWeeks, letters,
      voteCount, postCount, storeCount, recommendCount,
      lastActivityAt: events.length ? events[events.length - 1].createdAt : new Date(),
    },
    create: {
      userId, athleteId, score, level: score >= 75 ? 3 : score >= 40 ? 2 : 1,
      diversity: areaSet.size, streakWeeks, letters,
      voteCount, postCount, storeCount, recommendCount,
      firstActiveAt: events.length ? events[0].createdAt : new Date(),
      lastActivityAt: events.length ? events[events.length - 1].createdAt : new Date(),
    },
  });
  return saved;
}

/** 내 기여도 — 응원하는 선수별 (F08) */
export async function getMyContributions(userId: string) {
  const rows = await prisma.fanContribution.findMany({
    where: { userId },
    include: { athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true } } },
    orderBy: { score: 'desc' },
  });

  return {
    contributions: rows.map((c) => ({
      athlete: c.athlete,
      score: c.score,
      level: c.level,
      levelLabel: c.level >= 3 ? '함께 걷는 팬' : c.level === 2 ? '응원 중인 팬' : '응원 시작',
      diversity: c.diversity,
      diversityMax: AREAS.length,
      streakWeeks: c.streakWeeks,
      streakMax: 4,
      letters: c.letters,
      counts: {
        vote: c.voteCount, post: c.postCount, store: c.storeCount, recommend: c.recommendCount,
      },
      firstActiveAt: c.firstActiveAt,
      lastActivityAt: c.lastActivityAt,
      /* 연말 캠페인 자격 (§9.3) — 당첨 보장이 아니라 참여 자격이다 */
      campaign: {
        diversity: { have: c.diversity, need: 4 },
        continuity: { have: c.streakWeeks, need: 4 },
        letter: { have: Math.min(c.letters, 1), need: 1 },
        met: c.diversity >= 4 && c.streakWeeks >= 4 && c.letters >= 1,
      },
    })),
    notice: '기여도는 금액이 아닌 다양한 응원 활동을 종합해 산정합니다. 구매 금액이 많다고 기여도가 높아지지 않습니다.',
  };
}

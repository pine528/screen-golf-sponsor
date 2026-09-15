/**
 * 팬 참여 — 커뮤니티 · 팬레터 · 브랜드 추천 · 팬온도 (리디자인 v2.0 시안 img_05~08)
 *
 * 원칙
 *  - 팬온도는 원장(FanTemperatureEvent)의 합이다. 임의 보정·추정치를 넣지 않는다 (LEG-06).
 *  - 적립은 온도 원장 + 포인트 원장을 같은 트랜잭션에서 처리하고,
 *    (source, refType, refId) 유니크 + P2002 graceful 로 중복 적립을 막는다 (불변식).
 *  - 팬레터는 선수와 작성자 본인만 열람한다.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { pointService } from './point.service';

const prisma = new PrismaClient();

/* ────────────────────────────────────────────────────────────
 * 활동 1건당 보상 정책 — 화면·적립이 모두 이 표만 본다.
 * 팬온도는 0.001°C 단위 정수로 누적한다 (운영 확정 시 이 표만 고친다).
 * ──────────────────────────────────────────────────────────── */
export const ENGAGE_RULES = {
  VOTE: { label: 'VOTE 투표 참여', tempMilli: 200, points: 20 },
  LETTER: { label: '팬레터 편지 보내기', tempMilli: 300, points: 30 },
  COMMUNITY: { label: '커뮤니티 응원 소통', tempMilli: 250, points: 5 },
  STORE: { label: '팬스토어 구매/응원', tempMilli: 100, points: 0 }, // 포인트는 구매금액 1% 별도 적립
  BRAND_SUGGEST: { label: '브랜드 추천', tempMilli: 100, points: 10 },
} as const;

export type EngageSource = keyof typeof ENGAGE_RULES;

/** 팬온도 구성 표기 순서 (시안 img_06 우측 패널) */
const BREAKDOWN_ORDER: EngageSource[] = ['VOTE', 'LETTER', 'COMMUNITY', 'STORE', 'BRAND_SUGGEST'];

/** 커뮤니티 탭 → 글 종류 */
export const POST_TABS = [
  { key: 'ALL', label: '전체', types: null },
  { key: 'NOTICE', label: '선수 소식', types: ['NOTICE'] },
  { key: 'CHEER', label: '팬 응원', types: ['CHEER', 'LETTER'] },
  { key: 'MATCH_TALK', label: '경기 이야기', types: ['MATCH_TALK'] },
  { key: 'BRAND', label: '브랜드 추천', types: ['BRAND'] },
] as const;

export const SUGGEST_CATEGORIES = [
  '건강 · 뷰티', '골프 · 스포츠', '라이프스타일', '푸드', '테크', '패션 · 잡화',
];

/**
 * 온도·포인트 동시 적립 (멱등).
 * 이미 적립된 활동이면 아무 것도 하지 않고 false를 돌려준다.
 */
async function award(
  source: EngageSource,
  athleteId: string,
  userId: string,
  refType: string,
  refId: string,
  pointsOverride?: number,
) {
  const rule = ENGAGE_RULES[source];
  try {
    await prisma.fanTemperatureEvent.create({
      data: { athleteId, userId, source, deltaMilli: rule.tempMilli, refType, refId },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') return false; // 이미 적립됨
    throw e;
  }

  const points = pointsOverride ?? rule.points;
  if (points > 0) {
    try {
      await pointService.adjustPoints(
        userId, points, 'FAN_ENGAGE_REWARD' as any, refType, refId, rule.label,
      );
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // 포인트만 중복이면 온도는 유지
    }
  }
  return true;
}

/* ── 팬온도 ─────────────────────────────────────────────── */

/** 선수 팬온도 + 구성 + (로그인 시) 내 기여·순위 */
export async function getTemperature(athleteId: string, userId?: string) {
  const [bySource, totalAgg, fanCount] = await Promise.all([
    prisma.fanTemperatureEvent.groupBy({
      by: ['source'],
      where: { athleteId },
      _sum: { deltaMilli: true },
    }),
    prisma.fanTemperatureEvent.aggregate({ where: { athleteId }, _sum: { deltaMilli: true } }),
    prisma.fanTemperatureEvent.findMany({
      where: { athleteId }, select: { userId: true }, distinct: ['userId'],
    }),
  ]);

  const totalMilli = totalAgg._sum.deltaMilli || 0;
  const sumOf = (s: string) => bySource.find((b) => b.source === s)?._sum.deltaMilli || 0;

  const breakdown = BREAKDOWN_ORDER.map((s) => {
    const milli = sumOf(s);
    return {
      source: s,
      label: ENGAGE_RULES[s].label,
      celsius: milli / 1000,
      share: totalMilli > 0 ? Math.round((milli / totalMilli) * 100) : 0,
    };
  });

  let mine: { celsius: number; rankPercent: number | null } | null = null;
  if (userId) {
    const myAgg = await prisma.fanTemperatureEvent.aggregate({
      where: { athleteId, userId }, _sum: { deltaMilli: true },
    });
    const myMilli = myAgg._sum.deltaMilli || 0;
    let rankPercent: number | null = null;
    if (myMilli > 0 && fanCount.length > 0) {
      const perFan = await prisma.fanTemperatureEvent.groupBy({
        by: ['userId'], where: { athleteId }, _sum: { deltaMilli: true },
      });
      const above = perFan.filter((f) => (f._sum.deltaMilli || 0) > myMilli).length;
      rankPercent = Math.max(1, Math.round(((above + 1) / perFan.length) * 100));
    }
    mine = { celsius: myMilli / 1000, rankPercent };
  }

  /* 이번 주 상승분 — 원장에서 직접 계산한다 */
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekAgg = await prisma.fanTemperatureEvent.aggregate({
    where: { athleteId, createdAt: { gte: weekAgo } }, _sum: { deltaMilli: true },
  });

  return {
    celsius: totalMilli / 1000,
    weeklyDelta: (weekAgg._sum.deltaMilli || 0) / 1000,
    fanCount: fanCount.length,
    breakdown,
    mine,
    rules: BREAKDOWN_ORDER.map((s) => ({ source: s, ...ENGAGE_RULES[s] })),
  };
}

/** 커뮤니티가 열려 있는 선수 카드 목록 (팬온도 순) */
export async function listCommunityAthletes(params: { q?: string; limit?: number }) {
  const athletes = await prisma.athlete.findMany({
    where: {
      isActive: true,
      ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true, tour: true, region: true, profileImageUrl: true },
    take: Math.min(params.limit || 24, 60),
    orderBy: [{ isRecommended: 'desc' }, { recommendOrder: 'asc' }, { name: 'asc' }],
  });
  if (!athletes.length) return { athletes: [] };

  const ids = athletes.map((a) => a.id);
  const [temps, posts] = await Promise.all([
    prisma.fanTemperatureEvent.groupBy({ by: ['athleteId'], where: { athleteId: { in: ids } }, _sum: { deltaMilli: true } }),
    prisma.athleteCommunityPost.groupBy({ by: ['athleteId'], where: { athleteId: { in: ids }, isHidden: false }, _count: { _all: true } }),
  ]);
  const tempMap = new Map(temps.map((t) => [t.athleteId, t._sum.deltaMilli || 0]));
  const postMap = new Map(posts.map((p) => [p.athleteId, p._count._all]));

  return {
    athletes: athletes
      .map((a) => ({
        ...a,
        celsius: (tempMap.get(a.id) || 0) / 1000,
        postCount: postMap.get(a.id) || 0,
      }))
      .sort((x, y) => y.celsius - x.celsius),
  };
}

/* ── 커뮤니티 요약 (시안 2026-09-15 선수 커뮤니티 헤더·사이드바) ─────────────────
 * 참여 팬 수 · 최근 30일 응원 수 · 이번 시즌 TOP10 · 오늘의 인기 반응 · 이번 주 응원 랭킹.
 * 전부 원장·게시글·공식 성적에서 센 값이다. 랭킹은 포인트가 아니라 이번 주 활동 건수로 매긴다(개인 포인트 노출 금지).
 */
export async function getCommunitySummary(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true, tour: true, region: true, profileImageUrl: true, isRecommended: true, highlights: true, bio: true },
  });
  if (!athlete) return null;
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const seasonStart = new Date(now.getFullYear(), 0, 1);

  const [fans, cheers, top10, topPosts, weekly, tv] = await Promise.all([
    prisma.fanTemperatureEvent.findMany({ where: { athleteId }, select: { userId: true }, distinct: ['userId'] }),
    prisma.athleteCommunityPost.count({ where: { athleteId, isHidden: false, isPrivate: false, authorRole: 'FAN', createdAt: { gte: d30 } } }),
    prisma.athleteEventResult.count({ where: { athleteId, status: 'APPROVED', rank: { lte: 10 }, eventDate: { gte: seasonStart } } }),
    prisma.athleteCommunityPost.findMany({
      where: { athleteId, isHidden: false, isPrivate: false, createdAt: { gte: d30 } },
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }], take: 5,
      select: { id: true, content: true, likeCount: true, type: true },
    }),
    prisma.fanTemperatureEvent.groupBy({
      by: ['userId'], where: { athleteId, createdAt: { gte: d7 } },
      _count: { _all: true }, orderBy: { _count: { userId: 'desc' } }, take: 5,
    }),
    (await import('./fanTemperature.service')).getTemperatureView(athleteId).catch(() => null),
  ]);

  const userIds = weekly.map((w) => w.userId).filter(Boolean) as string[];
  const fanRows = userIds.length
    ? await prisma.fan.findMany({ where: { userId: { in: userIds } }, select: { userId: true, nickname: true, avatarUrl: true } })
    : [];
  const fanBy = new Map(fanRows.map((f) => [f.userId, f]));

  return {
    athlete: {
      id: athlete.id, name: athlete.name, tour: athlete.tour, region: athlete.region, profileImageUrl: athlete.profileImageUrl,
      isRecommended: athlete.isRecommended,
      quote: Array.isArray(athlete.highlights) && (athlete.highlights as any[]).length ? String((athlete.highlights as any[])[0]) : null,
    },
    stats: { fanCount: fans.length, recentCheers: cheers, seasonTop10: top10 },
    temperature: tv ? { score: tv.score, tier: tv.tier, lowSample: tv.lowSample, weeklyDelta: (tv as any).weeklyDelta ?? null } : null,
    topPosts: topPosts.map((p) => ({ id: p.id, content: p.content, likeCount: p.likeCount, type: p.type })),
    weeklyFans: weekly.map((w, i) => {
      const f = fanBy.get(w.userId as string);
      return { rank: i + 1, nickname: f?.nickname || '팬', avatarUrl: f?.avatarUrl || null, activities: w._count._all };
    }),
    asOf: now.toISOString(),
  };
}

/* ── 커뮤니티 ───────────────────────────────────────────── */

export async function listPosts(
  athleteId: string,
  tab: string,
  viewer?: { id: string; role?: string },
) {
  const tabDef = POST_TABS.find((t) => t.key === tab) || POST_TABS[0];
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true, tour: true, region: true, profileImageUrl: true, userId: true },
  });
  if (!athlete) return null;

  const isOwner = !!viewer && (athlete.userId === viewer.id || viewer.role === 'ADMIN');

  const posts = await prisma.athleteCommunityPost.findMany({
    where: {
      athleteId,
      isHidden: false,
      ...(tabDef.types ? { type: { in: [...tabDef.types] as string[] } } : {}),
      // 팬레터는 선수 본인과 작성자만 목록에 보인다
      ...(isOwner ? {} : {
        OR: [
          { isPrivate: false },
          ...(viewer ? [{ isPrivate: true, authorUserId: viewer.id }] : []),
        ],
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, role: true, fan: { select: { nickname: true } } } },
      ...(viewer ? { likes: { where: { userId: viewer.id }, select: { id: true } } } : {}),
    },
  });

  return {
    athlete: {
      id: athlete.id, name: athlete.name, tour: athlete.tour,
      region: athlete.region, profileImageUrl: athlete.profileImageUrl,
    },
    isOwner,
    posts: posts.map((p: any) => ({
      id: p.id,
      type: p.type,
      authorRole: p.authorRole,
      authorName: p.authorRole === 'ATHLETE' ? athlete.name
        : p.type === 'LETTER' ? '팬레터'
        : p.author?.fan?.nickname || '팬',
      content: p.content,
      imageUrl: p.imageUrl,
      isPrivate: p.isPrivate,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      likedByMe: Array.isArray(p.likes) ? p.likes.length > 0 : false,
      isMine: !!viewer && p.authorUserId === viewer.id,
      createdAt: p.createdAt,
    })),
  };
}

export async function createPost(
  input: { athleteId: string; type?: string; content: string; imageUrl?: string },
  user: { id: string; role?: string },
) {
  const content = (input.content || '').trim();
  if (!content) throw Object.assign(new Error('내용을 입력해주세요'), { status: 400 });
  if (content.length > 1000) throw Object.assign(new Error('1,000자 이내로 작성해주세요'), { status: 400 });

  const athlete = await prisma.athlete.findUnique({
    where: { id: input.athleteId }, select: { id: true, userId: true },
  });
  if (!athlete) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });

  const isAthlete = athlete.userId === user.id;
  const type = isAthlete ? (input.type || 'NOTICE')
    : input.type === 'LETTER' ? 'LETTER'
    : input.type === 'MATCH_TALK' ? 'MATCH_TALK'
    : 'CHEER';

  const post = await prisma.athleteCommunityPost.create({
    data: {
      athleteId: input.athleteId,
      authorUserId: user.id,
      authorRole: isAthlete ? 'ATHLETE' : user.role === 'ADMIN' ? 'ADMIN' : 'FAN',
      type,
      content,
      imageUrl: input.imageUrl,
      isPrivate: type === 'LETTER',
    },
  });

  /* 팬 활동만 온도·포인트에 반영한다 */
  let awarded = false;
  if (!isAthlete) {
    awarded = await award(
      type === 'LETTER' ? 'LETTER' : 'COMMUNITY',
      input.athleteId, user.id, 'COMMUNITY_POST', post.id,
    );
  }
  return { post, awarded };
}

export async function toggleLike(postId: string, userId: string) {
  const post = await prisma.athleteCommunityPost.findUnique({
    where: { id: postId }, select: { id: true, likeCount: true },
  });
  if (!post) throw Object.assign(new Error('글을 찾을 수 없습니다'), { status: 404 });

  const existing = await prisma.communityLike.findUnique({
    where: { postId_userId: { postId, userId } }, select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.communityLike.delete({ where: { id: existing.id } }),
      prisma.athleteCommunityPost.update({
        where: { id: postId }, data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return { liked: false, likeCount: Math.max(0, post.likeCount - 1) };
  }

  await prisma.$transaction([
    prisma.communityLike.create({ data: { postId, userId } }),
    prisma.athleteCommunityPost.update({
      where: { id: postId }, data: { likeCount: { increment: 1 } },
    }),
  ]);
  return { liked: true, likeCount: post.likeCount + 1 };
}

export async function listComments(postId: string) {
  const comments = await prisma.communityComment.findMany({
    where: { postId, isHidden: false },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { author: { select: { id: true, role: true, fan: { select: { nickname: true } } } } },
  });
  return {
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      authorName: c.author?.fan?.nickname || (c.author?.role === 'ATHLETE' ? '선수' : '팬'),
      createdAt: c.createdAt,
    })),
  };
}

export async function addComment(postId: string, content: string, user: { id: string }) {
  const text = (content || '').trim();
  if (!text) throw Object.assign(new Error('내용을 입력해주세요'), { status: 400 });
  if (text.length > 500) throw Object.assign(new Error('500자 이내로 작성해주세요'), { status: 400 });

  const post = await prisma.athleteCommunityPost.findUnique({
    where: { id: postId }, select: { id: true, athleteId: true },
  });
  if (!post) throw Object.assign(new Error('글을 찾을 수 없습니다'), { status: 404 });

  const [comment] = await prisma.$transaction([
    prisma.communityComment.create({ data: { postId, authorUserId: user.id, content: text } }),
    prisma.athleteCommunityPost.update({
      where: { id: postId }, data: { commentCount: { increment: 1 } },
    }),
  ]);

  const awarded = await award('COMMUNITY', post.athleteId, user.id, 'COMMUNITY_COMMENT', comment.id);
  return { comment, awarded };
}

/* ── 브랜드 추천 ────────────────────────────────────────── */

export async function suggestBrand(
  input: { athleteId: string; category: string; brandName?: string; reason?: string },
  user: { id: string },
) {
  if (!input.category) throw Object.assign(new Error('카테고리를 선택해주세요'), { status: 400 });
  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId }, select: { id: true } });
  if (!athlete) throw Object.assign(new Error('선수를 찾을 수 없습니다'), { status: 404 });

  const suggestion = await prisma.fanBrandSuggestion.create({
    data: {
      athleteId: input.athleteId,
      fanUserId: user.id,
      category: input.category,
      brandName: input.brandName?.slice(0, 60),
      reason: input.reason?.slice(0, 200),
    },
  });
  const awarded = await award('BRAND_SUGGEST', input.athleteId, user.id, 'BRAND_SUGGESTION', suggestion.id);
  return { suggestion, awarded };
}

/** 선수별 추천 집계 — 카테고리별 표 수 (검토 전 제안도 포함, 상태 표기) */
export async function getBrandSuggestionSummary(athleteId: string) {
  const rows = await prisma.fanBrandSuggestion.groupBy({
    by: ['category', 'status'],
    where: { athleteId },
    _count: { _all: true },
  });
  const map = new Map<string, { category: string; total: number; accepted: number }>();
  for (const r of rows) {
    const cur = map.get(r.category) || { category: r.category, total: 0, accepted: 0 };
    cur.total += r._count._all;
    if (r.status === 'ACCEPTED') cur.accepted += r._count._all;
    map.set(r.category, cur);
  }
  return {
    categories: SUGGEST_CATEGORIES,
    summary: [...map.values()].sort((a, b) => b.total - a.total),
  };
}

/* ── 팬 참여 요약 (팬포인트 화면 img_08) ────────────────── */

export async function getMyEngagement(userId: string) {
  const [events, wallet] = await Promise.all([
    prisma.fanTemperatureEvent.groupBy({
      by: ['athleteId', 'source'],
      where: { userId },
      _sum: { deltaMilli: true },
    }),
    prisma.pointWallet.findUnique({ where: { userId }, select: { balance: true } }),
  ]);

  const byAthlete = new Map<string, { athleteId: string; milli: number; sources: Record<string, number> }>();
  for (const e of events) {
    const cur = byAthlete.get(e.athleteId) || { athleteId: e.athleteId, milli: 0, sources: {} };
    const v = e._sum.deltaMilli || 0;
    cur.milli += v;
    cur.sources[e.source] = (cur.sources[e.source] || 0) + v;
    byAthlete.set(e.athleteId, cur);
  }

  const ids = [...byAthlete.keys()];
  const athletes = ids.length
    ? await prisma.athlete.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, tour: true, profileImageUrl: true },
      })
    : [];
  const nameMap = new Map(athletes.map((a) => [a.id, a]));

  /* 선수별 총 팬온도 — 내 기여 비중 계산용 */
  const totals = ids.length
    ? await prisma.fanTemperatureEvent.groupBy({
        by: ['athleteId'], where: { athleteId: { in: ids } }, _sum: { deltaMilli: true },
      })
    : [];
  const totalMap = new Map(totals.map((t) => [t.athleteId, t._sum.deltaMilli || 0]));

  const supported = [...byAthlete.values()]
    .map((x) => {
      const total = totalMap.get(x.athleteId) || 0;
      return {
        athlete: nameMap.get(x.athleteId) || null,
        myCelsius: x.milli / 1000,
        totalCelsius: total / 1000,
        breakdown: BREAKDOWN_ORDER.map((s) => ({
          source: s,
          label: ENGAGE_RULES[s].label,
          share: x.milli > 0 ? Math.round(((x.sources[s] || 0) / x.milli) * 100) : 0,
        })).filter((b) => b.share > 0),
      };
    })
    .filter((x) => x.athlete)
    .sort((a, b) => b.myCelsius - a.myCelsius);

  return {
    balance: wallet ? Number(wallet.balance) : 0,
    supported,
    rules: BREAKDOWN_ORDER.map((s) => ({ source: s, ...ENGAGE_RULES[s] })),
  };
}

/** 투표 참여 적립 — 투표 서비스에서 호출한다 (멱등) */
export async function awardVote(athleteId: string, userId: string, voteId: string) {
  return award('VOTE', athleteId, userId, 'VOTE', voteId);
}

/** 팬스토어 구매 적립 — 주문 서비스에서 호출한다 (멱등) */
export async function awardStorePurchase(
  athleteId: string, userId: string, orderId: string, amount: number,
) {
  return award('STORE', athleteId, userId, 'STORE_ORDER', orderId, Math.floor(amount * 0.01));
}

export type { Prisma };

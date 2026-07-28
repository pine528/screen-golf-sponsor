import { Router, Request, Response, NextFunction } from 'express';
import { athleteController } from '../controllers/athlete.controller';
import { agencyAthleteRequestController } from '../controllers/agencyAthleteRequest.controller';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../models/prisma';
import * as mediaExposureService from '../services/mediaExposure.service';
import * as naverNewsService from '../services/naverNews.service';
import * as followerSnapshotService from '../services/followerSnapshot.service';

const router = Router();

/**
 * @route GET /athletes/public
 * @desc 공개 선수 목록 (회원가입 + KYC 통과 ATHLETE만, 비회원 접근 가능)
 */
/**
 * @route GET /athletes/public-stats
 * @desc 메인 실적 수치 — 검증 가능한 실데이터만 노출 (개편 LEG-06: 하드코딩 수치 금지)
 */
router.get('/public-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [athletes, brands, activeSlots, contracts] = await Promise.all([
      prisma.athlete.count({ where: { isActive: true, kycStatus: 'APPROVED' } }),
      prisma.brand.count(),
      prisma.slotInstance.count({ where: { isActive: true, status: { in: ['OPEN', 'IN_AUCTION'] } } }),
      prisma.contract.count(),
    ]);
    res.json({ success: true, data: { athletes, brands, activeSlots, contracts }, error: null });
  } catch (e) { next(e); }
});

router.get('/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, tour, sportType, sport, page = '1', limit = '24' } = req.query as any;
    // docx 3-8: 회원가입 + 등록 완료된 선수만 노출 (KYC APPROVED 필수)
    // docx 4. status: is_active=true (운영 활성)
    const where: any = {
      isActive: true,
      kycStatus: 'APPROVED',
    };
    if (tour) where.tour = tour;
    // SPONPIK 3-8 — 종목별 소팅
    const sportFilter = sportType || sport;
    if (sportFilter) where.sportType = String(sportFilter).toUpperCase();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { realName: { contains: q, mode: 'insensitive' } },
        { tour: { contains: q, mode: 'insensitive' } },
        { affiliation: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(50, Number(limit) || 24);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const [total, items] = await Promise.all([
      prisma.athlete.count({ where }),
      prisma.athlete.findMany({
        where,
        select: {
          id: true, name: true, tour: true, profileImageUrl: true, bio: true,
          socialLinks: true, primarySponsors: true,
          // SPONPIK 4. 권장 데이터 항목 (구조화 필드)
          height: true, region: true, debutYear: true, affiliation: true, sportType: true,
          // 2026-07 항목2 — 추천/신규 노출용
          isRecommended: true, recommendOrder: true, createdAt: true, snsStats: true, tourQualification: true,
        },
        // 추천 우선(운영 지정 순) → 신규 가입 최신순
        orderBy: [
          { isRecommended: 'desc' },
          { recommendOrder: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        take, skip,
      }),
    ]);
    res.json({ success: true, data: { items, total, page: Number(page), limit: take }, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes/public/:id
 * @desc 공개 선수 상세 (비회원 접근) — docx 3-9 구조
 *  - 상단: 기본 프로필 + 진행 중 슬롯
 *  - 중단: 슬롯별 실시간 경매 현황 (각 슬롯의 auction + 최근 입찰 N건)
 *  - 하단: ROI/경기기록 (값 없으면 - 처리)
 */
router.get('/public/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, realName: true, tour: true,
        profileImageUrl: true, bio: true, socialLinks: true, primarySponsors: true,
        createdAt: true,
        // SPONPIK 4. 권장 데이터 항목 (구조화 필드 + status)
        height: true, region: true, debutYear: true, affiliation: true, sportType: true,
        // 선수 프로필 구조화 — 학력/수상/경력
        education: true, awards: true, career: true,
        // 2026-07 선수화면 개편 확장 필드
        birthDate: true, birthplace: true, weight: true, tourQualification: true,
        activityFields: true, highlights: true, snsStats: true,
        isActive: true, kycStatus: true,
        sport: { select: { code: true, name: true, parentCode: true } },
      },
    });
    // docx 3-8: KYC 미승인 또는 비활성 선수는 공개 상세에서 제외 (404)
    if (!athlete || !athlete.isActive || athlete.kycStatus !== 'APPROVED') {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Athlete not found' } });
      return;
    }

    // 활성 슬롯 + 각 슬롯의 경매 + 최근 입찰 5건 (실데이터) + GTOUR 경기결과 + 온도지수 재료
    const [slotInstances, exposureCount, athleteEvents, eventResults, fanFavorites, brandContracts, votesCreated, voteParticipants, purchaseCount, donationCount] = await Promise.all([
      prisma.slotInstance.findMany({
        where: {
          athleteId: req.params.id,
          isActive: true, // docx 3-2: 비활성 슬롯 노출 제외
        },
        include: {
          slotTemplate: { select: { name: true, code: true, bodyPart: true, category: true, grade: true } },
          auction: {
            select: {
              id: true, status: true, currentPrice: true, minBidIncrement: true,
              startAt: true, endAt: true,
              bids: {
                select: {
                  id: true, maxBid: true, currentProxy: true, isWinning: true, createdAt: true,
                  brand: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' }, // docx 3-4: 최신순
                take: 10,
              },
            },
          },
          event: { select: { id: true, name: true, dateStart: true, dateEnd: true, status: true, venue: true } },
        },
        // docx 3-2 + 4 — 정렬: 관리자 slotOrder > 상태(OPEN/IN_AUCTION 우선) > 등록 순
        orderBy: [
          { slotOrder: { sort: 'asc', nulls: 'last' } },
          { status: 'asc' },
          { createdAt: 'asc' },
        ],
      }).catch((e) => { console.error('[athlete public] slot fetch error', e); return []; }),
      prisma.roiExposure.count({ where: { athleteId: req.params.id } as any }).catch(() => 0),
      // 최근 참가 경기 (이미 끝난 것 포함, 최근 5개)
      prisma.event.findMany({
        where: { slotInstances: { some: { athleteId: req.params.id } } },
        select: { id: true, name: true, tour: true, dateStart: true, dateEnd: true, status: true, venue: true, multiplier: true },
        orderBy: { dateStart: 'desc' },
        take: 5,
      }).catch((e) => { console.error('[athlete public] events error', e); return []; }),
      // GTOUR 등 경기결과 (docx 3-6, 최신순) — 공개는 승인(APPROVED)만. 선수 자가등록 PENDING은 비공개
      prisma.athleteEventResult.findMany({
        where: { athleteId: req.params.id, status: 'APPROVED' },
        orderBy: { eventDate: 'desc' },
        take: 30,
      }).catch((e) => { console.error('[athlete public] eventResults error', e); return []; }),
      // ===== 스폰픽 온도 재료 (카운트만 — 저비용) =====
      prisma.favoriteAthlete.count({ where: { athleteId: req.params.id } }).catch(() => 0),
      prisma.contract.count({ where: { athleteId: req.params.id } }).catch(() => 0),
      prisma.voteV2.count({ where: { target: { path: ['playerId'], equals: req.params.id } } }).catch(() => 0),
      prisma.voteParticipationV2.count({ where: { vote: { target: { path: ['playerId'], equals: req.params.id } } } }).catch(() => 0),
      prisma.funnelOrder.count({ where: { athleteId: req.params.id } }).catch(() => 0),
      prisma.donation.count({ where: { athleteId: req.params.id } }).catch(() => 0),
    ]);

    // ===== 스폰픽 온도 (2026-07 정책) =====
    // 기본 30도에서 시작, 활동 신호로 상승, 최대 100도.
    //  - 팬 관심등록 0.8도 / 브랜드 신호(계약) 2도 / 투표 개설 1.5도 / 투표 참여 0.05도
    //  - 구매활동(퍼널 주문) 1도 / 도네이션 0.5도
    //  - 커뮤니티(게시글·좋아요·댓글): 모델 미구현 — 구현 시 반영 (현재 0)
    const communityScore = 0;
    const tempRaw = 30
      + fanFavorites * 0.8
      + brandContracts * 2
      + votesCreated * 1.5
      + voteParticipants * 0.05
      + purchaseCount * 1
      + donationCount * 0.5
      + communityScore;
    const sponpikTemp = {
      value: Math.round(Math.min(100, tempRaw) * 10) / 10,
      base: 30,
      max: 100,
      stats: {
        fans: fanFavorites,           // 관심 등록 (팬)
        brandContracts,               // 브랜드 계약 신호
        votesCreated,                 // VOTE 등록
        voteParticipants,             // 실제 투표 참여
        purchases: purchaseCount + donationCount, // 구매/도네이션 활동
        community: communityScore,    // 커뮤니티 지수 (미구현 — 0)
      },
    };

    res.json({
      success: true,
      data: { athlete, slotInstances, exposureCount, recentEvents: athleteEvents, eventResults, sponpikTemp },
      error: null,
      request_id: (req as any).requestId,
    });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes/public/:id/inventory
 * @desc 개편 Phase 1 (DATA-07) — 선수의 기간별 슬롯 인벤토리
 *       ?start=YYYY-MM-DD&end=YYYY-MM-DD (없으면 오늘 이후 전체)
 */
router.get('/public/:id/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inventoryService } = await import('../services/inventory.service');
    const start = req.query.start ? new Date(String(req.query.start)) : undefined;
    const end = req.query.end ? new Date(String(req.query.end)) : undefined;
    if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
      return res.status(400).json({ success: false, data: null, error: 'invalid start/end date', request_id: (req as any).requestId });
    }
    const slots = await inventoryService.getAthleteInventory(req.params.id, start, end);
    res.json({ success: true, data: { slots }, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes/public/:id/roi-dashboard
 * @desc 선수 ROI 대시보드 (docx '선수 상세 페이지 수정개발' 2026-05-04)
 *
 * 계약유형별 2단 구조:
 *  - 기본형 (BASIC, 모든 사용자): 4개 축 — 미디어/콘텐츠/팬덤/선수성과
 *  - 확장형 (EXTENDED, 중장기 계약 브랜드): + 랜딩 유입 + 구매/전환/ROI
 *
 * 종합점수 산정:
 *  - 기본형: 미디어(30) + 콘텐츠(20) + 팬덤(20) + 선수성과(30) = 100
 *  - 확장형: 미디어(20) + 콘텐츠(15) + 팬덤(15) + 선수성과(20) + 랜딩(10) + 구매(20) = 100
 *
 * 등급: A (≥80) / B (≥65) / C (≥50) / D (≥35) / E (<35)
 *
 * 산정 상태 배지 (data collection rate 기반):
 *  - 공식 산정 (OFFICIAL): 70%+
 *  - 예비 산정 (PRELIMINARY): 40-69%
 *  - 산정중 (CALCULATING): <40%
 */
router.get('/public/:id/roi-dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athleteId = req.params.id;
    const viewType = String(req.query.viewType || 'basic').toLowerCase() === 'extended' ? 'EXTENDED' : 'BASIC';

    // 선수 존재 + 활성 검증
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, isActive: true, kycStatus: true },
    });
    if (!athlete || !athlete.isActive || athlete.kycStatus !== 'APPROVED') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Athlete not found' } });
      return;
    }

    // 병렬 집계
    const [
      funnelEventsByName,
      orderAgg,
      promoCodes,
      slotsBreakdown,
      latestEventResult,
      recentResults,
      allRankedResults,
      seasonResults,
      upcomingEventsList,
      youtubeChannel,
      mentionAgg,
      upcomingEvents,
      // docx §6 C-1, C-3 자동/수동 수집 데이터 (Phase 미구현 보강)
      mediaExposureAgg,
      newsArticleCount,
      followerGrowthRate,
    ] = await Promise.all([
      prisma.funnelEvent.groupBy({
        by: ['eventName'],
        where: { athleteId },
        _count: { _all: true },
      }).catch(() => []),
      prisma.funnelOrder.aggregate({
        where: { athleteId },
        _sum: { netAmount: true, refundedAmount: true, grossAmount: true },
        _count: { _all: true },
      }).catch(() => null),
      prisma.promoCode.findMany({
        where: { athleteId },
        select: { id: true, code: true, usageCount: true, status: true },
      }).catch(() => []),
      prisma.slotInstance.groupBy({
        by: ['status'],
        where: { athleteId, isActive: true },
        _count: { _all: true },
      }).catch(() => []),
      prisma.athleteEventResult.findFirst({
        where: { athleteId, rank: { not: null } },
        orderBy: { eventDate: 'desc' },
        select: { eventName: true, rank: true, score: true, eventDate: true, summary: true },
      }).catch(() => null),
      // 최근 3개 대회 (평균 순위용)
      prisma.athleteEventResult.findMany({
        where: { athleteId, rank: { not: null } },
        orderBy: { eventDate: 'desc' },
        take: 3,
        select: { rank: true },
      }).catch(() => []),
      // 전체 순위 결과 (최신성 가중 선수성과 점수용 — 1년내 100% / 1-2년 90% / 2-3년 80% / 3-5년 70% / 5년+ 50%)
      prisma.athleteEventResult.findMany({
        where: { athleteId, rank: { not: null }, status: 'APPROVED' },
        orderBy: { eventDate: 'desc' },
        take: 40,
        select: { rank: true, eventDate: true },
      }).catch(() => []),
      // F 섹션 — 추가 권장 항목용
      // 시즌 누적 (현재 연도 기준) + 최근 5개 추이 (차트용)
      prisma.athleteEventResult.findMany({
        where: { athleteId, eventDate: { gte: new Date(new Date().getFullYear(), 0, 1) } },
        orderBy: { eventDate: 'desc' },
        select: { rank: true, eventDate: true, eventName: true, score: true },
      }).catch(() => []),
      // 향후 대회 일정 (3개) — 예정된 대회들
      prisma.event.findMany({
        where: {
          slotInstances: { some: { athleteId, isActive: true } },
          isActive: true,
          dateStart: { gte: new Date() },
          status: 'UPCOMING',
        },
        orderBy: { dateStart: 'asc' },
        take: 5,
        select: { id: true, name: true, dateStart: true, dateEnd: true, venue: true, tour: true, category: true },
      }).catch(() => []),
      prisma.youtubeChannel.findUnique({
        where: { athleteId },
        include: {
          videos: {
            orderBy: { publishedAt: 'desc' },
            take: 20,
            select: { viewCount: true, likeCount: true, commentCount: true },
          },
        },
      }).catch(() => null),
      prisma.athleteMention.aggregate({
        where: { athleteId, status: 'APPROVED' },
        _sum: { viewCount: true, likeCount: true, commentCount: true },
        _count: { _all: true },
      }).catch(() => null),
      prisma.event.findMany({
        where: {
          slotInstances: { some: { athleteId, isActive: true } },
          isActive: true,
          dateStart: { gte: new Date() },
          status: 'UPCOMING',
        },
        orderBy: { dateStart: 'asc' },
        take: 1,
        select: { id: true, name: true, dateStart: true, venue: true, tour: true },
      }).catch(() => []),
      // docx §6 C-1 — 미디어노출 누적 (수동 입력 + 자동 수집)
      mediaExposureService.aggregateMediaExposure(athleteId).catch(() => null),
      // docx §6 C-1 articleMentions 자동 — 최근 90일 네이버 뉴스 기사 수
      naverNewsService.countRecentArticles(athleteId, 90).catch(() => 0),
      // docx §6 C-3 최근 증가율 — 7일 전 vs 현재 YouTube 구독자
      followerSnapshotService.getGrowthRate(athleteId, 'YOUTUBE', 7).catch(() => null),
    ]);

    const eventCounts: Record<string, number> = {};
    funnelEventsByName.forEach((g: any) => { eventCounts[g.eventName] = g._count._all; });

    // F 섹션 — 추가 권장 항목 통계 (docx §9)
    const seasonRanked = seasonResults.filter((r: any) => r.rank != null);
    const seasonAvgRank = seasonRanked.length > 0
      ? Number((seasonRanked.reduce((s: number, r: any) => s + r.rank, 0) / seasonRanked.length).toFixed(1))
      : null;
    const seasonBestRank = seasonRanked.length > 0
      ? Math.min(...seasonRanked.map((r: any) => r.rank as number))
      : null;
    const seasonTop10Count = seasonRanked.filter((r: any) => r.rank <= 10).length;
    const seasonTop3Count = seasonRanked.filter((r: any) => r.rank <= 3).length;
    // 최근 5개 추이 (recent → recent_oldest 순서)
    const recentTrend = seasonResults.slice(0, 5).reverse().map((r: any) => ({
      eventName: r.eventName,
      eventDate: r.eventDate,
      rank: r.rank,
      score: r.score,
    }));

    const purchases = orderAgg?._count._all || 0;
    const grossRevenue = Number(orderAgg?._sum.grossAmount || 0);
    const netRevenue = Number(orderAgg?._sum.netAmount || 0) - Number(orderAgg?._sum.refundedAmount || 0);
    const landingViews = eventCounts.LANDING_VIEW || 0;
    const linkClicks = eventCounts.LINK_CLICK || 0;
    const totalCouponUsage = promoCodes.reduce((sum: number, c: any) => sum + (c.usageCount || 0), 0);

    // YouTube + Mentions 집계
    const ytSubscribers = youtubeChannel?.subscriberCount ?? null;
    const ytTotalViews = youtubeChannel?.totalViews ? Number(youtubeChannel.totalViews) : null;
    const ytRecentViews = (youtubeChannel?.videos || []).reduce((s, v) => s + v.viewCount, 0);
    const ytRecentLikes = (youtubeChannel?.videos || []).reduce((s, v) => s + v.likeCount, 0);
    const ytRecentComments = (youtubeChannel?.videos || []).reduce((s, v) => s + v.commentCount, 0);
    const mentionViews = Number(mentionAgg?._sum.viewCount || 0);
    const mentionLikes = Number(mentionAgg?._sum.likeCount || 0);
    const mentionComments = Number(mentionAgg?._sum.commentCount || 0);
    const mentionCount = mentionAgg?._count._all || 0;

    // 슬롯 현황 분리
    const slotsByStatus: Record<string, number> = {};
    slotsBreakdown.forEach((g: any) => { slotsByStatus[g.status] = g._count._all; });
    const slotsTotal = Object.values(slotsByStatus).reduce((s, n) => s + n, 0);
    const slotsInAuction = (slotsByStatus.IN_AUCTION || 0) + (slotsByStatus.OPEN || 0);
    const slotsSold = (slotsByStatus.SOLD || 0) + (slotsByStatus.RESERVED || 0);

    // 최근 3개 평균 순위
    const recentAvgRank = recentResults.length > 0
      ? recentResults.reduce((s, r) => s + (r.rank || 0), 0) / recentResults.length
      : null;

    // ============================================
    // 점수 산정 (각 축 0~100, 데이터 없으면 null)
    // ============================================

    // 미디어노출지수 — 수동 입력(mediaExposureAgg) + 자동 수집(mention 영상, 뉴스 기사) 통합
    // - 방송 횟수 가중치 높음, 패치 노출 + 하이라이트 + 기사 + 멘션 영상 합산
    const mediaComponents: number[] = [];
    if (mediaExposureAgg) {
      // 방송 노출: 1회당 8점 (10회 = 80점)
      if (mediaExposureAgg.broadcastCount > 0)
        mediaComponents.push(Math.min(100, mediaExposureAgg.broadcastCount * 8));
      // 패치/로고 노출: 1회당 3점
      if (mediaExposureAgg.patchExposureEstimate > 0)
        mediaComponents.push(Math.min(100, mediaExposureAgg.patchExposureEstimate * 3));
      // 하이라이트: 1회당 5점
      if (mediaExposureAgg.highlightCount > 0)
        mediaComponents.push(Math.min(100, mediaExposureAgg.highlightCount * 5));
    }
    // 자동 수집된 뉴스 기사 (최근 90일)
    if (newsArticleCount > 0)
      mediaComponents.push(Math.min(100, newsArticleCount * 4));
    // 출연 영상 (mention)
    if (mentionCount > 0)
      mediaComponents.push(Math.min(100, mentionCount * 5));
    const mediaScore = mediaComponents.length > 0
      ? Number((mediaComponents.reduce((s, v) => s + v, 0) / mediaComponents.length).toFixed(1))
      : null;

    // 콘텐츠 반응: YouTube 본인 채널 + 출연 영상의 조회/좋아요/댓글
    const totalContentViews = ytRecentViews + mentionViews;
    const totalContentLikes = ytRecentLikes + mentionLikes;
    const totalContentComments = ytRecentComments + mentionComments;
    const contentScore = totalContentViews > 0
      ? Math.min(100, Math.log10(totalContentViews + 1) * 15)  // 로그 스케일
      : null;

    // 팬덤지수: 구독자 + 멘션 + 쿠폰
    const fandomComponents: number[] = [];
    if (ytSubscribers != null && ytSubscribers > 0) fandomComponents.push(Math.min(100, Math.log10(ytSubscribers + 1) * 18));
    if (mentionCount > 0) fandomComponents.push(Math.min(100, mentionCount * 7));
    if (totalCouponUsage > 0) fandomComponents.push(Math.min(100, totalCouponUsage * 4));
    const fandomScore = fandomComponents.length > 0
      ? fandomComponents.reduce((s, v) => s + v, 0) / fandomComponents.length
      : null;

    // 선수성과/대회가치: 최신성 가중 순위 점수 + 다음 대회 유무
    // 정책(2026-07): 성적 반영 가중치 — 1년 이내 100% / 1~2년 90% / 2~3년 80% / 3~5년 70% / 5년 이상 50%
    const recencyWeight = (eventDate: Date): number => {
      const years = (Date.now() - new Date(eventDate).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (years <= 1) return 1.0;
      if (years <= 2) return 0.9;
      if (years <= 3) return 0.8;
      if (years <= 5) return 0.7;
      return 0.5;
    };
    let athleteScore: number | null = null;
    if (allRankedResults.length > 0) {
      // 대회별 점수: 1위=100, 10위=73, 30위=13 (min 10) → 최신성 가중 평균
      let wSum = 0, wTotal = 0;
      for (const r of allRankedResults) {
        const rankScore = Math.max(10, Math.min(100, 100 - ((r.rank as number) - 1) * 3));
        const w = recencyWeight(r.eventDate);
        wSum += rankScore * w;
        wTotal += w;
      }
      athleteScore = Math.round((wSum / wTotal) * 10) / 10;
      // 다음 참가 예정 대회 있으면 +5 보너스
      if (upcomingEvents.length > 0) athleteScore = Math.min(100, athleteScore + 5);
    } else if (recentAvgRank != null) {
      athleteScore = Math.max(20, Math.min(100, 100 - (recentAvgRank - 1) * 3));
      if (upcomingEvents.length > 0) athleteScore = Math.min(100, athleteScore + 5);
    }

    // 랜딩 유입 (확장형)
    const landingScore = (linkClicks > 0 || landingViews > 0)
      ? Math.min(100, ((linkClicks / 10) + (landingViews / 50)) / 2)
      : null;

    // 구매/전환/ROI (확장형)
    const conversionScore = (purchases > 0 || totalCouponUsage > 0)
      ? Math.min(100, (purchases * 5) + (totalCouponUsage * 2))
      : null;

    // 가중 평균 (수집된 항목만)
    const weighted = (items: { value: number | null; weight: number }[]) => {
      const collected = items.filter(i => i.value !== null);
      if (collected.length === 0) return null;
      const totalW = collected.reduce((s, i) => s + i.weight, 0);
      return Number((collected.reduce((s, i) => s + (i.value as number) * i.weight, 0) / totalW).toFixed(1));
    };

    const basicScore = weighted([
      { value: mediaScore, weight: 30 },
      { value: contentScore, weight: 20 },
      { value: fandomScore, weight: 20 },
      { value: athleteScore, weight: 30 },
    ]);

    const extendedScore = weighted([
      { value: mediaScore, weight: 20 },
      { value: contentScore, weight: 15 },
      { value: fandomScore, weight: 15 },
      { value: athleteScore, weight: 20 },
      { value: landingScore, weight: 10 },
      { value: conversionScore, weight: 20 },
    ]);

    // 데이터 수집률 (기본형 4개 축 기준)
    const basicCollected = [mediaScore, contentScore, fandomScore, athleteScore].filter(v => v !== null).length;
    const basicCollectionRate = Math.round(basicCollected / 4 * 100);
    const extCollected = [mediaScore, contentScore, fandomScore, athleteScore, landingScore, conversionScore].filter(v => v !== null).length;
    const extCollectionRate = Math.round(extCollected / 6 * 100);
    const collectionRate = viewType === 'EXTENDED' ? extCollectionRate : basicCollectionRate;

    // 산정 상태 배지
    const statusBadge =
      collectionRate >= 70 ? 'OFFICIAL' :
      collectionRate >= 40 ? 'PRELIMINARY' :
      'CALCULATING';

    // 신뢰도
    const reliability =
      collectionRate >= 70 ? 'HIGH' :
      collectionRate >= 40 ? 'MEDIUM' :
      'LOW';

    // 등급 — docx §11: '산정중' 상태에서는 보수적 처리 (한 단계 낮춤)
    const toGrade = (s: number | null) => {
      if (s == null) return null;
      // 산정중일 때 등급 보수적 처리: 한 단계 낮춤 (E는 E 유지)
      const adjusted = statusBadge === 'CALCULATING' ? Math.max(0, s - 15) : s;
      if (adjusted >= 80) return 'A';
      if (adjusted >= 65) return 'B';
      if (adjusted >= 50) return 'C';
      if (adjusted >= 35) return 'D';
      return 'E';
    };

    const dashboard = {
      viewType, // 'BASIC' | 'EXTENDED'

      // 종합 점수 (메인 카드)
      summary: {
        score: viewType === 'EXTENDED' ? extendedScore : basicScore,
        grade: toGrade(viewType === 'EXTENDED' ? extendedScore : basicScore),
        statusBadge, // OFFICIAL / PRELIMINARY / CALCULATING
        statusLabel:
          statusBadge === 'OFFICIAL' ? '공식 산정' :
          statusBadge === 'PRELIMINARY' ? '예비 산정' : '산정중',
        collectionRate,    // 0~100 %
        reliability,       // HIGH / MEDIUM / LOW
        reliabilityLabel: reliability === 'HIGH' ? '높음' : reliability === 'MEDIUM' ? '보통' : '낮음',
        updatedAt: new Date().toISOString(),
        latestPerformance: latestEventResult ? {
          eventName: latestEventResult.eventName,
          rank: latestEventResult.rank,
          eventDate: latestEventResult.eventDate,
        } : null,
        // 양쪽 점수 + 등급 모두 노출 (UI 토글용)
        // docx §11 보수적 처리(산정중 시 -15)는 backend toGrade 에서만 적용 → frontend 자체 매핑하면 위배
        basicScore,
        basicGrade: toGrade(basicScore),
        extendedScore,
        extendedGrade: toGrade(extendedScore),
      },

      // 4개 핵심 카드 (기본형)
      // docx §6 C-1 — 수동 입력(mediaExposureAgg) + 자동 수집(news, mention) 통합
      mediaExposure: {
        score: mediaScore,
        broadcastCount: mediaExposureAgg?.broadcastCount ?? null,
        broadcastSeconds: mediaExposureAgg?.broadcastSeconds ?? null,
        patchExposureEstimate: mediaExposureAgg?.patchExposureEstimate ?? null,
        // articleMentions = 수동 입력 합 + 자동 수집(네이버 뉴스 90일)
        articleMentions: ((mediaExposureAgg?.articleMentions ?? 0) + newsArticleCount) || null,
        articleMentionsAuto: newsArticleCount || null,  // 자동 수집 분리 표시
        articleMentionsManual: mediaExposureAgg?.articleMentions ?? null,
        highlightCount: mediaExposureAgg?.highlightCount ?? null,
        mentionVideos: mentionCount || null,
      },
      contentEngagement: {
        score: contentScore,
        videoViews: totalContentViews || null,
        reach: ytSubscribers,
        likes: totalContentLikes || null,
        comments: totalContentComments || null,
        shares: null,
        saves: null,
        engagementRate: totalContentViews > 0
          ? Number(((totalContentLikes + totalContentComments) / totalContentViews * 100).toFixed(2))
          : null,
      },
      fandom: {
        score: fandomScore,
        followers: ytSubscribers,
        // docx §6 C-3 — followerGrowthPct: 7일 전 vs 현재 YouTube 구독자 (자동 계산)
        followerGrowthPct: followerGrowthRate,
        fanCommentsMentions: mentionComments || null,
        fanEvents: null,
        voteParticipationRate: null,
        ugcCount: mentionCount || null,
      },
      athletePerformance: {
        score: athleteScore,
        latestRank: latestEventResult?.rank || null,
        recentAvgRank: recentAvgRank != null ? Number(recentAvgRank.toFixed(1)) : null,
        latestEventName: latestEventResult?.eventName || null,
        nextEvent: upcomingEvents[0] || null,
        exposureExpectation: null,
      },

      // 확장형 추가 카드
      landingTraffic: {
        score: landingScore,
        clicks: linkClicks || null,
        visits: landingViews || null,
        ctr: linkClicks > 0 && eventCounts.IMPRESSION_LOGGED
          ? Number((linkClicks / eventCounts.IMPRESSION_LOGGED * 100).toFixed(2))
          : null,
        newVisitors: null,
        avgDwellTime: null,
      },
      conversion: {
        score: conversionScore,
        conversions: purchases || null,
        purchases: purchases || null,
        revenue: netRevenue || null,
        couponUsage: totalCouponUsage || null,
        cvr: landingViews > 0 ? Number((purchases / landingViews * 100).toFixed(2)) : null,
        cac: null,
        roas: null,
      },

      // 슬롯 / 대회 영역
      operations: {
        slots: {
          total: slotsTotal,
          inAuction: slotsInAuction,
          sold: slotsSold,
        },
        recentEvent: latestEventResult,
        nextEvent: upcomingEvents[0] || null,
        upcomingList: upcomingEventsList || [],  // 향후 대회 일정 5개
      },

      // F 섹션 — 경기결과/분석 추가 권장 항목 (docx §9)
      matchAnalysis: {
        recentAvgRank: recentAvgRank != null ? Number(recentAvgRank.toFixed(1)) : null,  // 최근 3개 평균
        seasonAvgRank,                  // 시즌 누적 평균
        seasonBestRank,                 // 시즌 최고 순위
        seasonTop3Count,                // TOP 3 횟수
        seasonTop10Count,               // TOP 10 횟수
        seasonTotalEvents: seasonRanked.length, // 시즌 출전 대회 수
        recentTrend,                    // 최근 5개 추이 (시간순)
      },

      // 점수 산정 가중치 안내
      scoringRules: {
        basic: [
          { axis: '미디어노출지수', weight: 30 },
          { axis: '콘텐츠 반응', weight: 20 },
          { axis: '팬덤지수', weight: 20 },
          { axis: '선수성과 / 대회가치', weight: 30 },
        ],
        extended: [
          { axis: '미디어노출지수', weight: 20 },
          { axis: '콘텐츠 반응', weight: 15 },
          { axis: '팬덤지수', weight: 15 },
          { axis: '선수성과 / 대회가치', weight: 20 },
          { axis: '랜딩 유입', weight: 10 },
          { axis: '구매 / 전환 / ROI', weight: 20 },
        ],
      },

      // 데이터 출처 — docx §10 G-3 정확 6종 (명칭 docx 그대로 일치)
      dataSources: [
        { code: 'GTOUR_OFFICIAL', name: 'GTOUR 공식기록', status: latestEventResult ? 'OK' : 'MISSING' },
        { code: 'SPONPIK_INTERNAL', name: 'SPONPIK 내부 슬롯 데이터', status: slotsTotal > 0 ? 'OK' : 'MISSING' },
        { code: 'SNS_REACTIONS', name: 'SNS 반응 데이터', status: ytSubscribers != null || mentionCount > 0 ? 'OK' : 'MISSING' },
        { code: 'CONTENT_DATA', name: '콘텐츠 데이터', status: totalContentViews > 0 ? 'OK' : 'MISSING' },
        { code: 'BRAND_TRACKING', name: '브랜드 전용 트래킹 데이터', status: linkClicks > 0 ? 'OK' : 'MISSING' },
        { code: 'MANUAL_INPUT', name: '관리자 수기 입력 데이터', status: 'OK' },
      ],
    };

    res.json({ success: true, data: dashboard, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

// ============================================
// 선수 본인: 경기결과 자가등록 (status PENDING → 관리자 승인 필요)
// ※ '/:id/event-results' 보다 먼저 등록해야 '/me' 가 :id 로 잡히지 않음
// ============================================

/** GET /athletes/me/event-results — 본인 결과 전체(PENDING 포함) */
router.get('/me/event-results', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    const athleteId = req.user.athleteId;
    if (!athleteId) { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정이 아닙니다' } }); return; }
    const items = await prisma.athleteEventResult.findMany({ where: { athleteId }, orderBy: { eventDate: 'desc' } });
    res.json({ success: true, data: items, error: null });
  } catch (e) { next(e); }
});

/** POST /athletes/me/event-results — 본인 자가등록 (PENDING) */
router.post('/me/event-results', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    const athleteId = req.user.athleteId;
    if (!athleteId) { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '선수 계정이 아닙니다' } }); return; }
    const { eventName, eventDate, tour, category, rank, score, totalRounds, summary } = req.body;
    if (!eventName || !eventDate) { res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'eventName, eventDate 필수' } }); return; }
    const created = await prisma.athleteEventResult.create({
      data: {
        athleteId, eventName, eventDate: new Date(eventDate), tour: tour || null, category: category || null,
        rank: rank ?? null, score: score || null, totalRounds: totalRounds ?? null, summary: summary || null,
        source: 'ATHLETE_SELF', status: 'PENDING',
      },
    });
    res.json({ success: true, data: created, error: null });
  } catch (e) { next(e); }
});

/** PATCH /athletes/me/event-results/:resultId — 본인 결과 수정 (수정 시 재승인 위해 PENDING) */
router.patch('/me/event-results/:resultId', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    const athleteId = req.user.athleteId;
    const r = await prisma.athleteEventResult.findUnique({ where: { id: req.params.resultId } });
    if (!r || r.athleteId !== athleteId) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '결과를 찾을 수 없습니다' } }); return; }
    const updated = await prisma.athleteEventResult.update({
      where: { id: req.params.resultId },
      data: {
        ...(req.body.eventName != null && { eventName: req.body.eventName }),
        ...(req.body.eventDate && { eventDate: new Date(req.body.eventDate) }),
        ...(req.body.tour !== undefined && { tour: req.body.tour || null }),
        ...(req.body.category !== undefined && { category: req.body.category || null }),
        ...(req.body.rank !== undefined && { rank: req.body.rank }),
        ...(req.body.score !== undefined && { score: req.body.score || null }),
        ...(req.body.summary !== undefined && { summary: req.body.summary || null }),
        status: 'PENDING',
      },
    });
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

/** DELETE /athletes/me/event-results/:resultId — 본인 결과 삭제 */
router.delete('/me/event-results/:resultId', authenticate, authorize('ATHLETE'), async (req: any, res, next) => {
  try {
    const athleteId = req.user.athleteId;
    const r = await prisma.athleteEventResult.findUnique({ where: { id: req.params.resultId } });
    if (!r || r.athleteId !== athleteId) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '결과를 찾을 수 없습니다' } }); return; }
    await prisma.athleteEventResult.delete({ where: { id: req.params.resultId } });
    res.json({ success: true, data: { deleted: true }, error: null });
  } catch (e) { next(e); }
});

// ============================================
// 관리자: 선수 경기결과 CRUD (docx 3-6)
// ============================================

/** GET /athletes/:id/event-results — 운영자 또는 본인 */
router.get('/:id/event-results', authenticate, async (req: any, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN') {
      const a = await prisma.athlete.findUnique({ where: { id }, select: { userId: true } });
      if (!a || a.userId !== req.user.id) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
        return;
      }
    }
    const items = await prisma.athleteEventResult.findMany({
      where: { athleteId: id },
      orderBy: { eventDate: 'desc' },
    });
    res.json({ success: true, data: items, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /athletes/:id/event-results — 관리자만 (수기 등록) */
router.post('/:id/event-results', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const { eventName, eventDate, category, rank, score, totalRounds, summary, source } = req.body;
    if (!eventName || !eventDate) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'eventName, eventDate 필수' } });
      return;
    }
    const created = await prisma.athleteEventResult.create({
      data: {
        athleteId: id,
        eventName,
        eventDate: new Date(eventDate),
        category: category || null,
        rank: rank ?? null,
        score: score || null,
        totalRounds: totalRounds ?? null,
        summary: summary || null,
        source: source || 'MANUAL',
      },
    });
    res.json({ success: true, data: created, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** PATCH /athletes/event-results/:resultId */
router.patch('/event-results/:resultId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const updated = await prisma.athleteEventResult.update({
      where: { id: req.params.resultId },
      data: {
        ...(req.body.eventName != null && { eventName: req.body.eventName }),
        ...(req.body.eventDate && { eventDate: new Date(req.body.eventDate) }),
        ...(req.body.category !== undefined && { category: req.body.category }),
        ...(req.body.rank !== undefined && { rank: req.body.rank }),
        ...(req.body.score !== undefined && { score: req.body.score }),
        ...(req.body.totalRounds !== undefined && { totalRounds: req.body.totalRounds }),
        ...(req.body.summary !== undefined && { summary: req.body.summary }),
        ...(req.body.source && { source: req.body.source }),
        sourceUpdatedAt: new Date(),
      },
    });
    res.json({ success: true, data: updated, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** DELETE /athletes/event-results/:resultId */
router.delete('/event-results/:resultId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    await prisma.athleteEventResult.delete({ where: { id: req.params.resultId } });
    res.json({ success: true, data: { deleted: true }, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** PATCH /athletes/event-results/:resultId/approve — 관리자 승인/반려 (선수 자가등록 검수) */
router.patch('/event-results/:resultId/approve', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const status = req.body.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const updated = await prisma.athleteEventResult.update({ where: { id: req.params.resultId }, data: { status } });
    res.json({ success: true, data: updated, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

// ============================================
// docx §6 C-1 미디어노출 수동 입력 (관리자)
// ============================================
import { roiAutoSyncCron } from '../cron/followerSnapshot.cron';

/** GET /athletes/:id/media-exposures — 운영자 또는 본인 */
router.get('/:id/media-exposures', authenticate, async (req: any, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN') {
      const a = await prisma.athlete.findUnique({ where: { id }, select: { userId: true } });
      if (!a || a.userId !== req.user.id) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
        return;
      }
    }
    const items = await mediaExposureService.listMediaExposures(id);
    res.json({ success: true, data: items, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /athletes/:id/media-exposures — 관리자 (수기 입력) */
router.post('/:id/media-exposures', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const { broadcastCount, broadcastSeconds, patchExposureEstimate, articleMentions, highlightCount, periodStart, periodEnd, source, notes } = req.body;
    if (!periodStart || !periodEnd) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'periodStart, periodEnd 필수' } });
      return;
    }
    const created = await mediaExposureService.createMediaExposure({
      athleteId: id,
      broadcastCount, broadcastSeconds, patchExposureEstimate, articleMentions, highlightCount,
      periodStart, periodEnd, source, notes,
    });
    res.json({ success: true, data: created, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** PATCH /athletes/media-exposures/:exposureId */
router.patch('/media-exposures/:exposureId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const updated = await mediaExposureService.updateMediaExposure(req.params.exposureId, req.body);
    res.json({ success: true, data: updated, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** DELETE /athletes/media-exposures/:exposureId */
router.delete('/media-exposures/:exposureId', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    await mediaExposureService.deleteMediaExposure(req.params.exposureId);
    res.json({ success: true, data: { deleted: true }, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

// ============================================
// docx §6 C-1 / C-3 — 자동 수집 수동 트리거 (운영 디버깅용)
// ============================================

/** POST /athletes/:id/sync-news — 한 선수의 네이버 뉴스 즉시 수집 */
router.post('/:id/sync-news', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const a = await prisma.athlete.findUnique({ where: { id: req.params.id }, select: { name: true } });
    if (!a) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Athlete not found' } });
      return;
    }
    const r = await naverNewsService.syncAthleteNews(req.params.id, a.name, { extraKeyword: req.body.extraKeyword || '골프' });
    res.json({ success: true, data: r, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /athletes/sync-followers-all — 모든 선수의 팔로워 스냅샷 즉시 캡처 */
router.post('/sync-followers-all', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const r = await roiAutoSyncCron.runFollowerSnapshot();
    res.json({ success: true, data: r, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/** POST /athletes/sync-news-all — 모든 선수의 네이버 뉴스 즉시 수집 */
router.post('/sync-news-all', authenticate, authorize('ADMIN'), async (req: any, res, next) => {
  try {
    const r = await roiAutoSyncCron.runNewsSync();
    res.json({ success: true, data: r, error: null, request_id: (req as any).requestId });
  } catch (e) { next(e); }
});

/**
 * @route GET /athletes
 * @desc List all athletes (legacy, 인증 필요)
 */
router.get('/', authenticate, athleteController.list);

/**
 * @route GET /athletes/me
 * @desc Get current athlete profile
 */
router.get('/me', authenticate, authorize('ATHLETE'), athleteController.getMe);

/**
 * @route GET /athletes/me/stats
 * @desc Get athlete statistics
 */
router.get('/me/stats', authenticate, authorize('ATHLETE'), athleteController.getStats);

/**
 * @route GET /athletes/me/slots
 * @desc Get athlete's available slots
 */
router.get('/me/slots', authenticate, authorize('ATHLETE'), athleteController.getAvailableSlots);

/**
 * @route PATCH /athletes/me
 * @desc Update current athlete profile
 */
router.patch('/me', authenticate, authorize('ATHLETE'), athleteController.update);

/**
 * @route PATCH /athletes/admin/:id
 * @desc 관리자: 임의 선수 프로필 갱신 (구조화 필드 + isActive 포함)
 *  SPONPIK 4. 권장 데이터 항목 운영 — 관리자 우선 정책
 */
router.patch('/admin/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name, realName, bio, profileImageUrl, socialLinks, primarySponsors,
      height, region, debutYear, affiliation, sportType, sportId, isActive,
      kycStatus, blockedCategories,
      education, awards, career,
    } = req.body || {};
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (realName !== undefined) data.realName = realName;
    if (bio !== undefined) data.bio = bio;
    if (profileImageUrl !== undefined) data.profileImageUrl = profileImageUrl;
    if (socialLinks !== undefined) data.socialLinks = socialLinks;
    if (primarySponsors !== undefined) data.primarySponsors = primarySponsors;
    if (blockedCategories !== undefined) data.blockedCategories = blockedCategories;
    // 범위 검증 (서비스 레이어와 동일 정책)
    if (height !== undefined) {
      const h = height === '' || height === null ? null : Number(height);
      if (h !== null && (isNaN(h) || h < 100 || h > 250)) {
        res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '신장은 100~250cm 범위' } });
        return;
      }
      data.height = h;
    }
    if (region !== undefined) {
      if (region && String(region).length > 100) {
        res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '거주 지역은 100자 이내' } });
        return;
      }
      data.region = region || null;
    }
    if (debutYear !== undefined) {
      const dy = debutYear === '' || debutYear === null ? null : Number(debutYear);
      const currentYear = new Date().getFullYear();
      if (dy !== null && (isNaN(dy) || dy < 1950 || dy > currentYear + 1)) {
        res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: `데뷔 연도는 1950~${currentYear + 1} 범위` } });
        return;
      }
      data.debutYear = dy;
    }
    if (affiliation !== undefined) {
      if (affiliation && String(affiliation).length > 200) {
        res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '소속은 200자 이내' } });
        return;
      }
      data.affiliation = affiliation || null;
    }
    // 선수 프로필 구조화 — 학력/수상/경력 (각 500자 이내)
    for (const [key, val] of [['education', education], ['awards', awards], ['career', career]] as const) {
      if (val !== undefined) {
        if (val && String(val).length > 500) {
          res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: `${key}는 500자 이내` } });
          return;
        }
        data[key] = val || null;
      }
    }
    if (sportType !== undefined) {
      const allowed = ['GOLF', 'SCREEN_GOLF', 'BASEBALL', 'SOCCER', 'VOLLEYBALL', 'BASKETBALL', 'TENNIS'];
      if (sportType && !allowed.includes(sportType)) {
        res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '지원하지 않는 종목' } });
        return;
      }
      data.sportType = sportType || null;
    }
    if (sportId !== undefined) data.sportId = sportId || null;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (kycStatus !== undefined) data.kycStatus = kycStatus;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, data: null, error: { code: 'INVALID_REQUEST', message: '변경할 필드가 없습니다.' } });
      return;
    }
    const updated = await prisma.athlete.update({ where: { id }, data });
    res.json({ success: true, data: updated, error: null });
  } catch (e) { next(e); }
});

/**
 * @route PATCH /athletes/me/bank
 * @desc Update bank information
 */
router.patch('/me/bank', authenticate, authorize('ATHLETE'), athleteController.updateBankInfo);

/**
 * @route PATCH /athletes/me/bank-account
 * @desc Update bank account (simplified)
 */
router.patch('/me/bank-account', authenticate, authorize('ATHLETE'), athleteController.updateBankAccount);

/**
 * @route PATCH /athletes/me/slots
 * @desc Update slot availability (blocked categories)
 */
router.patch('/me/slots', authenticate, authorize('ATHLETE'), athleteController.updateSlotAvailability);

/**
 * @route POST /athletes/me/kyc
 * @desc Submit KYC documents
 */
router.post('/me/kyc', authenticate, authorize('ATHLETE'), athleteController.submitKyc);

/**
 * ★ Phase 9-3: Athlete pending signatures API
 */

/**
 * @route GET /athletes/me/pending-signatures
 * @desc Get athlete's contracts pending signature
 */
router.get('/me/pending-signatures', authenticate, authorize('ATHLETE'), athleteController.getPendingSignatures);

/**
 * ★ 에이전시 연결 요청 관리 (선수용)
 */

/**
 * @route GET /athletes/agency-requests
 * @desc Get agency connection requests received by athlete
 */
router.get('/agency-requests', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.getReceivedRequests);

/**
 * @route POST /athletes/agency-requests/:requestId/approve
 * @desc Approve an agency connection request
 */
router.post('/agency-requests/:requestId/approve', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.approveRequest);

/**
 * @route POST /athletes/agency-requests/:requestId/reject
 * @desc Reject an agency connection request
 */
router.post('/agency-requests/:requestId/reject', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.rejectRequest);

/**
 * @route GET /athletes/:id
 * @desc Get athlete by ID
 */
router.get('/:id', authenticate, athleteController.getById);

export default router;

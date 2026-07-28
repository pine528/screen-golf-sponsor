/**
 * IR 프레젠테이션용 Mock 데이터 시드
 * 실제 운영 중인 것처럼 보이도록 풍부한 데이터 생성
 *
 * 실행: npx ts-node prisma/seed-ir-mock.ts
 */
import { PrismaClient, BodyPart, SlotGrade, SlotCategory, MaterialRule } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================
// Helper
// ============================================
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

async function main() {
  console.log('🎬 IR Mock 데이터 시딩 시작...\n');

  // ============================================
  // 1. 추가 선수 생성 (기존 김프로 + 3명)
  // ============================================
  console.log('[1/10] 추가 선수 생성...');
  const pw = await bcrypt.hash('test123!', 12);

  const athlete2User = await prisma.user.upsert({
    where: { email: 'athlete2@example.com' },
    update: {},
    create: { email: 'athlete2@example.com', passwordHash: pw, role: 'ATHLETE',
      athlete: { create: { name: '이수진', tour: 'KLPGA', bio: 'KLPGA 시즌 우승 2회, 통산 상금 3.2억원', kycStatus: 'APPROVED' } } },
  });
  const athlete3User = await prisma.user.upsert({
    where: { email: 'athlete3@example.com' },
    update: {},
    create: { email: 'athlete3@example.com', passwordHash: pw, role: 'ATHLETE',
      athlete: { create: { name: '박준혁', tour: 'KPGA', bio: 'KPGA 시즌 챔피언, 투어 통산 4승', kycStatus: 'APPROVED' } } },
  });
  const athlete4User = await prisma.user.upsert({
    where: { email: 'athlete4@example.com' },
    update: {},
    create: { email: 'athlete4@example.com', passwordHash: pw, role: 'ATHLETE',
      athlete: { create: { name: '최민서', tour: 'GTOUR', bio: 'GTOUR 시즌2 챔피언, 드라이버 평균 280야드', kycStatus: 'APPROVED' } } },
  });

  // 기존 선수 포함 전체 athlete 가져오기
  const allAthletes = await prisma.athlete.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`  선수 ${allAthletes.length}명 준비`);

  // ============================================
  // 2. 추가 브랜드 생성 (기존 테스트 브랜드 + 3개)
  // ============================================
  console.log('[2/10] 추가 브랜드 생성...');

  // 기존 브랜드 이름 업데이트
  await prisma.brand.updateMany({
    where: { name: '테스트 브랜드' },
    data: { name: '나이키골프', category: 'SPORTSWEAR', description: '세계 1위 스포츠 브랜드, 골프웨어 & 장비' },
  });

  const brand2User = await prisma.user.upsert({
    where: { email: 'brand2@example.com' },
    update: {},
    create: { email: 'brand2@example.com', passwordHash: pw, role: 'BRAND',
      brand: { create: { name: '캘러웨이코리아', bizNo: '234-56-78901', contactEmail: 'brand2@example.com', contactPhone: '02-1234-5678', category: 'GOLF_EQUIPMENT', description: '프리미엄 골프 클럽 & 볼', kycStatus: 'APPROVED' } } },
  });
  const brand3User = await prisma.user.upsert({
    where: { email: 'brand3@example.com' },
    update: {},
    create: { email: 'brand3@example.com', passwordHash: pw, role: 'BRAND',
      brand: { create: { name: '한화생명', bizNo: '345-67-89012', contactEmail: 'brand3@example.com', contactPhone: '02-2345-6789', category: 'FINANCE', description: '대한민국 대표 생명보험, 한화이글스 모기업', kycStatus: 'APPROVED' } } },
  });
  const brand4User = await prisma.user.upsert({
    where: { email: 'brand4@example.com' },
    update: {},
    create: { email: 'brand4@example.com', passwordHash: pw, role: 'BRAND',
      brand: { create: { name: '볼빅', bizNo: '456-78-90123', contactEmail: 'brand4@example.com', contactPhone: '031-1234-5678', category: 'GOLF_BALL', description: '국산 프리미엄 골프볼 제조사', kycStatus: 'APPROVED' } } },
  });

  const allBrands = await prisma.brand.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`  브랜드 ${allBrands.length}개 준비`);

  // ============================================
  // 3. 추가 이벤트 생성
  // ============================================
  console.log('[3/10] 추가 이벤트 생성...');

  const tournamentRules = {
    chestReservedSide: 'LEFT',
    sleeveReservedSide: 'RIGHT',
    reservedSlotCodes: [],
    disabledSlotCodes: [],
    phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED',
    phase2UnlockMode: 'ADMIN_APPROVE',
    phase2EligibleMinDaysBefore: 2,
    creativeApprovalRequired: true,
    prohibitedCategories: ['tobacco', 'alcohol', 'adult', 'gambling'],
    maxSlotsPerBrandPerPlayer: 2,
  };

  const event2 = await prisma.event.upsert({
    where: { id: 'mock-event-2' },
    update: {},
    create: {
      id: 'mock-event-2', tour: 'GTOUR',
      name: '2026 GTOUR 시즌1 제2전',
      description: '2026 시즌 두 번째 GTOUR 대회 – 스크린골프 파크 부산',
      dateStart: new Date('2026-08-15'), dateEnd: new Date('2026-08-17'),
      broadcastEpisode: 'S1E2', multiplier: 1.0,
      venue: '골프존 파크 부산', status: 'UPCOMING',
      tournamentRules,
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: 'mock-event-3' },
    update: {},
    create: {
      id: 'mock-event-3', tour: 'GTOUR',
      name: '2026 GTOUR 시즌1 제3전',
      description: '2026 시즌 세 번째 GTOUR 대회 – 골프존 파크 제주',
      dateStart: new Date('2026-09-10'), dateEnd: new Date('2026-09-12'),
      broadcastEpisode: 'S1E3', multiplier: 1.3,
      venue: '골프존 파크 제주', status: 'UPCOMING',
      tournamentRules,
    },
  });

  const allEvents = await prisma.event.findMany({ orderBy: { dateStart: 'asc' } });
  console.log(`  이벤트 ${allEvents.length}개 준비`);

  // ============================================
  // 4. 슬롯 인스턴스 대량 생성
  // ============================================
  console.log('[4/10] 슬롯 인스턴스 생성...');

  const templates = await prisma.slotTemplate.findMany({ orderBy: [{ phase: 'asc' }, { code: 'asc' }] });

  // 기존 선수(김프로)의 슬롯을 전체 템플릿으로 확장
  const mainAthlete = allAthletes[0]; // 김프로
  const mainEvent = allEvents[0]; // 2026 GTOUR 1차

  const slotStatuses = ['OPEN', 'OPEN', 'IN_AUCTION', 'SOLD', 'OPEN', 'IN_AUCTION', 'SOLD', 'OPEN', 'OPEN', 'OPEN',
    'SOLD', 'OPEN', 'IN_AUCTION', 'OPEN', 'OPEN', 'OPEN'] as const;

  let slotCount = 0;
  for (let ti = 0; ti < templates.length; ti++) {
    const t = templates[ti];
    const status = slotStatuses[ti % slotStatuses.length];

    await prisma.slotInstance.upsert({
      where: { eventId_athleteId_slotTemplateId: { eventId: mainEvent.id, athleteId: mainAthlete.id, slotTemplateId: t.id } },
      update: { status },
      create: {
        eventId: mainEvent.id, athleteId: mainAthlete.id, slotTemplateId: t.id,
        reservePrice: t.defaultReservePrice, status,
        enableAuction: true, enableDirectBuy: status === 'OPEN',
        directBuyPrice: status === 'OPEN' ? t.defaultReservePrice * 1.5 : null,
      },
    });
    slotCount++;
  }

  // 다른 선수들에게도 이벤트별 슬롯 배정
  for (const ath of allAthletes.slice(1)) {
    for (const ev of allEvents) {
      // 랜덤 6~10개 슬롯
      const numSlots = randomInt(6, 10);
      const selectedTemplates = templates.slice(0, numSlots);
      for (let i = 0; i < selectedTemplates.length; i++) {
        const t = selectedTemplates[i];
        const statusArr: ('OPEN' | 'IN_AUCTION' | 'SOLD')[] = ['OPEN', 'OPEN', 'IN_AUCTION', 'SOLD', 'OPEN', 'OPEN'];
        const st = statusArr[i % statusArr.length];
        try {
          await prisma.slotInstance.upsert({
            where: { eventId_athleteId_slotTemplateId: { eventId: ev.id, athleteId: ath.id, slotTemplateId: t.id } },
            update: {},
            create: {
              eventId: ev.id, athleteId: ath.id, slotTemplateId: t.id,
              reservePrice: t.defaultReservePrice, status: st,
              enableAuction: true, enableDirectBuy: st === 'OPEN',
              directBuyPrice: st === 'OPEN' ? t.defaultReservePrice * 1.5 : null,
            },
          });
          slotCount++;
        } catch (e) { /* duplicate - skip */ }
      }
    }
  }
  console.log(`  슬롯 인스턴스 ${slotCount}개 생성/업데이트`);

  // ============================================
  // 5. 경매 생성 (LIVE + ENDED)
  // ============================================
  console.log('[5/10] 경매 생성...');

  // IN_AUCTION 상태의 슬롯에 경매 만들기
  const inAuctionSlots = await prisma.slotInstance.findMany({
    where: { status: 'IN_AUCTION' },
    include: { slotTemplate: true, athlete: true },
    take: 8,
  });

  const now = new Date();
  let auctionCount = 0;
  for (let i = 0; i < inAuctionSlots.length; i++) {
    const slot = inAuctionSlots[i];
    const isLive = i < 5; // 5개 LIVE, 나머지 ENDED
    const startAt = isLive
      ? new Date(now.getTime() - randomInt(5, 30) * 60 * 1000)
      : pastDate(randomInt(5, 20));
    const endAt = isLive
      ? new Date(now.getTime() + randomInt(10, 120) * 60 * 1000)
      : pastDate(randomInt(1, 4));

    try {
      await prisma.auction.upsert({
        where: { slotInstanceId: slot.id },
        update: {
          status: isLive ? 'LIVE' : 'ENDED',
          startAt, endAt, originalEndAt: endAt,
          currentPrice: slot.reservePrice + randomInt(1, 10) * 100000,
          isFeatured: i < 2,
        },
        create: {
          slotInstanceId: slot.id,
          startAt, endAt, originalEndAt: endAt,
          softCloseSec: 120, maxExtensionSec: 600, minBidIncrement: 10000,
          currentPrice: slot.reservePrice + randomInt(1, 10) * 100000,
          status: isLive ? 'LIVE' : 'ENDED',
          isFeatured: i < 2,
        },
      });
      auctionCount++;
    } catch (e) { /* skip duplicates */ }
  }

  // SOLD 슬롯에도 ENDED 경매 생성
  const soldSlots = await prisma.slotInstance.findMany({
    where: { status: 'SOLD' },
    take: 6,
  });
  for (const slot of soldSlots) {
    const startAt = pastDate(randomInt(10, 30));
    const endAt = pastDate(randomInt(3, 9));
    try {
      await prisma.auction.upsert({
        where: { slotInstanceId: slot.id },
        update: {},
        create: {
          slotInstanceId: slot.id,
          startAt, endAt, originalEndAt: endAt,
          softCloseSec: 120, maxExtensionSec: 600, minBidIncrement: 10000,
          currentPrice: slot.reservePrice + randomInt(2, 15) * 100000,
          status: 'ENDED',
        },
      });
      auctionCount++;
    } catch (e) { /* skip */ }
  }
  console.log(`  경매 ${auctionCount}개 생성`);

  // ============================================
  // 6. 입찰 생성
  // ============================================
  console.log('[6/10] 입찰 생성...');

  const allAuctions = await prisma.auction.findMany({
    include: { slotInstance: true },
  });

  let bidCount = 0;
  for (const auction of allAuctions) {
    // 각 경매당 1~3개 브랜드 입찰
    const numBids = randomInt(1, Math.min(3, allBrands.length));
    const shuffledBrands = [...allBrands].sort(() => Math.random() - 0.5).slice(0, numBids);

    for (let bi = 0; bi < shuffledBrands.length; bi++) {
      const brand = shuffledBrands[bi];
      const maxBid = auction.currentPrice + randomInt(1, 5) * 100000;
      const isWinning = bi === 0; // 첫 번째가 최고 입찰
      try {
        await prisma.bid.upsert({
          where: { auctionId_brandId: { auctionId: auction.id, brandId: brand.id } },
          update: { maxBid, currentProxy: isWinning ? auction.currentPrice : auction.currentPrice - 100000, isWinning },
          create: {
            auctionId: auction.id, brandId: brand.id,
            maxBid, currentProxy: isWinning ? auction.currentPrice : auction.currentPrice - 100000,
            autoBid: true, isWinning,
          },
        });
        bidCount++;
      } catch (e) { /* skip */ }
    }
  }
  console.log(`  입찰 ${bidCount}개 생성`);

  // ============================================
  // 7. 계약 생성
  // ============================================
  console.log('[7/10] 계약 생성...');

  const endedAuctions = await prisma.auction.findMany({
    where: { status: 'ENDED' },
    include: {
      slotInstance: { include: { athlete: true } },
      bids: { where: { isWinning: true }, include: { brand: true } },
    },
  });

  const contractStatuses = ['ACTIVE', 'ASSET_PENDING', 'VERIFIED', 'COMPLETED', 'PENDING_SIGNATURE'] as const;
  let contractCount = 0;
  for (let ci = 0; ci < endedAuctions.length; ci++) {
    const auction = endedAuctions[ci];
    const winBid = auction.bids[0];
    if (!winBid) continue;

    const status = contractStatuses[ci % contractStatuses.length];
    try {
      await prisma.contract.upsert({
        where: { auctionId: auction.id },
        update: { status, priceFinal: auction.currentPrice },
        create: {
          auctionId: auction.id,
          brandId: winBid.brandId,
          athleteId: auction.slotInstance.athleteId,
          priceFinal: auction.currentPrice,
          status,
          brandSignedAt: status !== 'PENDING_SIGNATURE' ? pastDate(randomInt(1, 5)) : null,
          athleteSignedAt: status !== 'PENDING_SIGNATURE' ? pastDate(randomInt(1, 5)) : null,
          signedAt: status !== 'PENDING_SIGNATURE' ? pastDate(randomInt(1, 5)) : null,
          assetDeadline: futureDate(randomInt(7, 30)),
          terms: {
            duration: '대회 기간 (3일)',
            bodyPart: auction.slotInstance.slotTemplateId,
            material: '무광 열전사',
            exclusivity: true,
          },
        },
      });
      contractCount++;
    } catch (e) { /* skip */ }
  }
  console.log(`  계약 ${contractCount}개 생성`);

  // ============================================
  // 8. 캠페인 + ROI 데이터 생성
  // ============================================
  console.log('[8/10] 캠페인 & ROI 데이터 생성...');

  const mainBrand = allBrands[0]; // 나이키골프 (원래 테스트 브랜드)

  // 기존 캠페인 업데이트 (실적 데이터 추가)
  await prisma.campaign.updateMany({
    where: { id: 'sample-campaign-1' },
    data: {
      name: '2026 GTOUR 시즌 메인 스폰서십',
      budget: 50000000,
      spentAmount: 18500000,
      goalImpressions: 500000,
      goalClicks: 15000,
      actualImpressions: 342000,
      actualClicks: 8900,
      status: 'ACTIVE',
    },
  });

  await prisma.campaign.updateMany({
    where: { id: 'sample-campaign-2' },
    data: {
      name: 'Q1 골프웨어 론칭 프로모션',
      budget: 20000000,
      spentAmount: 12000000,
      goalImpressions: 200000,
      goalClicks: 8000,
      actualImpressions: 156000,
      actualClicks: 5200,
      status: 'ACTIVE',
    },
  });

  // 2번째 브랜드 캠페인
  if (allBrands.length > 1) {
    await prisma.campaign.upsert({
      where: { id: 'mock-campaign-3' },
      update: {},
      create: {
        id: 'mock-campaign-3',
        brandId: allBrands[1].id,
        name: '캘러웨이 드라이버 프로모션',
        description: '신제품 드라이버 중계 노출 캠페인',
        budget: 30000000, spentAmount: 8200000,
        goalImpressions: 300000, actualImpressions: 98000,
        goalClicks: 10000, actualClicks: 3400,
        status: 'ACTIVE',
        dateStart: new Date('2026-07-01'), dateEnd: new Date('2026-12-31'),
      },
    });
  }

  // VOD 자산 생성
  const vodAsset = await prisma.vodAsset.upsert({
    where: { id: 'mock-vod-1' },
    update: {},
    create: {
      id: 'mock-vod-1',
      campaignId: 'sample-campaign-1',
      eventId: mainEvent.id,
      source: 'YOUTUBE',
      sourceUrl: 'https://youtube.com/watch?v=sample_gtour_2026',
      storageKey: 'vod/gtour-2026-s1e1.mp4',
      fileName: 'GTOUR 2026 시즌1 제1전 하이라이트.mp4',
      duration: 5400, fps: 30, resolution: '1920x1080',
      fileSizeBytes: BigInt(2_500_000_000),
      status: 'COMPLETED',
      processedAt: pastDate(3),
    },
  });

  const vodAsset2 = await prisma.vodAsset.upsert({
    where: { id: 'mock-vod-2' },
    update: {},
    create: {
      id: 'mock-vod-2',
      campaignId: 'sample-campaign-1',
      source: 'UPLOAD',
      storageKey: 'vod/gtour-2026-s1e1-full.mp4',
      fileName: 'GTOUR 2026 시즌1 제1전 풀영상.mp4',
      duration: 14400, fps: 30, resolution: '1920x1080',
      fileSizeBytes: BigInt(8_000_000_000),
      status: 'COMPLETED',
      processedAt: pastDate(2),
    },
  });

  // VodFrame 생성 (20개)
  for (let fi = 0; fi < 20; fi++) {
    await prisma.vodFrame.upsert({
      where: { id: `mock-frame-${fi}` },
      update: {},
      create: {
        id: `mock-frame-${fi}`,
        vodAssetId: vodAsset.id,
        frameNumber: fi * 270,
        timestamp: fi * 270 / 30,
        thumbnailKey: `frames/gtour-2026-s1e1/frame_${fi * 270}.jpg`,
      },
    });
  }

  // LogoDetection 생성
  for (let di = 0; di < 15; di++) {
    try {
      await prisma.logoDetection.create({
        data: {
          frameId: `mock-frame-${di % 20}`,
          brandId: mainBrand.id,
          confidence: 0.75 + Math.random() * 0.2,
          bboxX: randomInt(200, 800),
          bboxY: randomInt(100, 500),
          bboxW: randomInt(60, 200),
          bboxH: randomInt(30, 100),
          bboxArea: randomInt(3000, 20000),
          areaRatio: 0.005 + Math.random() * 0.03,
          blurScore: 0.6 + Math.random() * 0.3,
          slotType: ['CAP_FRONT', 'CHEST_L', 'SLEEVE_L', 'COLLAR_L'][di % 4],
        },
      });
    } catch (e) { /* skip */ }
  }

  // RoiExposure 생성
  for (let ri = 0; ri < 8; ri++) {
    try {
      await prisma.roiExposure.create({
        data: {
          vodAssetId: vodAsset.id,
          campaignId: 'sample-campaign-1',
          brandId: mainBrand.id,
          slotType: ['CAP_FRONT', 'CHEST_L', 'SLEEVE_L', 'COLLAR_L', 'CAP_SIDE_L', 'BACK_SHOULDER_L', 'CHEST_R', 'COLLAR_R'][ri],
          startTs: ri * 600 + randomInt(0, 100),
          endTs: ri * 600 + randomInt(150, 550),
          duration: randomInt(3, 15),
          frameCount: randomInt(10, 50),
          avgConfidence: 0.8 + Math.random() * 0.15,
          avgAreaRatio: 0.008 + Math.random() * 0.02,
          maxAreaRatio: 0.02 + Math.random() * 0.04,
          isValid: true,
          reviewStatus: ri < 5 ? 'APPROVED' : 'PENDING',
        },
      });
    } catch (e) { /* skip */ }
  }

  // RoiReport 생성
  await prisma.roiReport.upsert({
    where: { id: 'mock-roi-report-1' },
    update: {},
    create: {
      id: 'mock-roi-report-1',
      campaignId: 'sample-campaign-1',
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-08-03'),
      type: 'CAMPAIGN_FINAL',
      title: '2026 GTOUR 시즌1 제1전 ROI 리포트',
      status: 'COMPLETED',
      generatedAt: pastDate(1),
      metricsJson: {
        totalExposureSec: 127.5,
        totalFrameCount: 382,
        avgConfidence: 0.87,
        estimatedImpressions: 342000,
        estimatedMediaValue: 28500000,
        slotBreakdown: {
          CAP_FRONT: { exposureSec: 42.3, impressions: 120000, mediaValue: 10800000 },
          CHEST_L: { exposureSec: 35.8, impressions: 98000, mediaValue: 8820000 },
          SLEEVE_L: { exposureSec: 28.2, impressions: 72000, mediaValue: 5400000 },
          COLLAR_L: { exposureSec: 21.2, impressions: 52000, mediaValue: 3480000 },
        },
      },
    },
  });

  // ExposureRecords for contracts
  const contracts = await prisma.contract.findMany({ take: 5 });
  for (const contract of contracts) {
    for (let ei = 0; ei < randomInt(2, 5); ei++) {
      try {
        await prisma.exposureRecord.create({
          data: {
            contractId: contract.id,
            exposureType: ['BROADCAST', 'SOCIAL_MEDIA', 'PHOTO_PRESS', 'EVENT_LIVE'][ei % 4] as any,
            impressions: randomInt(5000, 150000),
            viewDurationSec: randomInt(10, 300),
            reachCount: randomInt(2000, 80000),
            mediaValue: randomInt(500000, 15000000),
            ratePerImpression: 0.05 + Math.random() * 0.1,
            description: ['중계 방송 노출', 'SNS 바이럴', '보도자료 사진', '현장 이벤트'][ei % 4],
            recordedAt: pastDate(randomInt(1, 15)),
          },
        });
      } catch (e) { /* skip */ }
    }
  }

  // MediaMention 생성
  const mediaMentions = [
    { type: 'NEWS' as const, url: 'https://sports.news.com/gtour-2026', title: '[골프] GTOUR 2026 시즌 개막, 스폰픽 플랫폼 최초 적용', viewCount: 15200, hasLogo: true },
    { type: 'YOUTUBE' as const, url: 'https://youtube.com/watch?v=gtour_highlights', title: 'GTOUR 2026 1차전 하이라이트 | 김프로 우승', viewCount: 85000, likeCount: 3200, commentCount: 420, hasLogo: true },
    { type: 'INSTAGRAM' as const, url: 'https://instagram.com/p/gtour2026', title: '골프 선수들의 스폰서십 광고 노출 모먼트', viewCount: 42000, likeCount: 5800, hasLogo: true },
    { type: 'NEWS' as const, url: 'https://economy.news.com/sponpick-launch', title: '[경제] 스폰픽, AI 기반 스폰서십 플랫폼으로 골프 마케팅 혁신', viewCount: 8500, hasLogo: false },
  ];
  for (const mm of mediaMentions) {
    try {
      await prisma.mediaMention.create({
        data: {
          campaignId: 'sample-campaign-1',
          ...mm,
          publishedAt: pastDate(randomInt(1, 10)),
        },
      });
    } catch (e) { /* skip */ }
  }

  console.log('  캠페인/ROI 데이터 생성 완료');

  // ============================================
  // 9. 지갑(Wallet) + 원장 생성
  // ============================================
  console.log('[9/10] 지갑 & 원장 생성...');

  for (const brand of allBrands) {
    const wallet = await prisma.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: 'BRAND', ownerId: brand.id } },
      update: { balance: randomInt(10, 80) * 1000000 },
      create: {
        ownerType: 'BRAND', ownerId: brand.id,
        balance: randomInt(10, 80) * 1000000,
      },
    });

    // 원장 항목 생성
    try {
      await prisma.ledgerTx.create({
        data: {
          walletId: wallet.id, type: 'TOPUP_DEPOSIT',
          amount: 50000000, balanceAfter: wallet.balance,
          status: 'COMPLETED', refType: 'TOPUP',
        },
      });
    } catch (e) { /* skip */ }
  }

  for (const ath of allAthletes) {
    const wallet = await prisma.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: 'ATHLETE', ownerId: ath.id } },
      update: { balance: randomInt(2, 15) * 1000000 },
      create: {
        ownerType: 'ATHLETE', ownerId: ath.id,
        balance: randomInt(2, 15) * 1000000,
      },
    });

    try {
      await prisma.ledgerTx.create({
        data: {
          walletId: wallet.id, type: 'ESCROW_RELEASE',
          amount: randomInt(1, 5) * 1000000, balanceAfter: wallet.balance,
          status: 'COMPLETED', refType: 'CONTRACT',
        },
      });
    } catch (e) { /* skip */ }
  }

  // 플랫폼 지갑
  await prisma.wallet.upsert({
    where: { ownerType_ownerId: { ownerType: 'PLATFORM', ownerId: 'PLATFORM_SYSTEM' } },
    update: { balance: 8500000 },
    create: {
      ownerType: 'PLATFORM', ownerId: 'PLATFORM_SYSTEM',
      balance: 8500000,
    },
  });

  console.log('  지갑 & 원장 생성 완료');

  // ============================================
  // 10. CampaignContract 연결
  // ============================================
  console.log('[10/10] 캠페인-계약 연결...');

  const allContracts = await prisma.contract.findMany({ take: 4 });
  for (let cci = 0; cci < allContracts.length; cci++) {
    try {
      await prisma.campaignContract.upsert({
        where: { campaignId_contractId: {
          campaignId: cci < 2 ? 'sample-campaign-1' : 'sample-campaign-2',
          contractId: allContracts[cci].id,
        }},
        update: {},
        create: {
          campaignId: cci < 2 ? 'sample-campaign-1' : 'sample-campaign-2',
          contractId: allContracts[cci].id,
          allocatedBudget: randomInt(3, 10) * 1000000,
        },
      });
    } catch (e) { /* skip */ }
  }

  console.log('  캠페인-계약 연결 완료');

  // ============================================
  // 완료!
  // ============================================
  console.log('\n========================================');
  console.log('✅ IR Mock 데이터 시딩 완료!');
  console.log('========================================');
  console.log(`  선수: ${allAthletes.length}명`);
  console.log(`  브랜드: ${allBrands.length}개`);
  console.log(`  이벤트: ${allEvents.length}개`);
  console.log(`  슬롯: ${slotCount}개`);
  console.log(`  경매: ${auctionCount}개`);
  console.log(`  입찰: ${bidCount}개`);
  console.log(`  계약: ${contractCount}개`);
  console.log(`  캠페인: 3개 + ROI 데이터`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ 시딩 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

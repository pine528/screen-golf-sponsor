/**
 * Full Funnel 시드 데이터
 *
 * - 기존 캠페인을 활용하여 자산 자동 생성 (코드/링크/QR/미니스토어)
 * - 미니스토어에 샘플 상품 3개 추가 → 게시
 * - 가짜 풀 퍼널 이벤트 생성 (LANDING_VIEW ~ PURCHASE)
 * - 일부 주문은 환불 처리
 *
 * 실행: npx ts-node prisma/seed-funnel.ts
 */

import { PrismaClient } from '@prisma/client';
import { campaignAssetsService } from '../src/services/campaignAssets.service';
import { miniStoreService } from '../src/services/miniStore.service';
import { funnelEventService } from '../src/services/funnelEvent.service';
import { funnelOrderService } from '../src/services/funnelOrder.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Full Funnel seeding...\n');

  // 1) 기존 캠페인 + 첫 매칭 선수 가져오기
  const campaign = await prisma.campaign.findFirst({
    include: {
      contracts: { include: { contract: { include: { athlete: true } } } },
      brand: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!campaign) {
    console.log('⚠️ 캠페인이 없습니다. 먼저 기본 시드를 실행하세요.');
    return;
  }

  // 매칭 선수 추출 (없으면 첫 번째 선수)
  let athleteId = campaign.contracts[0]?.contract.athleteId;
  if (!athleteId) {
    const firstAthlete = await prisma.athlete.findFirst();
    if (!firstAthlete) {
      console.log('⚠️ 선수가 없습니다.');
      return;
    }
    athleteId = firstAthlete.id;
  }

  console.log(`📌 캠페인: ${campaign.name} (브랜드: ${campaign.brand.name})`);
  console.log(`📌 선수 ID: ${athleteId}\n`);

  // 2) 자산 생성 (코드 + 링크 + QR + 스토어)
  const assets = await campaignAssetsService.generate({
    campaignId: campaign.id,
    brandId: campaign.brandId,
    athleteId,
    discountType: 'PERCENT',
    discountValue: 20,
  });
  console.log(`✅ 자산 발급: ${assets.status}`);
  console.log(`   - 코드: ${assets.promoCode}`);
  console.log(`   - 단축링크: ${assets.shortUrl}`);
  console.log(`   - 스토어: ${assets.brandMiniStoreUrl}\n`);

  // 3) 미니스토어 게시 + 상품 3개 추가
  const store = await miniStoreService.getByCampaign(campaign.id, true) as any;
  if (store && (!store.products || store.products.length === 0)) {
    await miniStoreService.update(campaign.id, {
      mainCopy: `${campaign.brand.name}와 함께하는 특별한 혜택`,
      benefitBadge: '선수 추천 단독 20% 할인',
      ctaText: '지금 구매하기',
    });

    const products = [
      { name: '프리미엄 골프공 12구', price: 35000, discountPrice: 28000, stock: 100, imageUrl: 'https://placehold.co/400x400/10b981/ffffff?text=Golf+Ball' },
      { name: '시그니처 골프 글러브', price: 25000, discountPrice: 20000, stock: 50, imageUrl: 'https://placehold.co/400x400/0ea5e9/ffffff?text=Glove' },
      { name: '브랜드 캡 모자', price: 45000, discountPrice: 36000, stock: 30, imageUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Cap' },
    ];
    for (let i = 0; i < products.length; i++) {
      await miniStoreService.addProduct({ ...products[i], storeId: store.id, sortOrder: i });
    }
    await miniStoreService.setStatus(campaign.id, 'PUBLISHED');
    console.log(`✅ 미니스토어 게시 + 상품 ${products.length}개 추가`);
  }

  // 4) 가짜 풀 퍼널 이벤트 생성 (지난 14일)
  const refreshedStore = await miniStoreService.getByCampaign(campaign.id, true) as any;
  const productIds = refreshedStore?.products?.map((p: any) => p.id) || [];

  if (productIds.length === 0) {
    console.log('⚠️ 상품이 없어 이벤트 생성 스킵');
    return;
  }

  console.log('\n🎯 풀 퍼널 이벤트 생성 중...');
  let totalOrders = 0;
  let totalRevenue = 0;

  for (let dayAgo = 14; dayAgo >= 0; dayAgo--) {
    const baseDate = new Date(Date.now() - dayAgo * 86400000);
    // 일별 가짜 트래픽 (랜덤)
    const linkClicks = 30 + Math.floor(Math.random() * 50);
    const landingViews = Math.floor(linkClicks * (0.7 + Math.random() * 0.2));
    const productViews = Math.floor(landingViews * 0.6);
    const addToCarts = Math.floor(productViews * 0.3);
    const checkouts = Math.floor(addToCarts * 0.5);
    const purchases = Math.floor(checkouts * 0.6);

    // 세션별로 1회씩 funnelEvent 생성 (간소화: ID만 다르게)
    for (let i = 0; i < linkClicks; i++) {
      const sessionId = `seed_sess_${dayAgo}_${i}`;
      const occurredAt = new Date(baseDate.getTime() + i * 1000);
      try {
        await funnelEventService.record('LINK_CLICK', {
          campaignId: campaign.id, brandId: campaign.brandId, athleteId,
          sessionId, occurredAt,
          deviceType: Math.random() > 0.5 ? 'mobile' : 'desktop',
          referrer: ['instagram', 'youtube', 'naver', 'kakao', 'direct'][Math.floor(Math.random() * 5)],
        });
        if (i < landingViews) {
          await funnelEventService.record('LANDING_VIEW', {
            campaignId: campaign.id, brandId: campaign.brandId, athleteId, sessionId, occurredAt,
          });
        }
        if (i < productViews) {
          await funnelEventService.record('PRODUCT_VIEW', {
            campaignId: campaign.id, brandId: campaign.brandId, athleteId, sessionId, occurredAt,
            payload: { product_id: productIds[i % productIds.length] },
          });
        }
        if (i < addToCarts) {
          await funnelEventService.record('ADD_TO_CART', {
            campaignId: campaign.id, brandId: campaign.brandId, athleteId, sessionId, occurredAt,
            payload: { product_id: productIds[i % productIds.length], quantity: 1 },
          });
        }
        if (i < checkouts) {
          await funnelEventService.record('BEGIN_CHECKOUT', {
            campaignId: campaign.id, brandId: campaign.brandId, athleteId, sessionId, occurredAt,
            payload: { cart_id: `seed_cart_${dayAgo}_${i}` },
          });
        }
        if (i < purchases) {
          // 실제 주문 생성 (트랜잭션)
          const productId = productIds[i % productIds.length];
          const product = refreshedStore!.products.find((p: any) => p.id === productId)!;
          const price = Number(product.discountPrice || product.price);
          await funnelOrderService.createPurchase({
            externalOrderId: `seed_ord_${dayAgo}_${i}`,
            campaignId: campaign.id, brandId: campaign.brandId, athleteId,
            promoCode: Math.random() > 0.3 ? assets.promoCode : undefined,
            grossAmount: price,
            discountAmount: Math.random() > 0.3 ? Math.round(price * 0.2) : 0,
            netAmount: Math.random() > 0.3 ? Math.round(price * 0.8) : price,
            isNewCustomer: Math.random() > 0.4,
            items: [{ product_id: productId, qty: 1, unit_price: price }],
            sessionId, occurredAt,
            customerEmail: `seed${dayAgo}_${i}@example.com`,
          });
          totalOrders++;
          totalRevenue += price;
        }
      } catch (e: any) {
        // 이미 처리된 이벤트는 skip
      }
    }
    if (dayAgo % 5 === 0) console.log(`  - D-${dayAgo}: 클릭 ${linkClicks}, 유입 ${landingViews}, 주문 ${purchases}`);
  }

  // 5) 일부 환불
  const allOrders = await prisma.funnelOrder.findMany({ where: { campaignId: campaign.id, status: 'PAID' }, take: 5 });
  for (const o of allOrders.slice(0, 2)) {
    try {
      await funnelOrderService.refundOrder({ orderId: o.id, reason: 'customer_request' });
    } catch {}
  }
  console.log(`✅ 환불 2건 처리\n`);

  console.log(`📊 최종: 주문 ${totalOrders}건, 매출 ₩${totalRevenue.toLocaleString()}`);
  console.log('\n✨ Full Funnel 시딩 완료!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

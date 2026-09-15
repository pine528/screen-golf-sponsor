/**
 * 팬스토어 v1.0 — 외부몰 연결형 (핸드오프 v1.0 2026-08-22 §8)
 *
 * 제약
 *  - MVP는 내부 결제를 하지 않는다. 외부몰 주문을 SPONPIK 주문처럼 표시하지 않는다 (§8.2).
 *  - 판매·배송·환불 책임주체를 모든 화면에 노출한다 (§8.2 · §8.4).
 *  - 이동 시 익명 click_id 를 만들고 UTM 을 붙인다 (§8.3).
 *  - 포인트는 브랜드가 구매확정을 회신한 뒤에 적립한다 (§8.3 · §7.2).
 */
import { PrismaClient } from '@prisma/client';
import { earn } from './fanPoint.service';
import { record } from './fanHub.service';

const prisma = new PrismaClient();

export const RESPONSIBLE_LABEL: Record<string, { label: string; desc: string }> = {
  BRAND: {
    label: '브랜드 판매',
    desc: '판매·배송·교환·환불은 브랜드가 책임집니다. 주문 문의는 브랜드 고객센터로 연결됩니다.',
  },
  SPONPIK: {
    label: 'SPONPIK 판매',
    desc: '판매·배송·교환·환불을 SPONPIK이 책임집니다.',
  },
};

/** 외부몰 이동 안내 (§8.3) — 화면이 이동 전에 반드시 보여준다 */
export const EXIT_NOTICE = [
  '지금부터는 브랜드가 운영하는 외부 쇼핑몰입니다.',
  '결제·배송·교환·환불은 해당 브랜드의 정책과 책임에 따릅니다.',
  '팬포인트는 브랜드가 구매확정을 회신한 뒤 적립되며, 최대 수 일이 걸릴 수 있습니다.',
];

const nowish = () => new Date();

function decorate(store: any) {
  const r = RESPONSIBLE_LABEL[store.responsible] || RESPONSIBLE_LABEL.BRAND;
  const closed = store.endAt ? new Date(store.endAt) < nowish() : false;
  return {
    id: store.id,
    slug: store.slug,
    title: store.title,
    summary: store.summary,
    story: store.story,
    heroImageUrl: store.heroImageUrl,
    brandName: store.brandName,
    athlete: store.athlete ?? null,
    benefit: store.benefitLabel
      ? { label: store.benefitLabel, code: store.benefitCode, desc: store.benefitDesc }
      : null,
    responsible: store.responsible,
    responsibleLabel: r.label,
    responsibleDesc: r.desc,
    sellerName: store.sellerName,
    sellerContact: store.sellerContact,
    externalUrl: store.externalUrl,
    startAt: store.startAt,
    endAt: store.endAt,
    closed,
    /* 마감 임박 표시는 종료일이 있을 때만. 없는데 추정하지 않는다 (LEG-06) */
    daysLeft: store.endAt && !closed
      ? Math.ceil((new Date(store.endAt).getTime() - Date.now()) / 86400_000)
      : null,
    productCount: store._count?.products ?? store.products?.length ?? null,
  };
}

function decorateProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    description: p.description,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: p.originalPrice && p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100)
      : null,
    shippingInfo: p.shippingInfo,
    returnInfo: p.returnInfo,
    sellerName: p.sellerName,
    stockNote: p.stockNote,
    isSponsored: p.isSponsored,
    pointRate: p.pointRate,
    /* 적립 예상액은 확정이 아니라 예상임을 화면이 말할 수 있게 rate 를 함께 준다 */
    estimatedPoints: p.pointRate ? Math.floor(p.price * p.pointRate) : null,
  };
}

/** F11 팬스토어 홈 */
export async function listStores(params: { athleteId?: string; limit?: number } = {}) {
  const stores = await prisma.fanStore.findMany({
    where: {
      status: 'PUBLISHED',
      ...(params.athleteId ? { athleteId: params.athleteId } : {}),
    },
    orderBy: [{ endAt: 'asc' }, { createdAt: 'desc' }],
    take: Math.min(params.limit ?? 20, 40),
    include: {
      athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, sportType: true } },
      _count: { select: { products: true } },
    },
  });

  return {
    stores: stores.map(decorate),
    notice: '팬스토어의 상품은 브랜드가 판매합니다. 구매·배송·환불은 각 브랜드 정책을 따릅니다.',
    howItWorks: [
      { step: 1, title: '협업 스토리 확인', desc: '선수와 브랜드가 왜 함께하는지 살펴보세요.' },
      { step: 2, title: '팬 혜택 코드 받기', desc: '스토어에서 팬 전용 혜택 코드를 확인합니다.' },
      { step: 3, title: '브랜드몰에서 구매', desc: '결제와 배송은 브랜드몰에서 진행됩니다.' },
      { step: 4, title: '구매확정 후 적립', desc: '브랜드 확인이 끝나면 팬포인트가 적립됩니다.' },
    ],
  };
}

/* ── 팬스토어 메인 (시안 2026-09-15) — 상품 모아보기·브랜드·선수 ───────────────
 * 공개 스토어의 판매 중 상품을 한 화면에 모은다. 배지는 확인된 사실에서만:
 *  NEW = 30일 내 등록, SALE = 정가 대비 할인, LIMITED = 재고 메모에 '한정', RECOMMENDED = 추천 선수 스토어.
 */
export async function storeHome(params: { tab?: string; limit?: number; athleteId?: string; userId?: string } = {}) {
  const now = nowish();
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const stores = await prisma.fanStore.findMany({
    where: { status: 'PUBLISHED', OR: [{ endAt: null }, { endAt: { gte: now } }], ...(params.athleteId ? { athleteId: params.athleteId } : {}) },
    include: {
      athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, isRecommended: true } },
      products: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] },
    },
    orderBy: { createdAt: 'desc' },
  });

  let products = stores.flatMap((s) => s.products.map((p) => {
    const discountRate = p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
    const isNew = p.createdAt >= d30;
    const isLimited = /한정|limited|단독/i.test(`${p.stockNote || ''} ${p.name}`);
    return {
      id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, originalPrice: p.originalPrice, discountRate,
      isNew, isLimited, isRecommended: !!s.athlete.isRecommended, pointRate: p.pointRate,
      badge: discountRate ? 'SALE' : isLimited ? 'LIMITED' : isNew ? 'NEW' : s.athlete.isRecommended ? 'BEST' : null,
      store: { id: s.id, slug: s.slug, title: s.title, brandName: s.brandName },
      athlete: s.athlete,
      createdAt: p.createdAt,
    };
  }));
  const tab = (params.tab || 'ALL').toUpperCase();
  if (tab === 'NEW') products = products.filter((p) => p.isNew);
  else if (tab === 'SALE') products = products.filter((p) => p.discountRate);
  else if (tab === 'LIMITED') products = products.filter((p) => p.isLimited);
  else if (tab === 'RECOMMENDED') products = products.filter((p) => p.isRecommended);
  products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  /* 브랜드·선수 — 공개 스토어에서만 */
  const brandMap = new Map<string, { name: string; stores: number; slug: string }>();
  for (const s of stores) {
    const b = brandMap.get(s.brandName) || { name: s.brandName, stores: 0, slug: s.slug };
    b.stores += 1; brandMap.set(s.brandName, b);
  }
  const athleteMap = new Map<string, any>();
  for (const s of stores) if (!athleteMap.has(s.athleteId)) athleteMap.set(s.athleteId, { ...s.athlete, storeSlug: s.slug, stores: 1 }); else athleteMap.get(s.athleteId).stores += 1;

  /* 내가 응원하는 선수(계정 단위 관심 선수) 중 스토어가 있는 선수 */
  let myAthletes: any[] = [];
  if (params.userId) {
    const favs = await prisma.userFavoriteAthlete.findMany({ where: { userId: params.userId }, select: { athleteId: true } });
    myAthletes = favs.map((f) => athleteMap.get(f.athleteId)).filter(Boolean);
  }

  const { EARN_RULES } = await import('./fanPoint.service');
  const rate = (EARN_RULES.find((r) => r.code === 'STORE_PURCHASE') as any)?.rate ?? null;

  return {
    products: products.slice(0, Math.min(params.limit ?? 20, 60)),
    counts: {
      ALL: stores.reduce((n, s) => n + s.products.length, 0),
      NEW: stores.flatMap((s) => s.products).filter((p) => p.createdAt >= d30).length,
      SALE: stores.flatMap((s) => s.products).filter((p) => p.originalPrice && p.originalPrice > p.price).length,
    },
    brands: [...brandMap.values()],
    athletes: [...athleteMap.values()],
    myAthletes,
    stores: stores.map(decorate).slice(0, 12),
    pointRatePercent: rate ? Math.round(rate * 100) : null,
    notice: '팬스토어의 상품은 브랜드가 판매합니다. 구매·배송·환불은 각 브랜드 정책을 따릅니다.',
  };
}

/** F12 스토어 상세 */
export async function getStore(idOrSlug: string) {
  const store = await prisma.fanStore.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      athlete: { select: { id: true, name: true, tour: true, profileImageUrl: true, region: true, sportType: true } },
      products: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!store) return null;

  await prisma.fanStore.update({ where: { id: store.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);

  return {
    ...decorate(store),
    products: store.products.map(decorateProduct),
    exitNotice: EXIT_NOTICE,
    disclosures: [
      store.responsible === 'BRAND'
        ? '이 스토어의 상품은 브랜드가 직접 판매하며, SPONPIK은 통신판매중개자로서 거래 당사자가 아닙니다.'
        : 'SPONPIK이 판매자로서 거래 당사자입니다.',
      '브랜드 협찬 상품에는 광고성 표시가 함께 표기됩니다.',
      '팬포인트 적립은 구매확정 이후에 이루어지며, 취소·반품 시 회수됩니다.',
    ],
  };
}

/** F13 상품 상세 */
export async function getProduct(productId: string) {
  const p = await prisma.fanStoreProduct.findUnique({
    where: { id: productId },
    include: {
      store: {
        include: {
          athlete: { select: { id: true, name: true, profileImageUrl: true, tour: true } },
        },
      },
    },
  });
  if (!p) return null;

  return {
    product: decorateProduct(p),
    store: decorate(p.store),
    exitNotice: EXIT_NOTICE,
    /* 판매자 정보는 상품 우선, 없으면 스토어 값을 쓴다 */
    seller: {
      name: p.sellerName || p.store.sellerName || p.store.brandName,
      contact: p.store.sellerContact,
      responsible: p.store.responsible,
      responsibleLabel: (RESPONSIBLE_LABEL[p.store.responsible] || RESPONSIBLE_LABEL.BRAND).label,
      responsibleDesc: (RESPONSIBLE_LABEL[p.store.responsible] || RESPONSIBLE_LABEL.BRAND).desc,
    },
    policies: [
      { key: 'shipping', label: '배송', value: p.shippingInfo || '브랜드몰 정책에 따릅니다' },
      { key: 'return', label: '교환·반품', value: p.returnInfo || '브랜드몰 정책에 따릅니다' },
      { key: 'stock', label: '재고', value: p.stockNote || '브랜드몰에서 확인해주세요' },
      {
        key: 'point', label: '팬포인트',
        value: p.pointRate
          ? `구매확정 시 결제금액의 ${Math.round(p.pointRate * 100)}% 적립 (월 5,000P 한도)`
          : '이 상품은 포인트 적립 대상이 아닙니다',
      },
    ],
  };
}

/**
 * 외부몰 이동 — 익명 click_id 를 만들고 UTM 을 붙여 최종 주소를 돌려준다 (§8.3).
 * 클릭 자체는 구매가 아니므로 포인트를 주지 않는다.
 */
export async function trackExit(input: {
  storeId: string; productId?: string; userId?: string;
}) {
  const store = await prisma.fanStore.findUnique({
    where: { id: input.storeId },
    select: { id: true, slug: true, externalUrl: true, athleteId: true },
  });
  if (!store) throw Object.assign(new Error('스토어를 찾을 수 없습니다'), { status: 404 });

  let target = store.externalUrl;
  if (input.productId) {
    const p = await prisma.fanStoreProduct.findUnique({
      where: { id: input.productId }, select: { externalUrl: true },
    });
    if (p?.externalUrl) target = p.externalUrl;
  }
  if (!target) throw Object.assign(new Error('이동할 주소가 등록되지 않았습니다'), { status: 400 });

  const clickId = `spk_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const utm = `utm_source=sponpik&utm_medium=fanstore&utm_campaign=${store.slug}&click_id=${clickId}`;

  await prisma.fanStoreClick.create({
    data: {
      clickId, storeId: store.id, productId: input.productId,
      userId: input.userId, utm,
    },
  });

  /* 스토어 방문 자체는 팬 활동으로 기록한다 (구매와 구분) */
  if (input.userId) {
    await record({
      userId: input.userId, athleteId: store.athleteId,
      source: 'STORE', refType: 'STORE_EXIT', refId: clickId,
    }).catch(() => null);
  }

  const url = target + (target.includes('?') ? '&' : '?') + utm;
  return { url, clickId, notice: EXIT_NOTICE };
}

/**
 * 브랜드 구매확정 회신 (postback / 월 정산 파일) — 여기서만 포인트가 적립된다 (§8.3).
 * 같은 click_id 를 두 번 받아도 한 번만 적립한다.
 */
export async function confirmPurchase(input: { clickId: string; amount: number }) {
  const click = await prisma.fanStoreClick.findUnique({
    where: { clickId: input.clickId },
    include: { store: { select: { athleteId: true } }, product: { select: { pointRate: true } } },
  });
  if (!click) throw Object.assign(new Error('클릭 기록을 찾을 수 없습니다'), { status: 404 });
  if (click.confirmedAt) return { confirmed: false, reason: 'ALREADY' as const };

  await prisma.fanStoreClick.update({
    where: { id: click.id },
    data: { confirmedAt: new Date(), amount: input.amount },
  });

  if (!click.userId) return { confirmed: true, point: { earned: 0, reason: 'ANONYMOUS' as const } };

  const point = await earn({
    userId: click.userId, code: 'STORE_PURCHASE',
    refType: 'STORE_PURCHASE', refId: click.clickId,
    athleteId: click.store.athleteId, amount: input.amount,
  });

  await record({
    userId: click.userId, athleteId: click.store.athleteId,
    source: 'STORE', refType: 'STORE_PURCHASE', refId: click.clickId,
    amount: input.amount,
  }).catch(() => null);

  return { confirmed: true, point };
}

/** 내 외부몰 이동 내역 — 내부 주문과 분리해서 보여준다 (§8.2) */
export async function myExits(userId: string) {
  const rows = await prisma.fanStoreClick.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      store: { select: { id: true, title: true, brandName: true, responsible: true, sellerContact: true } },
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  });
  return {
    exits: rows.map((r) => ({
      clickId: r.clickId,
      store: r.store,
      product: r.product,
      confirmed: !!r.confirmedAt,
      amount: r.amount,
      createdAt: r.createdAt,
    })),
    notice: '아래 내역은 브랜드몰로 이동한 기록이며 SPONPIK 주문이 아닙니다. 주문 조회와 취소는 브랜드 고객센터를 이용해주세요.',
  };
}

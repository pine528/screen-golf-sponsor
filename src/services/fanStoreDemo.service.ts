/**
 * 팬스토어 데모 카탈로그 시드 — 구 데모 페이지(/fan-store/orex · /fan-store/the-guys · /fan-store/hoi-bakery)에
 * 하드코딩돼 있던 3개 스토어·22개 상품을 FanStore/FanStoreProduct 레코드로 옮긴다.
 *
 *  - 프론트 `data/{orexStore,guysStore,hoiStore}.ts` 와 같은 값. 시안에 없는 수치는 넣지 않는다 (정가 없으면 null).
 *  - slug 기준 upsert, 상품은 (storeId, name) 기준으로 갱신 → 몇 번 실행해도 중복이 생기지 않는다.
 *  - 외부 이동 주소는 구 데모 페이지 경로. 브랜드 실제 몰 주소가 확정되면 관리자 화면에서 바꾼다.
 *  - 선수는 이름으로 찾는다(배진리 · 염돈웅). 없으면 그 스토어는 건너뛰고 결과에 남긴다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DemoProduct = {
  name: string; price: number; originalPrice?: number; description: string; externalUrl: string;
  shippingInfo?: string; returnInfo?: string; stockNote?: string; pointRate: number | null;
};
type DemoStore = {
  slug: string; athleteName: string; brandName: string; title: string; summary: string; story: string;
  heroImageUrl: string; benefitLabel: string; benefitCode: string; benefitDesc: string;
  sellerName: string; externalUrl: string; products: DemoProduct[];
};

const OREX_BULLETS = '고성능 알카라인으로 강력하고 오래가는 파워 · 다양한 전자기기에 안정적인 성능 제공 · 누액 방지 설계로 안전하게 사용 가능';
const OREX_SHIP = '배송비 3,000원 · 30,000원 이상 무료배송';
const HOI_SHIP = (t: string) => `${t} · 배송비 3,500원 · 35,000원 이상 무료배송`;

export const DEMO_STORES: DemoStore[] = [
  {
    slug: 'hoi-bakery-baejinri', athleteName: '배진리', brandName: '호이베이커리',
    title: '배진리 프로 × 호이베이커리 팬 에디션',
    summary: '"좋은 기운을 굽는 빵집", 호이베이커리와 배진리 프로가 함께 만든 콜라보 제품과 팬 전용 베이커리 세트!',
    story: '배진리 프로의 건강한 에너지와 호이베이커리의 정직한 재료, 굽는 마음이 만나 팬 여러분께 특별한 맛과 응원의 시간을 선물합니다.',
    heroImageUrl: '/growth-market/bae-jinri.jpg',
    benefitLabel: '팬 전용 10% 할인', benefitCode: 'HOIFAN10', benefitDesc: '전체 상품 10% 할인 (일부 상품 제외) · 결제 단계에서 코드 입력',
    sellerName: '호이베이커리', externalUrl: '/fan-store/hoi-bakery',
    products: [
      { name: '호이 시그니처 구움과자 선물세트 12구', price: 32400, originalPrice: 36000, description: '호이베이커리의 인기 구움과자 12종을 정성스럽게 담은 선물세트입니다. 마들렌, 휘낭시에, 쿠키까지 다양한 맛과 식감을 한 번에 즐기실 수 있어 소중한 분께 마음을 전하기 좋은 세트입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-signature-baked-12', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
      { name: '버터쿠키 틴', price: 16720, originalPrice: 19000, description: '진한 버터 풍미의 수제 쿠키를 틴 케이스에 담았습니다. 선물로도, 곁에 두고 즐기기에도 좋습니다.', externalUrl: '/fan-store/hoi-bakery/hoi-butter-cookie-tin', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
      { name: '피낭시에 & 마들렌 세트', price: 23400, originalPrice: 26000, description: '갓 구운 피낭시에와 마들렌을 함께 담은 호이베이커리의 대표 구움과자 세트입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-financier-madeleine', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
      { name: '답례품 미니 박스 (6입)', price: 13800, originalPrice: 15000, description: '작지만 정성 가득한 답례품 미니 박스입니다. 감사의 마음을 전하기 좋은 구성입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-mini-favor-box-6', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
      { name: '냉동 소금빵 홈베이크 세트', price: 15300, originalPrice: 18000, description: '집에서 갓 구운 맛 그대로. 오븐에 데우기만 하면 완성되는 냉동 소금빵 홈베이크 세트입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-frozen-saltbread-set', shippingInfo: HOI_SHIP('냉동 배송'), pointRate: 0.01 },
      { name: '드립백 커피 & 쿠키 세트', price: 18900, originalPrice: 21000, description: '드립백 커피와 수제 쿠키를 함께 담아 티타임을 완성하는 세트입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-dripbag-cookie-set', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
      { name: '바스크 치즈케이크 미니', price: 14500, originalPrice: 15800, description: '진한 치즈 풍미의 바스크 치즈케이크를 미니 사이즈로 즐겨보세요.', externalUrl: '/fan-store/hoi-bakery/hoi-basque-cheesecake-mini', shippingInfo: HOI_SHIP('냉장 배송'), pointRate: 0.01 },
      { name: '수제 잼 & 스콘 세트', price: 19800, originalPrice: 22000, description: '수제 잼과 담백한 스콘을 함께 담은 브런치 세트입니다.', externalUrl: '/fan-store/hoi-bakery/hoi-jam-scone-set', shippingInfo: HOI_SHIP('상온 배송'), pointRate: 0.01 },
    ],
  },
  {
    slug: 'orex-youmdonwoong', athleteName: '염돈웅', brandName: 'OREX',
    title: '염돈웅 프로 × OREX 에너지 컬렉션',
    summary: '강력한 에너지처럼 응원하는 퍼포먼스, OREX와 염돈웅 프로가 함께합니다.',
    story: '필드 위 마지막 홀까지 이어지는 염돈웅 프로의 집중력처럼, 오래가는 파워를 만드는 OREX가 팬 여러분의 일상에 힘을 보탭니다.',
    heroImageUrl: '/growth-market/youm-donwoong.jpg',
    benefitLabel: '팬 전용 10% 할인', benefitCode: 'OREXFAN10', benefitDesc: '전체 상품 10% 할인 · 구매 시 최대 5% 팬포인트 적립',
    sellerName: 'OREX', externalUrl: '/fan-store/orex',
    products: [
      { name: '오렉스 슈퍼플러스 알카라인 건전지 AA (2입)', price: 3900, originalPrice: 4390, description: `AA 건전지 2입 (1.5V) · ${OREX_BULLETS}`, externalUrl: '/fan-store/orex/orex-alkaline-aa-2p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 건전지 AAA (18입)', price: 17400, originalPrice: 20000, description: `AAA 건전지 18입 (1.5V) · ${OREX_BULLETS} · 18입 대용량 구성으로 가성비 UP`, externalUrl: '/fan-store/orex/orex-alkaline-aaa-18p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 건전지 AAA (8입)', price: 10500, originalPrice: 11900, description: `AAA 건전지 8입 (1.5V) · ${OREX_BULLETS}`, externalUrl: '/fan-store/orex/orex-alkaline-aaa-8p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 건전지 AA (16입)', price: 15900, description: `AA 건전지 16입 (1.5V) · ${OREX_BULLETS} · 16입 대용량 구성으로 가성비 UP`, externalUrl: '/fan-store/orex/orex-alkaline-aa-16p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 건전지 C (4입)', price: 7900, description: `C 건전지 4입 (1.5V) · ${OREX_BULLETS}`, externalUrl: '/fan-store/orex/orex-alkaline-c-4p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 건전지 D (2입)', price: 7600, description: `D 건전지 2입 (1.5V) · ${OREX_BULLETS}`, externalUrl: '/fan-store/orex/orex-alkaline-d-2p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 리튬 코인전지 CR2032 (5입)', price: 5300, description: 'CR2032 리튬 코인전지 5입 (3V) · 안정적인 3V 리튬 전원 · 리모컨·체중계·차키 등 소형기기용 · 낱개 블리스터 포장으로 보관 편리', externalUrl: '/fan-store/orex/orex-lithium-cr2032-5p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
      { name: '오렉스 슈퍼플러스 알카라인 9V 건전지 (1입)', price: 4900, description: `9V 건전지 1입 · ${OREX_BULLETS}`, externalUrl: '/fan-store/orex/orex-alkaline-9v-1p', shippingInfo: OREX_SHIP, pointRate: 0.05 },
    ],
  },
  {
    slug: 'the-guys-youmdonwoong', athleteName: '염돈웅', brandName: 'the GUYS',
    title: '염돈웅 프로 × the GUYS 스페셜 컬렉션',
    summary: '컨템포러리 남성 패션 브랜드 the GUYS와 염돈웅 프로가 함께하는 스페셜 컬렉션을 팬 여러분께 선보입니다.',
    story: '"필드 위에서의 집중과 일상에서의 편안함을 동시에." — 염돈웅 프로. 5월 30일 협업을 마치고 8월 8일 메이저 협업으로 이어지는 the GUYS와 염돈웅 프로의 컬렉션입니다.',
    heroImageUrl: '/growth-market/youm-donwoong.jpg',
    benefitLabel: '팬 전용 10% 할인', benefitCode: 'THEGUYS10', benefitDesc: '전체 상품 10% 할인 · 구매 금액의 1% 팬포인트 적립',
    sellerName: 'the GUYS', externalUrl: '/fan-store/the-guys',
    products: [
      { name: 'the GUYS × 염돈웅 프로 콜라보 폴로 셔츠 (화이트)', price: 67150, originalPrice: 79000, description: 'the GUYS와 염돈웅 프로의 아이덴티티를 담아낸 콜라보 폴로 셔츠입니다. 흡습속건 기능성 원단과 메쉬 패널로 쾌적한 착용감을 제공하며, 필드와 일상 어디서나 세련된 스타일을 완성합니다. 사이즈 S · M · L · XL', externalUrl: '/fan-store/the-guys/guys-collab-polo-white', pointRate: 0.01 },
      { name: '쿨링 퍼포먼스 티셔츠 (블랙)', price: 39000, originalPrice: 43000, description: '쿨링 기능성 원단으로 라운드 내내 쾌적한 퍼포먼스 티셔츠입니다. 사이즈 S · M · L · XL', externalUrl: '/fan-store/the-guys/guys-cooling-tee-black', pointRate: 0.01 },
      { name: '퍼포먼스 슬랙스 (차콜)', price: 89000, description: '스윙을 방해하지 않는 4방향 스트레치 퍼포먼스 슬랙스입니다. 사이즈 S · M · L · XL', externalUrl: '/fan-store/the-guys/guys-performance-slacks', pointRate: 0.01 },
      { name: 'the GUYS 로고 캡 (블랙)', price: 39000, originalPrice: 43000, description: 'the GUYS 시그니처 로고를 담은 데일리 캡입니다.', externalUrl: '/fan-store/the-guys/guys-logo-cap-black', pointRate: 0.01 },
      { name: '린넨 셋업 (라이트 베이지)', price: 89000, originalPrice: 105000, description: '시원한 린넨 혼방 소재의 셋업으로 여름 라운드룩을 완성합니다. 사이즈 S · M · L · XL', externalUrl: '/fan-store/the-guys/guys-linen-setup-beige', pointRate: 0.01 },
      { name: 'the GUYS 8.8 메이저 협업 패키지', price: 129000, originalPrice: 162000, description: '염돈웅 프로와 the GUYS의 8.8 메이저 협업을 기념한 한정 패키지입니다. 화이트 폴로 셔츠 + 블랙 로고 캡, 포토카드 3종 + 스페셜 스티커, 협업 패키지 전용 포토카드 증정.', externalUrl: '/fan-store/the-guys/guys-88-major-package', stockNote: '한정 패키지 · 소진 시 종료', pointRate: 0.01 },
    ],
  },
];

/** 데모 스토어를 만들거나 갱신한다. 반환값은 스토어별 처리 결과 */
export async function seedDemoStores() {
  const results: { slug: string; status: 'CREATED' | 'UPDATED' | 'SKIPPED'; reason?: string; products: number }[] = [];

  for (const d of DEMO_STORES) {
    const athlete = await prisma.athlete.findFirst({ where: { name: d.athleteName }, select: { id: true } });
    if (!athlete) { results.push({ slug: d.slug, status: 'SKIPPED', reason: `선수 '${d.athleteName}' 없음`, products: 0 }); continue; }

    const data = {
      athleteId: athlete.id, brandName: d.brandName, title: d.title, summary: d.summary, story: d.story,
      heroImageUrl: d.heroImageUrl, benefitLabel: d.benefitLabel, benefitCode: d.benefitCode, benefitDesc: d.benefitDesc,
      responsible: 'BRAND', sellerName: d.sellerName, externalUrl: d.externalUrl, status: 'PUBLISHED',
    };
    const existing = await prisma.fanStore.findUnique({ where: { slug: d.slug }, select: { id: true } });
    const store = existing
      ? await prisma.fanStore.update({ where: { id: existing.id }, data })
      : await prisma.fanStore.create({ data: { ...data, slug: d.slug, startAt: new Date() } });

    const current = await prisma.fanStoreProduct.findMany({ where: { storeId: store.id }, select: { id: true, name: true } });
    for (const [i, p] of d.products.entries()) {
      const pdata = {
        name: p.name, price: p.price, originalPrice: p.originalPrice ?? null, description: p.description,
        externalUrl: p.externalUrl, shippingInfo: p.shippingInfo ?? null, returnInfo: p.returnInfo ?? '브랜드 스토어 정책에 따릅니다',
        sellerName: d.sellerName, stockNote: p.stockNote ?? null, isSponsored: true, pointRate: p.pointRate, sortOrder: i, isActive: true,
      };
      const found = current.find((c) => c.name === p.name);
      if (found) await prisma.fanStoreProduct.update({ where: { id: found.id }, data: pdata });
      else await prisma.fanStoreProduct.create({ data: { ...pdata, storeId: store.id } });
    }
    results.push({ slug: d.slug, status: existing ? 'UPDATED' : 'CREATED', products: d.products.length });
  }
  return { results, total: DEMO_STORES.length };
}

/**
 * STO-01: 브랜드 미니스토어 랜딩
 *
 * Refs: wireframe_spec.docx > STO-01
 * - Hero: 브랜드 + 선수 + 혜택 배지
 * - 추천 상품 리스트
 * - Sticky CTA (모바일 전환 최적화)
 * - landing_view 이벤트 자동 전송
 */

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShoppingBag, Tag, Truck, ShieldCheck } from 'lucide-react';
import { useFunnelTracking } from '../../hooks/useFunnelTracking';

export default function MiniStoreLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { trackEvent, sessionId } = useFunnelTracking();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['public-mini-store', slug],
    queryFn: () => api.getPublicMiniStore(slug!),
    enabled: !!slug,
  });
  const store = resp?.data;

  useEffect(() => {
    if (store) {
      trackEvent('landing-view', {
        campaign_id: store.campaignId,
        brand_id: store.brandId,
        athlete_id: store.products?.[0]?.athleteId,
        landing_page_id: slug,
      });
    }
  }, [store, slug]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  if (!store) return <div className="min-h-screen flex items-center justify-center">스토어를 찾을 수 없습니다</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero (wireframe TABLE 32: 브랜드 로고 | 선수 이미지 | 카피 | 프로모션 배지) */}
      <div
        className="text-white relative overflow-hidden"
        style={{
          background: store.themeColor
            ? `linear-gradient(135deg, ${store.themeColor} 0%, ${store.themeColor}dd 50%, ${store.themeColor}aa 100%)`
            : 'linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0ea5e9 100%)',
        }}
      >
        {/* 브랜드 로고 (좌상단) */}
        {store.brandLogoUrl && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
            <img
              src={store.brandLogoUrl}
              alt={store.brand?.name}
              className="h-10 sm:h-12 bg-white/95 rounded-lg px-3 py-1.5 shadow-lg object-contain"
            />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-5 py-12 text-center relative z-10">
          {store.athleteImageUrl && (
            <img
              src={store.athleteImageUrl}
              alt=""
              className="w-28 h-28 rounded-full mx-auto mb-4 border-4 border-white/30 shadow-2xl object-cover"
            />
          )}
          <div className="text-xs font-bold opacity-90 mb-1">{store.brand?.name}</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-3 leading-tight">
            {store.mainCopy || `${store.brand?.name}와 함께하는 특별한 혜택`}
          </h1>
          {store.benefitBadge && (
            <div className="inline-block px-4 py-2 bg-yellow-300 text-slate-900 text-sm font-extrabold rounded-full shadow-lg">
              ⚡ {store.benefitBadge}
            </div>
          )}
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />
      </div>

      {/* Promo Expired 배너 (wireframe TABLE 31) */}
      {store.promoExpired && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs sm:text-sm font-semibold text-amber-700">
              ⚠️ 현재 활성화된 프로모션 코드가 없습니다. 일부 혜택은 적용되지 않을 수 있어요.
            </span>
          </div>
        </div>
      )}
      {store.hasSoldOut && (
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-2">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs font-semibold text-rose-600">
              일부 인기 상품이 품절되었어요. 빠른 구매를 추천드립니다!
            </span>
          </div>
        </div>
      )}

      {/* 추천 상품 */}
      <div className="max-w-3xl mx-auto px-5 -mt-6 relative z-10">
        <h2 className="text-lg font-bold text-slate-900 mb-3 inline-flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-emerald-500" /> 추천 상품
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(store.products || []).map((p: any) => (
            <Link
              key={p.id}
              to={`/store/brand/${slug}/product/${p.id}`}
              onClick={() => trackEvent('product-view', {
                campaign_id: store.campaignId, brand_id: store.brandId, product_id: p.id, session_id: sessionId,
              })}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-300 transition-colors"
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-slate-400">No Image</div>
              )}
              <div className="p-3">
                <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-extrabold text-emerald-600">₩{Number(p.discountPrice || p.price).toLocaleString()}</span>
                  {p.discountPrice && (
                    <span className="text-xs text-slate-400 line-through">₩{Number(p.price).toLocaleString()}</span>
                  )}
                </div>
                {p.soldOut && <div className="mt-1 text-xs text-rose-600 font-bold">품절</div>}
              </div>
            </Link>
          ))}
          {(!store.products || store.products.length === 0) && (
            <div className="col-span-full text-center py-12 text-sm text-slate-400">아직 등록된 상품이 없습니다</div>
          )}
        </div>

        {/* 신뢰 요소 */}
        <div className="mt-8 grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-white border border-slate-100 rounded-lg">
            <Tag className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-xs font-semibold">선수 추천 코드</div>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-lg">
            <Truck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-xs font-semibold">전국 무료배송</div>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-xs font-semibold">교환·환불</div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">자주 묻는 질문</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              { q: '프로모션 코드는 어디에 입력하나요?', a: '결제 시 "프로모션 코드" 입력란이 자동으로 나타납니다. 코드를 입력하면 즉시 할인이 적용됩니다.' },
              { q: '배송은 얼마나 걸리나요?', a: '결제 완료 후 영업일 기준 2~3일 이내 발송됩니다.' },
              { q: '환불·교환은 가능한가요?', a: '수령 후 7일 이내 미사용 상품에 한해 무료 교환·환불이 가능합니다.' },
              { q: '선수 후원 코드를 사용하면 어떤 혜택이 있나요?', a: '선수 추천 단독 할인이 자동 적용됩니다. 일부는 추가 굿즈도 함께 제공됩니다.' },
            ].map((f, i) => (
              <details key={i} className="p-4 group">
                <summary className="cursor-pointer text-sm font-semibold flex items-center justify-between">
                  {f.q}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      {store.products?.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-2xl">
          <div className="max-w-3xl mx-auto">
            <Link
              to={`/store/brand/${slug}/checkout`}
              onClick={() => trackEvent('cta-click', {
                campaign_id: store.campaignId, brand_id: store.brandId, button_type: 'sticky_buy', session_id: sessionId,
              })}
              className="block w-full text-white text-center font-extrabold py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: store.themeColor || '#10b981' }}
            >
              {store.ctaText || '구매하기'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

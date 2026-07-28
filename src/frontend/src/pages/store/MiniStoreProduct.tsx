/**
 * STO-02: 상품 상세 / 장바구니
 *
 * Refs: wireframe_spec.docx > STO-02
 * - 상품 이미지/이름/가격/할인적용가/수량
 * - 장바구니 Drawer (담기 시 add_to_cart 이벤트)
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useFunnelTracking } from '../../hooks/useFunnelTracking';
import { Plus, Minus, ShoppingCart, ArrowLeft, X } from 'lucide-react';

const CART_KEY = 'sponpik_cart';

export default function MiniStoreProduct() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useFunnelTracking();
  const [qty, setQty] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const { data: resp } = useQuery({
    queryKey: ['public-mini-store', slug],
    queryFn: () => api.getPublicMiniStore(slug!),
    enabled: !!slug,
  });
  const store = resp?.data;
  const product = store?.products?.find((p: any) => p.id === productId);

  useEffect(() => {
    if (store && product) {
      trackEvent('product-view', {
        campaign_id: store.campaignId,
        brand_id: store.brandId,
        product_id: product.id,
      });
    }
  }, [store, product]);

  if (!store || !product) return <div className="min-h-screen flex items-center justify-center">상품을 찾을 수 없습니다</div>;

  const finalPrice = Number(product.discountPrice || product.price);

  const addToCart = () => {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const existing = cart.find((c: any) => c.productId === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      // attribution snapshot: 결제 실패 시에도 동일 귀속 유지
      cart.push({
        productId: product.id, qty, name: product.name,
        price: finalPrice,
        originalPrice: Number(product.price),  // 할인 표시용 원가
        slug,
        options: selectedOptions,  // wireframe TABLE 36: 옵션
        attribution: {
          campaignId: store.campaignId,
          brandId: store.brandId,
          athleteId: product.athleteId || store.products?.[0]?.athleteId,
          addedAt: new Date().toISOString(),
        },
      });
    }
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    trackEvent('add-to-cart', {
      campaign_id: store.campaignId,
      brand_id: store.brandId,
      product_id: product.id,
      quantity: qty,
    });
    setDrawerOpen(true);
  };

  const cartItems = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const cartTotal = cartItems.reduce((sum: number, c: any) => sum + c.price * c.qty, 0);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="p-4">
          <Link to={`/store/brand/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> 스토어로
          </Link>
        </div>

        {(() => {
          // wireframe TABLE 35: 상품 이미지 / 썸네일
          const allImages = [product.imageUrl, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean);
          const current = allImages[activeImageIdx] || product.imageUrl;
          return (
            <>
              {current ? (
                <img src={current} alt={product.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-slate-400">No Image</div>
              )}
              {allImages.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-slate-100">
                  {allImages.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIdx(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${i === activeImageIdx ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                    >
                      <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        <div className="p-5">
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">{product.name}</h1>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-2xl font-extrabold text-emerald-600">₩{finalPrice.toLocaleString()}</span>
            {product.discountPrice && (
              <span className="text-base text-slate-400 line-through">₩{Number(product.price).toLocaleString()}</span>
            )}
          </div>
          {/* 재고 상태 (wireframe TABLE 34: In Stock / Low Stock / Sold Out) */}
          <div className="mb-4">
            {product.soldOut ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded">
                ❌ 품절
              </span>
            ) : product.stock <= 5 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                ⚠️ 마감 임박! 재고 {product.stock}개 남음
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded">
                ✓ 재고 충분 ({product.stock}개)
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{product.description}</p>
          )}

          {/* 상품 옵션 (variant) - wireframe TABLE 36 */}
          {product.options && Array.isArray(product.options) && product.options.length > 0 && (
            <div className="mb-4 space-y-3">
              {product.options.map((opt: any) => (
                <div key={opt.name}>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">{opt.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((v: string) => (
                      <button
                        key={v}
                        onClick={() => setSelectedOptions({ ...selectedOptions, [opt.name]: v })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${selectedOptions[opt.name] === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 수량 선택 */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-semibold text-slate-700">수량</span>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2 hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
              <span className="px-4 py-2 text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="p-2 hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
            </div>
            <span className="text-xs text-slate-400">재고 {product.stock}</span>
          </div>

          {/* 혜택 */}
          {store.benefitBadge && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2 rounded mb-4">
              ⚡ {store.benefitBadge}
            </div>
          )}

          {/* 리뷰 (docx 2-1: 하드코딩 제거 — 실 리뷰 시스템 도입 전까지 - 표기) */}
          <div className="mt-6 mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">⭐ 고객 리뷰</h3>
            <div className="p-4 bg-slate-50 rounded-lg text-center text-sm text-slate-400">
              아직 등록된 리뷰가 없습니다.
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-6 mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">❓ 상품 FAQ</h3>
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {[
                { q: '배송은 언제 받아볼 수 있나요?', a: '결제 완료 후 영업일 기준 2~3일 이내 발송됩니다.' },
                { q: '사이즈 교환이 가능한가요?', a: '수령 후 7일 이내 미사용 상품에 한해 교환 가능합니다.' },
                { q: '프로모션 코드와 함께 사용할 수 있나요?', a: '선수 추천 코드는 자동 적용되며 결제 시 할인이 표시됩니다.' },
              ].map((f, i) => (
                <details key={i} className="p-3 group">
                  <summary className="cursor-pointer text-xs font-semibold flex items-center justify-between">
                    {f.q}
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="text-xs text-slate-600 mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* 관련 상품 */}
          {store.products && store.products.length > 1 && (
            <div className="mt-6 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">🛍️ 함께 보면 좋은 상품</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {store.products.filter((p: any) => p.id !== productId).slice(0, 3).map((p: any) => (
                  <Link key={p.id} to={`/store/brand/${slug}/product/${p.id}`} className="block bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-emerald-300">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-slate-100" />}
                    <div className="p-2">
                      <div className="text-xs font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-emerald-600 font-bold">₩{Number(p.discountPrice || p.price).toLocaleString()}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-2xl z-30">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button
            onClick={addToCart}
            disabled={product.soldOut}
            className="flex-1 bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold py-3 rounded-xl"
          >
            장바구니
          </button>
          <button
            onClick={() => { addToCart(); navigate(`/store/brand/${slug}/checkout`); }}
            disabled={product.soldOut}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-xl"
          >
            바로 구매
          </button>
        </div>
      </div>

      {/* 장바구니 Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-base font-bold inline-flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> 장바구니
              </h3>
              <button onClick={() => setDrawerOpen(false)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {cartItems.map((c: any, i: number) => {
                // wireframe TABLE 35: drawer에 할인 표시
                const originalPrice = c.originalPrice || c.price;
                const discount = (originalPrice - c.price) * c.qty;
                return (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.qty}개 × ₩{c.price.toLocaleString()}</div>
                      </div>
                      <div className="text-sm font-bold">₩{(c.price * c.qty).toLocaleString()}</div>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-[11px] text-emerald-600">
                        <span>할인</span>
                        <span>-₩{Math.round(discount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
              {(() => {
                const totalDiscount = cartItems.reduce((s: number, c: any) => s + (((c.originalPrice || c.price) - c.price) * c.qty), 0);
                return totalDiscount > 0 ? (
                  <div className="flex justify-between text-xs text-emerald-600 mb-1">
                    <span>총 할인</span>
                    <span>-₩{Math.round(totalDiscount).toLocaleString()}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between mb-3">
                <span className="text-sm">예상 결제금액</span>
                <span className="text-lg font-extrabold">₩{cartTotal.toLocaleString()}</span>
              </div>
              <button
                onClick={() => navigate(`/store/brand/${slug}/checkout`)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl"
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

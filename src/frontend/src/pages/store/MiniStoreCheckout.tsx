/**
 * STO-03: 체크아웃 / 주문 완료
 *
 * Refs: wireframe_spec.docx > STO-03
 * - 코드 적용 (promo-apply 이벤트)
 * - 결제 시작 (begin-checkout 이벤트)
 * - 결제 완료 (purchase 이벤트 + 트랜잭션)
 * - 주문완료 화면 (선수 추천 공유)
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useFunnelTracking } from '../../hooks/useFunnelTracking';
import { CheckCircle2, Tag, ArrowLeft, Share2, AlertCircle, CreditCard } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/payment-sdk';

const TOSS_TEST_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';  // Toss 공식 테스트 키

const CART_KEY = 'sponpik_cart';

export default function MiniStoreCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const { trackEvent, sessionId } = useFunnelTracking();
  const [step, setStep] = useState<'form' | 'success' | 'failed'>('form');
  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<'sim' | 'toss'>('sim');
  const [paymentError, setPaymentError] = useState<string>('');

  const { data: resp } = useQuery({
    queryKey: ['public-mini-store', slug],
    queryFn: () => api.getPublicMiniStore(slug!),
    enabled: !!slug,
  });
  const store = resp?.data;

  const cartItems = JSON.parse(localStorage.getItem(CART_KEY) || '[]').filter((c: any) => c.slug === slug);
  const grossAmount = cartItems.reduce((sum: number, c: any) => sum + c.price * c.qty, 0);

  // 첫 cart item의 attribution snapshot 활용 (결제 실패 후에도 귀속 유지)
  const cartAttribution = cartItems[0]?.attribution || null;

  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoApplied, setPromoApplied] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    if (store) {
      trackEvent('begin-checkout', {
        campaign_id: store.campaignId,
        brand_id: store.brandId,
        cart_id: `cart_${sessionId}`,
        order_amount: grossAmount,
      });
    }
  }, [store]);

  const applyMut = useMutation({
    mutationFn: () => api.applyPromoCode({ promo_code: promoCode, order_preview_amount: grossAmount, session_id: sessionId }),
    onSuccess: (resp) => {
      const r = resp.data;
      if (r.applied) {
        setDiscountAmount(r.discount_amount);
        setPromoApplied({ code: promoCode });
        setPromoError('');
      } else {
        setPromoError(r.message || '코드를 사용할 수 없습니다');
      }
    },
  });

  const finalizePurchase = async (orderId: string) => {
    const items = cartItems.map((c: any) => ({ product_id: c.productId, qty: c.qty, unit_price: c.price }));
    const resp = await api.createFunnelPurchase({
      order_id: orderId,
      // cart snapshot 우선, 없으면 store 기본값 (결제 실패 후 재시도 시 동일 귀속 보장)
      campaign_id: cartAttribution?.campaignId || store?.campaignId,
      brand_id: cartAttribution?.brandId || store?.brandId,
      athlete_id: cartAttribution?.athleteId,
      promo_code: promoApplied?.code,
      gross_amount: grossAmount,
      discount_amount: discountAmount,
      net_amount: grossAmount - discountAmount,
      items,
      is_new_customer: true,
      session_id: sessionId,
      customer_email: customerEmail,
    });
    setOrderResult(resp.data);
    localStorage.removeItem(CART_KEY);
    setStep('success');
  };

  const purchaseMut = useMutation({
    mutationFn: async () => {
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (paymentMode === 'toss') {
        // 실제 TossPayments SDK 호출
        try {
          const tossPayments = await loadTossPayments(TOSS_TEST_KEY);
          await tossPayments.requestPayment('카드', {
            amount: grossAmount - discountAmount,
            orderId,
            orderName: cartItems[0]?.name + (cartItems.length > 1 ? ` 외 ${cartItems.length - 1}건` : ''),
            customerName: customerName || '고객',
            customerEmail: customerEmail || undefined,
            successUrl: `${window.location.origin}/store/brand/${slug}/checkout?status=success&orderId=${orderId}`,
            failUrl: `${window.location.origin}/store/brand/${slug}/checkout?status=fail&orderId=${orderId}`,
          });
        } catch (e: any) {
          // 사용자 취소 또는 실패
          setPaymentError(e?.message || '결제가 취소되었습니다');
          setStep('failed');
          throw e;
        }
      } else {
        // 시뮬레이션 모드
        await finalizePurchase(orderId);
      }
    },
    onError: (e: any) => {
      console.error('Purchase error:', e);
    },
  });

  // Toss 결제 콜백 처리 (URL 파라미터)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const orderId = params.get('orderId');
    if (status === 'success' && orderId) {
      finalizePurchase(orderId).catch(console.error);
      // URL 정리
      window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'fail' && orderId) {
      setPaymentError('Toss 결제가 실패했습니다. 세션은 유지되었으니 다시 시도해주세요.');
      setStep('failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!store) return <div className="p-6">로딩 중...</div>;

  if (step === 'failed') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">결제 실패</h1>
          <p className="text-sm text-slate-500 mb-2">{paymentError || '결제 처리 중 문제가 발생했습니다'}</p>
          <p className="text-xs text-emerald-600 mb-6">✓ 장바구니와 입력 정보가 보존되었습니다</p>
          <button onClick={() => { setStep('form'); setPaymentError(''); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">주문이 완료되었습니다!</h1>
          <p className="text-sm text-slate-500 mb-4">{store.brand?.name} 추천 상품을 주문해주셔서 감사합니다.</p>

          {/* 선수 추천 문구 (wireframe TABLE 38) */}
          {store.athlete && (
            <div className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-center gap-3 mb-2">
                {store.athlete.profileImageUrl && (
                  <img src={store.athlete.profileImageUrl} alt={store.athlete.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" />
                )}
                <div className="text-left">
                  <div className="text-xs text-emerald-600 font-semibold">{store.athlete.tour || 'PRO'}</div>
                  <div className="text-sm font-bold text-slate-900">{store.athlete.name} 선수</div>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                "<strong>{store.athlete.name}</strong> 선수가 추천한 상품을 구매해주셔서 감사해요. 함께 응원해주세요! 💚"
              </p>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 text-left mb-6">
            <Field label="주문번호" value={<code className="text-xs">{orderResult?.purchase_event_id?.slice(0, 12)}</code>} />
            <Field label="결제 금액" value={`₩${(grossAmount - discountAmount).toLocaleString()}`} />
            <Field label="귀속" value={orderResult?.attribution_reason || '-'} />
          </div>

          <button
            onClick={() => navigator.share?.({ title: store.brand?.name, text: store.mainCopy, url: window.location.origin + '/store/' + slug }).catch(() => {})}
            className="w-full mb-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl inline-flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" /> 친구에게 공유하기
          </button>

          {/* 재구매 유도 CTA (wireframe TABLE 39) */}
          {store.products && store.products.length > 1 && (
            <div className="mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-xs font-bold text-emerald-700 mb-2">🎁 함께 보면 좋은 상품</div>
              <div className="grid grid-cols-3 gap-1.5">
                {store.products.slice(0, 3).map((p: any) => (
                  <Link
                    key={p.id}
                    to={`/store/brand/${slug}/product/${p.id}`}
                    className="block bg-white rounded-lg p-1.5 hover:shadow-sm transition-shadow"
                  >
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full aspect-square rounded object-cover mb-1" /> : <div className="w-full aspect-square bg-slate-100 rounded mb-1" />}
                    <div className="text-[10px] font-semibold truncate">{p.name}</div>
                  </Link>
                ))}
              </div>
              <Link to={`/store/brand/${slug}`} className="block mt-2 text-center text-xs font-bold text-emerald-700 hover:text-emerald-800">
                전체 상품 보러가기 →
              </Link>
            </div>
          )}

          <Link to={`/store/brand/${slug}`} className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">
            스토어로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-3xl mx-auto p-4">
        <Link to={`/store/brand/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 스토어로
        </Link>

        {/* 주문 요약 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-bold mb-3">주문 요약</h2>
          {cartItems.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400">장바구니가 비어있습니다</div>
          )}
          {cartItems.map((c: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
              <div>
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">{c.qty}개</div>
              </div>
              <div className="text-sm font-bold">₩{(c.price * c.qty).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* 코드 적용 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-bold mb-3 inline-flex items-center gap-2"><Tag className="w-4 h-4" /> 프로모션 코드</h2>
          {!promoApplied ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="코드 입력"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
              <button
                onClick={() => applyMut.mutate()}
                disabled={!promoCode || applyMut.isPending}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg"
              >
                적용
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg">
              <div>
                <code className="text-sm font-bold text-emerald-700">{promoApplied.code}</code>
                <div className="text-xs text-emerald-600 mt-0.5">-₩{discountAmount.toLocaleString()} 할인 적용됨</div>
              </div>
              <button onClick={() => { setPromoApplied(null); setDiscountAmount(0); setPromoCode(''); }} className="text-xs text-rose-600 font-semibold">제거</button>
            </div>
          )}
          {promoError && <div className="mt-2 text-xs text-rose-600">{promoError}</div>}
        </div>

        {/* 결제 정보 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-bold mb-3">배송/결제 정보</h2>
          <div className="space-y-2 mb-4">
            <input type="text" placeholder="이름" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
            <input type="tel" placeholder="전화번호" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
            <input type="email" placeholder="이메일 (선택)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
          </div>
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">결제 방법</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMode('toss')}
                className={`p-3 border-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 ${paymentMode === 'toss' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
              >
                <CreditCard className="w-4 h-4" /> Toss 카드결제
              </button>
              <button
                onClick={() => setPaymentMode('sim')}
                className={`p-3 border-2 rounded-lg text-xs font-semibold ${paymentMode === 'sim' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}
              >
                🧪 시뮬레이션 (테스트용)
              </button>
            </div>
          </div>
        </div>

        {/* 합계 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex justify-between text-sm mb-1">
            <span>상품 금액</span>
            <span>₩{grossAmount.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 mb-1">
              <span>할인</span>
              <span>-₩{discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-lg pt-2 border-t border-slate-100">
            <span>최종 결제금액</span>
            <span className="text-emerald-600">₩{(grossAmount - discountAmount).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-2xl">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => purchaseMut.mutate()}
            disabled={cartItems.length === 0 || purchaseMut.isPending || !customerName}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-base font-extrabold py-4 rounded-xl shadow-lg disabled:opacity-50"
          >
            {purchaseMut.isPending ? '결제 중...' : `₩${(grossAmount - discountAmount).toLocaleString()} 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: any) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

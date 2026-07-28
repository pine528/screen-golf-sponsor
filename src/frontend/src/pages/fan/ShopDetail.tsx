import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Gift,
  ArrowLeft,
  Loader2,
  Truck,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../../utils';

interface ShopItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  pricePoints: string;
  stock: number;
  status: string;
  requiresShipping: boolean;
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shipping, setShipping] = useState({
    name: '',
    phone: '',
    address1: '',
    address2: '',
  });
  const [memo, setMemo] = useState('');
  const [success, setSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['shopItem', id],
    queryFn: () => api.getShopItem(id!),
    enabled: !!id,
  });

  const item: ShopItem | null = data?.data || null;

  const orderMutation = useMutation({
    mutationFn: () =>
      api.createRedemptionOrder(
        {
          itemId: id!,
          quantity,
          shipping: item?.requiresShipping ? shipping : undefined,
          memo: memo || undefined,
        },
        `order-${id}-${Date.now()}`
      ),
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['shopItem', id] });
      queryClient.invalidateQueries({ queryKey: ['pointBalance'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || '교환에 실패했습니다.';
      alert(message);
    },
  });

  const formatNumber = (num: string | number) => {
    return Number(num).toLocaleString();
  };

  const totalPoints = item ? Number(item.pricePoints) * quantity : 0;

  const handleOrder = () => {
    if (item?.requiresShipping && !showShippingForm) {
      setShowShippingForm(true);
      return;
    }

    if (item?.requiresShipping) {
      if (!shipping.name || !shipping.phone || !shipping.address1) {
        alert('배송 정보를 모두 입력해주세요');
        return;
      }
    }

    orderMutation.mutate();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-20">
          <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 mb-4">상품을 찾을 수 없습니다</p>
          <Link to="/shop" className="btn btn-primary">
            목록으로 돌아가기
          </Link>
        </div>
      </Layout>
    );
  }

  if (success) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">교환 신청 완료!</h2>
          <p className="text-slate-500 mb-6">
            {item.title} x{quantity} 교환이 신청되었습니다.
            <br />
            {totalPoints.toLocaleString()}P가 차감되었습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/orders" className="btn btn-primary">
              교환 내역 보기
            </Link>
            <Link to="/shop" className="btn btn-secondary">
              계속 쇼핑하기
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gift className="w-24 h-24 text-slate-300" />
              </div>
            )}
            {item.stock === 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">품절</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {item.requiresShipping && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    배송 상품
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{item.title}</h1>
              {item.description && (
                <p className="text-slate-600">{item.description}</p>
              )}
            </div>

            <div className="text-3xl font-bold text-emerald-600">
              {formatNumber(item.pricePoints)}P
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">재고:</span>
              <span
                className={cn(
                  'font-medium',
                  item.stock > 10
                    ? 'text-emerald-600'
                    : item.stock > 0
                    ? 'text-amber-600'
                    : 'text-red-500'
                )}
              >
                {item.stock}개
              </span>
            </div>

            {/* Quantity */}
            {item.stock > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-slate-700">수량</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(item.stock, quantity + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">총 차감 포인트</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {formatNumber(totalPoints)}P
                    </span>
                  </div>
                </div>

                {/* Shipping Form */}
                {showShippingForm && item.requiresShipping && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      배송 정보
                    </h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="받는 분 성함"
                        value={shipping.name}
                        onChange={(e) =>
                          setShipping({ ...shipping, name: e.target.value })
                        }
                        className="input w-full"
                      />
                      <input
                        type="tel"
                        placeholder="연락처"
                        value={shipping.phone}
                        onChange={(e) =>
                          setShipping({ ...shipping, phone: e.target.value })
                        }
                        className="input w-full"
                      />
                      <input
                        type="text"
                        placeholder="주소"
                        value={shipping.address1}
                        onChange={(e) =>
                          setShipping({ ...shipping, address1: e.target.value })
                        }
                        className="input w-full"
                      />
                      <input
                        type="text"
                        placeholder="상세주소 (선택)"
                        value={shipping.address2}
                        onChange={(e) =>
                          setShipping({ ...shipping, address2: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Memo */}
                <div>
                  <textarea
                    placeholder="요청사항 (선택)"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="input w-full h-20 resize-none"
                  />
                </div>

                {/* Error */}
                {orderMutation.isError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {(orderMutation.error as any)?.response?.data?.error || '교환 신청에 실패했습니다'}
                  </div>
                )}

                {/* Order Button */}
                <button
                  onClick={handleOrder}
                  disabled={orderMutation.isPending}
                  className="btn btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
                >
                  {orderMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Gift className="w-5 h-5" />
                      {item.requiresShipping && !showShippingForm
                        ? '배송정보 입력'
                        : '교환하기'}
                    </>
                  )}
                </button>
              </div>
            )}

            {item.stock === 0 && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center">
                현재 품절된 상품입니다
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

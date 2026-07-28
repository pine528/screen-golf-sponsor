/**
 * 포인트 충전 페이지
 * Toss Payments SDK를 사용한 결제 통합
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Coins,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';

// TossPayments SDK 타입
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsInstance;
  }
}

interface TossPaymentsInstance {
  requestPayment: (
    method: string,
    options: {
      amount: number;
      orderId: string;
      orderName: string;
      customerName?: string;
      successUrl: string;
      failUrl: string;
    }
  ) => Promise<void>;
}

// 환경 변수에서 클라이언트 키 가져오기
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

// 충전 금액 옵션
const TOPUP_OPTIONS = [
  { amount: 5000, points: 5000, label: '5,000원' },
  { amount: 10000, points: 10000, label: '1만원' },
  { amount: 30000, points: 30000, label: '3만원' },
  { amount: 50000, points: 50000, label: '5만원' },
  { amount: 100000, points: 100000, label: '10만원' },
  { amount: 300000, points: 300000, label: '30만원' },
];

export default function PointTopup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const paymentInitiated = useRef(false);

  // URL 파라미터로 결과 확인
  const topupResult = searchParams.get('topup');
  const topupId = searchParams.get('topupId');
  const paymentKey = searchParams.get('paymentKey');

  // 포인트 잔액 조회
  const { data: balanceData } = useQuery({
    queryKey: ['pointBalance'],
    queryFn: () => api.getMyPointBalance(),
  });

  // 충전 내역 조회
  const { data: topupsData } = useQuery({
    queryKey: ['myPointTopups'],
    queryFn: () => api.getMyPointTopups({ limit: 10 }),
  });

  // 결제 확인 (성공 리다이렉트 시)
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (topupId && paymentKey) {
        return api.confirmPointTopup(topupId, paymentKey);
      }
      throw new Error('결제 정보가 없습니다');
    },
    onSuccess: () => {
      // URL에서 파라미터 제거하고 완료 화면으로 이동
      // (invalidateQueries는 완료 화면에서 자동으로 됨)
      navigate('/points/topup?topup=complete', { replace: true });
      // 약간의 딜레이 후 쿼리 리프레시 (세션 복구 대기)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['pointBalance'] });
        queryClient.invalidateQueries({ queryKey: ['myPointTopups'] });
      }, 500);
    },
    onError: (error: any) => {
      console.error('결제 확인 실패:', error);
      setPaymentError(error?.response?.data?.error?.message || '결제 확인에 실패했습니다');
    },
  });

  // 충전 생성
  const createMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.createPointTopup({ amount });
      return response;
    },
    onSuccess: async (data) => {
      // 충전 레코드가 생성되면 Toss 결제 시작
      if (data?.data?.topup) {
        await startTossPayment(data.data.topup);
      }
    },
    onError: (error: any) => {
      setPaymentError(error?.response?.data?.error?.message || '충전 요청에 실패했습니다');
      setIsPaymentLoading(false);
    },
  });

  // 결제 성공 시 자동 확인
  useEffect(() => {
    console.log('[PointTopup] URL params:', { topupResult, topupId, paymentKey });

    if (topupResult === 'pending' && topupId) {
      if (!paymentKey) {
        console.error('[PointTopup] paymentKey missing in URL');
        setPaymentError('결제 정보(paymentKey)가 누락되었습니다. 다시 시도해주세요.');
        return;
      }

      if (!confirmMutation.isPending && !paymentInitiated.current) {
        console.log('[PointTopup] Starting confirm...');
        paymentInitiated.current = true;
        confirmMutation.mutate();
      }
    }
  }, [topupResult, topupId, paymentKey]);

  // Toss Payments SDK 로드 및 결제 시작
  const startTossPayment = async (topup: { id: string; providerOrderId: string; amount: number }) => {
    try {
      setIsPaymentLoading(true);
      setPaymentError('');

      // SDK 스크립트가 이미 로드되어 있는지 확인
      if (!window.TossPayments) {
        // SDK 스크립트 로드
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector('script[src*="tosspayments"]');
          if (existingScript) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://js.tosspayments.com/v1/payment';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('TossPayments SDK 로드 실패'));
          document.head.appendChild(script);
        });
      }

      // SDK 로드 완료 대기
      await new Promise<void>((resolve) => {
        const checkSDK = () => {
          if (window.TossPayments) {
            resolve();
          } else {
            setTimeout(checkSDK, 100);
          }
        };
        checkSDK();
      });

      const tossPayments = window.TossPayments!(TOSS_CLIENT_KEY);

      // 현재 URL 기반으로 success/fail URL 생성
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/points/topup?topup=pending&topupId=${topup.id}`;
      const failUrl = `${baseUrl}/points/topup?topup=fail`;

      const numAmount = Number(topup.amount);

      // 결제 요청
      await tossPayments.requestPayment('카드', {
        amount: numAmount,
        orderId: topup.providerOrderId,
        orderName: `포인트 충전 ${numAmount.toLocaleString()}P`,
        successUrl,
        failUrl,
      });
    } catch (err: any) {
      // 사용자가 결제를 취소한 경우
      if (err.code === 'USER_CANCEL') {
        setPaymentError('결제가 취소되었습니다');
      } else {
        console.error('Payment error:', err);
        setPaymentError(err.message || '결제 중 오류가 발생했습니다');
      }
      setIsPaymentLoading(false);
    }
  };

  const finalAmount = useCustom ? parseInt(customAmount) || 0 : selectedAmount || 0;
  const isValidAmount = finalAmount >= 1000 && finalAmount <= 10000000;

  const handleTopup = () => {
    if (!isValidAmount) return;
    setPaymentError('');
    createMutation.mutate(finalAmount);
  };

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString();
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      CREATED: { text: '대기중', color: 'bg-gray-100 text-gray-700' },
      PENDING: { text: '처리중', color: 'bg-yellow-100 text-yellow-700' },
      PAID: { text: '완료', color: 'bg-green-100 text-green-700' },
      FAILED: { text: '실패', color: 'bg-red-100 text-red-700' },
      CANCELED: { text: '취소됨', color: 'bg-slate-100 text-slate-700' },
      REFUNDED: { text: '환불됨', color: 'bg-purple-100 text-purple-700' },
    };
    return labels[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const balance = balanceData?.data?.balance || 0;
  const topups = topupsData?.data || [];

  // 결제 완료 상태
  if (topupResult === 'complete') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">충전 완료!</h2>
            <p className="text-slate-600 mb-6">포인트가 성공적으로 충전되었습니다.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/points')} className="btn btn-primary">
                포인트 내역 보기
              </button>
              <button
                onClick={() => navigate('/points/topup', { replace: true })}
                className="btn btn-secondary"
              >
                추가 충전
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // 결제 실패 상태
  if (topupResult === 'fail') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">결제 실패</h2>
            <p className="text-slate-600 mb-6">결제 처리 중 문제가 발생했습니다.</p>
            <button
              onClick={() => navigate('/points/topup', { replace: true })}
              className="btn btn-primary"
            >
              다시 시도
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // 결제 확인 중 (에러가 없을 때만)
  if (!paymentError && (confirmMutation.isPending || (topupResult === 'pending' && topupId && paymentKey))) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">결제 확인 중...</h2>
            <p className="text-slate-600">잠시만 기다려주세요.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 결제 확인 실패 (paymentKey 누락 또는 API 에러)
  if (paymentError && topupResult === 'pending') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">결제 확인 실패</h2>
            <p className="text-slate-600 mb-6">{paymentError}</p>
            <button
              onClick={() => navigate('/points/topup', { replace: true })}
              className="btn btn-primary"
            >
              다시 시도
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate('/points')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>포인트 내역</span>
        </button>

        {/* 현재 잔액 */}
        <div className="card p-6 bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Coins className="w-6 h-6" />
            <span className="font-medium">현재 포인트</span>
          </div>
          <div className="text-4xl font-bold">{formatNumber(balance)}P</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 충전 금액 선택 */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">포인트 충전</h2>
            </div>

            {/* 결제 수단 표시 */}
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">토스페이먼츠</div>
                  <div className="text-sm text-slate-600">신용카드, 체크카드</div>
                </div>
              </div>
            </div>

            {/* 정액 옵션 */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TOPUP_OPTIONS.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => {
                    setSelectedAmount(option.amount);
                    setUseCustom(false);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    !useCustom && selectedAmount === option.amount
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{option.label}</div>
                  <div className="text-sm text-emerald-600">{formatNumber(option.points)}P</div>
                </button>
              ))}
            </div>

            {/* 직접 입력 */}
            <div className="mb-6">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">직접 입력</span>
              </label>
              {useCustom && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="충전 금액"
                    min={1000}
                    max={10000000}
                    step={1000}
                    className="input flex-1"
                  />
                  <span className="text-slate-500">원</span>
                </div>
              )}
            </div>

            {/* 안내 */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 mt-0.5" />
                <div className="text-sm text-slate-600">
                  <p className="font-medium mb-1">충전 안내</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500">
                    <li>1원 = 1포인트로 충전됩니다</li>
                    <li>최소 1,000원부터 최대 1,000만원까지 가능합니다</li>
                    <li>결제 완료 후 즉시 포인트가 지급됩니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 충전 요약 */}
            {finalAmount > 0 && (
              <div className="bg-emerald-50 rounded-xl p-4 mb-6 border border-emerald-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">충전 금액</span>
                  <span className="font-semibold">{formatNumber(finalAmount)}원</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600">
                  <span>지급 포인트</span>
                  <span className="font-bold text-lg">{formatNumber(finalAmount)}P</span>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {(paymentError || createMutation.isError) && (
              <div className="bg-red-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">충전 요청에 실패했습니다</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  {paymentError || '다시 시도해주세요'}
                </p>
              </div>
            )}

            {/* 충전 버튼 */}
            <button
              onClick={handleTopup}
              disabled={!isValidAmount || createMutation.isPending || isPaymentLoading}
              className="btn btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || isPaymentLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  결제 준비 중...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  {formatNumber(finalAmount)}원 충전하기
                </>
              )}
            </button>
          </div>

          {/* 최근 충전 내역 */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">최근 충전 내역</h3>

            {topups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>충전 내역이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topups.map((topup: any) => {
                  const statusInfo = getStatusLabel(topup.status);
                  return (
                    <div
                      key={topup.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {formatNumber(topup.amount)}원
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}
                          >
                            {statusInfo.text}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {formatDate(topup.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-600">
                          +{formatNumber(topup.pointsToGrant)}P
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

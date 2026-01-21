/**
 * Phase 10-1: Brand Checkout Page
 * TossPayments 결제 진행 페이지
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils';

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

export default function BrandCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const paymentInitiated = useRef(false);

  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const topupId = searchParams.get('topupId');

  useEffect(() => {
    // 파라미터 검증
    if (!orderId || !amount || !topupId) {
      setError('결제 정보가 올바르지 않습니다.');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1000) {
      setError('결제 금액이 올바르지 않습니다.');
      return;
    }

    // 이미 결제가 시작되었으면 중복 실행 방지
    if (paymentInitiated.current) {
      return;
    }

    // TossPayments SDK 로드 및 결제 시작
    const loadAndPay = async () => {
      try {
        // SDK 스크립트가 이미 로드되어 있는지 확인
        if (!window.TossPayments) {
          // SDK 스크립트 로드
          await new Promise<void>((resolve, reject) => {
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

        paymentInitiated.current = true;
        const tossPayments = window.TossPayments!(TOSS_CLIENT_KEY);

        // 현재 URL 기반으로 success/fail URL 생성
        // TossPayments가 paymentKey, orderId, amount를 자동으로 추가함
        const baseUrl = window.location.origin;
        const successUrl = `${baseUrl}/brand/wallet?topup=pending&topupId=${topupId}`;
        const failUrl = `${baseUrl}/brand/wallet?topup=fail`;

        // 결제 요청
        await tossPayments.requestPayment('카드', {
          amount: numAmount,
          orderId: orderId,
          orderName: `지갑 충전 ${formatCurrency(numAmount)}`,
          successUrl,
          failUrl,
        });
      } catch (err: any) {
        // 사용자가 결제를 취소한 경우
        if (err.code === 'USER_CANCEL') {
          navigate('/brand/wallet?topup=cancel');
          return;
        }
        console.error('Payment error:', err);
        setError(err.message || '결제 중 오류가 발생했습니다.');
      }
    };

    loadAndPay();
  }, [orderId, amount, topupId, navigate]);

  // 에러 상태
  if (error) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">결제 오류</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/brand/wallet')}
              className="btn btn-primary"
            >
              지갑으로 돌아가기
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // 로딩 상태
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">결제 준비 중...</h2>
          <p className="text-slate-600 mb-4">
            {amount && `${formatCurrency(Number(amount))} 충전`}
          </p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          <p className="text-sm text-slate-500 mt-4">
            잠시 후 결제 화면이 나타납니다.
          </p>
        </div>
      </div>
    </Layout>
  );
}

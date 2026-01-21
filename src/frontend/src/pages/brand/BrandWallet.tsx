/**
 * Phase 10-1: Brand Wallet Page
 * 브랜드 지갑 충전 및 조회
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Wallet,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

// 충전 금액 옵션
const TOPUP_AMOUNTS = [10000, 50000, 100000, 500000, 1000000];

// Provider 옵션
const PROVIDERS = [
  { value: 'TOSS', label: 'Toss Payments', description: '간편결제, 카드, 계좌이체' },
] as const;

// 상태별 설정
const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
  CREATED: { label: '대기중', class: 'badge-info', icon: Clock },
  PENDING: { label: '결제중', class: 'badge-warning', icon: Loader2 },
  PAID: { label: '완료', class: 'badge-success', icon: CheckCircle },
  FAILED: { label: '실패', class: 'badge-error', icon: XCircle },
  CANCELED: { label: '취소됨', class: 'badge-warning', icon: XCircle },
  REFUNDED: { label: '환불됨', class: 'badge-info', icon: RefreshCw },
};

// LedgerTx 타입별 설정
const txTypeConfig: Record<string, { label: string; isCredit: boolean }> = {
  DEPOSIT: { label: '입금', isCredit: true },
  WITHDRAW: { label: '출금', isCredit: false },
  ESCROW_HOLD: { label: '에스크로 홀드', isCredit: false },
  ESCROW_RELEASE: { label: '에스크로 지급', isCredit: false },
  ESCROW_REFUND: { label: '에스크로 환불', isCredit: true },
  PLATFORM_FEE: { label: '수수료', isCredit: false },
  ADJUSTMENT: { label: '조정', isCredit: true },
  DIRECT_BUY_RESERVE: { label: '즉시구매 동결', isCredit: false },
  DIRECT_BUY_RESERVE_RELEASE: { label: '즉시구매 해제', isCredit: true },
  AUCTION_BID_RESERVE: { label: '입찰 동결', isCredit: false },
  AUCTION_BID_RESERVE_RELEASE: { label: '입찰 해제', isCredit: true },
  TOPUP_DEPOSIT: { label: '충전', isCredit: true },
  TOPUP_REFUND: { label: '충전 환불', isCredit: false },
};

export default function BrandWallet() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmAttempted = useRef(false);

  // 충전 폼 상태
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'TOSS'>('TOSS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // URL 파라미터에서 결제 결과 확인 및 confirm 처리
  useEffect(() => {
    const topupResult = searchParams.get('topup');

    if (topupResult === 'success') {
      setSuccessMessage('충전이 완료되었습니다!');
      queryClient.invalidateQueries({ queryKey: ['brandWallet'] });
      queryClient.invalidateQueries({ queryKey: ['myTopups'] });
    } else if (topupResult === 'fail') {
      setError('충전에 실패했습니다. 다시 시도해주세요.');
    } else if (topupResult === 'pending') {
      // TossPayments에서 돌아옴 - confirm 필요
      const topupId = searchParams.get('topupId');
      const paymentKey = searchParams.get('paymentKey');

      if (topupId && paymentKey && !confirmAttempted.current) {
        confirmAttempted.current = true;
        setIsConfirming(true);

        // 결제 확인 API 호출
        api.confirmTopup(topupId, paymentKey)
          .then(() => {
            setSuccessMessage('충전이 완료되었습니다!');
            queryClient.invalidateQueries({ queryKey: ['brandWallet'] });
            queryClient.invalidateQueries({ queryKey: ['myTopups'] });
            // URL 정리
            navigate('/brand/wallet?topup=success', { replace: true });
          })
          .catch((err: any) => {
            console.error('Confirm error:', err);
            setError(err.response?.data?.message || '결제 확인 중 오류가 발생했습니다.');
          })
          .finally(() => {
            setIsConfirming(false);
          });
      } else if (!topupId || !paymentKey) {
        setError('결제 정보가 올바르지 않습니다.');
      }
    } else if (topupResult === 'cancel') {
      setError('결제가 취소되었습니다.');
    }
  }, [searchParams, queryClient, navigate]);

  // 지갑 조회
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['brandWallet'],
    queryFn: () => api.getMyBrandWallet(),
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 충전 내역 조회
  const { data: topupsData, isLoading: topupsLoading } = useQuery({
    queryKey: ['myTopups'],
    queryFn: () => api.getMyTopups({ limit: 20 }),
  });

  // 충전 생성 뮤테이션
  const createTopupMutation = useMutation({
    mutationFn: (data: { amount: number; provider: 'TOSS' }) =>
      api.createTopup(data),
    onSuccess: (response) => {
      // checkoutUrl로 리다이렉트 (topupId 포함)
      const checkoutUrl = response.data?.checkoutUrl;
      const topupId = response.data?.topupPayment?.id;
      if (checkoutUrl && topupId) {
        // topupId를 checkout URL에 추가
        const url = new URL(checkoutUrl, window.location.origin);
        url.searchParams.set('topupId', topupId);
        window.location.href = url.toString();
      } else {
        setError('결제 페이지 URL을 받지 못했습니다.');
        setIsProcessing(false);
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '충전 요청 실패');
      setIsProcessing(false);
    },
  });

  // 테스트 충전 뮤테이션 (데모용)
  const mockTopupMutation = useMutation({
    mutationFn: (amount: number) => api.mockTopup(amount),
    onSuccess: () => {
      setSuccessMessage('테스트 충전이 완료되었습니다!');
      queryClient.invalidateQueries({ queryKey: ['brandWallet'] });
      queryClient.invalidateQueries({ queryKey: ['myTopups'] });
      setSelectedAmount(null);
      setCustomAmount('');
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || '테스트 충전 실패';
      setError(errorMsg);
    },
  });

  const wallet = walletData?.data?.wallet;
  const recentTransactions = walletData?.data?.recentTransactions || [];
  const topups = topupsData?.data?.items || [];

  const effectiveAmount = selectedAmount || (customAmount ? Number(customAmount) : 0);

  const handleTopup = () => {
    setError('');
    setSuccessMessage('');

    if (!effectiveAmount || effectiveAmount < 1000) {
      setError('최소 충전 금액은 1,000원입니다.');
      return;
    }

    if (effectiveAmount > 100000000) {
      setError('최대 충전 금액은 1억원입니다.');
      return;
    }

    setIsProcessing(true);
    createTopupMutation.mutate({
      amount: effectiveAmount,
      provider: selectedProvider,
    });
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
    setError('');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            지갑
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            잔액을 충전하고 경매 입찰, 즉시구매에 사용하세요.
          </p>
        </div>

        {/* 알림 메시지 */}
        {isConfirming && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            결제를 확인하고 있습니다...
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 잔액 카드 */}
          <div className="card p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-100">사용 가능 잔액</span>
              <Wallet className="w-6 h-6 text-emerald-200" />
            </div>

            {walletLoading ? (
              <div className="animate-pulse">
                <div className="h-10 bg-white/20 rounded w-48 mb-2"></div>
                <div className="h-4 bg-white/20 rounded w-32"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold mb-1">
                  {formatCurrency(wallet?.availableBalance || 0)}
                </div>
                <div className="text-sm text-emerald-100">
                  동결: {formatCurrency(wallet?.frozenAmount || 0)}
                </div>
                <div className="text-xs text-emerald-200 mt-2">
                  총 잔액: {formatCurrency(wallet?.balance || 0)}
                </div>
              </>
            )}
          </div>

          {/* 충전 폼 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-600" />
              충전하기
            </h2>

            {/* 금액 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                충전 금액
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {TOPUP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg border transition-all',
                      selectedAmount === amount
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 hover:border-emerald-300'
                    )}
                  >
                    {(amount / 10000).toLocaleString()}만
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="직접 입력 (원)"
                  className="input w-full"
                  min="1000"
                  max="100000000"
                />
                {customAmount && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    {formatCurrency(Number(customAmount))}
                  </span>
                )}
              </div>
            </div>

            {/* Provider 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                결제 수단
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.value}
                    onClick={() => setSelectedProvider(provider.value)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      selectedProvider === provider.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-300'
                    )}
                  >
                    <div className="font-medium text-slate-900">{provider.label}</div>
                    <div className="text-xs text-slate-500">{provider.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 충전 버튼 */}
            <button
              onClick={handleTopup}
              disabled={!effectiveAmount || isProcessing}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {effectiveAmount
                    ? `${formatCurrency(effectiveAmount)} 충전하기`
                    : '충전하기'}
                </>
              )}
            </button>

            {/* 테스트 충전 버튼 (데모용) */}
            <button
              onClick={() => {
                setError('');
                setSuccessMessage('');
                if (!effectiveAmount || effectiveAmount < 1000) {
                  setError('최소 충전 금액은 1,000원입니다.');
                  return;
                }
                mockTopupMutation.mutate(effectiveAmount);
              }}
              disabled={!effectiveAmount || mockTopupMutation.isPending}
              className="btn btn-outline w-full mt-2 flex items-center justify-center gap-2"
            >
              {mockTopupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  {effectiveAmount
                    ? `${formatCurrency(effectiveAmount)} 테스트 충전`
                    : '테스트 충전'} (데모용)
                </>
              )}
            </button>
          </div>
        </div>

        {/* 최근 거래 내역 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            최근 거래 내역
          </h2>

          {walletLoading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              로딩 중...
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              거래 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx: any) => {
                const config = txTypeConfig[tx.type] || { label: tx.type, isCredit: false };
                const amount = Number(tx.amount);
                const isPositive = amount > 0;

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {isPositive ? (
                        <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium text-slate-900">{config.label}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(tx.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'font-semibold',
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 충전 내역 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-600" />
            충전 내역
          </h2>

          {topupsLoading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              로딩 중...
            </div>
          ) : topups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              충전 내역이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 font-medium text-slate-600">날짜</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-600">금액</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-600">결제수단</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-600">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {topups.map((topup: any) => {
                    const config = statusConfig[topup.status] || statusConfig.CREATED;
                    const StatusIcon = config.icon;

                    return (
                      <tr key={topup.id} className="border-b border-slate-100">
                        <td className="py-3 px-2 text-slate-600">
                          {new Date(topup.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-2 font-medium text-slate-900">
                          {formatCurrency(Number(topup.amount))}
                        </td>
                        <td className="py-3 px-2 text-slate-600">{topup.provider}</td>
                        <td className="py-3 px-2">
                          <span className={cn('badge', config.class, 'flex items-center gap-1 w-fit')}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 안내 사항 */}
        <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg">
          <p className="font-medium text-slate-700 mb-1">안내사항</p>
          <ul className="list-disc list-inside space-y-1">
            <li>최소 충전 금액은 1,000원, 최대 1억원입니다.</li>
            <li>충전한 금액은 경매 입찰, 즉시구매에 사용됩니다.</li>
            <li>동결된 금액은 진행 중인 입찰에 예약된 금액입니다.</li>
            <li>환불은 고객센터로 문의해주세요.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

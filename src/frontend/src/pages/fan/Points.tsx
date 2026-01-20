import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Coins, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const REASON_LABELS: Record<string, string> = {
  ADMIN_GRANT: '관리자 지급',
  VOTE_ENTRY_FEE: '투표 참여 수수료',
  VOTE_WIN_PAYOUT: '투표 당첨 보상',
  VOTE_CREATE_FEE: '투표 생성 수수료',
  REDEEM_GOODS: '상품 교환',
};

export default function Points() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const pageSize = 20;

  // FAN이 아닌 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (user && user.role !== 'FAN') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // 포인트 잔액 조회
  const { data: balanceData } = useQuery({
    queryKey: ['pointBalance'],
    queryFn: () => api.getMyPointBalance(),
  });

  // 포인트 내역 조회
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['pointHistory', page, selectedReason],
    queryFn: () =>
      api.getMyPointHistory({
        page,
        pageSize,
        ...(selectedReason && { reason: selectedReason }),
      }),
  });

  const balance = balanceData?.data?.balance || 0;
  const transactions = historyData?.data?.transactions || [];
  const pagination = historyData?.data?.pagination;

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

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 포인트 잔액 카드 */}
      <div className="card p-8 bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Coins className="w-8 h-8" />
          <h2 className="text-2xl font-bold">내 포인트</h2>
        </div>
        <div className="text-5xl font-bold mb-2">{formatNumber(balance)}P</div>
        <div className="text-emerald-100 text-sm">
          마지막 업데이트: {formatDate(balanceData?.data?.updatedAt)}
        </div>
      </div>

      {/* 포인트 내역 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">포인트 내역</h3>

          {/* 필터 */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value);
                setPage(1);
              }}
              className="input py-2 px-3"
            >
              <option value="">전체</option>
              {Object.entries(REASON_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 내역 리스트 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Coins className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p>포인트 내역이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {transactions.map((tx: any) => {
                const isPositive = Number(tx.delta) > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isPositive ? 'bg-emerald-100' : 'bg-red-100'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">
                          {REASON_LABELS[tx.reason] || tx.reason}
                        </div>
                        {tx.description && (
                          <div className="text-sm text-slate-500">{tx.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(tx.createdAt)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xl font-bold ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatNumber(tx.delta)}P
                        </div>
                        <div className="text-sm text-slate-500">
                          잔액: {formatNumber(tx.balanceAfter)}P
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  이전
                </button>
                <span className="text-slate-600">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </Layout>
  );
}

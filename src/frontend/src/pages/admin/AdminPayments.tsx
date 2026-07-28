import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, DollarSign, Receipt, Coins, Wallet } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

const statusConfig: Record<string, { label: string; class: string }> = {
  CREATED: { label: '생성됨', class: 'badge-info' },
  PENDING: { label: '대기중', class: 'badge-warning' },
  PAID: { label: '완료', class: 'badge-success' },
  FAILED: { label: '실패', class: 'badge-danger' },
  CANCELED: { label: '취소', class: 'badge-info' },
  REFUNDED: { label: '환불', class: 'badge-danger' },
};

const providerLabels: Record<string, string> = {
  TOSS: '토스',
  STRIPE: 'Stripe',
  MOCK: '테스트',
};

type TopupType = 'WALLET' | 'POINT';

export default function AdminPayments() {
  const [topupType, setTopupType] = useState<TopupType>('WALLET');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // 브랜드 지갑 충전 내역
  const { data: walletTopupsData, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['adminTopups', { status: statusFilter, page }],
    queryFn: () => api.getAdminTopups({
      status: statusFilter || undefined,
      limit,
      offset: (page - 1) * limit
    }),
    enabled: topupType === 'WALLET',
  });

  const { data: walletStatsData } = useQuery({
    queryKey: ['adminTopupStats'],
    queryFn: () => api.getAdminTopupStats(),
    enabled: topupType === 'WALLET',
  });

  // 포인트 충전 내역
  const { data: pointTopupsData, isLoading: isLoadingPoint } = useQuery({
    queryKey: ['adminPointTopups', { status: statusFilter, page }],
    queryFn: () => api.getAdminPointTopups({
      status: statusFilter || undefined,
      limit,
      offset: (page - 1) * limit
    }),
    enabled: topupType === 'POINT',
  });

  const { data: pointStatsData } = useQuery({
    queryKey: ['adminPointTopupStats'],
    queryFn: () => api.getAdminPointTopupStats(),
    enabled: topupType === 'POINT',
  });

  const isLoading = topupType === 'WALLET' ? isLoadingWallet : isLoadingPoint;
  const topups = topupType === 'WALLET'
    ? (walletTopupsData?.data?.items || [])
    : (pointTopupsData?.data?.items || pointTopupsData?.data || []);
  const total = topupType === 'WALLET'
    ? (walletTopupsData?.data?.total || 0)
    : (pointTopupsData?.data?.total || topups.length);
  const totalPages = Math.ceil(total / limit);
  const stats = topupType === 'WALLET' ? walletStatsData?.data : pointStatsData?.data;

  // 타입 변경 시 페이지 리셋
  const handleTypeChange = (type: TopupType) => {
    setTopupType(type);
    setPage(1);
    setStatusFilter('');
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">결제 관리</h1>
          <p className="text-slate-600 mt-1">브랜드 지갑 충전 및 포인트 충전 내역을 조회하세요</p>
        </div>

        {/* Type Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-4">
          <button
            onClick={() => handleTypeChange('WALLET')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              topupType === 'WALLET'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <Wallet className="w-5 h-5" />
            브랜드 지갑 충전
          </button>
          <button
            onClick={() => handleTypeChange('POINT')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              topupType === 'POINT'
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <Coins className="w-5 h-5" />
            포인트 충전
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">
                  총 {topupType === 'WALLET' ? '충전' : '포인트 충전'}금액
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {topupType === 'WALLET'
                    ? formatCurrency(stats?.totalAmount || 0)
                    : `${(stats?.totalAmount || 0).toLocaleString()}P`
                  }
                </p>
              </div>
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                topupType === 'WALLET' ? 'bg-emerald-100' : 'bg-violet-100'
              )}>
                <DollarSign className={cn(
                  'w-6 h-6',
                  topupType === 'WALLET' ? 'text-emerald-600' : 'text-violet-600'
                )} />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 결제건수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalCount || 0}건</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-sky-600" />
              </div>
            </div>
          </div>
          {stats?.byProvider?.slice(0, 2).map((p: any) => (
            <div key={p.provider} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">{providerLabels[p.provider] || p.provider}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {topupType === 'WALLET'
                      ? formatCurrency(p.amount || 0)
                      : `${(p.amount || 0).toLocaleString()}P`
                    }
                  </p>
                  <p className="text-xs text-slate-500">{p.count}건</p>
                </div>
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex gap-4 items-center">
            <label className="text-sm text-slate-600">상태 필터:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input w-auto"
            >
              <option value="">전체</option>
              <option value="PAID">완료</option>
              <option value="PENDING">대기중</option>
              <option value="CREATED">생성됨</option>
              <option value="FAILED">실패</option>
              <option value="CANCELED">취소</option>
              <option value="REFUNDED">환불</option>
            </select>
          </div>
        </div>

        {/* Topups Table */}
        <div className="card overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  충전 ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {topupType === 'WALLET' ? '브랜드' : '사용자'}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  결제수단
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  결제일시
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                        {topupType === 'WALLET' ? (
                          <Wallet className="w-8 h-8 text-slate-400" />
                        ) : (
                          <Coins className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <p className="text-slate-500">
                        {topupType === 'WALLET' ? '지갑 충전' : '포인트 충전'} 내역이 없습니다
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                topups.map((topup: any) => (
                  <tr key={topup.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">
                      {topup.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-900">
                        {topupType === 'WALLET'
                          ? (topup.brand?.name || topup.brandId?.slice(0, 8) + '...' || '-')
                          : (topup.user?.email || topup.userId?.slice(0, 8) + '...' || '-')
                        }
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-900">
                        {topupType === 'WALLET'
                          ? formatCurrency(Number(topup.amount))
                          : `${Number(topup.amount).toLocaleString()}P`
                        }
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {providerLabels[topup.provider] || topup.provider}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('badge', statusConfig[topup.status]?.class || 'badge-info')}>
                        {statusConfig[topup.status]?.label || topup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {topup.paidAt
                        ? new Date(topup.paidAt).toLocaleString()
                        : new Date(topup.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                총 {total}건 중 {(page - 1) * limit + 1} -{' '}
                {Math.min(page * limit, total)}건
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-2 text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-secondary text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

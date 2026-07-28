import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import {
  Wallet,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  TrendingUp,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowDownRight,
  Building2,
} from 'lucide-react';
import { cn } from '../utils';
import { getEventMonthLabel } from '../utils/eventMonth';

export function Settlements() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: settlementsData, isLoading } = useQuery({
    queryKey: ['my-settlements'],
    queryFn: () => api.getMySettlements(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['my-settlement-stats'],
    queryFn: () => api.getMySettlementStats(),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['my-monthly-settlements'],
    queryFn: () => api.getMonthlySettlements(),
  });

  const settlements = settlementsData?.data || [];
  const stats = statsData?.data || {};
  const monthlySettlements = monthlyData?.data || [];

  const filteredSettlements = settlements
    .filter((settlement: any) => {
      if (statusFilter !== 'all' && settlement.status !== statusFilter) return false;
      return true;
    })
    .filter((settlement: any) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          settlement.contract?.auction?.slotInstance?.slotTemplate?.name?.toLowerCase().includes(searchLower) ||
          settlement.contract?.brand?.name?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter((settlement: any) => {
      if (periodFilter === 'all') return true;
      const date = new Date(settlement.createdAt);
      const now = new Date();
      switch (periodFilter) {
        case 'week':
          return date >= new Date(now.setDate(now.getDate() - 7));
        case 'month':
          return date >= new Date(now.setMonth(now.getMonth() - 1));
        case 'quarter':
          return date >= new Date(now.setMonth(now.getMonth() - 3));
        default:
          return true;
      }
    });

  const statusStyles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    PROCESSING: 'bg-sky-100 text-sky-700 border-sky-200',
    PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    PENDING: '대기중',
    PROCESSING: '처리중',
    PAID: '완료',
    FAILED: '실패',
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">정산</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">정산 내역을 확인합니다</p>
          </div>
          <button className="btn btn-secondary inline-flex items-center justify-center gap-2 text-sm sm:text-base">
            <Download className="w-4 h-4" />
            정산내역 다운로드
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">총 정산액</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">
                  {formatCurrency(stats.totalPaid || 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">정산 대기</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">
                  {formatCurrency(stats.pendingAmount || 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">이번 달</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">
                  {formatCurrency(stats.thisMonth || 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">정산 건수</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900">{stats.settlementCount || settlements.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Account Info */}
        <div className="card p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">정산 계좌</p>
                <p className="font-medium text-slate-900 text-sm sm:text-base">
                  {stats.bankName || '미등록'} {stats.bankAccount ? `****${stats.bankAccount.slice(-4)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/athlete/withdrawals')}
              className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium self-end sm:self-auto"
            >
              계좌 변경
            </button>
          </div>
        </div>

        {/* Notice */}
        <div className="card p-3 sm:p-4 bg-sky-50 border-sky-200">
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sky-900 text-sm sm:text-base">정산 안내</p>
              <p className="text-xs sm:text-sm text-sky-700 mt-1">
                계약 완료 후 D+7 영업일 이내에 등록된 계좌로 정산금이 입금됩니다.
                플랫폼 수수료 10%와 선수 수수료 5%가 차감됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <input
                type="text"
                placeholder="슬롯명, 브랜드명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 sm:pl-10 text-sm sm:text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input flex-1 min-w-[120px] text-sm sm:text-base"
              >
                <option value="all">전체 상태</option>
                <option value="PENDING">대기중</option>
                <option value="PROCESSING">처리중</option>
                <option value="PAID">완료</option>
              </select>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="input flex-1 min-w-[120px] text-sm sm:text-base"
              >
                <option value="all">전체 기간</option>
                <option value="week">최근 1주</option>
                <option value="month">최근 1개월</option>
                <option value="quarter">최근 3개월</option>
              </select>
            </div>
          </div>
        </div>

        {/* Settlements List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-6 sm:p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600 text-sm sm:text-base">로딩 중...</p>
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Wallet className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">정산 내역이 없습니다</h3>
              <p className="text-sm sm:text-base text-slate-600">계약이 완료되면 정산 내역이 표시됩니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredSettlements.map((settlement: any) => (
                <div
                  key={settlement.id}
                  className="p-3 sm:p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={cn(
                        'w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0',
                        settlement.status === 'PAID' ? 'bg-emerald-100' :
                        settlement.status === 'PENDING' ? 'bg-amber-100' : 'bg-sky-100'
                      )}>
                        {settlement.status === 'PAID' ? (
                          <ArrowDownRight className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                        ) : (
                          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {settlement.contract?.auction?.slotInstance?.slotTemplate?.name || '슬롯'}
                          </h3>
                          <span className={cn('badge text-xs', statusStyles[settlement.status])}>
                            {statusLabels[settlement.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="truncate">{settlement.contract?.brand?.name || '브랜드'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="truncate">{getEventMonthLabel(settlement.contract?.auction?.slotInstance?.event) || '이벤트'}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                          <span className="text-slate-500">
                            계약금: {formatCurrency(settlement.contract?.priceFinal || 0)}
                          </span>
                          <span className="text-slate-500">
                            수수료: {formatCurrency(settlement.platformFee || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-13 sm:pl-0 flex-shrink-0">
                      <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">
                        {settlement.status === 'PAID' ? '정산 완료' : '정산 예정'}
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-emerald-600">
                        {formatCurrency(settlement.payoutAmount || 0)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
                        {settlement.status === 'PAID'
                          ? formatDate(settlement.paidAt)
                          : `예정: ${formatDate(settlement.createdAt)}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredSettlements.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-slate-600">총 {filteredSettlements.length}건</p>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-600">페이지 {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Monthly Summary */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4">월별 정산 현황</h2>
          <div className="space-y-2 sm:space-y-4">
            {monthlySettlements.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                월별 정산 내역이 없습니다
              </div>
            ) : (
              monthlySettlements.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      item.status === 'completed' ? 'bg-emerald-100' : 'bg-amber-100'
                    )}>
                      {item.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                      ) : (
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm sm:text-base">{item.month}</p>
                      <p className="text-xs sm:text-sm text-slate-500">{item.count}건 정산</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm sm:text-base">{formatCurrency(item.amount)}</p>
                    <p className={cn(
                      'text-[10px] sm:text-xs',
                      item.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                      {item.status === 'completed' ? '정산 완료' : '정산 예정'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

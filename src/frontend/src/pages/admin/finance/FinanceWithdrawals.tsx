import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';
import {
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  Banknote,
  Loader2,
  Download,
  Search,
  ChevronRight,
  Package,
  Square,
  CheckSquare,
} from 'lucide-react';
import { cn } from '../../../utils';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: {
    label: '요청중',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
  APPROVED: {
    label: '승인됨',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle,
  },
  REJECTED: {
    label: '거부됨',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
  PAID: {
    label: '지급완료',
    color: 'bg-emerald-100 text-emerald-700',
    icon: Banknote,
  },
};

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'REQUESTED', label: '요청중' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'PAID', label: '지급완료' },
  { value: 'REJECTED', label: '거부됨' },
];

export default function FinanceWithdrawals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 출금 요청 목록
  const { data: withdrawalsData, isLoading } = useQuery({
    queryKey: ['adminWithdrawals', statusFilter, search, page],
    queryFn: () =>
      api.getAdminWithdrawals({
        status: statusFilter || undefined,
        q: search || undefined,
        page,
        pageSize: 20,
      }),
  });

  // 통계 요약
  const { data: summaryData } = useQuery({
    queryKey: ['adminWithdrawalSummary'],
    queryFn: () => api.getAdminWithdrawalSummary(),
  });

  // 배치 생성
  const createBatchMutation = useMutation({
    mutationFn: (ids: string[]) => api.createWithdrawalBatch({ withdrawalIds: ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatches'] });
      const batchId = data.data?.batch?.id;
      alert(`배치가 생성되었습니다.\n포함: ${data.data?.included?.length || 0}건\n제외: ${data.data?.skipped?.length || 0}건`);
      setSelectedIds(new Set());
      if (batchId) {
        navigate(`/admin/finance/withdrawals/batches/${batchId}`);
      }
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error?.message || '배치 생성에 실패했습니다');
    },
  });

  const withdrawals = withdrawalsData?.data?.requests || [];
  const pagination = withdrawalsData?.data?.pagination;
  const summary = summaryData?.data;

  // APPROVED 상태에서만 체크박스 표시
  const showCheckbox = statusFilter === 'APPROVED';
  const approvedWithdrawals = withdrawals.filter((w: any) => w.status === 'APPROVED' && !w.batchId);

  const handleSelectAll = () => {
    if (selectedIds.size === approvedWithdrawals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvedWithdrawals.map((w: any) => w.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleCreateBatch = () => {
    if (selectedIds.size === 0) {
      alert('배치에 포함할 출금을 선택해주세요');
      return;
    }
    if (confirm(`선택한 ${selectedIds.size}건으로 배치를 생성하시겠습니까?`)) {
      createBatchMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const blob = await api.downloadWithdrawalsCsv({
        status: statusFilter || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `withdrawals-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('CSV 다운로드에 실패했습니다');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            출금 요청 관리
          </h1>
          <div className="flex gap-2">
            <Link
              to="/admin/finance/withdrawals/batches"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              배치 관리
            </Link>
            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              CSV 다운로드
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <p className="text-sm text-amber-600">요청중</p>
              <p className="text-2xl font-bold text-amber-700">{summary.requested?.count || 0}건</p>
              <p className="text-sm text-amber-600">
                {(summary.requested?.amount || 0).toLocaleString()}원
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-blue-600">승인 대기</p>
              <p className="text-2xl font-bold text-blue-700">{summary.approved?.count || 0}건</p>
              <p className="text-sm text-blue-600">
                {(summary.approved?.amount || 0).toLocaleString()}원
              </p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">거부됨</p>
              <p className="text-2xl font-bold text-red-700">{summary.rejected?.count || 0}건</p>
              <p className="text-sm text-red-600">
                {(summary.rejected?.amount || 0).toLocaleString()}원
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">지급완료</p>
              <p className="text-2xl font-bold text-emerald-700">{summary.paid?.count || 0}건</p>
              <p className="text-sm text-emerald-600">
                {(summary.paid?.amount || 0).toLocaleString()}원
              </p>
            </div>
          </div>
        )}

        {/* 상태 탭 */}
        <div className="bg-white rounded-lg border p-1 flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
                setSelectedIds(new Set());
              }}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 검색 + 배치 생성 */}
        <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-4 items-center">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="선수명, 은행, 예금주 검색..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          {showCheckbox && selectedIds.size > 0 && (
            <button
              onClick={handleCreateBatch}
              disabled={createBatchMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {createBatchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              배치 생성 ({selectedIds.size}건)
            </button>
          )}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">출금 요청이 없습니다</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {showCheckbox && (
                      <th className="px-4 py-3 text-left">
                        <button onClick={handleSelectAll} className="p-1">
                          {selectedIds.size === approvedWithdrawals.length && approvedWithdrawals.length > 0 ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">선수</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">금액</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      계좌 정보
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      요청일
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {withdrawals.map((w: any) => {
                    const statusInfo = STATUS_MAP[w.status] || STATUS_MAP.REQUESTED;
                    const StatusIcon = statusInfo.icon;
                    const canSelect = w.status === 'APPROVED' && !w.batchId;
                    const isSelected = selectedIds.has(w.id);

                    return (
                      <tr key={w.id} className={cn('hover:bg-gray-50', isSelected && 'bg-emerald-50')}>
                        {showCheckbox && (
                          <td className="px-4 py-3">
                            {canSelect ? (
                              <button onClick={() => handleSelect(w.id)} className="p-1">
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {w.batchId ? '배치' : '-'}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <p className="font-medium">{w.athlete?.name || '-'}</p>
                          <p className="text-sm text-gray-500">{w.athlete?.user?.email || ''}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {Number(w.amount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p>{w.bankName}</p>
                          <p className="text-gray-500">
                            {w.bankAccountMasked} ({w.accountHolder})
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit',
                              statusInfo.color
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/finance/withdrawals/${w.id}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center justify-end gap-1"
                          >
                            상세
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 페이지네이션 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="p-4 border-t flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-600">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
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

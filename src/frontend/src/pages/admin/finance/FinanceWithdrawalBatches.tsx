import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileDown,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../../utils';

const BATCH_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  CREATED: {
    label: '생성됨',
    color: 'bg-gray-100 text-gray-700',
    icon: Clock,
  },
  EXPORTED: {
    label: 'CSV 완료',
    color: 'bg-blue-100 text-blue-700',
    icon: FileDown,
  },
  COMPLETED: {
    label: '지급완료',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  CANCELED: {
    label: '취소됨',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
};

export default function FinanceWithdrawalBatches() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['withdrawalBatches', statusFilter, page],
    queryFn: () =>
      api.getWithdrawalBatches({
        status: statusFilter || undefined,
        page,
        pageSize: 20,
      }),
  });

  const batches = batchesData?.data?.batches || [];
  const pagination = batchesData?.data?.pagination;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            출금 배치 관리
          </h1>
          <Link
            to="/admin/finance/withdrawals"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            출금 목록으로
          </Link>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg border p-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">전체 상태</option>
            <option value="CREATED">생성됨</option>
            <option value="EXPORTED">CSV 완료</option>
            <option value="COMPLETED">지급완료</option>
            <option value="CANCELED">취소됨</option>
          </select>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center text-gray-500">배치가 없습니다</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">건수</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">총액</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">생성일</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">완료일</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batches.map((b: any) => {
                    const statusInfo = BATCH_STATUS_MAP[b.status] || BATCH_STATUS_MAP.CREATED;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-sm">{b.id.slice(-8)}</td>
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
                        <td className="px-4 py-3 text-right font-semibold">{b.itemCount}건</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {Number(b.totalAmount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {b.completedAt ? new Date(b.completedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/finance/withdrawals/batches/${b.id}`}
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

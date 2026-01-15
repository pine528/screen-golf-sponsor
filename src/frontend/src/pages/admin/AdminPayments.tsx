import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, RefreshCw, DollarSign, Receipt } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

const statusConfig: Record<string, { label: string; class: string }> = {
  PENDING: { label: '대기중', class: 'badge-warning' },
  COMPLETED: { label: '완료', class: 'badge-success' },
  FAILED: { label: '실패', class: 'badge-danger' },
  REFUNDED: { label: '환불', class: 'badge-info' },
  CANCELLED: { label: '취소', class: 'badge-info' },
};

const methodLabels: Record<string, string> = {
  CARD: '카드',
  BANK_TRANSFER: '계좌이체',
  VIRTUAL_ACCOUNT: '가상계좌',
};

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['adminPayments', { status: statusFilter, page }],
    queryFn: () => api.getPayments({ status: statusFilter || undefined, page, limit: 20 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['paymentStats'],
    queryFn: () => api.getPaymentStats(),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) => api.refundPayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || '환불 실패');
    },
  });

  const handleRefund = (payment: any) => {
    const confirmMsg = `${payment.amount.toLocaleString()}원을 환불하시겠습니까?`;
    if (confirm(confirmMsg)) {
      refundMutation.mutate({ id: payment.id });
    }
  };

  const payments = paymentsData?.data || [];
  const pagination = paymentsData?.pagination;
  const stats = statsData?.data;

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
          <p className="text-slate-600 mt-1">결제 내역을 조회하고 관리하세요</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">총 결제금액</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(stats.totalAmount || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">총 결제건수</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalCount || 0}건</p>
                </div>
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-sky-600" />
                </div>
              </div>
            </div>
            {stats.byMethod?.slice(0, 2).map((m: any) => (
              <div key={m.method} className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{methodLabels[m.method] || m.method}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {formatCurrency(m.amount || 0)}
                    </p>
                    <p className="text-xs text-slate-500">{m.count}건</p>
                  </div>
                  <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-violet-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <option value="PENDING">대기중</option>
              <option value="COMPLETED">완료</option>
              <option value="FAILED">실패</option>
              <option value="REFUNDED">환불</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="card overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  결제 ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  브랜드
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
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                        <CreditCard className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500">결제 내역이 없습니다</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">
                      {payment.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-900">
                        {payment.brand?.name || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      {payment.refundAmount && (
                        <p className="text-xs text-red-600">
                          환불: {formatCurrency(payment.refundAmount)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {methodLabels[payment.method] || payment.method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('badge', statusConfig[payment.status]?.class || 'badge-info')}>
                        {statusConfig[payment.status]?.label || payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleString()
                        : new Date(payment.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {payment.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleRefund(payment)}
                          disabled={refundMutation.isPending}
                          className="btn btn-ghost text-red-600 hover:text-red-700 p-2"
                          title="환불"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                총 {pagination.total}건 중 {(page - 1) * 20 + 1} -{' '}
                {Math.min(page * 20, pagination.total)}건
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
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
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

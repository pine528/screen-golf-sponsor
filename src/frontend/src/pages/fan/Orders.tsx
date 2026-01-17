import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { cn } from '../../utils';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: {
    label: '처리중',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
  FULFILLED: {
    label: '완료',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  CANCELED: {
    label: '취소됨',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
};

export default function Orders() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['myRedemptionOrders', page, statusFilter],
    queryFn: () =>
      api.getMyRedemptionOrders({
        page,
        pageSize,
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => api.cancelRedemptionOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRedemptionOrders'] });
      queryClient.invalidateQueries({ queryKey: ['pointBalance'] });
    },
  });

  const orders = data?.data?.orders || [];
  const pagination = data?.data?.pagination;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: string | number) => {
    return Number(num).toLocaleString();
  };

  const handleCancel = (orderId: string) => {
    if (confirm('정말 취소하시겠습니까? 사용한 포인트가 환불됩니다.')) {
      cancelMutation.mutate(orderId);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">교환 내역</h1>
            <p className="text-slate-500 mt-1">포인트로 교환한 상품 내역입니다</p>
          </div>
          <Link
            to="/shop"
            className="btn btn-primary flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            상품 둘러보기
          </Link>
        </div>

        {/* Filter */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <span className="text-slate-600 text-sm">상태 필터:</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === ''
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                전체
              </button>
              {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => {
                    setStatusFilter(key);
                    setPage(1);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    statusFilter === key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 mb-4">교환 내역이 없습니다</p>
            <Link to="/shop" className="btn btn-primary">
              상품 둘러보기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const status = STATUS_MAP[order.status] || STATUS_MAP.REQUESTED;
              const StatusIcon = status.icon;

              return (
                <div
                  key={order.id}
                  className="card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                      {order.item?.imageUrl ? (
                        <img
                          src={order.item.imageUrl}
                          alt={order.item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {order.item?.title || '삭제된 상품'}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span>수량: {order.quantity}개</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">
                              {formatNumber(order.totalPoints)}P
                            </span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                            status.color
                          )}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>

                      {/* Shipping Info */}
                      {order.shippingName && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                          <Truck className="w-3 h-3" />
                          {order.shippingName} / {order.shippingPhone} /{' '}
                          {order.shippingAddress1}
                          {order.shippingAddress2 && ` ${order.shippingAddress2}`}
                        </div>
                      )}

                      {/* Memo */}
                      {order.memo && (
                        <div className="mt-2 text-xs text-slate-500">
                          메모: {order.memo}
                        </div>
                      )}

                      {/* Date & Actions */}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-slate-400">
                          {formatDate(order.createdAt)}
                        </span>

                        {order.status === 'REQUESTED' && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            {cancelMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            취소
                          </button>
                        )}

                        {order.status === 'FULFILLED' && order.fulfilledAt && (
                          <span className="text-xs text-emerald-600">
                            완료: {formatDate(order.fulfilledAt)}
                          </span>
                        )}

                        {order.status === 'CANCELED' && order.canceledAt && (
                          <span className="text-xs text-red-500">
                            취소: {formatDate(order.canceledAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
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
          </div>
        )}

        {/* Cancel Error */}
        {cancelMutation.isError && (
          <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-2 shadow-lg">
            <AlertCircle className="w-5 h-5" />
            {(cancelMutation.error as any)?.response?.data?.error ||
              '취소에 실패했습니다'}
          </div>
        )}
      </div>
    </Layout>
  );
}

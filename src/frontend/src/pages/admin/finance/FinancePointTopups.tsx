import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';
import { Coins, RefreshCw, AlertCircle } from 'lucide-react';

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR');
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELED: 'bg-gray-100 text-gray-600',
  REFUNDED: 'bg-purple-100 text-purple-800',
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: '생성됨',
  PENDING: '대기중',
  PAID: '완료',
  FAILED: '실패',
  CANCELED: '취소됨',
  REFUNDED: '환불됨',
};

const PROVIDER_LABELS: Record<string, string> = {
  TOSS: '토스',
  STRIPE: '스트라이프',
  MOCK: '테스트',
};

export default function FinancePointTopups() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);

  const [status, setStatus] = useState(searchParams.get('status') || '');

  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  useEffect(() => {
    loadTopups();
    loadStats();
  }, [searchParams]);

  const loadTopups = async () => {
    setLoading(true);
    try {
      const params: any = {
        take: limit,
        skip: (page - 1) * limit,
      };
      if (searchParams.get('status')) params.status = searchParams.get('status');

      const res = await api.getAdminPointTopups(params);
      if (res.success) {
        setItems(res.data?.items || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load point topups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.getAdminPointTopupStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to load point topup stats:', error);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const handleRefund = async (id: string) => {
    if (!confirm('정말 이 충전건을 환불 처리하시겠습니까?')) return;

    setRefundingId(id);
    setRefundError(null);
    try {
      const res = await api.adminRefundPointTopup(id, '관리자 환불 처리');
      if (res.success) {
        loadTopups();
        loadStats();
      } else {
        setRefundError(res.error || '환불 처리에 실패했습니다.');
      }
    } catch (error: any) {
      setRefundError(error.response?.data?.error || '환불 처리에 실패했습니다.');
    } finally {
      setRefundingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">포인트 충전 관리</h1>
            <p className="text-sm text-gray-500">팬/선수 포인트 충전 내역을 관리합니다</p>
          </div>
        </div>

        {refundError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{refundError}</span>
            <button onClick={() => setRefundError(null)} className="ml-auto text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">총 충전 건수</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalCount || 0)}건</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">완료된 충전</div>
              <div className="text-2xl font-bold text-green-600">{formatNumber(stats.paidCount || 0)}건</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">총 충전 포인트</div>
              <div className="text-2xl font-bold text-amber-600">{formatNumber(stats.totalPoints || 0)}P</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">총 충전 금액</div>
              <div className="text-2xl font-bold text-blue-600">₩{formatNumber(stats.totalAmount || 0)}</div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">전체</option>
                <option value="CREATED">생성됨</option>
                <option value="PENDING">대기중</option>
                <option value="PAID">완료</option>
                <option value="FAILED">실패</option>
                <option value="CANCELED">취소됨</option>
                <option value="REFUNDED">환불됨</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                검색
              </button>
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제수단</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">포인트</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">결제금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료일</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {item.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-900">{item.user?.email || '-'}</div>
                          <div className="text-xs text-gray-500">{item.userId?.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.status]}`}>
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {PROVIDER_LABELS[item.provider] || item.provider || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">
                          {formatNumber(item.points || 0)}P
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ₩{formatNumber(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.paidAt ? formatDate(item.paidAt) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.status === 'PAID' && (
                            <button
                              onClick={() => handleRefund(item.id)}
                              disabled={refundingId === item.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            >
                              {refundingId === item.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              환불
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          포인트 충전 내역이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    총 {total}건
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      이전
                    </button>
                    <span className="px-3 py-1">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

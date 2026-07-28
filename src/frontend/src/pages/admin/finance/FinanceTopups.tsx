import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';

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
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: '생성됨',
  PENDING: '대기중',
  PAID: '완료',
  FAILED: '실패',
  CANCELED: '취소됨',
};

const PROVIDER_LABELS: Record<string, string> = {
  TOSS: '토스',
  STRIPE: '스트라이프',
  MOCK: '테스트',
};

export default function FinanceTopups() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);

  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [provider, setProvider] = useState(searchParams.get('provider') || '');

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
        limit,
        offset: (page - 1) * limit,
      };
      if (searchParams.get('status')) params.status = searchParams.get('status');
      if (searchParams.get('provider')) params.provider = searchParams.get('provider');

      const res = await api.getAdminTopups(params);
      if (res.success) {
        setItems(res.data?.items || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load topups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.getAdminTopupStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to load topup stats:', error);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (provider) params.set('provider', provider);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">브랜드 충전 내역</h1>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">총 충전 건수</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(stats.count)}건</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">총 충전 금액</div>
              <div className="text-2xl font-bold text-emerald-600">₩{formatNumber(stats.totalAmount || 0)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">평균 충전 금액</div>
              <div className="text-2xl font-bold text-blue-600">₩{formatNumber(stats.avgAmount || 0)}</div>
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
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">결제수단</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">전체</option>
                <option value="TOSS">토스</option>
                <option value="STRIPE">스트라이프</option>
                <option value="MOCK">테스트</option>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜드ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제수단</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료일</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {item.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {item.brandId?.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.status]}`}>
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {PROVIDER_LABELS[item.provider] || item.provider}
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
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          충전 내역이 없습니다.
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

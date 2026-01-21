import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기중',
  PROCESSING: '처리중',
  COMPLETED: '완료',
  FAILED: '실패',
};

export default function FinancePayouts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [status, setStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    loadBatches();
  }, [searchParams]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: 20,
      };
      if (searchParams.get('status')) params.status = searchParams.get('status');

      const res = await api.getFinancePayoutBatches(params);
      if (res.success) {
        setBatches(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load payout batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  };

  return (
    <Layout>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">정산 배치 관리</h1>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">전체</option>
              <option value="PENDING">대기중</option>
              <option value="PROCESSING">처리중</option>
              <option value="COMPLETED">완료</option>
              <option value="FAILED">실패</option>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">항목 수</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">처리일</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      onClick={() => navigate(`/admin/finance/payouts/${batch.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">
                        {batch.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[batch.status]}`}>
                          {STATUS_LABELS[batch.status] || batch.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {batch.itemCount}건
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        ₩{formatNumber(batch.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {batch.processedAt ? formatDate(batch.processedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        정산 배치가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  총 {pagination.total}건
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
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

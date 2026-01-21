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
  HELD: 'bg-yellow-100 text-yellow-800',
  RELEASED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-red-100 text-red-800',
};

export default function FinanceEscrows() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // 필터 상태
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
  const [toDate, setToDate] = useState(searchParams.get('to') || '');

  useEffect(() => {
    loadEscrows();
  }, [searchParams]);

  const loadEscrows = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: 20,
      };
      if (searchParams.get('status')) params.status = searchParams.get('status');
      if (searchParams.get('q')) params.q = searchParams.get('q');
      if (searchParams.get('from')) params.from = searchParams.get('from');
      if (searchParams.get('to')) params.to = searchParams.get('to');

      const res = await api.getFinanceEscrows(params);
      if (res.success) {
        setEscrows(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load escrows:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('q', search);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setStatus('');
    setSearch('');
    setFromDate('');
    setToDate('');
    setSearchParams({});
  };

  const handleDownloadCsv = async () => {
    try {
      const params: any = {};
      if (status) params.status = status;
      if (search) params.q = search;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const blob = await api.downloadEscrowsCsv(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `escrows_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('CSV 다운로드에 실패했습니다.');
    }
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  };

  return (
    <Layout>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">에스크로 관리</h1>
        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          CSV 다운로드
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">전체</option>
              <option value="HELD">HELD</option>
              <option value="RELEASED">RELEASED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="계약/브랜드/선수 ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              검색
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              초기화
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계약 ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜드</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">선수</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총액</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">선수 정산</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {escrows.map((escrow) => (
                    <tr
                      key={escrow.id}
                      onClick={() => navigate(`/admin/finance/escrows/${escrow.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[escrow.status]}`}>
                          {escrow.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">
                        {escrow.contractId.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {escrow.contract?.brand?.name || escrow.brandId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {escrow.contract?.athlete?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        ₩{formatNumber(escrow.grossAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        ₩{formatNumber(escrow.athletePayout)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(escrow.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {escrows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        에스크로가 없습니다.
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
                  총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)}
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

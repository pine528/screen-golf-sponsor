import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../services/api';

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR');
}

const OWNER_TYPE_LABELS: Record<string, string> = {
  BRAND: '브랜드',
  ATHLETE: '선수',
  PLATFORM: '플랫폼',
};

const OWNER_TYPE_COLORS: Record<string, string> = {
  BRAND: 'bg-purple-100 text-purple-800',
  ATHLETE: 'bg-green-100 text-green-800',
  PLATFORM: 'bg-blue-100 text-blue-800',
};

export default function FinanceWallets() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [ownerType, setOwnerType] = useState(searchParams.get('ownerType') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');

  useEffect(() => {
    loadWallets();
  }, [searchParams]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: 20,
      };
      if (searchParams.get('ownerType')) params.ownerType = searchParams.get('ownerType');
      if (searchParams.get('q')) params.q = searchParams.get('q');

      const res = await api.getFinanceWallets(params);
      if (res.success) {
        setWallets(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (ownerType) params.set('ownerType', ownerType);
    if (search) params.set('q', search);
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setOwnerType('');
    setSearch('');
    setSearchParams({});
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  };

  const getOwnerName = (wallet: any) => {
    if (wallet.ownerType === 'PLATFORM') return 'SYSTEM';
    if (wallet.brand) return wallet.brand.name;
    if (wallet.athlete) return wallet.athlete.name;
    return wallet.ownerId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">지갑 관리</h1>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
            <select
              value={ownerType}
              onChange={(e) => setOwnerType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">전체</option>
              <option value="BRAND">브랜드</option>
              <option value="ATHLETE">선수</option>
              <option value="PLATFORM">플랫폼</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="소유자 ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end space-x-2 md:col-span-2">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소유자</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">잔액</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">동결 금액</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">가용 잔액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">최종 업데이트</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {wallets.map((wallet) => {
                    const balance = parseFloat(wallet.balance);
                    const frozen = parseFloat(wallet.frozenAmount);
                    const available = balance - frozen;
                    return (
                      <tr
                        key={wallet.id}
                        onClick={() => navigate(`/admin/finance/wallets/${wallet.id}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${OWNER_TYPE_COLORS[wallet.ownerType]}`}>
                            {OWNER_TYPE_LABELS[wallet.ownerType] || wallet.ownerType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {getOwnerName(wallet)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {wallet.ownerId.slice(0, 12)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ₩{formatNumber(wallet.balance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">
                          {frozen > 0 ? `₩${formatNumber(wallet.frozenAmount)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                          ₩{formatNumber(available)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(wallet.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                  {wallets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        지갑이 없습니다.
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
  );
}

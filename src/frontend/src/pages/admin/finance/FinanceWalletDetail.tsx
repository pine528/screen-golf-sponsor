import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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

const LEDGER_TYPE_COLORS: Record<string, string> = {
  CREDIT: 'bg-green-100 text-green-800',
  DEBIT: 'bg-red-100 text-red-800',
};

export default function FinanceWalletDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');

  useEffect(() => {
    if (id) {
      loadLedger();
    }
  }, [id, searchParams]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: 20,
      };
      if (searchParams.get('type')) params.type = searchParams.get('type');

      const res = await api.getFinanceWalletLedger(id!, params);
      if (res.success) {
        setWallet(res.data.wallet);
        setTransactions(res.data.transactions || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleDownloadCsv = async () => {
    try {
      const params: any = {};
      if (typeFilter) params.type = typeFilter;

      const blob = await api.downloadWalletLedgerCsv(id!, params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_${wallet?.ownerType}_${new Date().toISOString().slice(0, 10)}.csv`;
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

  const getOwnerName = () => {
    if (!wallet) return '';
    if (wallet.ownerType === 'PLATFORM') return 'SYSTEM';
    if (wallet.brand) return wallet.brand.name;
    if (wallet.athlete) return wallet.athlete.name;
    return wallet.ownerId;
  };

  if (loading && !wallet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">지갑을 찾을 수 없습니다.</p>
        <Link to="/admin/finance/wallets" className="text-blue-600 hover:underline mt-2 inline-block">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const balance = parseFloat(wallet.balance);
  const frozen = parseFloat(wallet.frozenAmount);
  const available = balance - frozen;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <Link to="/admin/finance/wallets" className="text-blue-600 hover:underline text-sm">
            ← 지갑 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">지갑 상세</h1>
        </div>
        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          CSV 다운로드
        </button>
      </div>

      {/* 지갑 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-500">유형</div>
            <div className="font-medium">{OWNER_TYPE_LABELS[wallet.ownerType] || wallet.ownerType}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">소유자</div>
            <div className="font-medium">{getOwnerName()}</div>
            <div className="text-xs text-gray-400 font-mono">{wallet.ownerId}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">버전</div>
            <div className="font-medium">{wallet.version}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">최종 업데이트</div>
            <div className="text-sm">{formatDate(wallet.updatedAt)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">총 잔액</div>
            <div className="text-2xl font-bold">₩{formatNumber(balance)}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">동결 금액</div>
            <div className="text-2xl font-bold text-orange-600">₩{formatNumber(frozen)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">가용 잔액</div>
            <div className="text-2xl font-bold text-green-600">₩{formatNumber(available)}</div>
          </div>
        </div>
      </div>

      {/* 원장 내역 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">거래 내역</h2>
          <div className="flex space-x-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
            >
              <option value="">전체</option>
              <option value="CREDIT">입금</option>
              <option value="DEBIT">출금</option>
            </select>
            <button
              onClick={applyFilters}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              필터
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">잔액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참조</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${LEDGER_TYPE_COLORS[tx.type]}`}>
                          {tx.type === 'CREDIT' ? '입금' : '출금'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}₩{formatNumber(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        ₩{formatNumber(tx.balanceAfter)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{tx.refType || '-'}</div>
                        {tx.refId && (
                          <div className="text-xs font-mono text-gray-400">
                            {tx.refId.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        거래 내역이 없습니다.
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

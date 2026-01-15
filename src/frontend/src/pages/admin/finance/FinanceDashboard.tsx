import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';

// 숫자 포맷 헬퍼
function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const res = await api.getFinanceSummary();
      if (res.success) {
        setSummary(res.data);
      }
    } catch (error) {
      console.error('Failed to load finance summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const escrowByStatus = summary?.escrows?.byStatus || [];
  const walletsByType = summary?.wallets || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">재무 콘솔</h1>
        <div className="text-sm text-gray-500">
          오늘 에스크로: {summary?.escrows?.todayCount || 0}건
        </div>
      </div>

      {/* 에스크로 현황 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">에스크로 현황</h2>
          <Link to="/admin/finance/escrows" className="text-blue-600 hover:underline text-sm">
            전체 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['HELD', 'RELEASED', 'REFUNDED'].map((status) => {
            const stat = escrowByStatus.find((s: any) => s.status === status) || { count: 0, totalAmount: '0' };
            const colors: Record<string, string> = {
              HELD: 'bg-yellow-50 border-yellow-200 text-yellow-800',
              RELEASED: 'bg-green-50 border-green-200 text-green-800',
              REFUNDED: 'bg-red-50 border-red-200 text-red-800',
            };
            return (
              <div key={status} className={`p-4 rounded-lg border ${colors[status]}`}>
                <div className="text-sm font-medium">{status}</div>
                <div className="text-2xl font-bold mt-1">{stat.count}건</div>
                <div className="text-sm mt-1">₩{formatNumber(stat.totalAmount)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 지갑 현황 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">지갑 현황</h2>
          <Link to="/admin/finance/wallets" className="text-blue-600 hover:underline text-sm">
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">개수</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총 잔액</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총 동결</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {walletsByType.map((w: any) => (
                <tr key={w.ownerType}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{w.ownerType}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{w.count}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">₩{formatNumber(w.totalBalance)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">₩{formatNumber(w.totalFrozen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 정산 현황 + 수동 처리 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">정산 현황</h2>
            <Link to="/admin/finance/payouts" className="text-blue-600 hover:underline text-sm">
              전체 보기 →
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-600">대기 중인 배치</div>
              <div className="text-2xl font-bold text-orange-800">
                {summary?.payouts?.pendingBatches || 0}건
              </div>
            </div>
          </div>
        </div>

        {/* 오늘 수동 처리 건수 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">오늘 수동 처리</h2>
          <div className="flex items-center space-x-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600">수동 액션</div>
              <div className="text-2xl font-bold text-gray-800">
                {summary?.manualActions?.todayCount || 0}건
              </div>
            </div>
            <div className="text-sm text-gray-500">
              릴리즈/환불/취소 등<br />
              운영자가 직접 처리한 건
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link
          to="/admin/finance/reports"
          className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow p-4 hover:shadow-md transition-shadow text-white"
        >
          <div className="text-sm text-blue-100">운영 리포트</div>
          <div className="text-lg font-semibold">분석 보기 →</div>
        </Link>
        <Link
          to="/admin/finance/escrows?status=HELD"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">HELD 에스크로</div>
          <div className="text-lg font-semibold text-yellow-600">
            {escrowByStatus.find((s: any) => s.status === 'HELD')?.count || 0}건
          </div>
        </Link>
        <Link
          to="/admin/finance/wallets?ownerType=PLATFORM"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">플랫폼 지갑</div>
          <div className="text-lg font-semibold text-blue-600">조회</div>
        </Link>
        <Link
          to="/admin/finance/wallets?ownerType=BRAND"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">브랜드 지갑</div>
          <div className="text-lg font-semibold text-purple-600">
            {walletsByType.find((w: any) => w.ownerType === 'BRAND')?.count || 0}개
          </div>
        </Link>
        <Link
          to="/admin/finance/wallets?ownerType=ATHLETE"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">선수 지갑</div>
          <div className="text-lg font-semibold text-green-600">
            {walletsByType.find((w: any) => w.ownerType === 'ATHLETE')?.count || 0}개
          </div>
        </Link>
      </div>
    </div>
  );
}

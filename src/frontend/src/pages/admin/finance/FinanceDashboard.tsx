import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';

// 숫자 포맷 헬퍼
function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [withdrawalMetrics, setWithdrawalMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryRes, metricsRes] = await Promise.all([
        api.getFinanceSummary(),
        api.getWithdrawalMetrics(),
      ]);
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }
      if (metricsRes.success) {
        setWithdrawalMetrics(metricsRes.data);
      }
    } catch (error) {
      console.error('Failed to load finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  const escrowByStatus = summary?.escrows?.byStatus || [];
  const walletsByType = summary?.wallets || [];

  return (
    <Layout>
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

      {/* 출금 현황 */}
      {withdrawalMetrics && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">출금 현황</h2>
            <Link to="/admin/finance/withdrawals" className="text-blue-600 hover:underline text-sm">
              전체 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 오늘 출금 요청 */}
            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <div className="text-sm text-blue-600">오늘 출금 요청</div>
              <div className="text-2xl font-bold text-blue-800">
                {withdrawalMetrics.today?.requested?.count || 0}건
              </div>
              <div className="text-sm text-blue-600">
                ₩{formatNumber(withdrawalMetrics.today?.requested?.amount || 0)}
              </div>
            </div>

            {/* 지급 대기 (승인됨) */}
            <div className="p-4 rounded-lg border bg-orange-50 border-orange-200">
              <div className="text-sm text-orange-600">지급 대기 (승인)</div>
              <div className="text-2xl font-bold text-orange-800">
                {withdrawalMetrics.pending?.approved?.count || 0}건
              </div>
              <div className="text-sm text-orange-600">
                ₩{formatNumber(withdrawalMetrics.pending?.approved?.amount || 0)}
              </div>
            </div>

            {/* 오늘 지급 완료 */}
            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="text-sm text-green-600">오늘 지급 완료</div>
              <div className="text-2xl font-bold text-green-800">
                {withdrawalMetrics.today?.paid?.count || 0}건
              </div>
              <div className="text-sm text-green-600">
                ₩{formatNumber(withdrawalMetrics.today?.paid?.amount || 0)}
              </div>
            </div>

            {/* 처리 실패 (24h) */}
            <div className={`p-4 rounded-lg border ${
              (withdrawalMetrics.failed?.last24h || 0) > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-sm ${
                (withdrawalMetrics.failed?.last24h || 0) > 0 ? 'text-red-600' : 'text-gray-600'
              }`}>처리 실패 (24h)</div>
              <div className={`text-2xl font-bold ${
                (withdrawalMetrics.failed?.last24h || 0) > 0 ? 'text-red-800' : 'text-gray-800'
              }`}>
                {withdrawalMetrics.failed?.last24h || 0}건
              </div>
              <div className="text-sm text-gray-500">
                배치 대기: {(withdrawalMetrics.batch?.pendingExport || 0) + (withdrawalMetrics.batch?.pendingComplete || 0)}건
              </div>
            </div>
          </div>

          {/* 추가 통계 */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">총 동결금액:</span>{' '}
              ₩{formatNumber(withdrawalMetrics.totalFrozenAmount || 0)}
            </div>
            <div>
              <span className="font-medium">평균 승인 소요:</span>{' '}
              {withdrawalMetrics.avgApprovalDays?.toFixed(1) || '0'}일
            </div>
            <div>
              <span className="font-medium">승인 대기:</span>{' '}
              {withdrawalMetrics.pending?.requested?.count || 0}건
            </div>
            <div>
              <span className="font-medium">오늘 배치:</span>{' '}
              생성 {withdrawalMetrics.batch?.todayCreated || 0} / 완료 {withdrawalMetrics.batch?.todayCompleted || 0}
            </div>
          </div>
        </div>
      )}

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
    </Layout>
  );
}

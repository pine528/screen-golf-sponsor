import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';
import { Layout } from '../../../components/Layout';

// 숫자 포맷 헬퍼
function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

type RangeType = 'TODAY' | '7D' | '30D' | 'MTD' | 'QTD' | 'YTD';

const RANGE_OPTIONS: { value: RangeType; label: string }[] = [
  { value: 'TODAY', label: '오늘' },
  { value: '7D', label: '7일' },
  { value: '30D', label: '30일' },
  { value: 'MTD', label: '이달' },
  { value: 'QTD', label: '이번 분기' },
  { value: 'YTD', label: '올해' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 border-red-500 text-red-800',
  high: 'bg-orange-100 border-orange-500 text-orange-800',
  medium: 'bg-yellow-100 border-yellow-500 text-yellow-800',
  low: 'bg-blue-100 border-blue-500 text-blue-800',
};

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  contractsCreated: '계약 생성',
  fullySigned: '양측 서명 완료',
  escrowHeld: '에스크로 HELD',
  assetSubmitted: '에셋 제출',
  assetApproved: '에셋 승인',
  verificationSubmitted: '검증 제출',
  verificationVerified: '검증 완료',
  released: '릴리즈',
  refunded: '환불',
};

interface Anomaly {
  type: string;
  severity: string;
  title: string;
  detail: string;
  value: number;
  threshold: number;
}

interface OverviewData {
  range: string;
  period: { start: string; end: string };
  totals: {
    grossHeldTotal: string;
    grossReleasedTotal: string;
    grossRefundedTotal: string;
    platformFeeTotal: string;
    athletePayoutTotal: string;
    refundRate: string;
  };
  counts: {
    heldCount: number;
    releasedCount: number;
    refundedCount: number;
    manualActionCount: number;
  };
  backlogs: {
    pendingAssets: number;
    pendingVerifications: number;
    pendingTotal: number;
    heldOver24hCount: number;
    heldOver7dCount: number;
  };
}

interface TimeseriesData {
  range: string;
  metric: string;
  bucket: string;
  data: Array<{ t: string; value: string | number }>;
}

interface FunnelStage {
  stage: string;
  count: number;
  rate: string;
}

// Simple Bar Chart Component
function SimpleBarChart({ data, label }: { data: Array<{ t: string; value: string | number }>; label: string }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500 py-8">데이터 없음</div>;
  }

  const values = data.map(d => {
    const v = typeof d.value === 'string' ? parseFloat(d.value) : d.value;
    return isNaN(v) ? 0 : v;
  });
  const maxValue = Math.max(...values, 1);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700 mb-4">{label}</div>
      <div className="flex items-end h-40 gap-1">
        {data.map((d, i) => {
          const value = values[i];
          const height = (value / maxValue) * 100;
          const dateStr = new Date(d.t).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-default"
                style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
              />
              <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {dateStr}
              </div>
              <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {formatNumber(value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsDashboard() {
  const [range, setRange] = useState<RangeType>('7D');
  const [metric, setMetric] = useState('gross');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, [range, metric]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, timeseriesRes, funnelRes, anomaliesRes] = await Promise.all([
        api.getReportsOverview({ range }),
        api.getReportsTimeseries({ range, metric }),
        api.getReportsFunnel({ range }),
        api.getReportsAnomalies({ range }),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (timeseriesRes.success) setTimeseries(timeseriesRes.data);
      if (funnelRes.success) setFunnel(funnelRes.data.funnel || []);
      if (anomaliesRes.success) setAnomalies(anomaliesRes.data.alerts || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      const blob = await api.downloadReportsCsv({ range });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
    } finally {
      setDownloading(false);
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

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운영 리포트</h1>
          <p className="text-sm text-gray-500 mt-1">
            기간: {overview?.period?.start?.slice(0, 10)} ~ {overview?.period?.end?.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Range Selector */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeType)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* CSV Download */}
          <button
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {downloading ? '다운로드 중...' : 'CSV 다운로드'}
          </button>
        </div>
      </div>

      {/* Anomalies Panel (if any) */}
      {anomalies.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <h2 className="text-lg font-semibold text-red-700 mb-3">이상징후 감지 ({anomalies.length}건)</h2>
          <div className="space-y-2">
            {anomalies.map((alert, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border-l-4 ${SEVERITY_COLORS[alert.severity]}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm mt-1">{alert.detail}</div>
                  </div>
                  <span className="text-xs font-semibold uppercase px-2 py-1 rounded bg-white bg-opacity-50">
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">총 릴리즈 금액</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            ₩{formatNumber(overview?.totals?.grossReleasedTotal || 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {overview?.counts?.releasedCount || 0}건
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">플랫폼 수수료</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            ₩{formatNumber(overview?.totals?.platformFeeTotal || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">환불 금액</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            ₩{formatNumber(overview?.totals?.grossRefundedTotal || 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {overview?.counts?.refundedCount || 0}건 ({overview?.totals?.refundRate || '0'}%)
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">HELD 잔액</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            ₩{formatNumber(overview?.totals?.grossHeldTotal || 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {overview?.counts?.heldCount || 0}건
          </div>
        </div>
      </div>

      {/* Backlog Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">대기 리뷰</div>
          <div className="text-xl font-semibold text-gray-800 mt-1">
            {overview?.backlogs?.pendingTotal || 0}건
          </div>
          <div className="text-xs text-gray-400">
            에셋 {overview?.backlogs?.pendingAssets || 0} / 검증 {overview?.backlogs?.pendingVerifications || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">HELD 24h+</div>
          <div className="text-xl font-semibold text-orange-600 mt-1">
            {overview?.backlogs?.heldOver24hCount || 0}건
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">HELD 7d+</div>
          <div className="text-xl font-semibold text-red-600 mt-1">
            {overview?.backlogs?.heldOver7dCount || 0}건
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">수동 처리</div>
          <div className="text-xl font-semibold text-purple-600 mt-1">
            {overview?.counts?.manualActionCount || 0}건
          </div>
        </div>
        <Link
          to="/admin/finance/escrows?status=HELD"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">HELD 관리</div>
          <div className="text-blue-600 font-medium mt-1">바로가기 →</div>
        </Link>
      </div>

      {/* Timeseries Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">추이 차트</h2>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gross">릴리즈 금액</option>
            <option value="fee">플랫폼 수수료</option>
            <option value="payout">선수 지급액</option>
            <option value="refundCount">환불 건수</option>
            <option value="heldCount">HELD 건수</option>
            <option value="releasedCount">릴리즈 건수</option>
            <option value="manualActions">수동 처리</option>
          </select>
        </div>
        <SimpleBarChart
          data={timeseries?.data || []}
          label={`${metric} (${timeseries?.bucket === 'hour' ? '시간별' : '일별'})`}
        />
      </div>

      {/* Funnel Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">전환 퍼널</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">단계</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">건수</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">전환율</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시각화</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {funnel.map((stage, i) => {
                const prevCount = i > 0 ? funnel[0].count : stage.count;
                const widthPercent = prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
                const isRefund = stage.stage === 'refunded';
                return (
                  <tr key={stage.stage} className={isRefund ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {FUNNEL_STAGE_LABELS[stage.stage] || stage.stage}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {stage.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {stage.rate}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${isRefund ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(widthPercent, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/admin/finance"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">재무 콘솔</div>
          <div className="text-blue-600 font-medium">대시보드 →</div>
        </Link>
        <Link
          to="/admin/finance/escrows"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">에스크로</div>
          <div className="text-blue-600 font-medium">전체 목록 →</div>
        </Link>
        <Link
          to="/admin/finance/wallets"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">지갑</div>
          <div className="text-blue-600 font-medium">전체 목록 →</div>
        </Link>
        <Link
          to="/admin/finance/payouts"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">정산</div>
          <div className="text-blue-600 font-medium">배치 목록 →</div>
        </Link>
      </div>
    </div>
    </Layout>
  );
}

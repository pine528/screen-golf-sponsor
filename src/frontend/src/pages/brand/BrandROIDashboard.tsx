import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  TrendingUp,
  Eye,
  BarChart3,
  Loader2,
  Filter,
  FileText,
  Timer,
  CheckCircle,
  ExternalLink,
  Video,
} from 'lucide-react';

export default function BrandROIDashboard() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // 내 캠페인 목록 조회
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['my-campaigns'],
    queryFn: () => api.get('/campaigns/my'),
  });

  // 선택된 캠페인의 ROI 대시보드 조회
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['campaign-roi-dashboard', selectedCampaignId],
    queryFn: () => api.get(`/roi/campaigns/${selectedCampaignId}/dashboard`),
    enabled: !!selectedCampaignId,
  });

  // 선택된 캠페인의 노출 통계 조회
  const { data: exposureStatsData } = useQuery({
    queryKey: ['campaign-exposure-stats', selectedCampaignId],
    queryFn: () => api.get(`/roi/campaigns/${selectedCampaignId}/exposures`, { limit: 10, isValid: true }),
    enabled: !!selectedCampaignId,
  });

  const campaigns = campaignsData?.data || [];
  const dashboard = dashboardData?.data;
  const exposures = exposureStatsData?.data?.items || [];

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0초';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  if (campaignsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ROI 대시보드</h1>
              <p className="text-sm text-slate-500">AI 로고 검출 기반 노출 성과 분석</p>
            </div>
          </div>
        </div>

        {/* Campaign Selector */}
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="input w-80"
            >
              <option value="">캠페인을 선택하세요</option>
              {campaigns.map((campaign: any) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            {selectedCampaignId && (
              <Link
                to={`/brand/campaigns/${selectedCampaignId}/reports`}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                리포트 페이지
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {!selectedCampaignId ? (
          <div className="card p-12 text-center">
            <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">캠페인을 선택하세요</h3>
            <p className="text-slate-500">ROI 데이터를 보려면 위에서 캠페인을 선택해주세요</p>
          </div>
        ) : dashboardLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">총 노출 횟수</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(dashboard?.totalExposures || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">유효 노출</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(dashboard?.validExposures || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Timer className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">총 노출 시간</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatDuration(dashboard?.totalDuration || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">평균 신뢰도</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {((dashboard?.avgConfidence || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Slot Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  슬롯별 노출 현황
                </h2>
                {dashboard?.slotStats && Object.keys(dashboard.slotStats).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(dashboard.slotStats).map(([slot, stats]: [string, any]) => {
                      const maxCount = Math.max(
                        ...Object.values(dashboard.slotStats).map((s: any) => s.count)
                      );
                      const percentage = maxCount > 0 ? Math.round((stats.count / maxCount) * 100) : 0;

                      return (
                        <div key={slot}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">
                              {slot === 'UNKNOWN' ? '미분류' : slot}
                            </span>
                            <span className="text-sm text-slate-500">
                              {stats.count}회 · {formatDuration(stats.duration)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>슬롯별 데이터가 없습니다</p>
                  </div>
                )}
              </div>

              {/* Review Status */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  검수 현황
                </h2>
                {dashboard?.reviewStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <span className="text-sm font-medium text-amber-700">검토 대기</span>
                      <span className="text-xl font-bold text-amber-700">
                        {dashboard.reviewStatus.pending || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <span className="text-sm font-medium text-emerald-700">승인됨</span>
                      <span className="text-xl font-bold text-emerald-700">
                        {dashboard.reviewStatus.approved || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-sm font-medium text-red-700">거부됨</span>
                      <span className="text-xl font-bold text-red-700">
                        {dashboard.reviewStatus.rejected || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>검수 데이터가 없습니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Exposures */}
            {exposures.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">최근 승인된 노출</h2>
                  <Link
                    to={`/brand/campaigns/${selectedCampaignId}/evidence`}
                    className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    전체 보기 <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">슬롯</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">시작</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">노출 시간</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">신뢰도</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exposures.slice(0, 5).map((exposure: any) => (
                      <tr key={exposure.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <span className="font-medium text-slate-900">
                            {exposure.slotType || '미분류'}
                          </span>
                        </td>
                        <td className="p-4 text-right text-sm text-slate-500">
                          {formatDuration(exposure.startTs)}
                        </td>
                        <td className="p-4 text-right font-medium">
                          {formatDuration(exposure.duration)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`badge ${
                            exposure.avgConfidence >= 0.8
                              ? 'bg-emerald-100 text-emerald-700'
                              : exposure.avgConfidence >= 0.7
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {(exposure.avgConfidence * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ROI Summary */}
            <div className="card p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">ROI 요약</h2>
                  <p className="text-sm text-slate-600">
                    AI 로고 검출 기반 총 노출 성과
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">총 유효 노출 시간</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {formatDuration(dashboard?.totalDuration || 0)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

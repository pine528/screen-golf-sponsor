import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  FileText,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  BarChart3,
  TrendingUp,
  Timer,
  Target,
  Calendar,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '../../utils';

type ReportStatus = 'GENERATING' | 'COMPLETED' | 'FAILED';
type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CAMPAIGN_FINAL'; // 백엔드 RoiReportType과 일치

export function BrandReports() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('CAMPAIGN_FINAL');
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // 캠페인 정보 조회
  const { data: campaignData } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get(`/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });

  // ROI 대시보드 요약 조회
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['campaign-roi-dashboard', campaignId],
    queryFn: () => api.get(`/roi/campaigns/${campaignId}/dashboard`),
    enabled: !!campaignId,
  });

  // 리포트 목록 조회
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['campaign-reports', campaignId, page],
    queryFn: () => api.get(`/roi/campaigns/${campaignId}/reports`, { page }),
    enabled: !!campaignId,
  });

  // 리포트 생성 mutation
  const createReportMutation = useMutation({
    mutationFn: (type: ReportType) =>
      api.post(`/roi/campaigns/${campaignId}/reports`, { type }), // 백엔드는 'type' 필드 기대
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-reports'] });
      setShowCreateModal(false);
      if (response?.data?.fileUrl) {
        alert('리포트가 생성되었습니다. PDF를 다운로드할 수 있습니다.');
      } else {
        alert('리포트 생성이 시작되었습니다.');
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '리포트 생성에 실패했습니다.');
    },
  });

  const campaign = campaignData?.data;
  const dashboard = dashboardData?.data;
  const reports = reportsData?.data?.items || []; // 백엔드는 { items, pagination } 형식 반환

  const statusStyles: Record<ReportStatus, string> = {
    GENERATING: 'bg-amber-100 text-amber-700 border-amber-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<ReportStatus, string> = {
    GENERATING: '생성 중',
    COMPLETED: '완료',
    FAILED: '실패',
  };

  const statusIcons: Record<ReportStatus, React.ReactNode> = {
    GENERATING: <Loader2 className="w-4 h-4 animate-spin" />,
    COMPLETED: <CheckCircle className="w-4 h-4" />,
    FAILED: <XCircle className="w-4 h-4" />,
  };

  const typeLabels: Record<ReportType, string> = {
    DAILY: '일간 리포트',
    WEEKLY: '주간 리포트',
    MONTHLY: '월간 리포트',
    CAMPAIGN_FINAL: '캠페인 최종 리포트',
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ROI 리포트</h1>
            <p className="text-slate-600 mt-1">
              {campaign?.name || '캠페인'}의 ROI 분석 리포트를 확인합니다
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            리포트 생성
          </button>
        </div>

        {/* Dashboard Summary */}
        {dashboardLoading ? (
          <div className="card p-8 text-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-600">대시보드 로딩 중...</p>
          </div>
        ) : dashboard ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">총 노출 횟수</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {dashboard.totalExposures || dashboard.metrics?.totalExposures || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Timer className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">총 노출 시간</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatDuration(dashboard.totalDuration || dashboard.metrics?.totalDuration || 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">슬롯 수</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {dashboard.metrics?.slotMetrics?.length || Object.keys(dashboard.slotStats || {}).length || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">평균 신뢰도</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {((dashboard.avgConfidence || dashboard.metrics?.avgConfidence || 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Slot Performance */}
        {dashboard?.metrics?.slotMetrics && dashboard.metrics.slotMetrics.length > 0 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">슬롯별 성과</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      슬롯 타입
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      노출 횟수
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      총 노출 시간
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      평균 신뢰도
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dashboard.metrics.slotMetrics.map((slot: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {slot.slotType}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {slot.exposureCount}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatDuration(slot.totalDuration)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {(slot.avgConfidence * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to={`/brand/campaigns/${campaignId}/evidence`}
            className="card p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">증빙 자료 보기</p>
                <p className="text-sm text-slate-500">스크린샷 및 영상 클립 확인</p>
              </div>
            </div>
          </Link>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['campaign-roi-dashboard'] })}
            className="card p-6 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">데이터 새로고침</p>
                <p className="text-sm text-slate-500">최신 ROI 데이터 불러오기</p>
              </div>
            </div>
          </button>
        </div>

        {/* Reports List */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">생성된 리포트</h3>
          </div>

          {reportsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">리포트가 없습니다</h3>
              <p className="text-slate-600 mb-4">첫 번째 ROI 리포트를 생성해보세요</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                리포트 생성
              </button>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      리포트
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reports.map((report: any) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {report.title || `ROI 리포트 #${report.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              {report.periodStart && report.periodEnd && (
                                `${new Date(report.periodStart).toLocaleDateString('ko-KR')} ~ ${new Date(report.periodEnd).toLocaleDateString('ko-KR')}`
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'badge',
                          report.type === 'CAMPAIGN_FINAL'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        )}>
                          {typeLabels[report.type as ReportType] || '리포트'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(report.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'badge inline-flex items-center gap-1',
                          statusStyles[report.status as ReportStatus] || 'bg-slate-100 text-slate-700 border-slate-200'
                        )}>
                          {statusIcons[report.status as ReportStatus]}
                          {statusLabels[report.status as ReportStatus] || '초안'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {report.status === 'COMPLETED' && report.fileUrl && (
                            <a
                              href={report.fileUrl}
                              download
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="PDF 다운로드"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="상세 보기"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">총 {reports.length}개 리포트</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">페이지 {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">리포트 생성</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  리포트 유형
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="reportType"
                      value="WEEKLY"
                      checked={reportType === 'WEEKLY'}
                      onChange={(e) => setReportType(e.target.value as ReportType)}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">주간 리포트</p>
                      <p className="text-sm text-slate-500">캠페인 진행 중 주간 현황 파악용</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="reportType"
                      value="MONTHLY"
                      checked={reportType === 'MONTHLY'}
                      onChange={(e) => setReportType(e.target.value as ReportType)}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">월간 리포트</p>
                      <p className="text-sm text-slate-500">캠페인 진행 중 월간 현황 파악용</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="reportType"
                      value="CAMPAIGN_FINAL"
                      checked={reportType === 'CAMPAIGN_FINAL'}
                      onChange={(e) => setReportType(e.target.value as ReportType)}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">캠페인 최종 리포트</p>
                      <p className="text-sm text-slate-500">캠페인 종료 후 최종 성과 분석</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600">
                  리포트 생성 시 현재까지의 모든 승인된 노출 데이터를 기반으로 PDF 문서가 생성됩니다.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => createReportMutation.mutate(reportType)}
                disabled={createReportMutation.isPending}
                className="btn btn-primary"
              >
                {createReportMutation.isPending ? '생성 중...' : '리포트 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">리포트 상세</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Report Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">유형</p>
                  <p className="font-medium text-slate-900">
                    {typeLabels[selectedReport.type as ReportType] || '리포트'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">상태</p>
                  <span className={cn(
                    'badge inline-flex items-center gap-1',
                    statusStyles[selectedReport.status as ReportStatus]
                  )}>
                    {statusIcons[selectedReport.status as ReportStatus]}
                    {statusLabels[selectedReport.status as ReportStatus]}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">생성일</p>
                  <p className="font-medium text-slate-900">
                    {new Date(selectedReport.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">기간</p>
                  <p className="font-medium text-slate-900">
                    {selectedReport.periodStart && selectedReport.periodEnd ? (
                      `${new Date(selectedReport.periodStart).toLocaleDateString('ko-KR')} ~ ${new Date(selectedReport.periodEnd).toLocaleDateString('ko-KR')}`
                    ) : '-'}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              {selectedReport.metricsJson && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">주요 지표</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl">
                      <p className="text-sm text-emerald-600 mb-1">총 노출 횟수</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {selectedReport.metricsJson.totalExposures || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-blue-600 mb-1">총 노출 시간</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatDuration(selectedReport.metricsJson.totalDuration || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => setSelectedReport(null)}
                className="btn btn-secondary"
              >
                닫기
              </button>
              {selectedReport.status === 'COMPLETED' && selectedReport.fileUrl && (
                <a
                  href={selectedReport.fileUrl}
                  download
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';
import {
  Target,
  TrendingUp,
  Eye,
  MousePointer,
  Users,
  Loader2,
  AlertCircle,
  ChevronLeft,
  FileText,
  BarChart3,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; class: string }> = {
  DRAFT: { label: '초안', class: 'bg-slate-100 text-slate-700' },
  ACTIVE: { label: '진행중', class: 'bg-emerald-100 text-emerald-700' },
  PAUSED: { label: '일시정지', class: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '완료', class: 'bg-blue-100 text-blue-700' },
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();

  // 캠페인 기본 정보
  const { data: campaignData, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.getCampaign(id!),
    enabled: !!id,
  });

  // 캠페인 성과
  const { data: performanceData, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['campaignPerformance', id],
    queryFn: () => api.getCampaignPerformance(id!),
    enabled: !!id,
  });

  // 추천 선수
  const { data: recommendedData } = useQuery({
    queryKey: ['recommendedAthletes', id],
    queryFn: () => api.getRecommendedAthletes({ limit: 5 }),
    enabled: !!id,
  });

  const isLoading = isLoadingCampaign || isLoadingPerformance;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  const campaign = campaignData?.data;
  const performance = performanceData?.data;
  const recommended = recommendedData?.data || [];

  if (!campaign) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              캠페인을 찾을 수 없습니다
            </h2>
            <Link to="/campaigns" className="btn btn-primary">
              캠페인 목록으로
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const budgetProgress = campaign.budget > 0
    ? Math.round((campaign.spentAmount / campaign.budget) * 100)
    : 0;

  const impressionProgress = campaign.goalImpressions
    ? Math.round((campaign.actualImpressions / campaign.goalImpressions) * 100)
    : 0;

  const clickProgress = campaign.goalClicks
    ? Math.round((campaign.actualClicks / campaign.goalClicks) * 100)
    : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/campaigns"
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              캠페인 목록
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
                  <span className={cn('badge text-xs', statusConfig[campaign.status]?.class)}>
                    {statusConfig[campaign.status]?.label}
                  </span>
                </div>
                {campaign.description && (
                  <p className="text-sm text-slate-500 mt-1">{campaign.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Budget */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">예산 사용</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(campaign.spentAmount)} / {formatCurrency(campaign.budget)}
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(budgetProgress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">{budgetProgress}%</p>
          </div>

          {/* Impressions */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">노출수</p>
                <p className="text-lg font-bold text-slate-900">
                  {(campaign.actualImpressions || 0).toLocaleString()}
                  {campaign.goalImpressions && (
                    <span className="text-sm text-slate-500 font-normal">
                      {' '}/ {campaign.goalImpressions.toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {campaign.goalImpressions && (
              <>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(impressionProgress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-right">{impressionProgress}%</p>
              </>
            )}
          </div>

          {/* Clicks */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">클릭수</p>
                <p className="text-lg font-bold text-slate-900">
                  {(campaign.actualClicks || 0).toLocaleString()}
                  {campaign.goalClicks && (
                    <span className="text-sm text-slate-500 font-normal">
                      {' '}/ {campaign.goalClicks.toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {campaign.goalClicks && (
              <>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(clickProgress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-right">{clickProgress}%</p>
              </>
            )}
          </div>

          {/* Allocated Budget */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">배정 예산</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(campaign.budgetAllocated || 0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">계약에 배정된 예산</p>
          </div>
        </div>

        {/* Contracts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connected Contracts */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              연결된 계약
            </h2>
            {performance?.contracts?.length > 0 ? (
              <div className="space-y-3">
                {performance.contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    className="p-3 bg-slate-50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {contract.athlete?.name || '선수'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {contract.slot?.template?.code || '슬롯'} · {formatCurrency(contract.allocatedBudget)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'badge text-xs',
                        contract.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {contract.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>연결된 계약이 없습니다</p>
              </div>
            )}
          </div>

          {/* Recommended Athletes */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              추천 선수
            </h2>
            {recommended.length > 0 ? (
              <div className="space-y-3">
                {recommended.map((athlete: any) => (
                  <div
                    key={athlete.id}
                    className="p-3 bg-slate-50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-emerald-700 font-semibold">
                          {athlete.name?.charAt(0) || 'A'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{athlete.name}</p>
                        <p className="text-sm text-slate-500">{athlete.tour || '투어 미지정'}</p>
                      </div>
                    </div>
                    {athlete.rating && (
                      <span className="text-sm font-medium text-amber-600">
                        ★ {athlete.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>추천 선수가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">캠페인 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <span className="text-slate-500">시작일</span>
              <p className="font-medium text-slate-900">
                {campaign.dateStart
                  ? new Date(campaign.dateStart).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">종료일</span>
              <p className="font-medium text-slate-900">
                {campaign.dateEnd
                  ? new Date(campaign.dateEnd).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">타겟 카테고리</span>
              <p className="font-medium text-slate-900">
                {campaign.targetCategories?.join(', ') || '-'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">선호 투어</span>
              <p className="font-medium text-slate-900">
                {campaign.preferredTours?.join(', ') || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

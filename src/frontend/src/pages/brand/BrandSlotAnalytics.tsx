import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  BarChart3,
  Loader2,
  Filter,
  TrendingUp,
  Clock,
  Eye,
  CheckCircle,
  Percent,
} from 'lucide-react';

const SLOT_LABELS: Record<string, string> = {
  CAP_FRONT: '모자 정면',
  CAP_SIDE_L: '모자 좌측',
  CAP_SIDE_R: '모자 우측',
  CAP_BACK: '모자 뒷면',
  CAP_BRIM_TOP: '모자 챙',
  CHEST_L: '상의 좌측',
  CHEST_R: '상의 우측',
  COLLAR_L: '카라 좌',
  COLLAR_R: '카라 우',
  SLEEVE_L: '소매 좌',
  SLEEVE_R: '소매 우',
  UNKNOWN: '미분류',
};

export function BrandSlotAnalytics() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['my-campaigns'],
    queryFn: () => api.get('/campaigns/my'),
  });

  const { data: slotData, isLoading: slotLoading } = useQuery({
    queryKey: ['slot-analytics', selectedCampaignId],
    queryFn: () => api.get(`/roi/campaigns/${selectedCampaignId}/slots`),
    enabled: !!selectedCampaignId,
  });

  const { data: eventData } = useQuery({
    queryKey: ['event-metrics', selectedCampaignId],
    queryFn: () => api.get(`/roi/campaigns/${selectedCampaignId}/events`),
    enabled: !!selectedCampaignId,
  });

  const campaigns = campaignsData?.data || [];
  const analytics = slotData?.data;
  const events = eventData?.data || [];

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0초';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  const getSlotLabel = (slotType: string) => SLOT_LABELS[slotType] || slotType;

  if (campaignsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  const maxDuration = analytics?.slots?.length
    ? Math.max(...analytics.slots.map((s: any) => s.totalDuration))
    : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">슬롯 분석</h1>
            <p className="text-sm text-slate-500">슬롯별 노출 성과 비교 분석</p>
          </div>
        </div>

        {/* Campaign Selector */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="input w-80"
            >
              <option value="">캠페인을 선택하세요</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!selectedCampaignId ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">캠페인을 선택하세요</h3>
            <p className="text-slate-500">슬롯별 분석 데이터를 보려면 위에서 캠페인을 선택해주세요</p>
          </div>
        ) : slotLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">슬롯 유형 수</p>
                    <p className="text-2xl font-bold text-slate-900">{analytics?.slots?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">총 노출 횟수</p>
                    <p className="text-2xl font-bold text-slate-900">{(analytics?.totalExposures || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">총 노출 시간</p>
                    <p className="text-2xl font-bold text-slate-900">{formatDuration(analytics?.totalDuration || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Slot Comparison Chart */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                슬롯별 노출 시간 비교
              </h2>
              {analytics?.slots?.length > 0 ? (
                <div className="space-y-4">
                  {analytics.slots.map((slot: any) => {
                    const pct = maxDuration > 0 ? (slot.totalDuration / maxDuration) * 100 : 0;
                    return (
                      <div key={slot.slotType} className="flex items-center gap-4">
                        <div className="w-28 text-sm font-medium text-slate-700 text-right shrink-0">
                          {getSlotLabel(slot.slotType)}
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-slate-100 rounded-full h-8 relative overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-8 rounded-full transition-all flex items-center justify-end pr-3"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            >
                              <span className="text-xs font-medium text-white whitespace-nowrap">
                                {formatDuration(slot.totalDuration)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-16 text-sm text-slate-500 text-right shrink-0">
                          {slot.validCount}회
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>슬롯 데이터가 없습니다</p>
                </div>
              )}
            </div>

            {/* Slot Detail Table */}
            {analytics?.slots?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="font-semibold text-slate-900">슬롯별 상세 지표</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">슬롯</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">
                        <span className="flex items-center justify-end gap-1"><Eye className="w-3 h-3" /> 총 노출</span>
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">
                        <span className="flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3" /> 유효</span>
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">
                        <span className="flex items-center justify-end gap-1"><Percent className="w-3 h-3" /> 유효율</span>
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">
                        <span className="flex items-center justify-end gap-1"><Clock className="w-3 h-3" /> 노출 시간</span>
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">평균 신뢰도</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">평균 면적 비율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.slots.map((slot: any) => (
                      <tr key={slot.slotType} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-900">{getSlotLabel(slot.slotType)}</td>
                        <td className="p-4 text-right text-slate-700">{slot.exposureCount}</td>
                        <td className="p-4 text-right text-slate-700">{slot.validCount}</td>
                        <td className="p-4 text-right">
                          <span className={`badge ${
                            slot.validityRate >= 0.8 ? 'bg-emerald-100 text-emerald-700'
                            : slot.validityRate >= 0.5 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {(slot.validityRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-900">{formatDuration(slot.totalDuration)}</td>
                        <td className="p-4 text-right text-slate-700">{(slot.avgConfidence * 100).toFixed(1)}%</td>
                        <td className="p-4 text-right text-slate-700">{(slot.avgAreaRatio * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Event (Round) Breakdown */}
            {events.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="font-semibold text-slate-900">라운드(이벤트)별 성과</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">이벤트</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">투어</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">기간</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">총 노출</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">유효 노출</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">노출 시간</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">신뢰도</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event: any) => (
                      <tr key={event.eventId} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-900">{event.eventName}</td>
                        <td className="p-4 text-sm text-slate-600">{event.tour || '-'}</td>
                        <td className="p-4 text-right text-sm text-slate-500">
                          {new Date(event.dateStart).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          {' ~ '}
                          {new Date(event.dateEnd).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-4 text-right text-slate-700">{event.totalExposures}</td>
                        <td className="p-4 text-right text-slate-700">{event.validExposures}</td>
                        <td className="p-4 text-right font-medium text-slate-900">{formatDuration(event.totalDuration)}</td>
                        <td className="p-4 text-right">
                          <span className={`badge ${
                            event.avgConfidence >= 0.8 ? 'bg-emerald-100 text-emerald-700'
                            : event.avgConfidence >= 0.7 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {(event.avgConfidence * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default BrandSlotAnalytics;

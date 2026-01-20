import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils';
import {
  TrendingUp,
  Eye,
  BarChart3,
  Calendar,
  Loader2,
  Filter,
  FileText,
} from 'lucide-react';

const exposureTypeLabels: Record<string, string> = {
  BROADCAST: '방송',
  EVENT_LIVE: '이벤트 라이브',
  SOCIAL_MEDIA: '소셜 미디어',
  PHOTO_PRESS: '보도 사진',
  OTHER: '기타',
};

export default function BrandROIDashboard() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
  });

  // 노출 리포트 조회
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['brandExposureReport', filters],
    queryFn: () =>
      api.getBrandExposureReport({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      }),
  });

  const report = reportData?.data || {};

  if (isLoading) {
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
              <p className="text-sm text-slate-500">노출 성과 및 미디어밸류 분석</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="input w-40"
                placeholder="시작일"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="input w-40"
                placeholder="종료일"
              />
            </div>
            <button
              onClick={() => setFilters({ startDate: '', endDate: '' })}
              className="btn btn-secondary text-sm"
            >
              초기화
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">총 노출수</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(report.totalImpressions || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">총 미디어밸류</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(Number(report.totalMediaValue) || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">평균 노출당 가치</p>
                <p className="text-2xl font-bold text-slate-900">
                  {report.totalImpressions > 0
                    ? formatCurrency(
                        Math.round(Number(report.totalMediaValue) / report.totalImpressions)
                      )
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">계약 수</p>
                <p className="text-2xl font-bold text-slate-900">
                  {report.contractCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Exposure Type */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              노출 유형별 현황
            </h2>
            {report.byExposureType && report.byExposureType.length > 0 ? (
              <div className="space-y-3">
                {report.byExposureType.map((item: any) => {
                  const maxImpressions = Math.max(
                    ...report.byExposureType.map((i: any) => i.impressions)
                  );
                  const percentage =
                    maxImpressions > 0
                      ? Math.round((item.impressions / maxImpressions) * 100)
                      : 0;

                  return (
                    <div key={item.exposureType}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {exposureTypeLabels[item.exposureType] || item.exposureType}
                        </span>
                        <span className="text-sm text-slate-500">
                          {item.impressions.toLocaleString()}회
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-emerald-600 mt-1">
                        밸류: {formatCurrency(Number(item.mediaValue) || 0)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>데이터가 없습니다</p>
              </div>
            )}
          </div>

          {/* By Contract */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              계약별 노출 현황
            </h2>
            {report.byContract && report.byContract.length > 0 ? (
              <div className="space-y-3">
                {report.byContract.slice(0, 5).map((contract: any) => (
                  <div
                    key={contract.contractId}
                    className="p-3 bg-slate-50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {contract.athleteName || '선수'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {contract.slotCode || '슬롯'} · {contract.recordCount}건
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {contract.impressions.toLocaleString()}회
                      </p>
                      <p className="text-xs text-emerald-600">
                        {formatCurrency(Number(contract.mediaValue) || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>데이터가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Records */}
        {report.recentRecords && report.recentRecords.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-900">최근 노출 기록</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">계약</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">유형</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">노출수</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">미디어밸류</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">기록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.recentRecords.map((record: any) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <span className="font-medium text-slate-900">
                        {record.athleteName || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="badge bg-purple-100 text-purple-700 text-xs">
                        {exposureTypeLabels[record.exposureType] || record.exposureType}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">
                      {record.impressions.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-medium text-emerald-600">
                      {formatCurrency(Number(record.mediaValue) || 0)}
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {new Date(record.recordedAt).toLocaleDateString()}
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
                총 투자 대비 미디어밸류 성과
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">총 미디어밸류</p>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(Number(report.totalMediaValue) || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

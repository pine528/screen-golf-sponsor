import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';
import {
  Eye,
  Plus,
  Trash2,
  BarChart3,
  Settings,
  Loader2,
  Calendar,
  Filter,
  TrendingUp,
} from 'lucide-react';

const exposureTypes = [
  { value: 'BROADCAST', label: '방송' },
  { value: 'EVENT_LIVE', label: '이벤트 라이브' },
  { value: 'SOCIAL_MEDIA', label: '소셜 미디어' },
  { value: 'PHOTO_PRESS', label: '보도 사진' },
  { value: 'OTHER', label: '기타' },
];

const bodyParts = [
  { value: 'SHIRT_CHEST_LEFT', label: '상의 좌측' },
  { value: 'SHIRT_CHEST_RIGHT', label: '상의 우측' },
  { value: 'SHIRT_SLEEVE_LEFT', label: '상의 소매 좌측' },
  { value: 'SHIRT_SLEEVE_RIGHT', label: '상의 소매 우측' },
  { value: 'CAP_SIDE_LEFT', label: '모자 측면' },
  { value: 'CAP_BACK', label: '모자 후면' },
  { value: 'PANTS_BELT', label: '바지 벨트' },
  { value: 'SHIRT_BACK', label: '상의 후면' },
];

export default function AdminExposure() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'records' | 'rates' | 'report'>('records');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [filters, setFilters] = useState({
    exposureType: '',
    startDate: '',
    endDate: '',
  });

  // Records
  const { data: recordsData, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['exposureRecords', filters],
    queryFn: () => api.getExposureRecords({
      exposureType: filters.exposureType || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    }),
    enabled: activeTab === 'records',
  });

  // Rates
  const { data: ratesData, isLoading: isLoadingRates } = useQuery({
    queryKey: ['mediaValueRates'],
    queryFn: () => api.getMediaValueRates(),
    enabled: activeTab === 'rates',
  });

  // Report
  const { data: reportData, isLoading: isLoadingReport } = useQuery({
    queryKey: ['mediaValueReport', filters],
    queryFn: () => api.getMediaValueReport({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      groupBy: 'day',
    }),
    enabled: activeTab === 'report',
  });

  // Delete record
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExposureRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exposureRecords'] });
    },
  });

  const records = recordsData?.data || [];
  const rates = ratesData?.data || [];
  const report = reportData?.data || {};

  const isLoading = isLoadingRecords || isLoadingRates || isLoadingReport;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">노출/미디어밸류 관리</h1>
              <p className="text-sm text-slate-500">노출 기록 및 미디어밸류 요율 관리</p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === 'records' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                노출 기록 추가
              </button>
            )}
            {activeTab === 'rates' && (
              <button
                onClick={() => setShowRateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                요율 추가
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-4">
            {[
              { id: 'records', label: '노출 기록', icon: Eye },
              { id: 'rates', label: '미디어밸류 요율', icon: Settings },
              { id: 'report', label: '리포트', icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filters.exposureType}
              onChange={(e) => setFilters({ ...filters, exposureType: e.target.value })}
              className="input w-40"
            >
              <option value="">모든 유형</option>
              {exposureTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input w-40"
              placeholder="시작일"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input w-40"
              placeholder="종료일"
            />
            <button
              onClick={() => setFilters({ exposureType: '', startDate: '', endDate: '' })}
              className="btn btn-secondary text-sm"
            >
              초기화
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Records Tab */}
            {activeTab === 'records' && (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">계약</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">유형</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">노출수</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">미디어밸류</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">기록일</th>
                      <th className="text-center p-4 text-sm font-medium text-slate-600">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          노출 기록이 없습니다
                        </td>
                      </tr>
                    ) : (
                      records.map((record: any) => (
                        <tr key={record.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <span className="font-medium text-slate-900">
                              {record.contract?.athlete?.name || '-'}
                            </span>
                            <p className="text-xs text-slate-500">
                              {record.contract?.brand?.companyName || '-'}
                            </p>
                          </td>
                          <td className="p-4">
                            <span className="badge bg-purple-100 text-purple-700 text-xs">
                              {exposureTypes.find((t) => t.value === record.exposureType)?.label ||
                                record.exposureType}
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
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                if (confirm('삭제하시겠습니까?')) {
                                  deleteMutation.mutate(record.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rates Tab */}
            {activeTab === 'rates' && (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">노출 유형</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">부위</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600">
                        노출당 단가
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">적용 시작일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          등록된 요율이 없습니다
                        </td>
                      </tr>
                    ) : (
                      rates.map((rate: any) => (
                        <tr key={rate.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <span className="badge bg-purple-100 text-purple-700 text-xs">
                              {exposureTypes.find((t) => t.value === rate.exposureType)?.label ||
                                rate.exposureType}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700">
                            {rate.bodyPart
                              ? bodyParts.find((b) => b.value === rate.bodyPart)?.label
                              : '전체'}
                          </td>
                          <td className="p-4 text-right font-medium text-emerald-600">
                            {formatCurrency(Number(rate.ratePerImpression))}
                          </td>
                          <td className="p-4 text-sm text-slate-500">
                            {new Date(rate.effectiveFrom).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Eye className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">총 노출수</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {(report.totalImpressions || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">총 미디어밸류</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {formatCurrency(Number(report.totalMediaValue) || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">기록 건수</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {(report.recordCount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Breakdown */}
                {report.byDate && report.byDate.length > 0 && (
                  <div className="card p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">일별 노출 현황</h3>
                    <div className="space-y-2">
                      {report.byDate.slice(0, 10).map((day: any) => (
                        <div
                          key={day.date}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <span className="text-sm text-slate-600">
                            {new Date(day.date).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-6">
                            <span className="text-sm">
                              노출: <strong>{day.impressions.toLocaleString()}</strong>
                            </span>
                            <span className="text-sm text-emerald-600">
                              밸류: <strong>{formatCurrency(Number(day.mediaValue) || 0)}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Record Modal */}
        {showCreateModal && (
          <CreateRecordModal onClose={() => setShowCreateModal(false)} />
        )}

        {/* Create Rate Modal */}
        {showRateModal && (
          <CreateRateModal onClose={() => setShowRateModal(false)} />
        )}
      </div>
    </Layout>
  );
}

// Create Record Modal Component
function CreateRecordModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    contractId: '',
    exposureType: 'BROADCAST',
    impressions: '',
    viewDurationSec: '',
    reachCount: '',
    sourceUrl: '',
    recordedAt: new Date().toISOString().split('T')[0],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createExposureRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exposureRecords'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      impressions: parseInt(formData.impressions),
      viewDurationSec: formData.viewDurationSec ? parseInt(formData.viewDurationSec) : undefined,
      reachCount: formData.reachCount ? parseInt(formData.reachCount) : undefined,
      recordedAt: new Date(formData.recordedAt).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-900 mb-4">노출 기록 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">계약 ID *</label>
            <input
              type="text"
              value={formData.contractId}
              onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">노출 유형 *</label>
            <select
              value={formData.exposureType}
              onChange={(e) => setFormData({ ...formData, exposureType: e.target.value })}
              className="input"
            >
              {exposureTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">노출수 *</label>
            <input
              type="number"
              value={formData.impressions}
              onChange={(e) => setFormData({ ...formData, impressions: e.target.value })}
              className="input"
              required
              min="0"
            />
          </div>
          <div>
            <label className="label">시청 시간 (초)</label>
            <input
              type="number"
              value={formData.viewDurationSec}
              onChange={(e) => setFormData({ ...formData, viewDurationSec: e.target.value })}
              className="input"
              min="0"
            />
          </div>
          <div>
            <label className="label">기록일 *</label>
            <input
              type="date"
              value={formData.recordedAt}
              onChange={(e) => setFormData({ ...formData, recordedAt: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              취소
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn btn-primary">
              {createMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Rate Modal Component
function CreateRateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    exposureType: 'BROADCAST',
    bodyPart: '',
    ratePerImpression: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createMediaValueRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaValueRates'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      bodyPart: formData.bodyPart || undefined,
      ratePerImpression: parseFloat(formData.ratePerImpression),
      effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-900 mb-4">미디어밸류 요율 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">노출 유형 *</label>
            <select
              value={formData.exposureType}
              onChange={(e) => setFormData({ ...formData, exposureType: e.target.value })}
              className="input"
            >
              {exposureTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">부위 (선택)</label>
            <select
              value={formData.bodyPart}
              onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })}
              className="input"
            >
              <option value="">전체</option>
              {bodyParts.map((part) => (
                <option key={part.value} value={part.value}>
                  {part.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">노출당 단가 (원) *</label>
            <input
              type="number"
              value={formData.ratePerImpression}
              onChange={(e) => setFormData({ ...formData, ratePerImpression: e.target.value })}
              className="input"
              required
              min="0"
              step="0.0001"
            />
          </div>
          <div>
            <label className="label">적용 시작일 *</label>
            <input
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              취소
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn btn-primary">
              {createMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

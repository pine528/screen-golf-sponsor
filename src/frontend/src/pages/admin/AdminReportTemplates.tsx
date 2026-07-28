import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  FileText,
  Loader2,
  Trash2,
  Download,
  AlertTriangle,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';

export function AdminReportTemplates() {
  const queryClient = useQueryClient();
  const [campaignFilter, setCampaignFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    campaignId: '',
    type: 'CAMPAIGN_FINAL',
    title: '',
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => api.get('/campaigns'),
  });

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['admin-reports', campaignFilter, statusFilter, page],
    queryFn: () => {
      if (campaignFilter) {
        return api.get(`/roi/campaigns/${campaignFilter}/reports`, {
          status: statusFilter || undefined,
          page,
          limit: 20,
        });
      }
      // 캠페인 필터 없을 때 admin 전체 리포트 조회
      return api.get('/roi/admin/reports', {
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/roi/campaigns/${genForm.campaignId}/reports`, {
      type: genForm.type,
      title: genForm.title || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      setShowGenerate(false);
      setGenForm({ campaignId: '', type: 'CAMPAIGN_FINAL', title: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roi/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      setDeleteTarget(null);
    },
  });

  const campaigns = campaignsData?.data || [];
  const reports = reportsData?.data?.items || [];
  const pagination = reportsData?.data?.pagination;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 완료</span>;
      case 'GENERATING':
        return <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1"><Clock className="w-3 h-3" /> 생성 중</span>;
      case 'FAILED':
        return <span className="badge bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> 실패</span>;
      default:
        return <span className="badge bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'DAILY': return '일간';
      case 'WEEKLY': return '주간';
      case 'MONTHLY': return '월간';
      case 'CAMPAIGN_FINAL': return '최종';
      default: return type;
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">리포트 관리</h1>
              <p className="text-sm text-slate-500">ROI 리포트 생성/조회/삭제</p>
            </div>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            리포트 생성
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={campaignFilter}
              onChange={(e) => { setCampaignFilter(e.target.value); setPage(1); }}
              className="input w-64"
            >
              <option value="">전체 캠페인</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input w-40"
            >
              <option value="">전체 상태</option>
              <option value="COMPLETED">완료</option>
              <option value="GENERATING">생성 중</option>
              <option value="FAILED">실패</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">리포트가 없습니다</h3>
            <p className="text-slate-500">'리포트 생성' 버튼으로 새 리포트를 생성하세요</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">캠페인</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">제목</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-600">유형</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-600">상태</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">기간</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">생성일</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report: any) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="p-4 text-sm text-slate-700">{report.campaign?.name || '-'}</td>
                    <td className="p-4 font-medium text-slate-900 truncate max-w-[200px]">
                      {report.title || '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="badge bg-slate-100 text-slate-700">{getTypeLabel(report.type)}</span>
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(report.status)}</td>
                    <td className="p-4 text-right text-sm text-slate-500">
                      {formatDate(report.periodStart)} ~ {formatDate(report.periodEnd)}
                    </td>
                    <td className="p-4 text-right text-sm text-slate-500">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.fileUrl && (
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setDeleteTarget(report.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  {pagination.total}건 중 {(page - 1) * 20 + 1}~{Math.min(page * 20, pagination.total)}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-secondary text-sm">이전</button>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="btn btn-secondary text-sm">다음</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Modal */}
        {showGenerate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">리포트 생성</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">캠페인 *</label>
                  <select
                    value={genForm.campaignId}
                    onChange={(e) => setGenForm(f => ({ ...f, campaignId: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">선택하세요</option>
                    {campaigns.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">유형</label>
                  <select
                    value={genForm.type}
                    onChange={(e) => setGenForm(f => ({ ...f, type: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="CAMPAIGN_FINAL">캠페인 최종</option>
                    <option value="MONTHLY">월간</option>
                    <option value="WEEKLY">주간</option>
                    <option value="DAILY">일간</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">제목 (선택)</label>
                  <input
                    type="text"
                    value={genForm.title}
                    onChange={(e) => setGenForm(f => ({ ...f, title: e.target.value }))}
                    className="input w-full"
                    placeholder="자동 생성됩니다"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => setShowGenerate(false)} className="btn btn-secondary">취소</button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={!genForm.campaignId || generateMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  생성
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">리포트 삭제</h3>
              </div>
              <p className="text-slate-600 mb-6">이 리포트를 삭제하시겠습니까?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary">취소</button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget)}
                  disabled={deleteMutation.isPending}
                  className="btn bg-red-500 text-white hover:bg-red-600"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminReportTemplates;

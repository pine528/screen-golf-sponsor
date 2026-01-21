/**
 * Phase 10-3: Reconciliation Admin Page
 * 결제/환불 대사 관리 페이지
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Play,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { cn } from '../../utils';

type Tab = 'runs' | 'issues';
type SeverityFilter = '' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type StatusFilter = '' | 'OPEN' | 'ACKED' | 'RESOLVED' | 'IGNORED';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  CRITICAL: { label: 'CRITICAL', color: 'bg-red-100 text-red-700', icon: XCircle },
  HIGH: { label: 'HIGH', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  MEDIUM: { label: 'MEDIUM', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  LOW: { label: 'LOW', color: 'bg-blue-100 text-blue-700', icon: Eye },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'OPEN', color: 'bg-red-100 text-red-700' },
  ACKED: { label: 'ACKED', color: 'bg-yellow-100 text-yellow-700' },
  RESOLVED: { label: 'RESOLVED', color: 'bg-green-100 text-green-700' },
  IGNORED: { label: 'IGNORED', color: 'bg-slate-100 text-slate-600' },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  TOPUP_PAID_NO_LEDGER: '충전 PAID인데 원장 없음',
  LEDGER_TOPUP_NO_PAID: '원장 있는데 충전 PAID 아님',
  REFUND_REFUNDED_NO_LEDGER: '환불 REFUNDED인데 원장 없음',
  LEDGER_REFUND_NO_REQUEST: '환불 원장 있는데 요청 없음',
  REFUNDED_AMOUNT_MISMATCH: '환불 금액 불일치',
  WALLET_NEGATIVE: '지갑 잔액 음수',
  VERSION_CONFLICT_SPIKE: '낙관적 락 충돌 급증',
};

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RUNNING: { label: '실행중', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: '완료', color: 'bg-green-100 text-green-700' },
  FAILED: { label: '실패', color: 'bg-red-100 text-red-700' },
};

export default function AdminReconciliation() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('issues');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Issue filters
  const [selectedRunId, _setSelectedRunId] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  // Status change modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');

  // Queries
  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['reconciliationRuns', page, pageSize],
    queryFn: () => api.getReconciliationRuns({ limit: pageSize, offset: (page - 1) * pageSize }),
    enabled: activeTab === 'runs',
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['reconciliationIssues', page, pageSize, selectedRunId, severityFilter, statusFilter],
    queryFn: () =>
      api.getReconciliationIssues({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        runId: selectedRunId || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      }),
    enabled: activeTab === 'issues',
  });

  const { data: summaryData } = useQuery({
    queryKey: ['reconciliationSummary'],
    queryFn: () => api.getReconciliationIssuesSummary(),
  });

  // Mutations
  const createRunMutation = useMutation({
    mutationFn: () => api.createReconciliationRun({ scope: 'FULL' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationRuns'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliationIssues'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliationSummary'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.updateReconciliationIssueStatus(id, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationIssues'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliationSummary'] });
      setStatusModalOpen(false);
      setSelectedIssue(null);
      setNewStatus('');
      setStatusNote('');
    },
  });

  const runs = runsData?.data?.runs || [];
  const issues = issuesData?.data?.issues || [];
  const summary = summaryData?.data || { bySeverity: {}, byStatus: {} };

  const handleRunReconciliation = () => {
    if (confirm('수동 대사를 실행하시겠습니까? (지난 24시간 데이터 검사)')) {
      createRunMutation.mutate();
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await api.exportReconciliationIssuesCsv({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconciliation-issues-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('CSV 내보내기 실패');
    }
  };

  const openStatusModal = (issue: any, status: string) => {
    setSelectedIssue(issue);
    setNewStatus(status);
    setStatusNote('');
    setStatusModalOpen(true);
  };

  const handleStatusChange = () => {
    if (!selectedIssue || !newStatus) return;
    if (statusNote.length < 10) {
      alert('사유는 10자 이상 입력해주세요.');
      return;
    }
    updateStatusMutation.mutate({ id: selectedIssue.id, status: newStatus, note: statusNote });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-600" />
              결제/환불 대사
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              결제 및 환불 데이터 정합성을 점검하고 이상 내역을 관리합니다
            </p>
          </div>
          <button
            onClick={handleRunReconciliation}
            disabled={createRunMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {createRunMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            수동 실행
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              CRITICAL
            </div>
            <div className="text-2xl font-bold text-red-600">
              {summary.bySeverity?.CRITICAL || 0}
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              HIGH
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {summary.bySeverity?.HIGH || 0}
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              OPEN
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.byStatus?.OPEN || 0}
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              RESOLVED
            </div>
            <div className="text-2xl font-bold text-green-600">
              {summary.byStatus?.RESOLVED || 0}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab('issues');
              setPage(1);
            }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'issues'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <FileText className="w-4 h-4 inline mr-1" />
            이상 이슈
          </button>
          <button
            onClick={() => {
              setActiveTab('runs');
              setPage(1);
            }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'runs'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            실행 기록
          </button>
        </div>

        {/* Issues Tab */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value as SeverityFilter);
                  setPage(1);
                }}
                className="input w-40"
              >
                <option value="">전체 심각도</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setPage(1);
                }}
                className="input w-40"
              >
                <option value="">전체 상태</option>
                <option value="OPEN">OPEN</option>
                <option value="ACKED">ACKED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="IGNORED">IGNORED</option>
              </select>

              <button onClick={handleExportCsv} className="btn btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                CSV 내보내기
              </button>
            </div>

            {/* Issues Table */}
            {issuesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : issues.length === 0 ? (
              <div className="card p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900">이상 없음</h3>
                <p className="text-slate-500 mt-1">발견된 정합성 이슈가 없습니다</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">심각도</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">유형</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">관련 ID</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">상태</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">발견일</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((issue: any) => {
                        const severityConfig = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.LOW;
                        const statusConfig = STATUS_CONFIG[issue.status] || STATUS_CONFIG.OPEN;
                        const SeverityIcon = severityConfig.icon;

                        return (
                          <tr key={issue.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                                  severityConfig.color
                                )}
                              >
                                <SeverityIcon className="w-3 h-3" />
                                {severityConfig.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-500">
                              {issue.relatedTopupId?.slice(0, 8) ||
                                issue.relatedRefundId?.slice(0, 8) ||
                                issue.relatedWalletId?.slice(0, 8) ||
                                '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'px-2 py-1 rounded text-xs font-medium',
                                  statusConfig.color
                                )}
                              >
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{formatDate(issue.createdAt)}</td>
                            <td className="py-3 px-4">
                              {issue.status === 'OPEN' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openStatusModal(issue, 'ACKED')}
                                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                                  >
                                    확인
                                  </button>
                                  <button
                                    onClick={() => openStatusModal(issue, 'RESOLVED')}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  >
                                    해결
                                  </button>
                                  <button
                                    onClick={() => openStatusModal(issue, 'IGNORED')}
                                    className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                                  >
                                    무시
                                  </button>
                                </div>
                              )}
                              {issue.status === 'ACKED' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openStatusModal(issue, 'RESOLVED')}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  >
                                    해결
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {issues.length > 0 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-1 text-slate-600">페이지 {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={issues.length < pageSize}
                  className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Runs Tab */}
        {activeTab === 'runs' && (
          <div className="space-y-4">
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : runs.length === 0 ? (
              <div className="card p-12 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900">실행 기록 없음</h3>
                <p className="text-slate-500 mt-1">아직 대사 실행 기록이 없습니다</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">ID</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">범위</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">검사 기간</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">검사 건수</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">이상 건수</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">상태</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">실행 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run: any) => {
                        const runStatusConfig = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.COMPLETED;

                        return (
                          <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono text-xs text-slate-500">
                              {run.id.slice(0, 8)}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{run.scope}</td>
                            <td className="py-3 px-4 text-slate-500 text-xs">
                              {formatDate(run.fromDate)} ~ {formatDate(run.toDate)}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{run.totalChecked?.toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'font-medium',
                                  run.issuesFound > 0 ? 'text-red-600' : 'text-green-600'
                                )}
                              >
                                {run.issuesFound}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'px-2 py-1 rounded text-xs font-medium',
                                  runStatusConfig.color
                                )}
                              >
                                {runStatusConfig.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{formatDate(run.startedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {runs.length > 0 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-1 text-slate-600">페이지 {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={runs.length < pageSize}
                  className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status Change Modal */}
        {statusModalOpen && selectedIssue && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">이슈 상태 변경</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">새 상태</label>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className={cn('px-2 py-1 rounded text-sm', STATUS_CONFIG[newStatus]?.color)}>
                      {STATUS_CONFIG[newStatus]?.label}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    사유 (10자 이상) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="상태 변경 사유를 입력하세요..."
                    className="input w-full h-24 resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">{statusNote.length}자 / 최소 10자</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setStatusModalOpen(false)}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={statusNote.length < 10 || updateStatusMutation.isPending}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    '변경'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

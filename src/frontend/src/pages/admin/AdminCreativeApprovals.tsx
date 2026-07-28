import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileImage, CheckCircle, XCircle, Clock, Eye, Filter, Building2, Calendar } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatDate, cn } from '../../utils';
import { getEventMonthLabel } from '../../utils/eventMonth';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'SUBMITTED', label: '대기 중' },
  { value: 'UNDER_REVIEW', label: '검토 중' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '거부됨' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  SUBMITTED: { label: '대기 중', color: 'bg-blue-100 text-blue-700', icon: Clock },
  UNDER_REVIEW: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700', icon: Eye },
  APPROVED: { label: '승인됨', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '거부됨', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export function AdminCreativeApprovals() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 크리에이티브 승인 목록
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['admin', 'creative-approvals', statusFilter, eventFilter],
    queryFn: () => api.getAdminCreativeApprovals({
      status: statusFilter || undefined,
      eventId: eventFilter || undefined,
    }),
  });

  // 통계
  const { data: stats } = useQuery({
    queryKey: ['admin', 'creative-approvals', 'stats'],
    queryFn: () => api.getAdminCreativeApprovalStats(),
  });

  // 대회 목록
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  // 검토 시작
  const startReviewMutation = useMutation({
    mutationFn: (id: string) => api.startCreativeApprovalReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'creative-approvals'] });
    },
  });

  // 승인
  const approveMutation = useMutation({
    mutationFn: ({ id, reviewNotes }: { id: string; reviewNotes?: string }) =>
      api.approveCreativeApproval(id, reviewNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'creative-approvals'] });
      setSelectedApproval(null);
      setReviewNotes('');
      setActionError(null);
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.error || '승인에 실패했습니다.');
    },
  });

  // 거부
  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewNotes }: { id: string; reviewNotes: string }) =>
      api.rejectCreativeApproval(id, reviewNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'creative-approvals'] });
      setSelectedApproval(null);
      setReviewNotes('');
      setActionError(null);
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.error || '거부에 실패했습니다.');
    },
  });

  const handleApprove = () => {
    if (!selectedApproval) return;
    approveMutation.mutate({ id: selectedApproval.id, reviewNotes });
  };

  const handleReject = () => {
    if (!selectedApproval || reviewNotes.length < 10) {
      setActionError('거부 사유는 최소 10자 이상 입력해주세요.');
      return;
    }
    rejectMutation.mutate({ id: selectedApproval.id, reviewNotes });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">크리에이티브 승인 관리</h1>
          <p className="text-slate-600 mt-1">브랜드의 크리에이티브 사전 승인 요청을 검토합니다.</p>
        </div>

        {/* Stats */}
        {stats?.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-sm text-slate-600">대기 중</div>
              <div className="text-2xl font-bold text-blue-600">{stats.data.submitted || 0}</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-slate-600">검토 중</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.data.underReview || 0}</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-slate-600">승인됨</div>
              <div className="text-2xl font-bold text-green-600">{stats.data.approved || 0}</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-slate-600">거부됨</div>
              <div className="text-2xl font-bold text-red-600">{stats.data.rejected || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-1.5 text-sm w-auto"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="input py-1.5 text-sm w-auto"
          >
            <option value="">전체 대회</option>
            {events?.data?.map((event: any) => (
              <option key={event.id} value={event.id}>
                {getEventMonthLabel(event)}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="card">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">로딩 중...</div>
          ) : !approvals?.data?.items?.length ? (
            <div className="p-12 text-center text-slate-500">
              크리에이티브 승인 요청이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {approvals.data.items.map((approval: any) => {
                const statusInfo = STATUS_LABELS[approval.status] || STATUS_LABELS.SUBMITTED;
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={approval.id} className="p-6 flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {approval.fileUrl ? (
                        <img
                          src={approval.fileUrl}
                          alt="크리에이티브"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => window.open(approval.fileUrl, '_blank')}
                        />
                      ) : (
                        <FileImage className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-900">
                          {getEventMonthLabel(approval.event)}
                        </h3>
                        <span className={cn('badge text-xs flex items-center gap-1', statusInfo.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {approval.brand?.name || '브랜드'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(approval.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {approval.status === 'SUBMITTED' && (
                        <button
                          onClick={() => startReviewMutation.mutate(approval.id)}
                          disabled={startReviewMutation.isPending}
                          className="btn btn-secondary text-sm"
                        >
                          검토 시작
                        </button>
                      )}
                      {(approval.status === 'SUBMITTED' || approval.status === 'UNDER_REVIEW') && (
                        <button
                          onClick={() => {
                            setSelectedApproval(approval);
                            setReviewNotes('');
                            setActionError(null);
                          }}
                          className="btn btn-primary text-sm"
                        >
                          심사하기
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {selectedApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">크리에이티브 심사</h2>

              {/* Info */}
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedApproval.fileUrl && (
                      <img
                        src={selectedApproval.fileUrl}
                        alt="크리에이티브"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => window.open(selectedApproval.fileUrl, '_blank')}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{selectedApproval.brand?.name}</p>
                    <p className="text-sm text-slate-600">{getEventMonthLabel(selectedApproval.event)}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatDate(selectedApproval.createdAt)}
                    </p>
                    {selectedApproval.fileName && (
                      <p className="text-xs text-slate-400 mt-1">{selectedApproval.fileName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              <div className="mb-4">
                <label className="label">심사 의견 (거부 시 필수, 최소 10자)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="승인/거부 사유를 입력하세요..."
                />
              </div>

              {actionError && (
                <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedApproval(null);
                    setReviewNotes('');
                    setActionError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                  className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {rejectMutation.isPending ? '처리 중...' : '거부'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {approveMutation.isPending ? '처리 중...' : '승인'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

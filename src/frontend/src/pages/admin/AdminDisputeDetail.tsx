import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  XCircle,
  Eye,
  ArrowUpRight,
  Save,
  Send,
  Lock,
  Unlock,
  History,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils';

type ReportType =
  | 'CONTRACT_DISPUTE'
  | 'INAPPROPRIATE_CONTENT'
  | 'FRAUD_SUSPICION'
  | 'SERVICE_ISSUE'
  | 'OTHER';

type ReportStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'PENDING_INFO'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'DISMISSED';

type ReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface ReportComment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

interface ReportHistory {
  id: string;
  reportId: string;
  userId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

interface Report {
  id: string;
  reporterUserId: string;
  type: ReportType;
  status: ReportStatus;
  priority: ReportPriority;
  targetType: string;
  targetId: string;
  title: string;
  description: string;
  evidenceUrls: string[];
  assignedTo?: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments: ReportComment[];
  history: ReportHistory[];
}

const typeConfig: Record<ReportType, { label: string; color: string }> = {
  CONTRACT_DISPUTE: { label: '계약 분쟁', color: 'bg-red-100 text-red-700' },
  INAPPROPRIATE_CONTENT: { label: '부적절한 콘텐츠', color: 'bg-pink-100 text-pink-700' },
  FRAUD_SUSPICION: { label: '사기 의심', color: 'bg-orange-100 text-orange-700' },
  SERVICE_ISSUE: { label: '서비스 문제', color: 'bg-amber-100 text-amber-700' },
  OTHER: { label: '기타', color: 'bg-slate-100 text-slate-700' },
};

const statusConfig: Record<ReportStatus, { label: string; color: string; icon: React.ElementType }> = {
  OPEN: { label: '접수됨', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  IN_REVIEW: { label: '검토 중', color: 'bg-violet-100 text-violet-700', icon: Eye },
  PENDING_INFO: { label: '정보 대기', color: 'bg-amber-100 text-amber-700', icon: Clock },
  ESCALATED: { label: '에스컬레이션', color: 'bg-red-100 text-red-700', icon: ArrowUpRight },
  RESOLVED: { label: '해결됨', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  DISMISSED: { label: '기각됨', color: 'bg-slate-100 text-slate-600', icon: XCircle },
};

const priorityConfig: Record<ReportPriority, { label: string; color: string }> = {
  LOW: { label: '낮음', color: 'text-slate-500 bg-slate-100' },
  MEDIUM: { label: '보통', color: 'text-blue-600 bg-blue-100' },
  HIGH: { label: '높음', color: 'text-orange-600 bg-orange-100' },
  CRITICAL: { label: '긴급', color: 'text-red-600 bg-red-100 font-bold' },
};

const allStatuses: ReportStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'PENDING_INFO',
  'ESCALATED',
  'RESOLVED',
  'DISMISSED',
];

const allPriorities: ReportPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function AdminDisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch report detail
  const { data: report, isLoading } = useQuery({
    queryKey: ['adminReportDetail', id],
    queryFn: async () => {
      const res = await api.getAdminReportDetail(id!);
      return res.data as Report;
    },
    enabled: !!id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.updateReportStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReportDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      showSuccess('상태가 변경되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '상태 변경에 실패했습니다');
    },
  });

  // Update priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: (priority: string) => api.updateReportPriority(id!, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReportDetail', id] });
      showSuccess('우선순위가 변경되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '우선순위 변경에 실패했습니다');
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: () => api.addAdminReportComment(id!, newComment, isInternalComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReportDetail', id] });
      setNewComment('');
      showSuccess('댓글이 추가되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '댓글 추가에 실패했습니다');
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: () => api.resolveReport(id!, resolution, resolveStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReportDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['reportStats'] });
      setShowResolveModal(false);
      setResolution('');
      showSuccess(resolveStatus === 'RESOLVED' ? '신고가 해결되었습니다' : '신고가 기각되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '처리에 실패했습니다');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">신고를 찾을 수 없습니다</h2>
          <Link to="/admin/disputes" className="text-emerald-600 hover:underline">
            목록으로 돌아가기
          </Link>
        </div>
      </Layout>
    );
  }

  const typeCfg = typeConfig[report.type];
  const statusCfg = statusConfig[report.status];
  const priorityCfg = priorityConfig[report.priority];
  const StatusIcon = statusCfg.icon;
  const isResolved = report.status === 'RESOLVED' || report.status === 'DISMISSED';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/disputes')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('badge text-xs', typeCfg.color)}>{typeCfg.label}</span>
              <span className={cn('badge text-xs inline-flex items-center gap-1', statusCfg.color)}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
              <span className={cn('badge text-xs', priorityCfg.color)}>{priorityCfg.label}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 mb-4">신고 내용</h3>
              <p className="text-slate-700 whitespace-pre-wrap">{report.description}</p>

              {report.evidenceUrls && report.evidenceUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">증거 자료</h4>
                  <div className="flex flex-wrap gap-2">
                    {report.evidenceUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        자료 {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resolution */}
            {report.resolution && (
              <div className="card p-6 bg-emerald-50 border-emerald-200">
                <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  해결 내용
                </h3>
                <p className="text-emerald-800 whitespace-pre-wrap">{report.resolution}</p>
                {report.resolvedAt && (
                  <p className="text-sm text-emerald-600 mt-2">
                    {formatDate(report.resolvedAt)} 처리됨
                  </p>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 mb-4">댓글</h3>

              {report.comments && report.comments.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {report.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={cn(
                        'p-4 rounded-lg',
                        comment.isInternal
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-slate-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {comment.userId.slice(0, 8)}...
                        </span>
                        {comment.isInternal && (
                          <span className="badge text-xs bg-amber-200 text-amber-800">
                            <Lock className="w-3 h-3 mr-1" />
                            내부
                          </span>
                        )}
                        <span className="text-xs text-slate-500 ml-auto">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mb-6">아직 댓글이 없습니다</p>
              )}

              {/* Add Comment */}
              {!isResolved && (
                <div className="pt-4 border-t border-slate-100">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="input min-h-[100px] resize-y mb-2"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600"
                      />
                      {isInternalComment ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      내부 메모 (사용자에게 공개되지 않음)
                    </label>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      className="btn btn-primary inline-flex items-center gap-2"
                    >
                      {addCommentMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      전송
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 mb-4">신고 정보</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">대상 타입</span>
                  <span className="text-slate-900 font-medium">{report.targetType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">대상 ID</span>
                  <span className="text-slate-900 font-mono text-xs">{report.targetId.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">신고자</span>
                  <span className="text-slate-900 font-mono text-xs">{report.reporterUserId.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">접수일</span>
                  <span className="text-slate-900">{formatDate(report.createdAt)}</span>
                </div>
                {report.assignedTo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">담당자</span>
                    <span className="text-slate-900 font-mono text-xs">{report.assignedTo.slice(0, 8)}...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {!isResolved && (
              <div className="card p-6">
                <h3 className="font-semibold text-slate-900 mb-4">처리</h3>

                {/* Status Change */}
                <div className="mb-4">
                  <label className="label">상태 변경</label>
                  <select
                    value={report.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    disabled={updateStatusMutation.isPending}
                    className="input"
                  >
                    {allStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusConfig[status].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Change */}
                <div className="mb-4">
                  <label className="label">우선순위 변경</label>
                  <select
                    value={report.priority}
                    onChange={(e) => updatePriorityMutation.mutate(e.target.value)}
                    disabled={updatePriorityMutation.isPending}
                    className="input"
                  >
                    {allPriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityConfig[priority].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resolve Buttons */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => {
                      setResolveStatus('RESOLVED');
                      setShowResolveModal(true);
                    }}
                    className="w-full btn bg-emerald-500 text-white hover:bg-emerald-600 inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    해결 완료
                  </button>
                  <button
                    onClick={() => {
                      setResolveStatus('DISMISSED');
                      setShowResolveModal(true);
                    }}
                    className="w-full btn btn-secondary inline-flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    기각
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            {report.history && report.history.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  처리 이력
                </h3>
                <div className="space-y-3">
                  {report.history.slice(0, 10).map((item) => (
                    <div key={item.id} className="text-sm border-l-2 border-slate-200 pl-3">
                      <p className="text-slate-700">
                        <span className="font-medium">{item.action}</span>
                        {item.oldValue && item.newValue && (
                          <span className="text-slate-500">
                            {' '}{item.oldValue} → {item.newValue}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resolve Modal */}
        {showResolveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">
                  {resolveStatus === 'RESOLVED' ? '신고 해결' : '신고 기각'}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="label">
                    {resolveStatus === 'RESOLVED' ? '해결 내용 *' : '기각 사유 *'}
                  </label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder={resolveStatus === 'RESOLVED' ? '해결 내용을 입력하세요' : '기각 사유를 입력하세요'}
                    className="input min-h-[150px] resize-y"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowResolveModal(false);
                      setResolution('');
                    }}
                    className="btn btn-secondary"
                    disabled={resolveMutation.isPending}
                  >
                    취소
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate()}
                    className={cn(
                      'btn inline-flex items-center gap-2',
                      resolveStatus === 'RESOLVED'
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-500 text-white hover:bg-slate-600'
                    )}
                    disabled={!resolution.trim() || resolveMutation.isPending}
                  >
                    {resolveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {resolveStatus === 'RESOLVED' ? '해결 완료' : '기각'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminDisputeDetail;

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  AlertTriangle,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  MessageSquare,
  User,
  FileText,
  AlertCircle,
  Shield,
  XCircle,
  Eye,
  ArrowUpRight,
  Flag,
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
}

interface ReportStats {
  total: number;
  open: number;
  inReview: number;
  pendingInfo: number;
  escalated: number;
  resolved: number;
  dismissed: number;
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
  LOW: { label: '낮음', color: 'text-slate-500' },
  MEDIUM: { label: '보통', color: 'text-blue-600' },
  HIGH: { label: '높음', color: 'text-orange-600' },
  CRITICAL: { label: '긴급', color: 'text-red-600 font-bold' },
};

const allTypes: ReportType[] = [
  'CONTRACT_DISPUTE',
  'INAPPROPRIATE_CONTENT',
  'FRAUD_SUSPICION',
  'SERVICE_ISSUE',
  'OTHER',
];

const allStatuses: ReportStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'PENDING_INFO',
  'ESCALATED',
  'RESOLVED',
  'DISMISSED',
];

const allPriorities: ReportPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function AdminDisputes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ReportType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<ReportPriority | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['adminReports', statusFilter, typeFilter, priorityFilter, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (searchQuery) params.q = searchQuery;
      const res = await api.getAdminReportsList(params);
      return res.data || [];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['reportStats'],
    queryFn: async () => {
      const res = await api.getReportStats();
      return res.data as ReportStats;
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['reportStats'] });
      showSuccess('상태가 변경되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '상태 변경에 실패했습니다');
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

  const handleQuickStatusChange = (reportId: string, newStatus: ReportStatus) => {
    updateStatusMutation.mutate({ id: reportId, status: newStatus });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">신고/분쟁 관리</h1>
            <p className="text-slate-600 mt-1">사용자 신고 및 분쟁을 처리합니다</p>
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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">전체</p>
                  <p className="text-lg font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="card p-3 border-blue-200 bg-blue-50/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-600">접수됨</p>
                  <p className="text-lg font-bold text-blue-700">{stats.open}</p>
                </div>
              </div>
            </div>
            <div className="card p-3 border-violet-200 bg-violet-50/30">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-xs text-violet-600">검토 중</p>
                  <p className="text-lg font-bold text-violet-700">{stats.inReview}</p>
                </div>
              </div>
            </div>
            <div className="card p-3 border-amber-200 bg-amber-50/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-600">정보 대기</p>
                  <p className="text-lg font-bold text-amber-700">{stats.pendingInfo}</p>
                </div>
              </div>
            </div>
            <div className="card p-3 border-red-200 bg-red-50/30">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-xs text-red-600">에스컬레이션</p>
                  <p className="text-lg font-bold text-red-700">{stats.escalated}</p>
                </div>
              </div>
            </div>
            <div className="card p-3 border-emerald-200 bg-emerald-50/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600">해결됨</p>
                  <p className="text-lg font-bold text-emerald-700">{stats.resolved}</p>
                </div>
              </div>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">기각됨</p>
                  <p className="text-lg font-bold text-slate-600">{stats.dismissed}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="label">상태</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
                className="input"
              >
                <option value="">전체</option>
                {allStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusConfig[status].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="label">유형</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ReportType | '')}
                className="input"
              >
                <option value="">전체</option>
                {allTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeConfig[type].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="label">우선순위</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as ReportPriority | '')}
                className="input"
              >
                <option value="">전체</option>
                {allPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityConfig[priority].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[250px]">
              <label className="label">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목 또는 내용 검색..."
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Report List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flag className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">신고가 없습니다</h3>
              <p className="text-slate-500 text-sm">조건에 맞는 신고가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">우선순위</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">유형</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">제목</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">대상</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">상태</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">접수일</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reports as Report[]).map((report) => {
                    const typeCfg = typeConfig[report.type];
                    const statusCfg = statusConfig[report.status];
                    const priorityCfg = priorityConfig[report.priority];
                    const StatusIcon = statusCfg.icon;

                    return (
                      <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn('text-sm font-medium', priorityCfg.color)}>
                            {priorityCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('badge text-xs', typeCfg.color)}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 line-clamp-1 max-w-[200px]">
                            {report.title}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-1 max-w-[200px]">
                            {report.description}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            {report.targetType === 'CONTRACT' ? (
                              <FileText className="w-4 h-4" />
                            ) : report.targetType === 'BRAND' ? (
                              <Shield className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                            <span>{report.targetType}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('badge text-xs inline-flex items-center gap-1', statusCfg.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">{formatDate(report.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/admin/disputes/${report.id}`}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="상세 보기"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            {report.status === 'OPEN' && (
                              <button
                                onClick={() => handleQuickStatusChange(report.id, 'IN_REVIEW')}
                                className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                title="검토 시작"
                                disabled={updateStatusMutation.isPending}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default AdminDisputes;

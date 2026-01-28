import { useState, useEffect } from 'react';
import { Building2, Check, X, AlertCircle, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

interface AgencyRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  message?: string;
  createdAt: string;
  agency: {
    id: string;
    name: string;
    bizNo?: string;
    contactEmail?: string;
    kycStatus: string;
    user: {
      email: string;
    };
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: '대기중', color: 'bg-amber-100 text-amber-700', icon: Clock },
  APPROVED: { label: '승인됨', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  REJECTED: { label: '거부됨', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: '취소됨', color: 'bg-slate-100 text-slate-700', icon: X },
};

export function AthleteAgencyRequests() {
  const [requests, setRequests] = useState<AgencyRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAgencyRequests({
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
      setRequests(res.data?.requests || []);
      setPagination(res.data?.pagination || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '요청 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleApprove = async (requestId: string) => {
    if (!confirm('이 에이전시와 연결하시겠습니까? 연결 후에는 다른 에이전시의 요청이 자동으로 거부됩니다.')) {
      return;
    }

    try {
      setProcessingId(requestId);
      await api.approveAgencyRequest(requestId);
      setSuccessMessage('에이전시와 연결되었습니다');
      fetchRequests(pagination?.page || 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '승인 처리에 실패했습니다');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await api.rejectAgencyRequest(requestId, rejectReason || undefined);
      setSuccessMessage('요청을 거부했습니다');
      setShowRejectModal(null);
      setRejectReason('');
      fetchRequests(pagination?.page || 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '거부 처리에 실패했습니다');
    } finally {
      setProcessingId(null);
    }
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

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">에이전시 연결 요청</h1>
          <p className="text-slate-600 mt-1">
            에이전시로부터 받은 연결 요청을 관리합니다
          </p>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              &times;
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">상태 필터:</label>
            <select
              className="input w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">전체</option>
              <option value="PENDING">대기중 {pendingCount > 0 && `(${pendingCount})`}</option>
              <option value="APPROVED">승인됨</option>
              <option value="REJECTED">거부됨</option>
              <option value="CANCELLED">취소됨</option>
            </select>
          </div>
        </div>

        {/* Request List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length > 0 ? (
          <>
            <div className="card divide-y divide-slate-100">
              {requests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-7 h-7 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{request.agency.name}</p>
                          <p className="text-sm text-slate-500">{request.agency.user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {request.agency.bizNo && (
                              <span className="text-xs text-slate-400">
                                사업자번호: {request.agency.bizNo}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              요청일: {formatDate(request.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {request.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => setShowRejectModal(request.id)}
                              disabled={processingId === request.id}
                              className="btn btn-secondary text-sm px-4 py-2 inline-flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                              거부
                            </button>
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="btn btn-primary text-sm px-4 py-2 inline-flex items-center gap-1"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  승인
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-4 h-4" />
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message */}
                    {request.message && (
                      <div className="mt-3 pl-[72px]">
                        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                          <span className="font-medium">메시지:</span> {request.message}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => fetchRequests(page)}
                    className={`px-3 py-1 rounded ${
                      page === pagination.page
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card p-12 text-center">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">
              {statusFilter ? '해당 상태의 요청이 없습니다' : '받은 연결 요청이 없습니다'}
            </p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">연결 요청 거부</h3>
            <div className="mb-4">
              <label className="label">거부 사유 (선택)</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="에이전시에게 전달할 거부 사유를 입력하세요"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
                disabled={processingId === showRejectModal}
              >
                {processingId === showRejectModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '거부하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

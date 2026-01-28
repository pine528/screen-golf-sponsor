import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Users, ArrowLeft, AlertCircle, X, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

interface ConnectionRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  message?: string;
  rejectedReason?: string;
  createdAt: string;
  respondedAt?: string;
  athlete: {
    id: string;
    name: string;
    tour: string;
    profileImageUrl?: string;
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

export function AgencySentRequests() {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRequests = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSentConnectionRequests({
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

  const handleCancel = async (requestId: string) => {
    if (!confirm('요청을 취소하시겠습니까?')) return;

    try {
      setCancellingId(requestId);
      await api.cancelConnectionRequest(requestId);
      setSuccessMessage('요청이 취소되었습니다');
      fetchRequests(pagination?.page || 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '요청 취소에 실패했습니다');
    } finally {
      setCancellingId(null);
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/agency/athletes"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              소속 선수 목록
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">보낸 연결 요청</h1>
            <p className="text-slate-600 mt-1">선수에게 보낸 연결 요청 현황입니다</p>
          </div>
          <Link
            to="/agency/athletes/search"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            선수 검색
          </Link>
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
              <option value="PENDING">대기중</option>
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
                        <div className="w-14 h-14 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                          {request.athlete.profileImageUrl ? (
                            <img
                              src={request.athlete.profileImageUrl}
                              alt={request.athlete.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="w-7 h-7 text-slate-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{request.athlete.name}</p>
                          <p className="text-sm text-slate-500">{request.athlete.user.email}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {request.athlete.tour} · 요청일: {formatDate(request.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${statusConfig.color}`}
                        >
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig.label}
                        </span>
                        {request.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancel(request.id)}
                            disabled={cancellingId === request.id}
                            className="btn btn-secondary text-sm px-3 py-1"
                          >
                            {cancellingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '취소'
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Additional Info */}
                    {(request.message || request.rejectedReason || request.respondedAt) && (
                      <div className="mt-3 pl-[72px] space-y-1">
                        {request.message && (
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">보낸 메시지:</span> {request.message}
                          </p>
                        )}
                        {request.rejectedReason && (
                          <p className="text-sm text-red-600">
                            <span className="font-medium">거부 사유:</span> {request.rejectedReason}
                          </p>
                        )}
                        {request.respondedAt && (
                          <p className="text-xs text-slate-400">
                            응답일: {formatDate(request.respondedAt)}
                          </p>
                        )}
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
            <Send className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">
              {statusFilter ? '해당 상태의 요청이 없습니다' : '보낸 연결 요청이 없습니다'}
            </p>
            <Link
              to="/agency/athletes/search"
              className="btn btn-primary inline-flex items-center gap-2 mt-4"
            >
              <Users className="w-4 h-4" />
              선수 검색하기
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}

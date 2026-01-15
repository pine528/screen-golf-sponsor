import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  Globe,
  Calendar,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';

interface BrandRegistrationRequest {
  id: string;
  brandName: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  note?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  fan: {
    id: string;
    nickname?: string;
    user: {
      id: string;
      email: string;
    };
  };
}

export function AdminBrandRegistrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<BrandRegistrationRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const limit = 20;

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-brand-registrations', statusFilter, searchTerm, page],
    queryFn: async () => {
      const res = await api.getAdminBrandRegistrations({
        status: statusFilter || undefined,
        q: searchTerm || undefined,
        page,
        limit,
      });
      return res.data as { data: BrandRegistrationRequest[]; meta: { total: number } };
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote?: string }) =>
      api.approveBrandRegistration(id, adminNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brand-registrations'] });
      setShowModal(false);
      setSelectedItem(null);
      setAdminNote('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote?: string }) =>
      api.rejectBrandRegistration(id, adminNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brand-registrations'] });
      setShowModal(false);
      setSelectedItem(null);
      setAdminNote('');
    },
  });

  const requests = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            대기중
          </span>
        );
      case 'APPROVED':
        return (
          <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            승인됨
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            반려됨
          </span>
        );
      default:
        return null;
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

  const handleApprove = () => {
    if (selectedItem) {
      approveMutation.mutate({ id: selectedItem.id, adminNote });
    }
  };

  const handleReject = () => {
    if (selectedItem) {
      rejectMutation.mutate({ id: selectedItem.id, adminNote });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">브랜드 등록 신청</h1>
            <p className="text-slate-600 mt-1">팬 사용자의 브랜드 전환 신청을 관리합니다</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              대기중: {statusFilter === 'SUBMITTED' ? total : '-'}건
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="브랜드명 또는 이메일 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="input w-40"
              >
                <option value="">전체</option>
                <option value="SUBMITTED">대기중</option>
                <option value="APPROVED">승인됨</option>
                <option value="REJECTED">반려됨</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">신청 내역이 없습니다</h3>
              <p className="text-slate-600">
                {statusFilter === 'SUBMITTED'
                  ? '대기중인 브랜드 등록 신청이 없습니다'
                  : '검색 결과가 없습니다'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-sky-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{request.brandName}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            <span>{request.contactEmail}</span>
                          </div>
                          {request.contactPhone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              <span>{request.contactPhone}</span>
                            </div>
                          )}
                          {request.website && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-4 h-4" />
                              <a
                                href={request.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline"
                              >
                                웹사이트
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(request.createdAt)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                          신청자: {request.fan.nickname || request.fan.user.email}
                        </p>
                        {request.note && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {request.note}
                          </p>
                        )}
                      </div>
                    </div>
                    {request.status === 'SUBMITTED' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedItem(request);
                            setShowModal(true);
                            setAdminNote('');
                          }}
                          className="btn btn-primary btn-sm inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          승인
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(request);
                            setShowModal(true);
                            setAdminNote('');
                          }}
                          className="btn btn-danger btn-sm inline-flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          반려
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        {request.reviewedAt && (
                          <p>처리일: {formatDate(request.reviewedAt)}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {request.adminNote && (
                    <div
                      className={cn(
                        'mt-3 p-3 rounded-lg text-sm',
                        request.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      )}
                    >
                      <p className="font-medium mb-1">관리자 메모</p>
                      <p>{request.adminNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                총 {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedItem.brandName}</h2>
                  <p className="text-sm text-slate-600">브랜드 등록 심사</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">담당자 이메일</p>
                  <p className="font-medium text-slate-900">{selectedItem.contactEmail}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">연락처</p>
                  <p className="font-medium text-slate-900">{selectedItem.contactPhone || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                  <p className="text-xs text-slate-500 mb-1">웹사이트</p>
                  <p className="font-medium text-slate-900">
                    {selectedItem.website ? (
                      <a
                        href={selectedItem.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline"
                      >
                        {selectedItem.website}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                  <p className="text-xs text-slate-500 mb-1">신청자</p>
                  <p className="font-medium text-slate-900">
                    {selectedItem.fan.nickname || '-'} ({selectedItem.fan.user.email})
                  </p>
                </div>
              </div>

              {selectedItem.note && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">신청 메모</p>
                  <p className="text-sm text-slate-700">{selectedItem.note}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-900 mb-2 block">
                  관리자 메모 (반려 시 사유 필수)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="심사 의견을 입력하세요"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedItem(null);
                }}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || approveMutation.isPending}
                className="btn btn-danger flex-1 inline-flex items-center justify-center gap-2"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                반려
              </button>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                승인
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

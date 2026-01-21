/**
 * Phase 11-2A: Admin Tax Invoices Page
 * 세금계산서 관리 (승인/거부/발행)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

// 세금계산서 상태
const TAX_INVOICE_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: { label: '요청됨', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
  APPROVED: { label: '승인됨', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  ISSUED: { label: '발행완료', color: 'text-green-600 bg-green-50 border-green-200', icon: FileCheck },
  REJECTED: { label: '거부됨', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
};

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'REQUESTED', label: '요청됨' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'ISSUED', label: '발행완료' },
  { value: 'REJECTED', label: '거부됨' },
];

export default function AdminTaxInvoices() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 목록 조회
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['adminTaxInvoices', page, statusFilter],
    queryFn: () => api.getAdminTaxInvoices({ page, pageSize: 20, status: statusFilter || undefined }),
  });

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ['adminTaxInvoiceStats'],
    queryFn: () => api.getAdminTaxInvoiceStats(),
  });

  // 승인 뮤테이션
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveTaxInvoice(id),
    onSuccess: () => {
      setSuccess('세금계산서가 승인되었습니다.');
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoiceStats'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '승인 실패');
    },
  });

  // 거부 뮤테이션
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectTaxInvoice(id, reason),
    onSuccess: () => {
      setSuccess('세금계산서가 거부되었습니다.');
      setSelectedInvoice(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoiceStats'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '거부 실패');
    },
  });

  // 발행 뮤테이션
  const issueMutation = useMutation({
    mutationFn: ({ id, invoiceNumber, confirmText }: { id: string; invoiceNumber: string; confirmText: string }) =>
      api.issueTaxInvoice(id, invoiceNumber, confirmText),
    onSuccess: () => {
      setSuccess('세금계산서가 발행되었습니다.');
      setSelectedInvoice(null);
      setInvoiceNumber('');
      setConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['adminTaxInvoiceStats'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '발행 실패');
    },
  });

  const invoices = invoicesData?.data || [];
  const pagination = invoicesData?.pagination;
  const stats = statsData?.data;

  const handleApprove = (invoice: any) => {
    setError('');
    approveMutation.mutate(invoice.id);
  };

  const handleReject = () => {
    if (!selectedInvoice) return;
    if (rejectReason.length < 10) {
      setError('거부 사유는 10자 이상 입력해야 합니다.');
      return;
    }
    setError('');
    rejectMutation.mutate({ id: selectedInvoice.id, reason: rejectReason });
  };

  const handleIssue = () => {
    if (!selectedInvoice) return;
    if (!invoiceNumber.trim()) {
      setError('세금계산서 번호를 입력해주세요.');
      return;
    }
    if (confirmText !== 'ISSUE') {
      setError('확인을 위해 "ISSUE"를 정확히 입력해주세요.');
      return;
    }
    setError('');
    issueMutation.mutate({ id: selectedInvoice.id, invoiceNumber: invoiceNumber.trim(), confirmText });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-blue-600" />
            세금계산서 관리
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            브랜드의 세금계산서 발행 요청을 관리합니다.
          </p>
        </div>

        {/* 알림 메시지 */}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto text-emerald-500 hover:text-emerald-700">&times;</button>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card p-4">
            <div className="text-sm text-slate-500 mb-1">전체</div>
            <div className="text-2xl font-bold text-slate-900">{stats?.total || 0}</div>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="text-sm text-blue-600 mb-1">요청됨</div>
            <div className="text-2xl font-bold text-blue-700">{stats?.requested || 0}</div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="text-sm text-emerald-600 mb-1">승인됨</div>
            <div className="text-2xl font-bold text-emerald-700">{stats?.approved || 0}</div>
          </div>
          <div className="card p-4 border-l-4 border-green-500">
            <div className="text-sm text-green-600 mb-1">발행완료</div>
            <div className="text-2xl font-bold text-green-700">{stats?.issued || 0}</div>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <div className="text-sm text-red-600 mb-1">거부됨</div>
            <div className="text-2xl font-bold text-red-700">{stats?.rejected || 0}</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 목록 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            요청 목록 ({pagination?.total || 0}건)
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              로딩 중...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              세금계산서 요청이 없습니다.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-medium text-slate-600">요청일</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">브랜드</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">기간</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-600">금액</th>
                      <th className="text-center py-3 px-2 font-medium text-slate-600">상태</th>
                      <th className="text-center py-3 px-2 font-medium text-slate-600">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice: any) => {
                      const statusInfo = TAX_INVOICE_STATUS[invoice.status] || TAX_INVOICE_STATUS.REQUESTED;
                      const StatusIcon = statusInfo.icon;
                      const brand = invoice.billingProfile?.brand;
                      return (
                        <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2 text-slate-600">
                            {new Date(invoice.requestedAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-medium text-slate-900">{brand?.name || '-'}</div>
                            <div className="text-xs text-slate-500">{invoice.billingProfile?.businessName}</div>
                          </td>
                          <td className="py-3 px-2 text-slate-600">
                            {new Date(invoice.fromDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            {' ~ '}
                            {new Date(invoice.toDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-slate-900">
                            {formatCurrency(Number(invoice.totalAmount))}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border', statusInfo.color)}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {invoice.status === 'REQUESTED' && (
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => handleApprove(invoice)}
                                  disabled={approveMutation.isPending}
                                  className="btn btn-sm bg-emerald-500 text-white hover:bg-emerald-600"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => { setSelectedInvoice(invoice); setRejectReason(''); }}
                                  className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                                >
                                  거부
                                </button>
                              </div>
                            )}
                            {invoice.status === 'APPROVED' && (
                              <button
                                onClick={() => { setSelectedInvoice(invoice); setInvoiceNumber(''); setConfirmText(''); }}
                                className="btn btn-sm bg-blue-500 text-white hover:bg-blue-600"
                              >
                                발행
                              </button>
                            )}
                            {invoice.status === 'ISSUED' && (
                              <span className="text-xs text-slate-500">{invoice.invoiceNumber}</span>
                            )}
                            {invoice.status === 'REJECTED' && (
                              <span className="text-xs text-red-500" title={invoice.rejectionReason}>
                                사유 보기
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="btn btn-outline btn-sm"
                  >
                    이전
                  </button>
                  <span className="flex items-center px-3 text-sm text-slate-600">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="btn btn-outline btn-sm"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 거부 모달 */}
        {selectedInvoice && selectedInvoice.status === 'REQUESTED' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                세금계산서 거부
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                거부 사유를 입력해주세요 (10자 이상).
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거부 사유를 입력하세요..."
                className="input w-full h-24 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="btn btn-outline"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || rejectReason.length < 10}
                  className="btn bg-red-500 text-white hover:bg-red-600"
                >
                  {rejectMutation.isPending ? '처리 중...' : '거부'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 발행 모달 (Danger Zone) */}
        {selectedInvoice && selectedInvoice.status === 'APPROVED' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                세금계산서 발행 (Danger Zone)
              </h3>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <p className="text-sm text-amber-700">
                  세금계산서 발행은 취소할 수 없습니다. 신중하게 진행해주세요.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    세금계산서 번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="20240101-001"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    확인을 위해 "ISSUE"를 입력하세요 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ISSUE"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="btn btn-outline"
                >
                  취소
                </button>
                <button
                  onClick={handleIssue}
                  disabled={issueMutation.isPending || confirmText !== 'ISSUE' || !invoiceNumber.trim()}
                  className="btn bg-amber-500 text-white hover:bg-amber-600"
                >
                  {issueMutation.isPending ? '처리 중...' : '발행 확인'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

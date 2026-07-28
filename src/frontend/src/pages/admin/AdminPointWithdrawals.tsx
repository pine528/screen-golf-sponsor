import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Coins,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Banknote,
  Check,
  X,
} from 'lucide-react';
import { cn } from '../../utils';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: {
    label: '요청중',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
  APPROVED: {
    label: '승인됨',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle,
  },
  REJECTED: {
    label: '거부됨',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
  PAID: {
    label: '지급완료',
    color: 'bg-emerald-100 text-emerald-700',
    icon: Banknote,
  },
};

interface WithdrawalRequest {
  id: string;
  amount: string;
  status: string;
  bankName: string;
  bankAccountMasked: string;
  accountHolder: string;
  requestedReason?: string;
  adminNote?: string;
  payoutReference?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export default function AdminPointWithdrawals() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('REQUESTED');
  const [rejectModal, setRejectModal] = useState<{ id: string; show: boolean }>({ id: '', show: false });
  const [rejectReason, setRejectReason] = useState('');
  const [completeModal, setCompleteModal] = useState<{ id: string; show: boolean }>({ id: '', show: false });
  const [payoutReference, setPayoutReference] = useState('');

  // 출금 요청 목록
  const { data, isLoading } = useQuery({
    queryKey: ['adminPointWithdrawals', statusFilter],
    queryFn: () => api.getAdminPointWithdrawals({ status: statusFilter || undefined }),
  });

  // 승인
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePointWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointWithdrawals'] });
    },
  });

  // 거부
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.rejectPointWithdrawal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointWithdrawals'] });
      setRejectModal({ id: '', show: false });
      setRejectReason('');
    },
  });

  // 지급 완료
  const completeMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference?: string }) =>
      api.completePointWithdrawal(id, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointWithdrawals'] });
      setCompleteModal({ id: '', show: false });
      setPayoutReference('');
    },
  });

  const withdrawals: WithdrawalRequest[] = data?.data?.requests || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-6 h-6" />
          포인트 출금 관리
        </h1>

        {/* 필터 */}
        <div className="flex gap-2">
          {['', 'REQUESTED', 'APPROVED', 'REJECTED', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {status === '' ? '전체' : STATUS_MAP[status]?.label || status}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-lg border">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              출금 요청이 없습니다
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">요청자</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">금액</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">계좌정보</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">요청일</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {withdrawals.map((w) => {
                  const statusInfo = STATUS_MAP[w.status] || STATUS_MAP.REQUESTED;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{w.user.name}</div>
                        <div className="text-sm text-gray-500">{w.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-lg">
                          {Number(w.amount).toLocaleString()}P
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {w.bankName} {w.bankAccountMasked}
                        </div>
                        <div className="text-sm text-gray-500">{w.accountHolder}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
                            statusInfo.color
                          )}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {w.status === 'REQUESTED' && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(w.id)}
                                disabled={approveMutation.isPending}
                                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                                title="승인"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRejectModal({ id: w.id, show: true })}
                                className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                title="거부"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {w.status === 'APPROVED' && (
                            <button
                              onClick={() => setCompleteModal({ id: w.id, show: true })}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                            >
                              지급완료
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 거부 모달 */}
        {rejectModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">출금 요청 거부</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거부 사유를 입력하세요 (선택)"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 mb-4"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectModal({ id: '', show: false })}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                  disabled={rejectMutation.isPending}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '거부'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 지급완료 모달 */}
        {completeModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">지급 완료 처리</h3>
              <input
                type="text"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                placeholder="이체 참조번호 (선택)"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setCompleteModal({ id: '', show: false })}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => completeMutation.mutate({ id: completeModal.id, reference: payoutReference })}
                  disabled={completeMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '완료'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

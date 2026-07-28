import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  AlertCircle,
  Banknote,
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
}

export default function AthleteWithdrawals() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    bankName: '',
    bankAccountNumber: '',
    accountHolder: '',
    reason: '',
  });
  const [statusFilter, setStatusFilter] = useState<string>('');

  // 내 프로필 (은행 정보 가져오기)
  const { data: profileData } = useQuery({
    queryKey: ['my-athlete'],
    queryFn: () => api.getMyAthlete(),
  });

  // 출금 가능 잔액 조회
  const { data: balanceData, isLoading: loadingBalance } = useQuery({
    queryKey: ['withdrawalBalance'],
    queryFn: () => api.getWithdrawalAvailableBalance(),
  });

  // 내 출금 요청 목록
  const { data: withdrawalsData, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ['myWithdrawals', statusFilter],
    queryFn: () => api.getMyWithdrawals({ status: statusFilter || undefined }),
  });

  // 출금 요청 생성
  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.createWithdrawalRequest(
        {
          amount: Number(data.amount),
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          accountHolder: data.accountHolder,
          reason: data.reason || undefined,
        },
        `withdrawal-${Date.now()}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalBalance'] });
      queryClient.invalidateQueries({ queryKey: ['myWithdrawals'] });
      setShowForm(false);
      setForm({ amount: '', bankName: '', bankAccountNumber: '', accountHolder: '', reason: '' });
    },
  });

  const balance = balanceData?.data;
  const withdrawals: WithdrawalRequest[] = withdrawalsData?.data?.requests || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.bankName || !form.bankAccountNumber || !form.accountHolder) {
      alert('필수 항목을 모두 입력해주세요');
      return;
    }
    const amount = Number(form.amount);
    if (amount <= 0) {
      alert('출금 금액은 0보다 커야 합니다');
      return;
    }
    if (balance && amount > balance.available) {
      alert(`출금 가능 금액(${balance.available.toLocaleString()}원)을 초과했습니다`);
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          출금 관리
        </h1>

        {/* 잔액 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="text-2xl font-bold text-gray-900">
              {loadingBalance ? '...' : `${(balance?.balance || 0).toLocaleString()}원`}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">출금 대기중</p>
            <p className="text-2xl font-bold text-amber-600">
              {loadingBalance ? '...' : `${(balance?.frozenAmount || 0).toLocaleString()}원`}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">출금 가능</p>
            <p className="text-2xl font-bold text-emerald-600">
              {loadingBalance ? '...' : `${(balance?.available || 0).toLocaleString()}원`}
            </p>
          </div>
        </div>

        {/* 출금 요청 버튼/폼 */}
        <div className="bg-white rounded-lg border p-4">
          {!showForm ? (
            <button
              onClick={() => {
                // 프로필에서 등록된 계좌 정보 자동 입력
                const profile = profileData?.data;
                const bankInfo = profile?.bankAccount || {};
                setForm({
                  amount: '',
                  bankName: bankInfo.bankName || '',
                  bankAccountNumber: bankInfo.accountNumber || '',
                  accountHolder: bankInfo.accountHolder || '',
                  reason: '',
                });
                setShowForm(true);
              }}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              새 출금 요청
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-semibold text-lg">출금 요청</h3>

              <div>
                <label className="block text-sm font-medium mb-1">출금 금액 *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="출금할 금액을 입력하세요"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  min="1"
                  max={balance?.available || 0}
                />
                <p className="text-sm text-gray-500 mt-1">
                  출금 가능: {(balance?.available || 0).toLocaleString()}원
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">은행명 *</label>
                  <select
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">은행 선택</option>
                    <option value="국민은행">국민은행</option>
                    <option value="신한은행">신한은행</option>
                    <option value="우리은행">우리은행</option>
                    <option value="하나은행">하나은행</option>
                    <option value="농협은행">농협은행</option>
                    <option value="기업은행">기업은행</option>
                    <option value="SC제일은행">SC제일은행</option>
                    <option value="카카오뱅크">카카오뱅크</option>
                    <option value="토스뱅크">토스뱅크</option>
                    <option value="케이뱅크">케이뱅크</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">예금주 *</label>
                  <input
                    type="text"
                    value={form.accountHolder}
                    onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
                    placeholder="예금주명"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">계좌번호 *</label>
                <input
                  type="text"
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                  placeholder="- 없이 입력"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  계좌번호는 마스킹되어 저장됩니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">요청 사유 (선택)</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="출금 사유가 있다면 입력해주세요"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  출금 요청
                </button>
              </div>

              {createMutation.isError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {(() => {
                    const err = createMutation.error as any;
                    const data = err?.response?.data;
                    // 통일된 에러 형식: { error: { message: '...' } }
                    if (data?.error?.message) return data.error.message;
                    // 구형 에러 형식: { error: '...' }
                    if (typeof data?.error === 'string') return data.error;
                    // 기타
                    return '출금 요청에 실패했습니다';
                  })()}
                </div>
              )}
            </form>
          )}
        </div>

        {/* 출금 요청 목록 */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">내 출금 요청</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="">전체</option>
              <option value="REQUESTED">요청중</option>
              <option value="APPROVED">승인됨</option>
              <option value="REJECTED">거부됨</option>
              <option value="PAID">지급완료</option>
            </select>
          </div>

          {loadingWithdrawals ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              출금 요청 내역이 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {withdrawals.map((w) => {
                const statusInfo = STATUS_MAP[w.status] || STATUS_MAP.REQUESTED;
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={w.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">
                            {Number(w.amount).toLocaleString()}원
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                              statusInfo.color
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {w.bankName} {w.bankAccountMasked} ({w.accountHolder})
                        </p>
                        {w.requestedReason && (
                          <p className="text-sm text-gray-500 mt-1">
                            요청 사유: {w.requestedReason}
                          </p>
                        )}
                        {w.adminNote && (
                          <p className="text-sm text-gray-500 mt-1">
                            관리자 메모: {w.adminNote}
                          </p>
                        )}
                        {w.payoutReference && (
                          <p className="text-sm text-emerald-600 mt-1">
                            이체 참조: {w.payoutReference}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>요청: {new Date(w.createdAt).toLocaleDateString()}</p>
                        {w.paidAt && (
                          <p className="text-emerald-600">
                            지급: {new Date(w.paidAt).toLocaleDateString()}
                          </p>
                        )}
                        {w.rejectedAt && (
                          <p className="text-red-600">
                            거부: {new Date(w.rejectedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

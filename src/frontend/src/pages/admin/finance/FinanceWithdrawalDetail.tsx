import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';
import {
  ArrowLeft,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  Banknote,
  Loader2,
  AlertTriangle,
  User,
} from 'lucide-react';
import { cn } from '../../../utils';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: {
    label: '요청중',
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    icon: Clock,
  },
  APPROVED: {
    label: '승인됨',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: CheckCircle,
  },
  REJECTED: {
    label: '거부됨',
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: XCircle,
  },
  PAID: {
    label: '지급완료',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    icon: Banknote,
  },
};

export default function FinanceWithdrawalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [payoutReference, setPayoutReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | 'pay' | null>(null);

  // 상세 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['adminWithdrawal', id],
    queryFn: () => api.getAdminWithdrawal(id!),
    enabled: !!id,
  });

  const withdrawal = data?.data;

  // 승인
  const approveMutation = useMutation({
    mutationFn: () =>
      api.approveWithdrawal(id!, {
        confirmText,
        reason: approveNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawal', id] });
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      setActiveAction(null);
      setConfirmText('');
      setApproveNote('');
    },
  });

  // 거부
  const rejectMutation = useMutation({
    mutationFn: () =>
      api.rejectWithdrawal(id!, {
        confirmText,
        reason: rejectReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawal', id] });
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      setActiveAction(null);
      setConfirmText('');
      setRejectReason('');
    },
  });

  // 지급완료
  const payMutation = useMutation({
    mutationFn: () =>
      api.markWithdrawalPaid(id!, {
        confirmText,
        payoutReference,
        reason: payNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawal', id] });
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      setActiveAction(null);
      setConfirmText('');
      setPayoutReference('');
      setPayNote('');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  if (error || !withdrawal) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">
            출금 요청을 찾을 수 없습니다
          </div>
        </div>
      </Layout>
    );
  }

  const statusInfo = STATUS_MAP[withdrawal.status] || STATUS_MAP.REQUESTED;
  const StatusIcon = statusInfo.icon;
  const expectedConfirm = id!.slice(-6).toUpperCase();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/finance/withdrawals')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            출금 목록
          </button>
          <span
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 border',
              statusInfo.color
            )}
          >
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </span>
        </div>

        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          출금 요청 상세
        </h1>

        {/* 요청 정보 */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg">요청 정보</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">ID</p>
              <p className="font-mono">{withdrawal.id}</p>
            </div>
            <div>
              <p className="text-gray-500">요청일</p>
              <p>{new Date(withdrawal.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">금액</p>
              <p className="text-xl font-bold">{Number(withdrawal.amount).toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-500">상태</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  statusInfo.color
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </span>
            </div>
          </div>

          <hr />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">은행</p>
              <p>{withdrawal.bankName}</p>
            </div>
            <div>
              <p className="text-gray-500">계좌번호</p>
              <p>{withdrawal.bankAccountMasked}</p>
            </div>
            <div>
              <p className="text-gray-500">예금주</p>
              <p>{withdrawal.accountHolder}</p>
            </div>
            {withdrawal.requestedReason && (
              <div className="col-span-2">
                <p className="text-gray-500">요청 사유</p>
                <p>{withdrawal.requestedReason}</p>
              </div>
            )}
          </div>

          {withdrawal.adminNote && (
            <>
              <hr />
              <div>
                <p className="text-gray-500 text-sm">관리자 메모</p>
                <p>{withdrawal.adminNote}</p>
              </div>
            </>
          )}

          {withdrawal.payoutReference && (
            <>
              <hr />
              <div>
                <p className="text-gray-500 text-sm">이체 참조번호</p>
                <p className="font-mono text-emerald-600">{withdrawal.payoutReference}</p>
              </div>
            </>
          )}
        </div>

        {/* 선수 정보 */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            선수 정보
          </h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">선수명</p>
              <p className="font-medium">{withdrawal.athlete?.name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">이메일</p>
              <p>{withdrawal.athlete?.user?.email || '-'}</p>
            </div>
          </div>

          {withdrawal.wallet && (
            <>
              <hr />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">현재 잔액</p>
                  <p className="font-semibold">
                    {Number(withdrawal.wallet.balance).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">동결 금액</p>
                  <p className="font-semibold text-amber-600">
                    {Number(withdrawal.wallet.frozenAmount).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">가용 잔액</p>
                  <p className="font-semibold text-emerald-600">
                    {(
                      Number(withdrawal.wallet.balance) - Number(withdrawal.wallet.frozenAmount)
                    ).toLocaleString()}
                    원
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Danger Zone - 액션 버튼 */}
        {withdrawal.status === 'REQUESTED' && (
          <div className="bg-white rounded-lg border border-amber-300 p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              처리 (Danger Zone)
            </h2>

            {!activeAction && (
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveAction('approve')}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  승인하기
                </button>
                <button
                  onClick={() => setActiveAction('reject')}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  거부하기
                </button>
              </div>
            )}

            {activeAction === 'approve' && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  이 출금 요청을 승인하시겠습니까? 승인 후 실제 은행 이체를 진행해야 합니다.
                </p>
                <input
                  type="text"
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="메모 (선택)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`확인을 위해 '${expectedConfirm}' 입력`}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveAction(null);
                      setConfirmText('');
                    }}
                    className="flex-1 py-2 border rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending || confirmText.toUpperCase() !== expectedConfirm}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {approveMutation.isPending ? '처리중...' : '승인 확인'}
                  </button>
                </div>
                {approveMutation.isError && (
                  <p className="text-sm text-red-600">
                    {(approveMutation.error as any)?.response?.data?.error?.message || '승인에 실패했습니다'}
                  </p>
                )}
              </div>
            )}

            {activeAction === 'reject' && (
              <div className="space-y-3 p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  이 출금 요청을 거부하시겠습니까? 동결된 금액이 해제됩니다.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거부 사유 (10자 이상 필수)"
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`확인을 위해 '${expectedConfirm}' 입력`}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveAction(null);
                      setConfirmText('');
                    }}
                    className="flex-1 py-2 border rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate()}
                    disabled={
                      rejectMutation.isPending ||
                      confirmText.toUpperCase() !== expectedConfirm ||
                      rejectReason.length < 10
                    }
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {rejectMutation.isPending ? '처리중...' : '거부 확인'}
                  </button>
                </div>
                {rejectMutation.isError && (
                  <p className="text-sm text-red-600">
                    {(rejectMutation.error as any)?.response?.data?.error?.message || '거부에 실패했습니다'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 지급 완료 처리 */}
        {withdrawal.status === 'APPROVED' && (
          <div className="bg-white rounded-lg border border-emerald-300 p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-emerald-700">
              <Banknote className="w-5 h-5" />
              지급 완료 처리
            </h2>

            {!activeAction && (
              <button
                onClick={() => setActiveAction('pay')}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                지급 완료 처리
              </button>
            )}

            {activeAction === 'pay' && (
              <div className="space-y-3 p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-800">
                  실제 은행 이체가 완료되었나요? 지급 완료 처리 시 선수 지갑에서 금액이 차감됩니다.
                </p>
                <input
                  type="text"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  placeholder="이체 참조번호 / 거래번호 (필수)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="메모 (선택)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="확인을 위해 'PAY' 입력"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveAction(null);
                      setConfirmText('');
                    }}
                    className="flex-1 py-2 border rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => payMutation.mutate()}
                    disabled={
                      payMutation.isPending ||
                      confirmText.toUpperCase() !== 'PAY' ||
                      !payoutReference.trim()
                    }
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {payMutation.isPending ? '처리중...' : '지급 완료 확인'}
                  </button>
                </div>
                {payMutation.isError && (
                  <p className="text-sm text-red-600">
                    {(payMutation.error as any)?.response?.data?.error?.message || '지급 완료 처리에 실패했습니다'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 처리 완료 상태 */}
        {(withdrawal.status === 'REJECTED' || withdrawal.status === 'PAID') && (
          <div
            className={cn(
              'rounded-lg border p-6',
              withdrawal.status === 'REJECTED'
                ? 'bg-red-50 border-red-200'
                : 'bg-emerald-50 border-emerald-200'
            )}
          >
            <h2
              className={cn(
                'font-semibold text-lg flex items-center gap-2',
                withdrawal.status === 'REJECTED' ? 'text-red-700' : 'text-emerald-700'
              )}
            >
              <StatusIcon className="w-5 h-5" />
              {withdrawal.status === 'REJECTED' ? '거부됨' : '지급 완료'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              처리일:{' '}
              {new Date(
                withdrawal.status === 'REJECTED' ? withdrawal.rejectedAt : withdrawal.paidAt
              ).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

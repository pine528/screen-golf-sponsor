import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileDown,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Banknote,
} from 'lucide-react';
import { cn } from '../../../utils';

const BATCH_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  CREATED: { label: '생성됨', color: 'bg-gray-100 text-gray-700', icon: Clock },
  EXPORTED: { label: 'CSV 완료', color: 'bg-blue-100 text-blue-700', icon: FileDown },
  COMPLETED: { label: '지급완료', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CANCELED: { label: '취소됨', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const WITHDRAWAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: '요청중', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: '승인됨', color: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: '거부됨', color: 'bg-red-100 text-red-700' },
  PAID: { label: '지급완료', color: 'bg-emerald-100 text-emerald-700' },
};

export default function FinanceWithdrawalBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [actionType, setActionType] = useState<'complete' | 'cancel' | null>(null);

  const { data: batchData, isLoading } = useQuery({
    queryKey: ['withdrawalBatch', id],
    queryFn: () => api.getWithdrawalBatch(id!),
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.completeWithdrawalBatch(id!, { confirmText, reason, proofUrl: proofUrl || undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatch', id] });
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatches'] });
      alert(
        `처리 완료!\n성공: ${data.data?.successCount || 0}건\n실패: ${data.data?.failedIds?.length || 0}건`
      );
      setShowDangerZone(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error?.message || '처리에 실패했습니다');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelWithdrawalBatch(id!, { confirmText, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatch', id] });
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatches'] });
      alert('배치가 취소되었습니다');
      setShowDangerZone(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error?.message || '취소에 실패했습니다');
    },
  });

  const resetForm = () => {
    setConfirmText('');
    setReason('');
    setProofUrl('');
    setActionType(null);
  };

  const handleDownloadCsv = async () => {
    try {
      const blob = await api.downloadWithdrawalBatchCsv(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `withdrawal-batch-${id?.slice(-8)}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ['withdrawalBatch', id] });
    } catch (error) {
      alert('CSV 다운로드에 실패했습니다');
    }
  };

  const handleAction = () => {
    if (actionType === 'complete') {
      completeMutation.mutate();
    } else if (actionType === 'cancel') {
      cancelMutation.mutate();
    }
  };

  const batch = batchData?.data;

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-6 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  if (!batch) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-6 text-center text-gray-500">
          배치를 찾을 수 없습니다
        </div>
      </Layout>
    );
  }

  const statusInfo = BATCH_STATUS_MAP[batch.status] || BATCH_STATUS_MAP.CREATED;
  const StatusIcon = statusInfo.icon;
  const canProcess = batch.status === 'CREATED' || batch.status === 'EXPORTED';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6" />
              배치 상세
            </h1>
            <p className="text-gray-500 font-mono">{batch.id}</p>
          </div>
          <span
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1',
              statusInfo.color
            )}
          >
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </span>
        </div>

        {/* 배치 정보 */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-lg mb-4">배치 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">건수</p>
              <p className="text-xl font-bold">{batch.itemCount}건</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">총액</p>
              <p className="text-xl font-bold">{Number(batch.totalAmount).toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">생성일</p>
              <p className="font-medium">{new Date(batch.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">완료일</p>
              <p className="font-medium">
                {batch.completedAt ? new Date(batch.completedAt).toLocaleString() : '-'}
              </p>
            </div>
          </div>
          {batch.note && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{batch.note}</p>
            </div>
          )}
          {batch.proofUrl && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">증빙 URL</p>
              <a
                href={batch.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {batch.proofUrl}
              </a>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            CSV 다운로드
          </button>
          <Link
            to="/admin/finance/withdrawals/batches"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            배치 목록
          </Link>
        </div>

        {/* 포함된 출금 목록 */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">포함된 출금 ({batch.withdrawals?.length || 0}건)</h2>
          </div>
          {batch.withdrawals && batch.withdrawals.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">선수</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">금액</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">계좌</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">지급일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batch.withdrawals.map((w: any) => {
                  const wStatus = WITHDRAWAL_STATUS_MAP[w.status] || WITHDRAWAL_STATUS_MAP.APPROVED;
                  return (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{w.athlete?.name || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {Number(w.amount).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {w.bankName} {w.bankAccountMasked}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            wStatus.color
                          )}
                        >
                          {wStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {w.paidAt ? new Date(w.paidAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">포함된 출금이 없습니다</div>
          )}
        </div>

        {/* Danger Zone */}
        {canProcess && (
          <div className="bg-red-50 border border-red-200 rounded-lg">
            <button
              onClick={() => setShowDangerZone(!showDangerZone)}
              className="w-full p-4 flex items-center justify-between text-red-700 hover:bg-red-100 rounded-lg"
            >
              <span className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </span>
              <span>{showDangerZone ? '닫기' : '열기'}</span>
            </button>

            {showDangerZone && (
              <div className="p-4 border-t border-red-200 space-y-4">
                {/* 액션 선택 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setActionType('complete');
                      resetForm();
                    }}
                    className={cn(
                      'flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2',
                      actionType === 'complete'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Banknote className="w-5 h-5" />
                    일괄 지급 완료
                  </button>
                  <button
                    onClick={() => {
                      setActionType('cancel');
                      resetForm();
                    }}
                    className={cn(
                      'flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2',
                      actionType === 'cancel'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <XCircle className="w-5 h-5" />
                    배치 취소
                  </button>
                </div>

                {actionType && (
                  <div className="space-y-4 p-4 bg-white rounded-lg border">
                    {actionType === 'complete' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">증빙 URL (선택)</label>
                        <input
                          type="url"
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">사유 (10자 이상) *</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          actionType === 'complete'
                            ? '예: 2024년 1월 출금 일괄 처리 완료'
                            : '예: 은행 이체 오류로 인한 배치 취소'
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={2}
                      />
                      <p className="text-sm text-gray-500 mt-1">{reason.length}/10자</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        확인 텍스트: "{actionType === 'complete' ? 'PAY' : 'CANCEL'}" 입력 *
                      </label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={actionType === 'complete' ? 'PAY' : 'CANCEL'}
                        className="w-full px-3 py-2 border rounded-lg font-mono"
                      />
                    </div>

                    <button
                      onClick={handleAction}
                      disabled={
                        reason.length < 10 ||
                        confirmText.toUpperCase() !== (actionType === 'complete' ? 'PAY' : 'CANCEL') ||
                        completeMutation.isPending ||
                        cancelMutation.isPending
                      }
                      className={cn(
                        'w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2',
                        actionType === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      {(completeMutation.isPending || cancelMutation.isPending) && (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      )}
                      {actionType === 'complete' ? '일괄 지급 완료 실행' : '배치 취소 실행'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

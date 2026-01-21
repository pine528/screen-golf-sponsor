import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../../../components/Layout';
import { api } from '../../../services/api';

// Danger Zone Modal Component
function DangerActionModal({
  isOpen,
  onClose,
  action,
  escrow,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  action: 'release' | 'refund';
  escrow: any;
  onConfirm: (reason: string, confirmText: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expectedConfirm = action === 'release' ? 'RELEASE' : 'REFUND';
  const isConfirmValid = confirmText.toUpperCase() === expectedConfirm ||
    confirmText.toUpperCase() === escrow?.id?.slice(-6).toUpperCase();
  const isReasonValid = reason.trim().length >= 10;
  const canSubmit = isConfirmValid && isReasonValid && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await onConfirm(reason, confirmText);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to execute action');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !escrow) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className={`px-6 py-4 rounded-t-lg ${action === 'release' ? 'bg-green-600' : 'bg-red-600'}`}>
          <h3 className="text-lg font-bold text-white">
            {action === 'release' ? '강제 릴리즈 (선수 지급)' : '강제 환불 (브랜드 환불)'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* 요약 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">에스크로 ID</span>
              <span className="font-mono">{escrow.id?.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">계약 ID</span>
              <span className="font-mono">{escrow.contractId?.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">총액</span>
              <span className="font-bold">₩{formatNumber(escrow.grossAmount)}</span>
            </div>
            {action === 'release' && (
              <div className="flex justify-between text-sm text-green-600">
                <span>선수 지급액</span>
                <span className="font-bold">₩{formatNumber(escrow.athletePayout)}</span>
              </div>
            )}
            {action === 'refund' && (
              <div className="flex justify-between text-sm text-red-600">
                <span>브랜드 환불액</span>
                <span className="font-bold">₩{formatNumber(escrow.grossAmount)}</span>
              </div>
            )}
          </div>

          {/* 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사유 (최소 10자) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 ${
                reason.length > 0 && !isReasonValid ? 'border-red-300' : 'border-gray-300'
              }`}
              rows={3}
              placeholder="운영자 처리 사유를 상세히 입력하세요..."
            />
            <div className="text-xs text-gray-400 mt-1">
              {reason.length}/10 글자
            </div>
          </div>

          {/* 확인 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              확인 텍스트 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              "{expectedConfirm}" 또는 에스크로 ID 마지막 6자리 "{escrow.id?.slice(-6).toUpperCase()}"를 입력하세요.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 ${
                confirmText.length > 0 && !isConfirmValid ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder={expectedConfirm}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              action === 'release'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? '처리 중...' : action === 'release' ? '릴리즈 실행' : '환불 실행'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR');
}

const STATUS_COLORS: Record<string, string> = {
  HELD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  RELEASED: 'bg-green-100 text-green-800 border-green-300',
  REFUNDED: 'bg-red-100 text-red-800 border-red-300',
};

const LEDGER_TYPE_LABELS: Record<string, string> = {
  CREDIT: '입금',
  DEBIT: '출금',
};

const REF_TYPE_LABELS: Record<string, string> = {
  ESCROW_HOLD: '에스크로 홀드',
  ESCROW_RELEASE: '에스크로 릴리스',
  ESCROW_REFUND: '에스크로 환불',
  ESCROW_FEE: '플랫폼 수수료',
};

export default function FinanceEscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalAction, setModalAction] = useState<'release' | 'refund' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const loadEscrow = useCallback(async () => {
    try {
      const res = await api.getFinanceEscrow(id!);
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load escrow:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadEscrow();
    }
  }, [id, loadEscrow]);

  const handleRelease = async (reason: string, confirmText: string) => {
    const res = await api.adminReleaseEscrow(id!, { reason, confirmText });
    if (res.success) {
      if (res.data.alreadyProcessed) {
        setToast({ message: '이미 처리된 건입니다.', type: 'info' });
      } else {
        setToast({ message: '릴리즈가 완료되었습니다.', type: 'success' });
      }
      loadEscrow();
    } else {
      throw new Error(res.error?.message || 'Release failed');
    }
  };

  const handleRefund = async (reason: string, confirmText: string) => {
    const res = await api.adminRefundEscrow(id!, { reason, confirmText });
    if (res.success) {
      if (res.data.alreadyProcessed) {
        setToast({ message: '이미 처리된 건입니다.', type: 'info' });
      } else {
        setToast({ message: '환불이 완료되었습니다.', type: 'success' });
      }
      loadEscrow();
    } else {
      throw new Error(res.error?.message || 'Refund failed');
    }
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
      </Layout>
    );
  }

  if (!data?.escrow) {
    return (
      <Layout>
      <div className="text-center py-12">
        <p className="text-gray-500">에스크로를 찾을 수 없습니다.</p>
        <Link to="/admin/finance/escrows" className="text-blue-600 hover:underline mt-2 inline-block">
          ← 목록으로
        </Link>
      </div>
      </Layout>
    );
  }

  const { escrow, relatedLedgerTx } = data;
  const contract = escrow.contract;

  return (
    <Layout>
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <Link to="/admin/finance/escrows" className="text-blue-600 hover:underline text-sm">
            ← 에스크로 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">에스크로 상세</h1>
        </div>
        <span className={`px-4 py-2 text-sm font-medium rounded-lg border ${STATUS_COLORS[escrow.status]}`}>
          {escrow.status}
        </span>
      </div>

      {/* 에스크로 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">에스크로 정보</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">ID</div>
            <div className="font-mono text-sm">{escrow.id}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">계약 ID</div>
            <Link
              to={`/contracts?highlight=${escrow.contractId}`}
              className="font-mono text-sm text-blue-600 hover:underline"
            >
              {escrow.contractId.slice(0, 12)}...
            </Link>
          </div>
          <div>
            <div className="text-sm text-gray-500">생성일</div>
            <div className="text-sm">{formatDate(escrow.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">상태 변경일</div>
            <div className="text-sm">
              {escrow.status === 'RELEASED' && formatDate(escrow.releasedAt)}
              {escrow.status === 'REFUNDED' && formatDate(escrow.refundedAt)}
              {escrow.status === 'HELD' && '-'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">총액</div>
            <div className="text-xl font-bold">₩{formatNumber(escrow.grossAmount)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">플랫폼 수수료 ({escrow.platformFeeRate})</div>
            <div className="text-xl font-bold text-blue-600">₩{formatNumber(escrow.platformFee)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">선수 정산액</div>
            <div className="text-xl font-bold text-green-600">₩{formatNumber(escrow.athletePayout)}</div>
          </div>
          {escrow.refundReason && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">환불 사유</div>
              <div className="text-sm text-red-600">{escrow.refundReason}</div>
            </div>
          )}
        </div>
      </div>

      {/* 계약 정보 */}
      {contract && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">계약 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">브랜드</div>
              <div className="font-medium">{contract.brand?.name || '-'}</div>
              <div className="text-xs text-gray-400 font-mono">
                {contract.brand?.id?.slice(0, 8)}
                <button
                  onClick={() => navigator.clipboard.writeText(contract.brand?.id || '')}
                  className="ml-2 text-blue-500 hover:underline"
                >
                  복사
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">선수</div>
              <div className="font-medium">{contract.athlete?.name || '-'}</div>
              <div className="text-xs text-gray-400 font-mono">
                {contract.athlete?.id?.slice(0, 8)}
                <button
                  onClick={() => navigator.clipboard.writeText(contract.athlete?.id || '')}
                  className="ml-2 text-blue-500 hover:underline"
                >
                  복사
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">계약 상태</div>
              <div className="font-medium">{contract.status}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">계약 금액</div>
              <div className="font-medium">₩{formatNumber(contract.priceFinal)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">계약 생성일</div>
              <div className="text-sm">{formatDate(contract.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">서명 완료일</div>
              <div className="text-sm">{formatDate(contract.signedAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">인증 상태</div>
              <div className="font-medium">{contract.verification?.status || '미제출'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">인증 완료일</div>
              <div className="text-sm">{formatDate(contract.verification?.verifiedAt)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 관련 원장 거래 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">관련 원장 거래</h2>
        {relatedLedgerTx && relatedLedgerTx.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참조</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지갑 ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {relatedLedgerTx.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        tx.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {LEDGER_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {REF_TYPE_LABELS[tx.refType] || tx.refType}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      ₩{formatNumber(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">
                      <Link
                        to={`/admin/finance/wallets/${tx.walletId}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {tx.walletId.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">관련 거래가 없습니다.</p>
        )}
      </div>

      {/* Danger Zone - HELD 상태일 때만 표시 */}
      {escrow.status === 'HELD' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">
            아래 작업은 되돌릴 수 없습니다. 신중하게 진행하세요.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setModalAction('release')}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              강제 릴리즈 (선수 지급)
            </button>
            <button
              onClick={() => setModalAction('refund')}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              강제 환불 (브랜드 환불)
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <DangerActionModal
        isOpen={modalAction !== null}
        onClose={() => setModalAction(null)}
        action={modalAction || 'release'}
        escrow={escrow}
        onConfirm={modalAction === 'release' ? handleRelease : handleRefund}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
          toast.type === 'success' ? 'bg-green-600' :
          toast.type === 'info' ? 'bg-blue-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
    </Layout>
  );
}

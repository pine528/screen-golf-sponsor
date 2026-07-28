/**
 * ★ Phase 9-3: Admin Operations Page
 * 운영자 강제 처리 도구 - 예약 해제, 경매 강제 종료
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Search,
  FileX,
  Gavel,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  User,
  Calendar,
  DollarSign,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { cn, formatCurrency } from '../../utils';
import { getEventMonthLabel } from '../../utils/eventMonth';

type SearchType = 'contract' | 'auction';

// 남은 시간 표시
function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '만료됨';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간`;
  }
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

export default function AdminOps() {
  const [searchType, setSearchType] = useState<SearchType>('contract');
  const [searchId, setSearchId] = useState('');
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [searchedType, setSearchedType] = useState<SearchType | null>(null);

  // 모달 상태
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 계약 조회
  const {
    data: contractData,
    isLoading: loadingContract,
    refetch: refetchContract,
  } = useQuery({
    queryKey: ['admin', 'ops', 'contract', searchedId],
    queryFn: () => api.getOpsContract(searchedId!),
    enabled: !!searchedId && searchedType === 'contract',
  });

  // 경매 조회
  const {
    data: auctionData,
    isLoading: loadingAuction,
    refetch: refetchAuction,
  } = useQuery({
    queryKey: ['admin', 'ops', 'auction', searchedId],
    queryFn: () => api.getOpsAuction(searchedId!),
    enabled: !!searchedId && searchedType === 'auction',
  });

  // 예약 강제 해제
  const releaseMutation = useMutation({
    mutationFn: () =>
      api.releaseReservation(searchedId!, {
        reason,
        confirmText,
        idempotencyKey: `release-${searchedId}-${Date.now()}`,
      }),
    onSuccess: (data) => {
      setShowReleaseModal(false);
      setReason('');
      setConfirmText('');
      setActionError(null);
      setActionSuccess(
        (data as any).data?.alreadyProcessed
          ? '이미 처리된 요청입니다.'
          : '예약이 해제되었습니다.'
      );
      refetchContract();
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.error?.message || '처리에 실패했습니다.');
    },
  });

  // 경매 강제 종료
  const closeMutation = useMutation({
    mutationFn: () =>
      api.forceCloseAuction(searchedId!, {
        reason,
        confirmText,
        idempotencyKey: `close-${searchedId}-${Date.now()}`,
      }),
    onSuccess: (data) => {
      setShowCloseModal(false);
      setReason('');
      setConfirmText('');
      setActionError(null);
      setActionSuccess(
        (data as any).data?.alreadyProcessed
          ? '이미 처리된 요청입니다.'
          : '경매가 종료되었습니다.'
      );
      refetchAuction();
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.error?.message || '처리에 실패했습니다.');
    },
  });

  const handleSearch = () => {
    if (!searchId.trim()) return;
    setActionSuccess(null);
    setActionError(null);
    setSearchedId(searchId.trim());
    setSearchedType(searchType);
  };

  const contract = (contractData as any)?.data;
  const auction = (auctionData as any)?.data;
  const isLoading = loadingContract || loadingAuction;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            운영 도구
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            예약 강제 해제 및 경매 강제 종료 기능
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">주의사항</p>
            <ul className="list-disc list-inside space-y-1">
              <li>모든 운영 액션은 감사 로그에 기록됩니다.</li>
              <li>사유는 10자 이상 입력해야 합니다.</li>
              <li>확인 텍스트를 정확히 입력해야 처리됩니다.</li>
            </ul>
          </div>
        </div>

        {/* Search Section */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">ID로 검색</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Type Selector */}
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as SearchType)}
              className="input w-full sm:w-40"
            >
              <option value="contract">계약 (Contract)</option>
              <option value="auction">경매 (Auction)</option>
            </select>

            {/* ID Input */}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder={searchType === 'contract' ? 'Contract ID 입력' : 'Auction ID 입력'}
                className="input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={!searchId.trim() || isLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                검색
              </button>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-5 h-5" />
            {actionSuccess}
          </div>
        )}
        {actionError && !showReleaseModal && !showCloseModal && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {actionError}
          </div>
        )}

        {/* Contract Detail */}
        {searchedType === 'contract' && contract && (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileX className="w-5 h-5 text-slate-600" />
                계약 정보
              </h2>
              <span
                className={cn(
                  'badge',
                  contract.status === 'PENDING_SIGNATURE' ? 'badge-warning' : 'badge-info'
                )}
              >
                {contract.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-slate-500">계약 ID</p>
                <p className="font-mono text-sm">{contract.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">슬롯</p>
                <p className="font-medium">{contract.auction?.slotInstance?.slotTemplate?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">브랜드</p>
                  <p className="font-medium">{contract.brand?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">선수</p>
                  <p className="font-medium">{contract.athlete?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">이벤트</p>
                  <p className="font-medium">{getEventMonthLabel(contract.auction?.slotInstance?.event)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">금액</p>
                  <p className="font-medium">{formatCurrency(contract.priceFinal)}</p>
                </div>
              </div>
            </div>

            {/* Reserved Until */}
            {contract.reservedUntil && (
              <div
                className={cn(
                  'p-3 rounded-lg mb-6 flex items-center justify-between',
                  contract.isExpired ? 'bg-slate-100' : 'bg-amber-50 border border-amber-200'
                )}
              >
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  예약 만료
                </span>
                <span
                  className={cn(
                    'font-medium',
                    contract.isExpired ? 'text-slate-500' : 'text-amber-700'
                  )}
                >
                  {contract.isExpired ? '만료됨' : formatRemainingTime(contract.remainingSeconds)}
                </span>
              </div>
            )}

            {/* Action */}
            {contract.status === 'PENDING_SIGNATURE' && (
              <button
                onClick={() => {
                  setShowReleaseModal(true);
                  setActionError(null);
                }}
                className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
              >
                <FileX className="w-4 h-4" />
                예약 강제 해제
              </button>
            )}
          </div>
        )}

        {/* Auction Detail */}
        {searchedType === 'auction' && auction && (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-slate-600" />
                경매 정보
              </h2>
              <span
                className={cn(
                  'badge',
                  auction.status === 'LIVE'
                    ? 'badge-success'
                    : auction.status === 'SCHEDULED'
                    ? 'badge-info'
                    : 'badge-warning'
                )}
              >
                {auction.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-slate-500">경매 ID</p>
                <p className="font-mono text-sm">{auction.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">슬롯</p>
                <p className="font-medium">{auction.slotInstance?.slotTemplate?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">선수</p>
                  <p className="font-medium">{auction.slotInstance?.athlete?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">이벤트</p>
                  <p className="font-medium">{getEventMonthLabel(auction.slotInstance?.event)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">현재가</p>
                  <p className="font-medium">{formatCurrency(auction.currentPrice)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">입찰 수</p>
                <p className="font-medium">{auction.bidCount}건</p>
              </div>
            </div>

            {/* Time Remaining */}
            {(auction.status === 'LIVE' || auction.status === 'SCHEDULED') && (
              <div className="p-3 rounded-lg mb-6 bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {auction.status === 'LIVE' ? '남은 시간' : '시작까지'}
                </span>
                <span className="font-medium text-emerald-700">
                  {formatRemainingTime(auction.remainingSeconds)}
                </span>
              </div>
            )}

            {/* Top Bids */}
            {auction.bids?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-2">상위 입찰</p>
                <div className="space-y-2">
                  {auction.bids.slice(0, 3).map((bid: any, index: number) => (
                    <div
                      key={bid.id || index}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded"
                    >
                      <span className="text-sm">{bid.brand?.name || 'Unknown'}</span>
                      <span className="font-medium">{formatCurrency(bid.currentProxy)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            {(auction.status === 'LIVE' || auction.status === 'SCHEDULED') && (
              <button
                onClick={() => {
                  setShowCloseModal(true);
                  setActionError(null);
                }}
                className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
              >
                <Gavel className="w-4 h-4" />
                경매 강제 종료
              </button>
            )}
          </div>
        )}

        {/* Not Found */}
        {searchedId && !isLoading && !contract && !auction && (
          <div className="card p-6 text-center text-slate-500">
            검색 결과가 없습니다. ID를 확인해주세요.
          </div>
        )}

        {/* Release Modal */}
        {showReleaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileX className="w-5 h-5 text-red-600" />
                예약 강제 해제
              </h2>

              <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">
                  이 작업은 되돌릴 수 없습니다. 계약이 취소되고 동결된 금액이 해제됩니다.
                </p>
              </div>

              {actionError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="label">사유 (10자 이상)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="예약 해제 사유를 입력하세요"
                  />
                </div>

                <div>
                  <label className="label">
                    확인: <code className="bg-slate-100 px-1 rounded">RELEASE</code> 입력
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="input"
                    placeholder="RELEASE"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowReleaseModal(false);
                    setReason('');
                    setConfirmText('');
                    setActionError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={() => releaseMutation.mutate()}
                  disabled={
                    releaseMutation.isPending ||
                    reason.trim().length < 10 ||
                    confirmText.toUpperCase() !== 'RELEASE'
                  }
                  className="btn bg-red-600 text-white hover:bg-red-700 flex-1 flex items-center justify-center gap-2"
                >
                  {releaseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileX className="w-4 h-4" />
                  )}
                  해제 실행
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Auction Modal */}
        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-red-600" />
                경매 강제 종료
              </h2>

              <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">
                  경매가 즉시 종료됩니다. 입찰자가 있으면 낙찰 처리됩니다.
                </p>
              </div>

              {actionError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="label">사유 (10자 이상)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="강제 종료 사유를 입력하세요"
                  />
                </div>

                <div>
                  <label className="label">
                    확인: <code className="bg-slate-100 px-1 rounded">CLOSE</code> 입력
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="input"
                    placeholder="CLOSE"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setReason('');
                    setConfirmText('');
                    setActionError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={() => closeMutation.mutate()}
                  disabled={
                    closeMutation.isPending ||
                    reason.trim().length < 10 ||
                    confirmText.toUpperCase() !== 'CLOSE'
                  }
                  className="btn bg-red-600 text-white hover:bg-red-700 flex-1 flex items-center justify-center gap-2"
                >
                  {closeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gavel className="w-4 h-4" />
                  )}
                  종료 실행
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

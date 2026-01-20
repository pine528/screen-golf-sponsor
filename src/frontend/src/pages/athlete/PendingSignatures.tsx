/**
 * ★ Phase 9-3: Athlete Pending Signatures Page
 * 선수의 서명 대기 계약 목록
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  FileSignature,
  Clock,
  AlertTriangle,
  Building2,
  DollarSign,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency } from '../../utils';

// 남은 시간 표시 (초 단위)
function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '만료됨';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간 남음`;
  }
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남음`;
  }
  return `${minutes}분 남음`;
}

interface PendingContract {
  id: string;
  slotId: string;
  slotName: string;
  brandId: string;
  brandName: string;
  brandCategory: string;
  eventName: string;
  eventId: string;
  price: number;
  reservedUntil: string;
  remainingSeconds: number;
  type: 'DIRECT_BUY' | 'AUCTION';
  createdAt: string;
  isUrgent: boolean;
  isExpired: boolean;
}

export default function AthletePendingSignatures() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 서명 대기 계약 목록
  const { data, isLoading } = useQuery({
    queryKey: ['athletes', 'me', 'pending-signatures'],
    queryFn: () => api.getPendingSignatures(),
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 계약 서명 뮤테이션
  const signMutation = useMutation({
    mutationFn: (contractId: string) => api.signContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes', 'me', 'pending-signatures'] });
    },
  });

  const contracts: PendingContract[] = (data as any)?.data || [];
  const urgentCount = contracts.filter((c) => c.isUrgent && !c.isExpired).length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-emerald-600" />
              서명 대기
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              브랜드가 서명을 완료한 계약입니다. 서명하면 계약이 확정됩니다.
            </p>
          </div>

          {/* Summary Badge */}
          {contracts.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-sm text-emerald-700">
                  총 <strong>{contracts.length}</strong>건 대기 중
                </span>
              </div>
              {urgentCount > 0 && (
                <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-200 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700">
                    <strong>{urgentCount}</strong>건 긴급
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            로딩 중...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && contracts.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">대기 중인 계약이 없습니다</h3>
            <p className="text-sm text-slate-500 mt-1">
              브랜드가 서명을 완료하면 여기에 표시됩니다.
            </p>
          </div>
        )}

        {/* Contract List */}
        {!isLoading && contracts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className={cn(
                  'card p-5 border-l-4 transition-all',
                  contract.isExpired
                    ? 'border-l-slate-300 opacity-60'
                    : contract.isUrgent
                    ? 'border-l-red-500 ring-2 ring-red-100'
                    : 'border-l-emerald-500'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{contract.slotName}</h3>
                    <p className="text-sm text-slate-600">{contract.eventName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'badge text-xs',
                        contract.type === 'AUCTION' ? 'badge-success' : 'badge-info'
                      )}
                    >
                      {contract.type === 'AUCTION' ? '경매 낙찰' : '즉시구매'}
                    </span>
                    {contract.isUrgent && !contract.isExpired && (
                      <span className="badge bg-red-100 text-red-700 text-xs flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        긴급
                      </span>
                    )}
                  </div>
                </div>

                {/* Brand Info */}
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-800">{contract.brandName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{contract.brandCategory}</span>
                </div>

                {/* Price */}
                <div className="flex items-center gap-2 text-sm mb-4">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(contract.price)}
                  </span>
                </div>

                {/* Time Remaining */}
                <div
                  className={cn(
                    'p-3 rounded-lg mb-4 flex items-center justify-between',
                    contract.isExpired
                      ? 'bg-slate-100'
                      : contract.isUrgent
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-amber-50 border border-amber-200'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      className={cn(
                        'w-4 h-4',
                        contract.isExpired
                          ? 'text-slate-400'
                          : contract.isUrgent
                          ? 'text-red-600'
                          : 'text-amber-600'
                      )}
                    />
                    <span className="text-sm text-slate-600">서명 마감</span>
                  </div>
                  <span
                    className={cn(
                      'font-medium',
                      contract.isExpired
                        ? 'text-slate-500'
                        : contract.isUrgent
                        ? 'text-red-700'
                        : 'text-amber-700'
                    )}
                  >
                    {contract.isExpired ? '만료됨' : formatRemainingTime(contract.remainingSeconds)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {!contract.isExpired && (
                    <button
                      onClick={() => signMutation.mutate(contract.id)}
                      disabled={signMutation.isPending}
                      className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {signMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <FileSignature className="w-4 h-4" />
                          지금 서명
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/athlete/contracts/${contract.id}`)}
                    className={cn(
                      'btn btn-secondary',
                      contract.isExpired ? 'flex-1' : ''
                    )}
                  >
                    상세 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Text */}
        <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg">
          <p className="font-medium text-slate-700 mb-1">안내사항</p>
          <ul className="list-disc list-inside space-y-1">
            <li>서명 마감 시간 내에 서명해야 계약이 확정됩니다.</li>
            <li>마감 시간이 지나면 예약이 자동으로 취소됩니다.</li>
            <li>60분 이하 남은 계약은 긴급으로 표시됩니다.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

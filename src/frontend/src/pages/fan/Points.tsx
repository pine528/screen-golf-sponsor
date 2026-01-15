import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Trophy,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Vote,
  Gift,
  Loader2,
  ChevronRight,
  History,
} from 'lucide-react';
import { cn } from '../../utils';

interface PointHistory {
  id: string;
  type: 'EARN' | 'REDEEM' | 'BONUS' | 'REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  refType?: string;
  refId?: string;
  createdAt: string;
}

interface PointsData {
  totalPoints: number;
  totalEarned: number;
  totalRedeemed: number;
}

export default function Points() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: pointsData, isLoading: loadingPoints } = useQuery({
    queryKey: ['myPoints'],
    queryFn: async () => {
      const res = await api.getMyPoints();
      return res.data as PointsData;
    },
  });

  const { data: historyResponse, isLoading: loadingHistory } = useQuery({
    queryKey: ['myPointHistory', page],
    queryFn: async () => {
      const res = await api.getMyPointHistory({ page, pageSize });
      return res;
    },
  });

  const history = historyResponse?.data || [];
  const totalCount = historyResponse?.pagination?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EARN':
        return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
      case 'REDEEM':
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      case 'BONUS':
        return <Gift className="w-4 h-4 text-amber-500" />;
      case 'REFUND':
        return <ArrowUpRight className="w-4 h-4 text-sky-500" />;
      default:
        return <Coins className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EARN':
        return '획득';
      case 'REDEEM':
        return '사용';
      case 'BONUS':
        return '보너스';
      case 'REFUND':
        return '환불';
      default:
        return type;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'EARN':
        return 'bg-emerald-50';
      case 'REDEEM':
        return 'bg-red-50';
      case 'BONUS':
        return 'bg-amber-50';
      case 'REFUND':
        return 'bg-sky-50';
      default:
        return 'bg-slate-50';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loadingPoints) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">내 포인트</h1>
              <p className="text-sm text-slate-500">투표 참여로 획득한 포인트를 확인하세요</p>
            </div>
          </div>
        </div>

        {/* Points Summary */}
        <div className="card p-6 mb-6 bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
          <p className="text-sm text-emerald-100 mb-1">보유 포인트</p>
          <p className="text-4xl font-bold mb-4">
            {(pointsData?.totalPoints || 0).toLocaleString()}
            <span className="text-lg ml-1">P</span>
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs text-emerald-100">총 획득</p>
              <p className="text-lg font-semibold">
                +{(pointsData?.totalEarned || 0).toLocaleString()}P
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-100">총 사용</p>
              <p className="text-lg font-semibold">
                -{(pointsData?.totalRedeemed || 0).toLocaleString()}P
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Link
            to="/votes"
            className="card p-4 flex items-center gap-3 hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <Vote className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                투표하기
              </p>
              <p className="text-xs text-slate-500">포인트 획득</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          </Link>
          <Link
            to="/ranking"
            className="card p-4 flex items-center gap-3 hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                랭킹
              </p>
              <p className="text-xs text-slate-500">선수 순위</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          </Link>
        </div>

        {/* History */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">포인트 내역</h2>
            </div>
            <span className="text-sm text-slate-500">총 {totalCount}건</span>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Coins className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500">포인트 내역이 없습니다</p>
              <Link to="/votes" className="text-sm text-emerald-600 hover:underline mt-2 inline-block">
                투표에 참여하고 포인트를 획득하세요
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {history.map((item: PointHistory) => (
                  <div key={item.id} className="p-4 flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      getTypeBg(item.type)
                    )}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded',
                          item.type === 'EARN' || item.type === 'BONUS' || item.type === 'REFUND'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'font-semibold',
                        item.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}P
                      </p>
                      <p className="text-xs text-slate-500">
                        잔액 {item.balanceAfter.toLocaleString()}P
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

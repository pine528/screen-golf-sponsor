import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  Trophy,
  Medal,
  Crown,
  Users,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';

interface LeaderboardEntry {
  id: string;
  userId: string;
  rank: number;
  nickname: string;
  voteParticipations: number;
  correctPredictions: number;
  totalPointsEarned: string;
  badgeAwards: Array<{
    badge: {
      id: string;
      badgeType: string;
      name: string;
      iconUrl?: string;
    };
  }>;
}

export default function SeasonLeaderboard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // 시즌 리더보드
  const { data, isLoading, error } = useQuery({
    queryKey: ['seasonLeaderboard', id, page],
    queryFn: () => api.getSeasonLeaderboard(id!, { page, pageSize }),
    enabled: !!id,
  });

  // 내 참여 현황
  const { data: myParticipation } = useQuery({
    queryKey: ['mySeasonParticipation', id],
    queryFn: () => api.getMySeasonParticipation(id),
    enabled: !!id && !!user,
  });

  const formatNumber = (num: string | number) => Number(num).toLocaleString();

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200';
    if (rank === 2) return 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200';
    if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200';
    return 'bg-white border-slate-200';
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (error || !data?.data) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              리더보드를 불러올 수 없습니다
            </h2>
            <Link to="/ranking" className="btn btn-primary">
              랭킹으로
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const { season, leaderboard, pagination } = data.data;
  const myData = myParticipation?.data?.participation;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/ranking"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            랭킹
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{season.name}</h1>
              <p className="text-sm text-slate-500">
                {pagination.total}명 참여 · {season.status === 'ACTIVE' ? '진행중' : '종료'}
              </p>
            </div>
          </div>
        </div>

        {/* My Status Card */}
        {myData && (
          <div className="card p-4 mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                  {myData.currentRank || '-'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">내 순위</p>
                  <p className="text-sm text-slate-600">
                    {formatNumber(myData.totalPointsEarned)}P 획득
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">참여 {myData.voteParticipations}회</p>
                <p className="text-sm text-emerald-600">
                  정답 {myData.correctPredictions}회
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                리더보드
              </h2>
              <span className="text-sm text-slate-500">
                {pagination.total}명
              </span>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">아직 참여자가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.map((entry: LeaderboardEntry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'p-4 flex items-center justify-between border-l-4',
                    getRankBg(entry.rank),
                    entry.userId === user?.id && 'ring-2 ring-emerald-500 ring-inset'
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-10 text-center">
                      {getRankIcon(entry.rank) || (
                        <span className="text-lg font-bold text-slate-400">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {entry.nickname}
                        </span>
                        {entry.userId === user?.id && (
                          <span className="badge bg-emerald-100 text-emerald-700 text-xs">
                            나
                          </span>
                        )}
                        {/* Badges */}
                        {entry.badgeAwards.length > 0 && (
                          <div className="flex items-center gap-1">
                            {entry.badgeAwards.slice(0, 3).map((award) => (
                              <span
                                key={award.badge.id}
                                className="text-xs"
                                title={award.badge.name}
                              >
                                {award.badge.badgeType === 'SEASON_GOLD' && '🥇'}
                                {award.badge.badgeType === 'SEASON_SILVER' && '🥈'}
                                {award.badge.badgeType === 'SEASON_BRONZE' && '🥉'}
                                {award.badge.badgeType === 'SEASON_TOP10' && '🏆'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        참여 {entry.voteParticipations}회 · 정답{' '}
                        {entry.correctPredictions}회
                      </p>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatNumber(entry.totalPointsEarned)}P
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-600">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

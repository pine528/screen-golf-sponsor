import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Trophy,
  Medal,
  Crown,
  Users,
  Loader2,
  ArrowRight,
  Vote,
  Star,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../utils';

interface AthleteRanking {
  athleteId: string;
  name: string;
  profileImageUrl?: string;
  tour?: string;
  totalPoints: number;
  rank: number;
}

export default function Ranking() {
  const [limit, setLimit] = useState(20);

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['pointRanking', limit],
    queryFn: async () => {
      const res = await api.getPointRanking(limit);
      return (res.data || []) as AthleteRanking[];
    },
  });

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center">
            <Medal className="w-4 h-4 text-white" />
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center">
            <Medal className="w-4 h-4 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-slate-600">{rank}</span>
          </div>
        );
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200';
      case 2:
        return 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200';
      case 3:
        return 'bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200';
      default:
        return 'bg-white border-slate-200';
    }
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">선수 랭킹</h1>
              <p className="text-sm text-slate-500">팬 투표로 선정된 인기 선수 순위</p>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        {rankings && rankings.length >= 3 && (
          <div className="card p-6 mb-6 bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="flex items-end justify-center gap-4">
              {/* 2nd Place */}
              <div className="text-center">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-full bg-slate-700 mx-auto overflow-hidden border-2 border-slate-400">
                    {rankings[1]?.profileImageUrl ? (
                      <img
                        src={rankings[1].profileImageUrl}
                        alt={rankings[1].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    2
                  </div>
                </div>
                <p className="text-white font-medium text-sm truncate max-w-[80px]">
                  {rankings[1]?.name}
                </p>
                <p className="text-slate-400 text-xs">{rankings[1]?.totalPoints.toLocaleString()}P</p>
              </div>

              {/* 1st Place */}
              <div className="text-center -mt-4">
                <div className="relative mb-3">
                  <Crown className="w-6 h-6 text-amber-400 absolute -top-6 left-1/2 -translate-x-1/2" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 mx-auto overflow-hidden border-4 border-amber-300">
                    {rankings[0]?.profileImageUrl ? (
                      <img
                        src={rankings[0].profileImageUrl}
                        alt={rankings[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-amber-500">
                        <Users className="w-10 h-10 text-amber-200" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    1
                  </div>
                </div>
                <p className="text-white font-semibold truncate max-w-[100px]">
                  {rankings[0]?.name}
                </p>
                <p className="text-amber-400 text-sm font-medium">
                  {rankings[0]?.totalPoints.toLocaleString()}P
                </p>
              </div>

              {/* 3rd Place */}
              <div className="text-center">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-full bg-slate-700 mx-auto overflow-hidden border-2 border-amber-600">
                    {rankings[2]?.profileImageUrl ? (
                      <img
                        src={rankings[2].profileImageUrl}
                        alt={rankings[2].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    3
                  </div>
                </div>
                <p className="text-white font-medium text-sm truncate max-w-[80px]">
                  {rankings[2]?.name}
                </p>
                <p className="text-slate-400 text-xs">{rankings[2]?.totalPoints.toLocaleString()}P</p>
              </div>
            </div>
          </div>
        )}

        {/* Full Ranking List */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">전체 순위</h2>
            </div>
            <span className="text-sm text-slate-500">총 {rankings?.length || 0}명</span>
          </div>

          {!rankings || rankings.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500">아직 랭킹 데이터가 없습니다</p>
              <Link to="/votes" className="text-sm text-emerald-600 hover:underline mt-2 inline-block">
                투표에 참여하세요
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rankings.map((athlete) => (
                <div
                  key={athlete.athleteId}
                  className={cn(
                    'p-4 flex items-center gap-4 transition-colors',
                    getRankStyle(athlete.rank)
                  )}
                >
                  {getRankBadge(athlete.rank)}
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                    {athlete.profileImageUrl ? (
                      <img
                        src={athlete.profileImageUrl}
                        alt={athlete.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{athlete.name}</p>
                    {athlete.tour && (
                      <p className="text-xs text-slate-500">{athlete.tour}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">
                      {athlete.totalPoints.toLocaleString()}
                      <span className="text-sm ml-0.5">P</span>
                    </p>
                    {athlete.rank <= 3 && (
                      <span className="text-xs text-amber-600 flex items-center gap-0.5 justify-end">
                        <Star className="w-3 h-3" />
                        TOP 3
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {rankings && rankings.length >= limit && (
            <div className="p-4 border-t border-slate-100 text-center">
              <button
                onClick={() => setLimit(l => l + 20)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                더 보기
              </button>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-2 gap-4">
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
              <p className="text-xs text-slate-500">선수 응원하기</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </Link>
          <Link
            to="/points"
            className="card p-4 flex items-center gap-3 hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                내 포인트
              </p>
              <p className="text-xs text-slate-500">포인트 현황</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}

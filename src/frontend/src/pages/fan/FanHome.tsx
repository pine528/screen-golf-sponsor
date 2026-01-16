import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Vote,
  Trophy,
  Users,
  Clock,
  ArrowRight,
  Loader2,
  Crown,
  Star,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';

interface VoteEvent {
  id: string;
  title: string;
  description?: string;
  questionType: 'PREDICTION' | 'QUIZ' | 'POLL';
  question: string;
  pointsPerCorrect: number;
  status: string;
  endAt: string;
  _count?: {
    votes: number;
  };
}

interface AthleteRanking {
  athleteId: string;
  name: string;
  profileImageUrl?: string;
  totalPoints: number;
  rank: number;
}

export default function FanHome() {
  const { data: activeVotes, isLoading: loadingVotes } = useQuery({
    queryKey: ['activeVoteEvents'],
    queryFn: async () => {
      const res = await api.getActiveVoteEvents();
      return (res.data || []) as VoteEvent[];
    },
  });

  const { data: pointsData, isLoading: loadingPoints } = useQuery({
    queryKey: ['myPoints'],
    queryFn: async () => {
      const res = await api.getMyVotePoints();
      return res.data;
    },
  });

  const { data: rankings, isLoading: loadingRankings } = useQuery({
    queryKey: ['athleteRanking', 5],
    queryFn: async () => {
      const res = await api.getAthleteRanking({ limit: 5 });
      return (res.data || []) as AthleteRanking[];
    },
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PREDICTION': return 'bg-violet-100 text-violet-700';
      case 'QUIZ': return 'bg-amber-100 text-amber-700';
      case 'POLL': return 'bg-sky-100 text-sky-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PREDICTION': return '예측';
      case 'QUIZ': return '퀴즈';
      case 'POLL': return '투표';
      default: return type;
    }
  };

  const getTimeRemaining = (endAt: string) => {
    const end = new Date(endAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return '종료됨';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}일 남음`;
    return `${hours}시간 남음`;
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 2:
        return <span className="text-xs font-bold text-slate-400">2</span>;
      case 3:
        return <span className="text-xs font-bold text-amber-600">3</span>;
      default:
        return <span className="text-xs font-bold text-slate-500">{rank}</span>;
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">팬 홈</h1>
          <p className="text-slate-500">투표 참여하고 포인트를 획득하세요</p>
        </div>

        {/* My Points Card */}
        <div className="card p-5 mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-100 mb-1">내 포인트</p>
              {loadingPoints ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <p className="text-3xl font-bold">
                  {(pointsData?.totalPoints || 0).toLocaleString()}
                  <span className="text-base ml-1">P</span>
                </p>
              )}
            </div>
            <Link
              to="/points"
              className="flex items-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              상세보기
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Active Votes */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Vote className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-slate-900">진행중 투표</h2>
              </div>
              <Link
                to="/votes"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loadingVotes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : !activeVotes || activeVotes.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Vote className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm">진행중인 투표가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeVotes.slice(0, 3).map((vote) => (
                  <Link
                    key={vote.id}
                    to={`/votes/${vote.id}`}
                    className="block p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('badge text-xs', getTypeColor(vote.questionType))}>
                          {getTypeLabel(vote.questionType)}
                        </span>
                        {vote.pointsPerCorrect > 0 && (
                          <span className="text-xs font-medium text-emerald-600">
                            +{vote.pointsPerCorrect}P
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <h3 className="font-medium text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-1">
                      {vote.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {vote._count?.votes ?? 0}명
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeRemaining(vote.endAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Top Rankings */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-slate-900">포인트 TOP</h2>
              </div>
              <Link
                to="/ranking"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loadingRankings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : !rankings || rankings.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm">아직 랭킹 데이터가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rankings.map((athlete) => (
                  <div
                    key={athlete.athleteId}
                    className={cn(
                      'p-4 flex items-center gap-3',
                      athlete.rank === 1 && 'bg-amber-50/50'
                    )}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {getRankBadge(athlete.rank)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                      {athlete.profileImageUrl ? (
                        <img
                          src={athlete.profileImageUrl}
                          alt={athlete.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{athlete.name}</p>
                    </div>
                    <span className="font-semibold text-emerald-600 text-sm">
                      {athlete.totalPoints.toLocaleString()}P
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Link
            to="/votes"
            className="card p-4 text-center hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Vote className="w-6 h-6 text-violet-600" />
            </div>
            <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
              투표하기
            </p>
            <p className="text-xs text-slate-500 mt-1">참여하고 포인트 획득</p>
          </Link>
          <Link
            to="/points"
            className="card p-4 text-center hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
            <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
              내 포인트
            </p>
            <p className="text-xs text-slate-500 mt-1">포인트 내역 확인</p>
          </Link>
          <Link
            to="/ranking"
            className="card p-4 text-center hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
              랭킹
            </p>
            <p className="text-xs text-slate-500 mt-1">선수 순위 보기</p>
          </Link>
        </div>

        {/* How to Earn Points */}
        <div className="mt-6 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-900">포인트 획득 방법</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-violet-600">1</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">예측 투표</p>
                <p className="text-xs text-slate-500">경기 결과 맞추기</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-amber-600">2</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">퀴즈 참여</p>
                <p className="text-xs text-slate-500">정답 맞추면 포인트</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-sky-600">3</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">투표 참여</p>
                <p className="text-xs text-slate-500">의견 제시하기</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

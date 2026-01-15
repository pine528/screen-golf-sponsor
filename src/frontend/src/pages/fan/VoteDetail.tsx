import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  ArrowLeft,
  Vote,
  Clock,
  Users,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Calendar,
  Star,
} from 'lucide-react';
import { cn } from '../../utils';

interface VoteOption {
  id: string;
  label: string;
  athleteId?: string;
}

interface VoteEvent {
  id: string;
  title: string;
  description?: string;
  questionType: 'PREDICTION' | 'QUIZ' | 'POLL';
  question: string;
  options: VoteOption[];
  correctOptionId?: string;
  pointsPerCorrect: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  startAt: string;
  endAt: string;
  _count?: {
    votes: number;
  };
  event?: {
    id: string;
    name: string;
    dateStart: string;
  };
  sponsorBrand?: {
    id: string;
    companyName: string;
  };
}

interface VoteStats {
  totalVotes: number;
  optionStats: {
    optionId: string;
    label: string;
    count: number;
    percentage: number;
  }[];
}

interface MyVote {
  id: string;
  selectedOptionId: string;
  pointsEarned: number;
  createdAt: string;
}

export default function VoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const { data: voteEvent, isLoading: loadingEvent } = useQuery({
    queryKey: ['voteEvent', id],
    queryFn: async () => {
      const res = await api.getVoteEvent(id!);
      return res.data as VoteEvent;
    },
    enabled: !!id,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['voteEventStats', id],
    queryFn: async () => {
      const res = await api.getVoteEventStats(id!);
      return res.data as VoteStats;
    },
    enabled: !!id && voteEvent?.status !== 'ACTIVE',
  });

  const { data: myVotes } = useQuery({
    queryKey: ['myVotes'],
    queryFn: async () => {
      const res = await api.getMyVotes();
      return res.data || [];
    },
  });

  const myVote = myVotes?.find((v: MyVote) => v.voteEventId === id) as MyVote | undefined;
  const hasVoted = !!myVote;
  const isActive = voteEvent?.status === 'ACTIVE';
  const isEnded = voteEvent?.status === 'CLOSED' || voteEvent?.status === 'SETTLED';
  const isSettled = voteEvent?.status === 'SETTLED';

  const submitVoteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return await api.submitVote(id!, optionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvent', id] });
      queryClient.invalidateQueries({ queryKey: ['voteEventStats', id] });
      queryClient.invalidateQueries({ queryKey: ['myVotes'] });
      queryClient.invalidateQueries({ queryKey: ['myPoints'] });
    },
  });

  const handleVote = () => {
    if (!selectedOption) return;
    submitVoteMutation.mutate(selectedOption);
  };

  const getOptionPercentage = (optionId: string) => {
    if (!stats) return 0;
    const optionStat = stats.optionStats.find(s => s.optionId === optionId);
    return optionStat?.percentage || 0;
  };

  const getOptionVoteCount = (optionId: string) => {
    if (!stats) return 0;
    const optionStat = stats.optionStats.find(s => s.optionId === optionId);
    return optionStat?.count || 0;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = () => {
    if (!voteEvent) return '';
    const end = new Date(voteEvent.endAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return '종료됨';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}일 ${hours}시간 남음`;
    if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
    return `${minutes}분 남음`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PREDICTION': return '예측';
      case 'QUIZ': return '퀴즈';
      case 'POLL': return '투표';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PREDICTION': return 'bg-violet-100 text-violet-700';
      case 'QUIZ': return 'bg-amber-100 text-amber-700';
      case 'POLL': return 'bg-sky-100 text-sky-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loadingEvent) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (!voteEvent) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">투표를 찾을 수 없습니다</h2>
            <p className="text-slate-500 mb-4">요청하신 투표 이벤트가 존재하지 않습니다.</p>
            <Link to="/votes" className="btn btn-primary">
              투표 목록으로
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/votes')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>투표 목록</span>
        </button>

        {/* Main Card */}
        <div className="card p-6 mb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={cn('badge text-xs', getTypeColor(voteEvent.questionType))}>
                {getTypeLabel(voteEvent.questionType)}
              </span>
              {isEnded ? (
                <span className="badge bg-slate-100 text-slate-600 text-xs">
                  종료됨
                </span>
              ) : (
                <span className="badge bg-emerald-100 text-emerald-700 text-xs">
                  진행중
                </span>
              )}
            </div>
            {voteEvent.pointsPerCorrect > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Trophy className="w-4 h-4" />
                +{voteEvent.pointsPerCorrect}P
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">{voteEvent.title}</h1>
          {voteEvent.description && (
            <p className="text-slate-600 text-sm mb-4">{voteEvent.description}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {voteEvent._count?.votes ?? 0}명 참여
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {isEnded ? '종료됨' : getTimeRemaining()}
            </span>
            {voteEvent.event && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {voteEvent.event.name}
              </span>
            )}
          </div>

          {/* Question */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="font-medium text-slate-900">{voteEvent.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {voteEvent.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isMyVote = myVote?.selectedOptionId === option.id;
              const isCorrect = isSettled && voteEvent.correctOptionId === option.id;
              const percentage = getOptionPercentage(option.id);
              const voteCount = getOptionVoteCount(option.id);
              const showStats = hasVoted || isEnded;

              return (
                <button
                  key={option.id}
                  onClick={() => !hasVoted && isActive && setSelectedOption(option.id)}
                  disabled={hasVoted || !isActive}
                  className={cn(
                    'w-full relative p-4 rounded-xl border-2 text-left transition-all overflow-hidden',
                    hasVoted || !isActive
                      ? 'cursor-default'
                      : 'cursor-pointer hover:border-emerald-300',
                    isSelected && 'border-emerald-500 bg-emerald-50',
                    isMyVote && 'border-emerald-500',
                    isCorrect && 'border-emerald-500 bg-emerald-50',
                    !isSelected && !isMyVote && !isCorrect && 'border-slate-200'
                  )}
                >
                  {/* Progress Bar Background */}
                  {showStats && (
                    <div
                      className={cn(
                        'absolute inset-0 transition-all',
                        isCorrect ? 'bg-emerald-100' : 'bg-slate-100'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  )}

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          isSelected || isMyVote
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-300'
                        )}
                      >
                        {(isSelected || isMyVote) && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className={cn(
                        'font-medium',
                        isCorrect ? 'text-emerald-700' : 'text-slate-900'
                      )}>
                        {option.label}
                      </span>
                      {isMyVote && (
                        <span className="badge bg-emerald-500 text-white text-xs">내 선택</span>
                      )}
                      {isCorrect && (
                        <span className="badge bg-emerald-500 text-white text-xs flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          정답
                        </span>
                      )}
                    </div>
                    {showStats && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">{voteCount}표</span>
                        <span className="font-semibold text-slate-900">{percentage.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Vote Button or Result */}
          {isActive && !hasVoted && (
            <div className="mt-6">
              <button
                onClick={handleVote}
                disabled={!selectedOption || submitVoteMutation.isPending}
                className={cn(
                  'btn btn-primary w-full py-3',
                  (!selectedOption || submitVoteMutation.isPending) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {submitVoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    투표 중...
                  </>
                ) : (
                  <>
                    <Vote className="w-4 h-4 mr-2" />
                    투표하기
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-500 mt-2">
                투표 후에는 변경할 수 없습니다
              </p>
            </div>
          )}

          {hasVoted && !isEnded && (
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">투표 완료!</span>
              </div>
              <p className="text-sm text-emerald-600 mt-1">
                결과는 투표 종료 후 확인할 수 있습니다
              </p>
            </div>
          )}

          {isSettled && myVote && (
            <div className={cn(
              'mt-6 p-4 rounded-xl',
              myVote.pointsEarned > 0 ? 'bg-emerald-50' : 'bg-slate-50'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {myVote.pointsEarned > 0 ? (
                    <>
                      <Trophy className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">정답!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-slate-500" />
                      <span className="font-medium text-slate-700">아쉽게도 오답입니다</span>
                    </>
                  )}
                </div>
                {myVote.pointsEarned > 0 && (
                  <span className="text-lg font-bold text-emerald-600">
                    +{myVote.pointsEarned}P
                  </span>
                )}
              </div>
            </div>
          )}

          {submitVoteMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">투표에 실패했습니다</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                이미 투표했거나 투표 기간이 종료되었습니다
              </p>
            </div>
          )}
        </div>

        {/* Stats Card (for ended votes) */}
        {isEnded && stats && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">투표 결과</h2>
            </div>
            <div className="space-y-3">
              {stats.optionStats
                .sort((a, b) => b.count - a.count)
                .map((stat, index) => (
                  <div key={stat.optionId} className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    )}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900">{stat.label}</span>
                        <span className="text-sm text-slate-600">{stat.count}표 ({stat.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            index === 0 ? 'bg-emerald-500' : 'bg-slate-300'
                          )}
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
              총 {stats.totalVotes}명 참여
            </div>
          </div>
        )}

        {/* Time Info */}
        <div className="card p-4 mt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">시작</p>
              <p className="font-medium text-slate-900">{formatDate(voteEvent.startAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">종료</p>
              <p className="font-medium text-slate-900">{formatDate(voteEvent.endAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

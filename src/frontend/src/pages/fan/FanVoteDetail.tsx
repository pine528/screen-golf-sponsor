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
  Coins,
} from 'lucide-react';
import { cn } from '../../utils';

interface FanVoteEvent {
  id: string;
  title: string;
  description?: string;
  question: string;
  options: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  startsAt: string;
  endsAt: string;
  entryFeePoints: number | string;  // Decimal from backend
  sponsorContribution?: number | string;  // 스폰서 기여금
  _count?: {
    entries: number;
  };
  creator?: {
    id: string;
    email: string;
  };
}

// Helper to calculate prize pool
function calculatePrizePool(event: FanVoteEvent): number {
  const entryFee = Number(event.entryFeePoints) || 0;
  const entriesCount = event._count?.entries ?? 0;
  const sponsorContribution = Number(event.sponsorContribution) || 0;
  return entryFee * entriesCount + sponsorContribution;
}

// Helper to get entry fee as number
function getEntryFee(event: FanVoteEvent): number {
  return Number(event.entryFeePoints) || 0;
}

interface MyEntry {
  id: string;
  eventId: string;
  optionIndex: number;
  paidPoints: number | string;
  createdAt: string;
}

export default function FanVoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const { data: eventData, isLoading: loadingEvent } = useQuery({
    queryKey: ['fanVoteEvent', id],
    queryFn: async () => {
      const res = await api.getFanVoteEvent(id!);
      // Backend returns { event, myEntry, voteCounts }
      return res.data as { event: FanVoteEvent; myEntry: MyEntry | null; voteCounts: Record<number, number> };
    },
    enabled: !!id,
  });

  const event = eventData?.event;

  // myEntry is included in eventData from backend
  const myEntry = eventData?.myEntry;
  const hasEntered = !!myEntry;
  const isActive = event?.status === 'ACTIVE';
  const isEnded = event?.status === 'CLOSED' || event?.status === 'SETTLED';
  const isSettled = event?.status === 'SETTLED';

  const enterVoteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const idempotencyKey = `fanvote-${id}-${Date.now()}`;
      return await api.enterFanVote(id!, optionIndex, idempotencyKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fanVoteEvent', id] });
      queryClient.invalidateQueries({ queryKey: ['myFanVoteEntries'] });
      queryClient.invalidateQueries({ queryKey: ['myPoints'] });
    },
  });

  const handleEnter = () => {
    if (selectedOption === null) return;
    enterVoteMutation.mutate(selectedOption);
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
    if (!event) return '';
    const end = new Date(event.endsAt);
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

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString();
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

  if (!event) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">투표를 찾을 수 없습니다</h2>
            <p className="text-slate-500 mb-4">요청하신 팬 투표가 존재하지 않습니다.</p>
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
              <span className="badge text-xs bg-pink-100 text-pink-700">
                팬 투표
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
            {calculatePrizePool(event) > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium text-pink-600">
                <Trophy className="w-4 h-4" />
                상금 {formatNumber(calculatePrizePool(event))}P
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h1>
          {event.description && (
            <p className="text-slate-600 text-sm mb-4">{event.description}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {event._count?.entries ?? 0}명 참여
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {isEnded ? '종료됨' : getTimeRemaining()}
            </span>
            {getEntryFee(event) > 0 && (
              <span className="flex items-center gap-1 text-pink-600 font-medium">
                <Coins className="w-4 h-4" />
                참가비 {formatNumber(getEntryFee(event))}P
              </span>
            )}
          </div>

          {/* Question */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="font-medium text-slate-900">{event.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {event.options.map((option, index) => {
              const isSelected = selectedOption === index;
              const isMyEntry = myEntry?.optionIndex === index;

              return (
                <button
                  key={index}
                  onClick={() => !hasEntered && isActive && setSelectedOption(index)}
                  disabled={hasEntered || !isActive}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    hasEntered || !isActive
                      ? 'cursor-default'
                      : 'cursor-pointer hover:border-pink-300',
                    isSelected && 'border-pink-500 bg-pink-50',
                    isMyEntry && 'border-pink-500 bg-pink-50',
                    !isSelected && !isMyEntry && 'border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          isSelected || isMyEntry
                            ? 'border-pink-500 bg-pink-500'
                            : 'border-slate-300'
                        )}
                      >
                        {(isSelected || isMyEntry) && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-slate-900">
                        {option}
                      </span>
                      {isMyEntry && (
                        <span className="badge bg-pink-500 text-white text-xs">내 선택</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Enter Button */}
          {isActive && !hasEntered && (
            <div className="mt-6">
              <button
                onClick={handleEnter}
                disabled={selectedOption === null || enterVoteMutation.isPending}
                className={cn(
                  'btn w-full py-3 bg-pink-500 hover:bg-pink-600 text-white',
                  (selectedOption === null || enterVoteMutation.isPending) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {enterVoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    참여 중...
                  </>
                ) : (
                  <>
                    <Vote className="w-4 h-4 mr-2" />
                    {getEntryFee(event) > 0 ? `${formatNumber(getEntryFee(event))}P로 참여하기` : '참여하기'}
                  </>
                )}
              </button>
              {getEntryFee(event) > 0 && (
                <p className="text-center text-xs text-slate-500 mt-2">
                  참여 시 {formatNumber(getEntryFee(event))}P가 차감됩니다
                </p>
              )}
            </div>
          )}

          {hasEntered && !isEnded && (
            <div className="mt-6 p-4 bg-pink-50 rounded-xl">
              <div className="flex items-center gap-2 text-pink-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">참여 완료!</span>
              </div>
              <p className="text-sm text-pink-600 mt-1">
                결과는 투표 종료 후 확인할 수 있습니다
              </p>
            </div>
          )}

          {isSettled && (
            <div className="mt-6">
              <Link
                to={`/fan-votes/${id}/result`}
                className="btn w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Trophy className="w-4 h-4 mr-2" />
                결과 보기
              </Link>
            </div>
          )}

          {isEnded && !isSettled && (
            <div className="mt-6 p-4 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="w-5 h-5" />
                <span className="font-medium">정산 대기 중</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">
                관리자가 결과를 확정하면 당첨자에게 포인트가 지급됩니다
              </p>
            </div>
          )}

          {enterVoteMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">참여에 실패했습니다</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                포인트가 부족하거나 이미 참여했거나 투표 기간이 종료되었습니다
              </p>
            </div>
          )}
        </div>

        {/* Prize Pool Info */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900">상금 정보</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500">총 상금 풀</p>
              <p className="font-bold text-lg text-pink-600">{formatNumber(calculatePrizePool(event))}P</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500">참가비</p>
              <p className="font-bold text-lg text-slate-900">
                {getEntryFee(event) > 0 ? `${formatNumber(getEntryFee(event))}P` : '무료'}
              </p>
            </div>
          </div>
        </div>

        {/* Time Info */}
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">시작</p>
              <p className="font-medium text-slate-900">{formatDate(event.startsAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">종료</p>
              <p className="font-medium text-slate-900">{formatDate(event.endsAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

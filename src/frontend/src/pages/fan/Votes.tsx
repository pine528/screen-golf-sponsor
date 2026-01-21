import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Vote,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Trophy,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '../../utils';

type VoteStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
type TabType = 'active' | 'ended';

interface VoteEvent {
  id: string;
  title: string;
  description?: string;
  questionType: 'PREDICTION' | 'QUIZ' | 'POLL';
  question: string;
  options: { id: string; label: string; athleteId?: string }[];
  correctOptionId?: string;
  pointsPerCorrect: number;
  status: VoteStatus;
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

interface FanVoteEvent {
  id: string;
  title: string;
  description?: string;
  question: string;
  status: string;
  startsAt: string;
  endsAt: string;
  entryFeePoints: number | string;  // Decimal from backend
  sponsorContribution?: number | string;  // 스폰서 기여금
  options: string[];  // Backend returns string array
  _count?: {
    entries: number;
  };
}

// 통합 표시용 인터페이스
interface DisplayVote {
  id: string;
  title: string;
  description?: string;
  question: string;
  voteType: 'admin' | 'fan';
  questionType?: 'PREDICTION' | 'QUIZ' | 'POLL';
  pointsPerCorrect?: number;
  entryFee?: number;
  prizePool?: number;
  status: string;
  endAt: string;
  participantCount: number;
  event?: {
    id: string;
    name: string;
    dateStart: string;
  };
}

function VoteCard({ vote }: { vote: DisplayVote }) {
  const isEnded = vote.status === 'CLOSED' || vote.status === 'SETTLED';
  const endDate = new Date(vote.endAt);
  const now = new Date();
  const isExpiringSoon = !isEnded && (endDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;

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

  const linkTo = vote.voteType === 'admin' ? `/votes/${vote.id}` : `/fan-votes/${vote.id}`;

  return (
    <Link
      to={linkTo}
      className={cn(
        'block card p-5 hover:border-emerald-500/30 transition-all duration-200 group',
        isExpiringSoon && !isEnded && 'border-amber-300 bg-amber-50/30'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {vote.voteType === 'admin' && vote.questionType ? (
            <span className={cn('badge text-xs', getTypeColor(vote.questionType))}>
              {getTypeLabel(vote.questionType)}
            </span>
          ) : (
            <span className="badge text-xs bg-pink-100 text-pink-700">
              팬 투표
            </span>
          )}
          {isEnded ? (
            <span className="badge bg-slate-100 text-slate-600 text-xs">
              종료됨
            </span>
          ) : isExpiringSoon ? (
            <span className="badge bg-amber-100 text-amber-700 text-xs animate-pulse">
              곧 종료
            </span>
          ) : (
            <span className="badge bg-emerald-100 text-emerald-700 text-xs">
              진행중
            </span>
          )}
        </div>
        {vote.voteType === 'admin' && (vote.pointsPerCorrect ?? 0) > 0 && (
          <span className="text-xs font-medium text-emerald-600">
            +{vote.pointsPerCorrect}P
          </span>
        )}
        {vote.voteType === 'fan' && (vote.prizePool ?? 0) > 0 && (
          <span className="text-xs font-medium text-pink-600">
            🏆{vote.prizePool?.toLocaleString()}P
          </span>
        )}
      </div>

      <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">
        {vote.title}
      </h3>
      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
        {vote.question}
      </p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {vote.participantCount}명 참여
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {isEnded ? '종료' : new Date(vote.endAt).toLocaleDateString('ko-KR')}
          </span>
          {vote.voteType === 'fan' && (vote.entryFee ?? 0) > 0 && (
            <span className="text-pink-600 font-medium">
              참가 {vote.entryFee}P
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
      </div>

      {vote.event && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {vote.event.name}
          </span>
        </div>
      )}
    </Link>
  );
}

export default function Votes() {
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // 관리자 투표 (진행중)
  const { data: activeAdminVotes, isLoading: loadingActiveAdmin } = useQuery({
    queryKey: ['voteEvents', 'active'],
    queryFn: async () => {
      const res = await api.getVoteEvents({ status: 'ACTIVE' });
      return (res.data || []) as VoteEvent[];
    },
  });

  // 팬 투표 (진행중)
  const { data: activeFanVotes, isLoading: loadingActiveFan } = useQuery({
    queryKey: ['fanVotes', 'active'],
    queryFn: async () => {
      const res = await api.getActiveFanVotes();
      return (res.data || []) as FanVoteEvent[];
    },
  });

  // 관리자 투표 (종료)
  const { data: endedAdminVotes, isLoading: loadingEndedAdmin } = useQuery({
    queryKey: ['voteEvents', 'ended'],
    queryFn: async () => {
      const res = await api.getVoteEvents({ status: 'CLOSED,SETTLED' });
      return (res.data || []) as VoteEvent[];
    },
  });

  // 팬 투표 (종료)
  const { data: endedFanVotes, isLoading: loadingEndedFan } = useQuery({
    queryKey: ['fanVotes', 'ended'],
    queryFn: async () => {
      const res = await api.getEndedFanVotes();
      return (res.data || []) as FanVoteEvent[];
    },
  });

  // 통합 진행중 투표
  const activeVotes: DisplayVote[] = [
    ...(activeAdminVotes || []).map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      question: v.question,
      voteType: 'admin' as const,
      questionType: v.questionType,
      pointsPerCorrect: v.pointsPerCorrect,
      status: v.status,
      endAt: v.endAt,
      participantCount: v._count?.votes ?? 0,
      event: v.event,
    })),
    ...(activeFanVotes || []).map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      question: v.question,
      voteType: 'fan' as const,
      entryFee: Number(v.entryFeePoints) || 0,
      prizePool: (Number(v.entryFeePoints) || 0) * (v._count?.entries ?? 0) + (Number(v.sponsorContribution) || 0),
      status: v.status,
      endAt: v.endsAt,
      participantCount: v._count?.entries ?? 0,
    })),
  ].sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime());

  // 통합 종료 투표
  const endedVotes: DisplayVote[] = [
    ...(endedAdminVotes || []).map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      question: v.question,
      voteType: 'admin' as const,
      questionType: v.questionType,
      pointsPerCorrect: v.pointsPerCorrect,
      status: v.status,
      endAt: v.endAt,
      participantCount: v._count?.votes ?? 0,
      event: v.event,
    })),
    ...(endedFanVotes || []).map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      question: v.question,
      voteType: 'fan' as const,
      entryFee: Number(v.entryFeePoints) || 0,
      prizePool: (Number(v.entryFeePoints) || 0) * (v._count?.entries ?? 0) + (Number(v.sponsorContribution) || 0),
      status: v.status,
      endAt: v.endsAt,
      participantCount: v._count?.entries ?? 0,
    })),
  ].sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());

  const loadingActive = loadingActiveAdmin || loadingActiveFan;
  const loadingEnded = loadingEndedAdmin || loadingEndedFan;
  const isLoading = activeTab === 'active' ? loadingActive : loadingEnded;
  const votes = activeTab === 'active' ? activeVotes : endedVotes;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">투표</h1>
              <p className="text-sm text-slate-500">선수 예측 및 퀴즈에 참여하고 포인트를 획득하세요</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'active'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            진행중
            {activeVotes && activeVotes.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {activeVotes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'ended'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            종료됨
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : !votes || votes.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {activeTab === 'active' ? (
                <Vote className="w-8 h-8 text-slate-400" />
              ) : (
                <CheckCircle className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {activeTab === 'active' ? '진행중인 투표가 없습니다' : '종료된 투표가 없습니다'}
            </h3>
            <p className="text-slate-500 text-sm">
              {activeTab === 'active'
                ? '새로운 투표가 곧 열릴 예정입니다'
                : '아직 종료된 투표가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {votes.map((vote: DisplayVote) => (
              <VoteCard key={`${vote.voteType}-${vote.id}`} vote={vote} />
            ))}
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 gap-4">
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
              <p className="text-xs text-slate-500">포인트 현황 및 내역</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </Link>
          <Link
            to="/ranking"
            className="card p-4 flex items-center gap-3 hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                랭킹
              </p>
              <p className="text-xs text-slate-500">선수 포인트 TOP</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}

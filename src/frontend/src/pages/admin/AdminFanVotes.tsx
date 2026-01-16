import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Vote,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../utils';

interface FanVoteEvent {
  id: string;
  creatorUserId: string;
  title: string;
  question: string;
  options: string[];
  entryFeePoints: string;
  winnersCount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  startsAt: string;
  endsAt: string;
  submittedAt: string | null;
  _count?: {
    entries: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '초안', color: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: '승인 대기', color: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: '진행중', color: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { label: '종료', color: 'bg-blue-100 text-blue-700' },
  SETTLED: { label: '정산 완료', color: 'bg-purple-100 text-purple-700' },
};

export default function AdminFanVotes() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'active' | 'closed'>('pending');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 승인 대기 목록
  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['pendingFanVotes', page],
    queryFn: async () => {
      const res = await api.getPendingFanVotes({ page, pageSize });
      return res.data;
    },
    enabled: tab === 'pending',
  });

  // 활성 투표 목록
  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ['activeFanVotes'],
    queryFn: async () => {
      const res = await api.getActiveFanVotes();
      return { events: res.data || [] };
    },
    enabled: tab === 'active',
  });

  // 종료된 투표 목록
  const { data: endedData, isLoading: loadingEnded } = useQuery({
    queryKey: ['endedFanVotes'],
    queryFn: async () => {
      const res = await api.getEndedFanVotes(50);
      return { events: res.data || [] };
    },
    enabled: tab === 'closed',
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveFanVote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingFanVotes'] });
      queryClient.invalidateQueries({ queryKey: ['activeFanVotes'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.closeFanVote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFanVotes'] });
      queryClient.invalidateQueries({ queryKey: ['endedFanVotes'] });
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleApprove = (id: string) => {
    if (confirm('이 투표를 승인하고 활성화하시겠습니까?')) {
      approveMutation.mutate(id);
    }
  };

  const handleClose = (id: string) => {
    if (confirm('이 투표를 종료하시겠습니까?')) {
      closeMutation.mutate(id);
    }
  };

  const renderEventCard = (event: FanVoteEvent, showActions: boolean = false) => (
    <div
      key={event.id}
      className="card p-5 hover:border-emerald-200 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn('badge text-xs', STATUS_LABELS[event.status]?.color)}
            >
              {STATUS_LABELS[event.status]?.label}
            </span>
            {Number(event.entryFeePoints) > 0 && (
              <span className="text-xs text-emerald-600 font-medium">
                {event.entryFeePoints}P
              </span>
            )}
            <span className="text-xs text-slate-500">
              당첨 {event.winnersCount}명
            </span>
          </div>

          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
          <p className="text-sm text-slate-500 mt-1 line-clamp-1">
            {event.question}
          </p>

          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {event._count?.entries || 0}명 참여
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(event.startsAt)} ~ {formatDate(event.endsAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {showActions && event.status === 'SUBMITTED' && (
            <button
              onClick={() => handleApprove(event.id)}
              disabled={approveMutation.isPending}
              className="btn btn-primary text-sm"
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  승인
                </>
              )}
            </button>
          )}

          {event.status === 'ACTIVE' && (
            <button
              onClick={() => handleClose(event.id)}
              disabled={closeMutation.isPending}
              className="btn btn-secondary text-sm"
            >
              {closeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  종료
                </>
              )}
            </button>
          )}

          {event.status === 'CLOSED' && (
            <Link
              to={`/admin/fan-votes/${event.id}`}
              className="btn btn-primary text-sm"
            >
              정산하기
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          )}

          {event.status === 'SETTLED' && (
            <Link
              to={`/fan-votes/${event.id}/result`}
              className="btn btn-secondary text-sm"
            >
              결과 보기
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  const events =
    tab === 'pending'
      ? pendingData?.events
      : tab === 'active'
      ? activeData?.events
      : endedData?.events;
  const isLoading =
    tab === 'pending'
      ? loadingPending
      : tab === 'active'
      ? loadingActive
      : loadingEnded;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">팬 투표 관리</h1>
          <p className="text-slate-500">팬이 만든 투표를 승인하고 정산하세요</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setTab('pending');
              setPage(1);
            }}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              tab === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            승인 대기
            {pendingData?.pagination?.total > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                {pendingData.pagination.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('active')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              tab === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            진행중
          </button>
          <button
            onClick={() => setTab('closed')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              tab === 'closed'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            종료됨
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="card p-12 text-center">
            <Vote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {tab === 'pending'
                ? '승인 대기 중인 투표가 없습니다'
                : tab === 'active'
                ? '진행 중인 투표가 없습니다'
                : '종료된 투표가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event: FanVoteEvent) =>
              renderEventCard(event, tab === 'pending')
            )}
          </div>
        )}

        {/* Pagination (pending tab only) */}
        {tab === 'pending' &&
          pendingData?.pagination &&
          pendingData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="btn btn-secondary px-4 py-2 disabled:opacity-50"
              >
                이전
              </button>
              <span className="text-slate-600">
                {page} / {pendingData.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pendingData.pagination.totalPages}
                className="btn btn-secondary px-4 py-2 disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
      </div>
    </Layout>
  );
}

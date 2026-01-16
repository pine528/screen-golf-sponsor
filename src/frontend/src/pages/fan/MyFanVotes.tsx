import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Plus,
  Vote,
  Clock,
  Users,
  CheckCircle2,
  Send,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';

interface FanVoteEvent {
  id: string;
  title: string;
  question: string;
  options: string[];
  entryFeePoints: string;
  winnersCount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  startsAt: string;
  endsAt: string;
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

export default function MyFanVotes() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['myCreatedFanVotes', page],
    queryFn: async () => {
      const res = await api.getMyCreatedFanVotes({ page, pageSize });
      return res.data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.submitFanVote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCreatedFanVotes'] });
    },
  });

  const events = data?.events || [];
  const pagination = data?.pagination;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = (id: string) => {
    if (confirm('투표를 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.')) {
      submitMutation.mutate(id);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">내가 만든 투표</h1>
            <p className="text-slate-500">직접 만든 투표를 관리하세요</p>
          </div>
          <Link to="/fan-votes/create" className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            투표 만들기
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Vote className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              아직 만든 투표가 없습니다
            </h2>
            <p className="text-slate-500 mb-6">
              첫 번째 투표를 만들어 팬들과 함께 즐겨보세요!
            </p>
            <Link to="/fan-votes/create" className="btn btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              투표 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event: FanVoteEvent) => (
              <div
                key={event.id}
                className="card p-5 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'badge text-xs',
                          STATUS_LABELS[event.status]?.color
                        )}
                      >
                        {STATUS_LABELS[event.status]?.label}
                      </span>
                      {Number(event.entryFeePoints) > 0 && (
                        <span className="text-xs text-emerald-600 font-medium">
                          {event.entryFeePoints}P 참가비
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/fan-votes/${event.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-emerald-600 transition-colors"
                    >
                      {event.title}
                    </Link>

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
                    {event.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSubmit(event.id)}
                        disabled={submitMutation.isPending}
                        className="btn btn-secondary text-sm"
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            제출하기
                          </>
                        )}
                      </button>
                    )}

                    {(event.status === 'CLOSED' || event.status === 'SETTLED') && (
                      <Link
                        to={`/fan-votes/${event.id}/result`}
                        className="btn btn-secondary text-sm"
                      >
                        결과 보기
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    )}

                    {event.status === 'ACTIVE' && (
                      <Link
                        to={`/fan-votes/${event.id}`}
                        className="btn btn-primary text-sm"
                      >
                        보기
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  이전
                </button>
                <span className="text-slate-600">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

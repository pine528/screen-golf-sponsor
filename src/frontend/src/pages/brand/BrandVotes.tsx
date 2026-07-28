import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Vote,
  Plus,
  Clock,
  Users,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Eye,
  BarChart3,
} from 'lucide-react';

interface BrandVoteEvent {
  id: string;
  title: string;
  question: string;
  options: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  startsAt: string;
  endsAt: string;
  entryFeePoints: number | string;
  sponsorContribution?: number | string;
  _count?: {
    entries: number;
  };
  sponsorEngagement?: {
    bannerImpressions: number;
    bannerClicks: number;
    linkClicks: number;
  };
}

export default function BrandVotes() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['brandCreatedVotes'],
    queryFn: async () => {
      const res = await api.getBrandCreatedVotes();
      return res.data as { events: BrandVoteEvent[]; pagination: any };
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.submitBrandVote(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandCreatedVotes'] });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="badge bg-slate-100 text-slate-600">초안</span>;
      case 'SUBMITTED':
        return <span className="badge bg-amber-100 text-amber-700">승인 대기</span>;
      case 'ACTIVE':
        return <span className="badge bg-emerald-100 text-emerald-700">진행중</span>;
      case 'CLOSED':
        return <span className="badge bg-blue-100 text-blue-700">종료</span>;
      case 'SETTLED':
        return <span className="badge bg-violet-100 text-violet-700">정산완료</span>;
      default:
        return <span className="badge bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const events = data?.events || [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">내 브랜드 투표</h1>
            <p className="text-slate-500">생성한 투표를 관리하세요</p>
          </div>
          <Link
            to="/brand/votes/create"
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            투표 만들기
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-sky-100 rounded-2xl flex items-center justify-center">
              <Vote className="w-8 h-8 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              아직 생성한 투표가 없습니다
            </h3>
            <p className="text-slate-500 mb-6">
              첫 번째 브랜드 투표를 만들어보세요
            </p>
            <Link to="/brand/votes/create" className="btn btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              투표 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(event.status)}
                      <span className="badge bg-sky-100 text-sky-700 text-xs">
                        브랜드 투표
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 mb-3 line-clamp-1">
                      {event.question}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {event._count?.entries || 0}명 참여
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(event.startsAt)} ~ {formatDate(event.endsAt)}
                      </span>
                      {Number(event.sponsorContribution) > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Trophy className="w-4 h-4" />
                          {Number(event.sponsorContribution).toLocaleString()}P 기여
                        </span>
                      )}
                    </div>

                    {/* Sponsor Engagement Stats */}
                    {event.sponsorEngagement && (event.status === 'ACTIVE' || event.status === 'CLOSED' || event.status === 'SETTLED') && (
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          노출 {event.sponsorEngagement.bannerImpressions}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          클릭 {event.sponsorEngagement.bannerClicks + event.sponsorEngagement.linkClicks}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {event.status === 'DRAFT' && (
                      <button
                        onClick={() => submitMutation.mutate(event.id)}
                        disabled={submitMutation.isPending}
                        className="btn btn-secondary text-sm py-2 px-3"
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            제출
                          </>
                        )}
                      </button>
                    )}
                    {(event.status === 'ACTIVE' || event.status === 'CLOSED' || event.status === 'SETTLED') && (
                      <Link
                        to={`/votes`}
                        className="btn btn-secondary text-sm py-2 px-3"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        보기
                      </Link>
                    )}
                    {event.status === 'SETTLED' && (
                      <Link
                        to={`/votes`}
                        className="btn btn-primary text-sm py-2 px-3"
                      >
                        <Trophy className="w-4 h-4 mr-1" />
                        결과
                      </Link>
                    )}
                  </div>
                </div>

                {/* Status Messages */}
                {event.status === 'SUBMITTED' && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>관리자 승인을 기다리는 중입니다</span>
                    </div>
                  </div>
                )}
                {event.status === 'DRAFT' && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>제출 버튼을 눌러 관리자에게 승인 요청을 보내세요</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submit Mutation Error */}
        {submitMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">제출에 실패했습니다</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              {(submitMutation.error as any)?.response?.data?.message || '다시 시도해주세요'}
            </p>
          </div>
        )}

        {/* Submit Mutation Success */}
        {submitMutation.isSuccess && (
          <div className="mt-4 p-4 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">투표가 제출되었습니다</span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">
              관리자 승인 후 투표가 활성화됩니다
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

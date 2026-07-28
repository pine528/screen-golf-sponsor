import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import RewardPoolStatus from '../../components/RewardPoolStatus';
import { Layout } from '../../components/Layout';

interface VoteV2 {
  id: string;
  templateCode: string;
  title: string;
  description?: string;
  options: any[];
  status: string;
  rewardBudgetEp: string;
  escrowEp: string;
  maxPerWinnerEp: string;
  closeAt: string;
  createdAt: string;
  _count: {
    participations: number;
  };
}

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'SETTLED';

export default function VoteV2List() {
  const navigate = useNavigate();
  const [votes, setVotes] = useState<VoteV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });

  useEffect(() => {
    fetchVotes();
  }, [statusFilter, pagination.page]);

  const fetchVotes = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await api.getVotes(params);
      if (response.success) {
        setVotes(response.data || []);
        if (response.pagination) {
          setPagination(prev => ({ ...prev, ...response.pagination }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-800',
      CLOSED: 'bg-yellow-100 text-yellow-800',
      SETTLED: 'bg-blue-100 text-blue-800',
      CANCELED: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      OPEN: '참여 가능',
      CLOSED: '마감',
      SETTLED: '정산 완료',
      CANCELED: '취소됨',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTemplateLabel = (code: string) => {
    const templates: Record<string, string> = {
      'T1-YesNo': 'Yes/No',
      'T2-MC': '객관식',
      'T3-TopN': 'Top N',
      'T4-Exact': '정확값',
    };
    return templates[code] || code;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRemainingTime = (closeAt: string) => {
    const now = new Date();
    const close = new Date(closeAt);
    const diff = close.getTime() - now.getTime();

    if (diff <= 0) return '마감됨';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}일 남음`;
    }
    return `${hours}시간 ${minutes}분 남음`;
  };

  return (
    <Layout>
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">무료 투표</h1>
          <p className="text-gray-600">
            무료로 참여하고 정답 시 리워드를 받으세요!
          </p>
        </div>
        <RewardPoolStatus compact className="md:w-auto" />
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['ALL', 'OPEN', 'CLOSED', 'SETTLED'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === status
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'ALL' ? '전체' : status === 'OPEN' ? '참여 가능' : status === 'CLOSED' ? '마감' : '정산 완료'}
          </button>
        ))}
      </div>

      {/* 투표 목록 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-6">
              <div className="h-5 bg-gray-300 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
              <div className="flex gap-4">
                <div className="h-4 bg-gray-300 rounded w-20"></div>
                <div className="h-4 bg-gray-300 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      ) : votes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">투표가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map((vote) => (
            <div
              key={vote.id}
              onClick={() => navigate(`/votes/${vote.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {getTemplateLabel(vote.templateCode)}
                    </span>
                    {getStatusBadge(vote.status)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">{vote.title}</h3>
                  {vote.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{vote.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">예상 보상</div>
                  <div className="text-lg font-bold text-purple-600">
                    {Number(vote.escrowEp).toLocaleString()} <span className="text-sm">EP</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>{vote._count?.participations || 0}명 참여</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{vote.status === 'OPEN' ? getRemainingTime(vote.closeAt) : formatDate(vote.closeAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{vote.options?.length || 0}개 선택지</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page <= 1}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
          >
            이전
          </button>
          <span className="px-4 py-2 text-gray-600">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
          >
            다음
          </button>
        </div>
      )}
    </div>
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Layout } from '../../components/Layout';

interface VoteV2 {
  id: string;
  templateCode: string;
  title: string;
  description?: string;
  status: string;
  rewardBudgetEp: string;
  escrowEp: string;
  closeAt: string;
  createdAt: string;
  _count: {
    participations: number;
  };
}

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'SETTLED' | 'CANCELED';

export default function MyCreatedVotes() {
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

      const response = await api.getMyCreatedVotes(params);
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
      OPEN: '진행중',
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelVote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('투표를 취소하시겠습니까? 시드머니가 환불됩니다.')) {
      return;
    }

    try {
      const response = await api.cancelUserVote(id);
      if (response.success) {
        alert('투표가 취소되었습니다. 시드머니가 환불되었습니다.');
        fetchVotes();
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '취소에 실패했습니다');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">내가 만든 투표</h1>
            <p className="text-gray-600">
              내가 생성한 투표 목록입니다
            </p>
          </div>
          <button
            onClick={() => navigate('/votes/create')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            + 투표 만들기
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['ALL', 'OPEN', 'CLOSED', 'SETTLED', 'CANCELED'] as StatusFilter[]).map((status) => (
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
              {status === 'ALL' ? '전체' :
               status === 'OPEN' ? '진행중' :
               status === 'CLOSED' ? '마감' :
               status === 'SETTLED' ? '정산 완료' : '취소됨'}
            </button>
          ))}
        </div>

        {/* 투표 목록 */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-6">
                <div className="h-5 bg-gray-300 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : votes.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 mb-4">아직 생성한 투표가 없습니다</p>
            <button
              onClick={() => navigate('/votes/create')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              첫 투표 만들기
            </button>
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
                      {getStatusBadge(vote.status)}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">{vote.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400">시드머니</div>
                    <div className="text-lg font-bold text-purple-600">
                      {Number(vote.rewardBudgetEp).toLocaleString()} <span className="text-sm">EP</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{vote._count?.participations || 0}명 참여</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>마감: {formatDate(vote.closeAt)}</span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                {vote.status === 'OPEN' && vote._count?.participations === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={(e) => handleCancelVote(vote.id, e)}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      취소하고 환불받기
                    </button>
                  </div>
                )}
                {(vote.status === 'CLOSED' || (vote.status === 'OPEN' && new Date() > new Date(vote.closeAt))) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/votes/${vote.id}`);
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      정산하기 →
                    </button>
                  </div>
                )}
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

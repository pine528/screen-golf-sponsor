import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Layout } from '../../components/Layout';
import RewardPoolStatus from '../../components/RewardPoolStatus';

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
  settleAt?: string;
  correctAnswer?: any;
  createdAt: string;
  _count?: {
    participations: number;
  };
}

interface VoteTemplate {
  code: string;
  name: string;
  baseBudget: number;
  difficulty: number;
}

interface VoteStats {
  votes: {
    open: number;
    closed: number;
    settled: number;
    canceled: number;
    total: number;
  };
  totalParticipations: number;
}

export default function AdminVoteV2() {
  const [votes, setVotes] = useState<VoteV2[]>([]);
  const [templates, setTemplates] = useState<VoteTemplate[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteV2 | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 생성 폼 상태
  const [createForm, setCreateForm] = useState({
    templateCode: 'T1-YesNo',
    title: '',
    description: '',
    options: ['', ''],
    closeAt: '',
  });

  // 정산 폼 상태
  const [settleForm, setSettleForm] = useState({
    correctAnswer: 0,
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter, pagination.page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const [votesRes, templatesRes, statsRes] = await Promise.all([
        api.getVotes(params),
        api.getVoteTemplates(),
        api.getVoteStats(),
      ]);

      if (votesRes.success) {
        setVotes(votesRes.data || []);
        if (votesRes.pagination) {
          setPagination(prev => ({ ...prev, ...votesRes.pagination }));
        }
      }
      if (templatesRes.success) {
        setTemplates(templatesRes.data || []);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title || !createForm.closeAt || createForm.options.some(o => !o.trim())) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요' });
      return;
    }

    setActionLoading(true);
    try {
      const response = await api.createVote({
        templateCode: createForm.templateCode,
        title: createForm.title,
        description: createForm.description || undefined,
        options: createForm.options.filter(o => o.trim()),
        closeAt: new Date(createForm.closeAt).toISOString(),
      });

      if (response.success) {
        setMessage({ type: 'success', text: '투표가 생성되었습니다' });
        setShowCreateModal(false);
        setCreateForm({ templateCode: 'T1-YesNo', title: '', description: '', options: ['', ''], closeAt: '' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: response.error?.message || '생성 실패' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error?.message || '생성 실패' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedVote) return;

    setActionLoading(true);
    try {
      const response = await api.settleVote(selectedVote.id, settleForm.correctAnswer);

      if (response.success && response.data) {
        const data = response.data;
        setMessage({
          type: 'success',
          text: data.alreadySettled
            ? '이미 정산된 투표입니다'
            : `정산 완료: ${data.winnersCount}명 당첨, 1인당 ${Number(data.perWinnerEp).toLocaleString()} EP`,
        });
        setShowSettleModal(false);
        setSelectedVote(null);
        fetchData();
      } else {
        setMessage({ type: 'error', text: response.error?.message || '정산 실패' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error?.message || '정산 실패' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (vote: VoteV2) => {
    if (!confirm(`"${vote.title}" 투표를 취소하시겠습니까? 에스크로가 풀로 반환됩니다.`)) return;

    try {
      const response = await api.cancelVote(vote.id);
      if (response.success) {
        setMessage({ type: 'success', text: '투표가 취소되었습니다' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: response.error?.message || '취소 실패' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error?.message || '취소 실패' });
    }
  };

  const handleCloseExpired = async () => {
    try {
      const response = await api.closeExpiredVotes();
      if (response.success) {
        setMessage({ type: 'success', text: `${response.data?.closedCount || 0}개 투표 마감 처리됨` });
        fetchData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: '마감 처리 실패' });
    }
  };

  const handleDepositPool = async () => {
    const amountStr = prompt('충전할 EP 금액을 입력하세요:');
    if (!amountStr) return;

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: '유효한 금액을 입력해주세요' });
      return;
    }

    try {
      const response = await api.depositToRewardPool(amount, '관리자 수동 충전');
      if (response.success) {
        setMessage({ type: 'success', text: `${amount.toLocaleString()} EP 충전 완료` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: '충전 실패' });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-800',
      CLOSED: 'bg-yellow-100 text-yellow-800',
      SETTLED: 'bg-blue-100 text-blue-800',
      CANCELED: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vote V2 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDepositPool}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
          >
            풀 충전
          </button>
          <button
            onClick={handleCloseExpired}
            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
          >
            만료 마감 처리
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            투표 생성
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right">×</button>
        </div>
      )}

      {/* 리워드풀 + 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <RewardPoolStatus showDetails className="lg:col-span-2" />
        {stats && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold mb-3">통계</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">진행중</div>
              <div className="font-medium">{stats.votes.open}</div>
              <div className="text-gray-500">마감</div>
              <div className="font-medium">{stats.votes.closed}</div>
              <div className="text-gray-500">정산완료</div>
              <div className="font-medium">{stats.votes.settled}</div>
              <div className="text-gray-500">취소됨</div>
              <div className="font-medium">{stats.votes.canceled}</div>
              <div className="border-t pt-2 text-gray-500">총 참여</div>
              <div className="border-t pt-2 font-medium">{stats.totalParticipations}</div>
            </div>
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {['ALL', 'OPEN', 'CLOSED', 'SETTLED', 'CANCELED'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-3 py-1 rounded text-sm ${statusFilter === status ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {status === 'ALL' ? '전체' : status}
          </button>
        ))}
      </div>

      {/* 투표 목록 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">템플릿</th>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-right">에스크로</th>
              <th className="px-4 py-3 text-right">참여자</th>
              <th className="px-4 py-3 text-left">마감일</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : votes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  투표가 없습니다
                </td>
              </tr>
            ) : (
              votes.map((vote) => (
                <tr key={vote.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{vote.title}</div>
                    <div className="text-xs text-gray-500">{vote.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">{vote.templateCode}</td>
                  <td className="px-4 py-3">{getStatusBadge(vote.status)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {Number(vote.escrowEp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">{vote._count?.participations || 0}</td>
                  <td className="px-4 py-3">{formatDate(vote.closeAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      {(vote.status === 'OPEN' || vote.status === 'CLOSED') && (
                        <button
                          onClick={() => {
                            setSelectedVote(vote);
                            setSettleForm({ correctAnswer: 0 });
                            setShowSettleModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          정산
                        </button>
                      )}
                      {vote.status === 'OPEN' && (
                        <button
                          onClick={() => handleCancel(vote)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">투표 생성</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">템플릿</label>
                <select
                  value={createForm.templateCode}
                  onChange={(e) => setCreateForm({ ...createForm, templateCode: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {templates.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} (기본 {t.baseBudget.toLocaleString()} EP)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">제목</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="투표 제목"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">설명 (선택)</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="투표 설명"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">선택지</label>
                {createForm.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...createForm.options];
                        newOptions[i] = e.target.value;
                        setCreateForm({ ...createForm, options: newOptions });
                      }}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder={`선택지 ${i + 1}`}
                    />
                    {createForm.options.length > 2 && (
                      <button
                        onClick={() => {
                          const newOptions = createForm.options.filter((_, idx) => idx !== i);
                          setCreateForm({ ...createForm, options: newOptions });
                        }}
                        className="px-2 text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setCreateForm({ ...createForm, options: [...createForm.options, ''] })}
                  className="text-sm text-purple-600 hover:underline"
                >
                  + 선택지 추가
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">마감일시</label>
                <input
                  type="datetime-local"
                  value={createForm.closeAt}
                  onChange={(e) => setCreateForm({ ...createForm, closeAt: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 정산 모달 */}
      {showSettleModal && selectedVote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">투표 정산</h2>
            <p className="text-gray-600 mb-4">{selectedVote.title}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">정답 선택</label>
              <div className="space-y-2">
                {selectedVote.options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={i}
                      checked={settleForm.correctAnswer === i}
                      onChange={() => setSettleForm({ correctAnswer: i })}
                    />
                    <span>{typeof opt === 'object' ? opt.label || opt.text : opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700 mb-4">
              정산 시 정답자에게 1/n 균등 분배됩니다. (최대 {Number(selectedVote.maxPerWinnerEp).toLocaleString()} EP/인)
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSettleModal(false);
                  setSelectedVote(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSettle}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? '정산 중...' : '정산 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}

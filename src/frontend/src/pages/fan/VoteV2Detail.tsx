import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import RewardPoolStatus from '../../components/RewardPoolStatus';
import { Layout } from '../../components/Layout';

interface VoteV2Detail {
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
  participationCount: number;
  userParticipation?: {
    answer: any;
    isCorrect?: boolean;
    microRewardPaidEp: string;
    finalRewardPaidEp: string;
    createdAt: string;
  } | null;
}

export default function VoteV2Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [vote, setVote] = useState<VoteV2Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; microReward?: number } | null>(null);

  useEffect(() => {
    if (id) {
      fetchVoteDetail();
    }
  }, [id]);

  const fetchVoteDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getVote(id!);
      if (response.success && response.data) {
        setVote(response.data);
        if (response.data.userParticipation) {
          setSelectedAnswer(response.data.userParticipation.answer);
        }
      } else {
        setError(response.error?.message || '투표를 불러오지 못했습니다');
      }
    } catch (err: any) {
      console.error('Failed to fetch vote detail:', err);
      setError(err.response?.data?.error?.message || '투표를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigate('/fan/login', { state: { from: `/votes/${id}` } });
      return;
    }

    if (selectedAnswer === null) {
      setSubmitResult({ success: false, message: '답변을 선택해주세요' });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await api.participateVote(id!, selectedAnswer);
      if (response.success) {
        setSubmitResult({
          success: true,
          message: '투표에 참여했습니다!',
          microReward: response.data?.microRewardPaid || 0,
        });
        // 상세 정보 새로고침 (await 추가)
        await fetchVoteDetail();
      } else {
        setSubmitResult({
          success: false,
          message: response.error?.message || '참여에 실패했습니다',
        });
      }
    } catch (error: any) {
      setSubmitResult({
        success: false,
        message: error.response?.data?.error?.message || '참여에 실패했습니다',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-800 border-green-200',
      CLOSED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      SETTLED: 'bg-blue-100 text-blue-800 border-blue-200',
      CANCELED: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    const labels: Record<string, string> = {
      OPEN: '참여 가능',
      CLOSED: '마감 (정산 대기)',
      SETTLED: '정산 완료',
      CANCELED: '취소됨',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRemainingTime = (closeAt: string) => {
    const now = new Date();
    const close = new Date(closeAt);
    const diff = close.getTime() - now.getTime();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}일 ${hours % 24}시간`;
    }
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  };

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (vote?.closeAt && vote.status === 'OPEN') {
      const updateTimer = () => {
        setTimeRemaining(getRemainingTime(vote.closeAt));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [vote?.closeAt, vote?.status]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!vote) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4 text-center">
          <p className="text-gray-500">{error || '투표를 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/votes')} className="mt-4 text-purple-600 hover:underline">
            목록으로 돌아가기
          </button>
        </div>
      </Layout>
    );
  }

  const hasParticipated = !!vote.userParticipation;
  const canParticipate = vote.status === 'OPEN' && !hasParticipated;

  return (
    <Layout>
    <div className="max-w-2xl mx-auto p-4">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate('/votes')}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-800 mb-4"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        목록으로
      </button>

      {/* 리워드풀 상태 */}
      <RewardPoolStatus compact className="mb-6" />

      {/* 투표 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            {getStatusBadge(vote.status)}
            {vote.status === 'OPEN' && timeRemaining && (
              <span className="text-sm text-orange-600 font-medium">{timeRemaining} 남음</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{vote.title}</h1>
          {vote.description && <p className="text-gray-600">{vote.description}</p>}
        </div>

        {/* 보상 정보 */}
        <div className="p-4 bg-purple-50 border-b border-purple-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">총 보상</div>
              <div className="text-lg font-bold text-purple-700">{Number(vote.escrowEp).toLocaleString()} EP</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">참여자</div>
              <div className="text-lg font-bold text-gray-700">{vote.participationCount}명</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">최대 1인 보상</div>
              <div className="text-lg font-bold text-green-600">{Number(vote.maxPerWinnerEp).toLocaleString()} EP</div>
            </div>
          </div>
        </div>

        {/* 내 참여 결과 */}
        {hasParticipated && (
          <div className={`p-4 border-b ${vote.userParticipation?.isCorrect === true ? 'bg-green-50 border-green-100' : vote.userParticipation?.isCorrect === false ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">
                {vote.userParticipation?.isCorrect === true
                  ? '정답! 보상을 받았습니다'
                  : vote.userParticipation?.isCorrect === false
                  ? '아쉽지만 오답입니다'
                  : '참여 완료'}
              </span>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-500">참여 보상:</span>{' '}
                <span className="font-medium text-purple-600">+{Number(vote.userParticipation?.microRewardPaidEp || 0).toLocaleString()} EP</span>
              </div>
              {Number(vote.userParticipation?.finalRewardPaidEp || 0) > 0 && (
                <div>
                  <span className="text-gray-500">정답 보상:</span>{' '}
                  <span className="font-medium text-green-600">+{Number(vote.userParticipation?.finalRewardPaidEp || 0).toLocaleString()} EP</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 선택지 */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            {canParticipate ? '답변을 선택하세요' : '선택지'}
          </h3>
          <div className="space-y-3">
            {vote.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isUserAnswer = vote.userParticipation?.answer === index;
              const isCorrectAnswer = vote.correctAnswer === index;

              return (
                <button
                  key={index}
                  onClick={() => canParticipate && setSelectedAnswer(index)}
                  disabled={!canParticipate}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isCorrectAnswer && vote.status === 'SETTLED'
                      ? 'border-green-500 bg-green-50'
                      : isUserAnswer && vote.status === 'SETTLED' && !isCorrectAnswer
                      ? 'border-red-300 bg-red-50'
                      : isSelected && canParticipate
                      ? 'border-purple-500 bg-purple-50'
                      : canParticipate
                      ? 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{typeof option === 'object' ? option.label || option.text : option}</span>
                    <div className="flex items-center gap-2">
                      {isCorrectAnswer && vote.status === 'SETTLED' && (
                        <span className="text-green-600 text-sm font-medium">정답</span>
                      )}
                      {isUserAnswer && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 제출 버튼 */}
        {canParticipate && (
          <div className="p-6 pt-0">
            {submitResult && (
              <div className={`mb-4 p-3 rounded-lg ${submitResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {submitResult.message}
                {submitResult.microReward !== undefined && submitResult.microReward > 0 && (
                  <span className="ml-2 font-bold">+{submitResult.microReward} EP</span>
                )}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedAnswer === null}
              className="w-full py-3 px-6 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '참여 중...' : isAuthenticated ? '무료로 참여하기' : '로그인하고 참여하기'}
            </button>
            <p className="text-center text-xs text-gray-500 mt-2">
              참여 즉시 마이크로 보상을 받습니다
            </p>
          </div>
        )}

        {/* 마감 정보 */}
        <div className="p-4 bg-gray-50 text-sm text-gray-500">
          <div className="flex justify-between">
            <span>마감일</span>
            <span>{formatDate(vote.closeAt)}</span>
          </div>
          {vote.settleAt && (
            <div className="flex justify-between mt-1">
              <span>정산일</span>
              <span>{formatDate(vote.settleAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}

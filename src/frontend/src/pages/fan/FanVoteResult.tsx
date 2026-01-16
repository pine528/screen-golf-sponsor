import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  ArrowLeft,
  Trophy,
  Users,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  PartyPopper,
  XCircle,
} from 'lucide-react';
import { cn } from '../../utils';

export default function FanVoteResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['fanVoteResult', id],
    queryFn: async () => {
      const res = await api.getFanVoteResult(id!);
      return res.data;
    },
    enabled: !!id,
  });

  const formatNumber = (num: string | number) => {
    return Number(num).toLocaleString();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              결과를 불러올 수 없습니다
            </h2>
            <Link to="/fan-votes" className="btn btn-primary">
              투표 목록으로
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const { event, status, settlement, resultOptionIndex, myWin } = data;
  const options = event.options as string[];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>뒤로</span>
        </button>

        {/* Main Card */}
        <div className="card p-6">
          {/* Header */}
          <h1 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h1>
          <p className="text-slate-600 mb-6">{event.question}</p>

          {/* Pending Settlement */}
          {status === 'PENDING_SETTLEMENT' && (
            <div className="bg-amber-50 rounded-xl p-6 text-center">
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-amber-700 mb-2">
                정산 대기 중
              </h2>
              <p className="text-amber-600">
                관리자가 결과를 확정하면 당첨자에게 포인트가 지급됩니다
              </p>
            </div>
          )}

          {/* Settled Result */}
          {status === 'SETTLED' && settlement && (
            <>
              {/* My Result */}
              {myWin && (
                <div
                  className={cn(
                    'rounded-xl p-6 mb-6',
                    myWin.isWinner ? 'bg-emerald-50' : 'bg-slate-50'
                  )}
                >
                  {myWin.isWinner ? (
                    <div className="text-center">
                      <PartyPopper className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                      <h2 className="text-xl font-bold text-emerald-700 mb-2">
                        축하합니다! 당첨되셨습니다!
                      </h2>
                      <p className="text-3xl font-bold text-emerald-600 mb-2">
                        +{formatNumber(myWin.payoutPoints)}P
                      </p>
                      <p className="text-emerald-600">
                        포인트가 지급되었습니다
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h2 className="text-lg font-semibold text-slate-700 mb-2">
                        아쉽게도 당첨되지 않았습니다
                      </h2>
                      <p className="text-slate-500">다음 투표에서 다시 도전해보세요!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Result Option */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 mb-3">정답</h3>
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">
                      {options[resultOptionIndex]}
                    </span>
                  </div>
                </div>
              </div>

              {/* All Options */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 mb-3">전체 옵션</h3>
                <div className="space-y-2">
                  {options.map((option: string, index: number) => (
                    <div
                      key={index}
                      className={cn(
                        'rounded-xl p-3 border',
                        index === resultOptionIndex
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span
                            className={cn(
                              index === resultOptionIndex
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-700'
                            )}
                          >
                            {option}
                          </span>
                        </div>
                        {index === resultOptionIndex && (
                          <span className="badge bg-emerald-500 text-white text-xs">
                            정답
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  정산 결과
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Coins className="w-4 h-4" />
                      총 포인트 풀
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {formatNumber(settlement.potTotal)}P
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Users className="w-4 h-4" />
                      당첨자 수
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {settlement.winnersCount}명
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Trophy className="w-4 h-4" />
                      1인당 지급
                    </div>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatNumber(settlement.payoutEach)}P
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      플랫폼 귀속
                    </div>
                    <p className="text-lg font-bold text-slate-600">
                      {formatNumber(settlement.remainder)}P
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Not Settled */}
          {status !== 'SETTLED' && status !== 'PENDING_SETTLEMENT' && (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-700 mb-2">
                아직 결과가 없습니다
              </h2>
              <p className="text-slate-500">
                투표가 종료된 후 결과를 확인할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

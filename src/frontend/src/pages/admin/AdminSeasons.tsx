import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  Gift,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../utils';

interface Season {
  id: string;
  name: string;
  description?: string;
  status: string;
  startsAt: string;
  endsAt: string;
  rewardTiers: any[];
  participationBonus: number;
  _count?: {
    participants: number;
  };
}

interface RewardTier {
  rankFrom: number;
  rankTo: number;
  rewardPoints: number;
}

function CreateSeasonModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startsAt: '',
    endsAt: '',
    participationBonus: 100,
    rewardTiers: [
      { rankFrom: 1, rankTo: 1, rewardPoints: 10000 },
      { rankFrom: 2, rankTo: 2, rewardPoints: 5000 },
      { rankFrom: 3, rankTo: 3, rewardPoints: 3000 },
      { rankFrom: 4, rankTo: 10, rewardPoints: 1000 },
      { rankFrom: 11, rankTo: 100, rewardPoints: 500 },
    ] as RewardTier[],
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createSeason(data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '시즌 생성에 실패했습니다');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.startsAt || !formData.endsAt) {
      setError('시작일과 종료일을 입력하세요');
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
      participationBonus: formData.participationBonus,
      rewardTiers: formData.rewardTiers,
    });
  };

  const updateTier = (index: number, field: keyof RewardTier, value: number) => {
    const newTiers = [...formData.rewardTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData({ ...formData, rewardTiers: newTiers });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">새 시즌 만들기</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              시즌 이름 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 2024 시즌 1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="시즌 설명을 입력하세요"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                시작일 *
              </label>
              <input
                type="datetime-local"
                value={formData.startsAt}
                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                종료일 *
              </label>
              <input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              참여 보너스 (포인트)
            </label>
            <input
              type="number"
              min="0"
              value={formData.participationBonus}
              onChange={(e) =>
                setFormData({ ...formData, participationBonus: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              모든 참여자에게 지급되는 기본 보상
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              보상 티어
            </label>
            <div className="space-y-2">
              {formData.rewardTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 w-8">{index + 1}.</span>
                  <input
                    type="number"
                    min="1"
                    value={tier.rankFrom}
                    onChange={(e) => updateTier(index, 'rankFrom', Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                  />
                  <span className="text-slate-500">~</span>
                  <input
                    type="number"
                    min="1"
                    value={tier.rankTo}
                    onChange={(e) => updateTier(index, 'rankTo', Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                  />
                  <span className="text-slate-500">위</span>
                  <span className="text-slate-500">→</span>
                  <input
                    type="number"
                    min="0"
                    value={tier.rewardPoints}
                    onChange={(e) => updateTier(index, 'rewardPoints', Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                  <span className="text-slate-500">P</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                '만들기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSeasons() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adminSeasons'],
    queryFn: () => api.getSeasons({ pageSize: 100 }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateSeason(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSeasons'] }),
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.endSeason(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSeasons'] }),
  });

  const distributeMutation = useMutation({
    mutationFn: (id: string) => api.distributeSeasonRewards(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSeasons'] }),
  });

  const updateRankingsMutation = useMutation({
    mutationFn: (id: string) => api.updateSeasonRankings(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSeasons'] }),
  });

  const seasons: Season[] = data?.data?.seasons || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', label: '초안' },
      UPCOMING: { bg: 'bg-blue-100', text: 'text-blue-700', label: '예정' },
      ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '진행중' },
      ENDED: { bg: 'bg-amber-100', text: 'text-amber-700', label: '종료' },
      REWARDS_DISTRIBUTED: { bg: 'bg-purple-100', text: 'text-purple-700', label: '배포완료' },
    };
    const badge = badges[status] || badges.DRAFT;
    return (
      <span className={cn('badge text-xs', badge.bg, badge.text)}>{badge.label}</span>
    );
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">시즌 관리</h1>
              <p className="text-sm text-slate-500">시즌 리워드 프로그램 관리</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            새 시즌
          </button>
        </div>

        {/* Seasons List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : seasons.length === 0 ? (
          <div className="card p-12 text-center">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">아직 생성된 시즌이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seasons.map((season) => (
              <div key={season.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(season.status)}
                    <div>
                      <h3 className="font-semibold text-slate-900">{season.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(season.startsAt)} ~ {formatDate(season.endsAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {season._count?.participants || 0}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Gift className="w-4 h-4" />
                          참여 보너스 {season.participationBonus}P
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Actions based on status */}
                    {season.status === 'DRAFT' && (
                      <button
                        onClick={() => activateMutation.mutate(season.id)}
                        disabled={activateMutation.isPending}
                        className="btn btn-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        활성화
                      </button>
                    )}

                    {season.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => updateRankingsMutation.mutate(season.id)}
                          disabled={updateRankingsMutation.isPending}
                          className="btn btn-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          랭킹 갱신
                        </button>
                        <button
                          onClick={() => endMutation.mutate(season.id)}
                          disabled={endMutation.isPending}
                          className="btn btn-sm bg-amber-100 text-amber-700 hover:bg-amber-200"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          종료
                        </button>
                      </>
                    )}

                    {season.status === 'ENDED' && (
                      <button
                        onClick={() => {
                          if (confirm('보상을 배포하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                            distributeMutation.mutate(season.id);
                          }
                        }}
                        disabled={distributeMutation.isPending}
                        className="btn btn-sm bg-purple-100 text-purple-700 hover:bg-purple-200"
                      >
                        <Gift className="w-4 h-4 mr-1" />
                        보상 배포
                      </button>
                    )}

                    {season.status === 'REWARDS_DISTRIBUTED' && (
                      <span className="flex items-center gap-1 text-sm text-purple-600">
                        <CheckCircle className="w-4 h-4" />
                        배포 완료
                      </span>
                    )}

                    <Link
                      to={`/seasons/${season.id}/leaderboard`}
                      className="btn btn-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      리더보드
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>

                {/* Reward Tiers Summary */}
                {season.rewardTiers && (season.rewardTiers as RewardTier[]).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">보상 티어:</p>
                    <div className="flex flex-wrap gap-2">
                      {(season.rewardTiers as RewardTier[]).map((tier, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-slate-100 rounded"
                        >
                          {tier.rankFrom === tier.rankTo
                            ? `${tier.rankFrom}위`
                            : `${tier.rankFrom}~${tier.rankTo}위`}
                          : {tier.rewardPoints.toLocaleString()}P
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSeasonModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['adminSeasons'] })}
        />
      )}
    </Layout>
  );
}

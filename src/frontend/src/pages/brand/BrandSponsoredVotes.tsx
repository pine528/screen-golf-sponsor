import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Award,
  BarChart3,
  Eye,
  MousePointer,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Coins,
  Clock,
  Image,
  MessageSquare,
  Link2,
  Plus,
} from 'lucide-react';

interface SponsoredVote {
  id: string;
  title: string;
  question: string;
  status: string;
  entryFeePoints: string;
  startsAt: string;
  endsAt: string;
  sponsorContribution: string;
  sponsorBannerUrl?: string;
  sponsorLogoUrl?: string;
  sponsorMessage?: string;
  sponsorLinkUrl?: string;
  _count?: {
    entries: number;
  };
  sponsorEngagement?: {
    bannerImpressions: number;
    bannerClicks: number;
    linkClicks: number;
  };
}

interface SponsorStats {
  sponsoredEventsCount: number;
  totalBannerImpressions: number;
  totalBannerClicks: number;
  totalLinkClicks: number;
  totalContribution: string;
  totalParticipants: number;
  ctr: string;
}

function SponsorModal({
  eventId,
  eventTitle,
  onClose,
  onSuccess,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    contributionAmount: 1000,
    bannerUrl: '',
    logoUrl: '',
    message: '',
    linkUrl: '',
  });
  const [error, setError] = useState<string | null>(null);

  const sponsorMutation = useMutation({
    mutationFn: (data: typeof formData) => api.sponsorVote(eventId, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '후원에 실패했습니다');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    sponsorMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">투표 후원하기</h2>
          <p className="text-sm text-slate-500 mt-1">{eventTitle}</p>
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
              후원 금액 (포인트) *
            </label>
            <input
              type="number"
              min="1"
              value={formData.contributionAmount}
              onChange={(e) =>
                setFormData({ ...formData, contributionAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              후원 금액은 투표 상금 풀에 추가됩니다
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Image className="w-4 h-4 inline mr-1" />
              배너 이미지 URL
            </label>
            <input
              type="url"
              value={formData.bannerUrl}
              onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Image className="w-4 h-4 inline mr-1" />
              로고 이미지 URL
            </label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              홍보 메시지
            </label>
            <input
              type="text"
              maxLength={200}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="브랜드 홍보 문구를 입력하세요"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Link2 className="w-4 h-4 inline mr-1" />
              링크 URL
            </label>
            <input
              type="url"
              value={formData.linkUrl}
              onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
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
              disabled={sponsorMutation.isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {sponsorMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                '후원하기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandSponsoredVotes() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sponsorModalEvent, setSponsorModalEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // 후원한 투표 목록
  const { data: sponsoredVotesData, isLoading: loadingVotes } = useQuery({
    queryKey: ['sponsoredVotes'],
    queryFn: () => api.getSponsoredVotes(),
  });

  // 스폰서 통계
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['sponsorStats'],
    queryFn: () => api.getSponsorStats(),
  });

  // 후원 가능한 투표 (활성 투표 중 아직 후원 안 한 것)
  const { data: activeVotesData } = useQuery({
    queryKey: ['activeFanVotes'],
    queryFn: () => api.getActiveFanVotes(),
  });

  const sponsoredVotes: SponsoredVote[] = sponsoredVotesData?.data?.events || [];
  const stats: SponsorStats | null = statsData?.data || null;
  const activeVotes = activeVotesData?.data || [];

  // 후원 가능한 투표 필터링 (아직 스폰서가 없는 것)
  const sponsorableVotes = activeVotes.filter(
    (v: any) => !v.sponsorBrandId && v.status === 'ACTIVE'
  );

  const formatNumber = (num: string | number) => Number(num).toLocaleString();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge bg-emerald-100 text-emerald-700">진행중</span>;
      case 'CLOSED':
        return <span className="badge bg-slate-100 text-slate-700">종료</span>;
      case 'SETTLED':
        return <span className="badge bg-blue-100 text-blue-700">정산완료</span>;
      default:
        return <span className="badge bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">투표 스폰서십</h1>
              <p className="text-sm text-slate-500">
                팬 투표를 후원하고 브랜드를 홍보하세요
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Award className="w-4 h-4" />
                후원한 투표
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {stats.sponsoredEventsCount}개
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Eye className="w-4 h-4" />
                총 노출
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {formatNumber(stats.totalBannerImpressions)}회
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <MousePointer className="w-4 h-4" />
                배너 클릭율
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.ctr}%</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Coins className="w-4 h-4" />
                총 후원
              </div>
              <p className="text-2xl font-bold text-amber-600">
                {formatNumber(stats.totalContribution)}P
              </p>
            </div>
          </div>
        ) : null}

        {/* Available Votes to Sponsor */}
        {sponsorableVotes.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              후원 가능한 투표
            </h2>
            <div className="space-y-3">
              {sponsorableVotes.slice(0, 3).map((vote: any) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-slate-900">{vote.title}</h3>
                    <p className="text-sm text-slate-500">
                      {vote._count?.entries || 0}명 참여
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSponsorModalEvent({ id: vote.id, title: vote.title })
                    }
                    className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600"
                  >
                    후원하기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sponsored Votes List */}
        <div className="card">
          <div className="p-6 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              후원한 투표 목록
            </h2>
          </div>

          {loadingVotes ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
            </div>
          ) : sponsoredVotes.length === 0 ? (
            <div className="p-8 text-center">
              <Award className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">아직 후원한 투표가 없습니다</p>
              <p className="text-sm text-slate-400 mt-1">
                팬 투표를 후원하고 브랜드를 홍보해보세요
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sponsoredVotes.map((vote) => (
                <div key={vote.id} className="p-4">
                  {/* Vote Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === vote.id ? null : vote.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      {getStatusBadge(vote.status)}
                      <div>
                        <h3 className="font-medium text-slate-900">{vote.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {vote._count?.entries || 0}명
                          </span>
                          <span className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5" />
                            {formatNumber(vote.sponsorContribution)}P 후원
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {vote.sponsorEngagement && (
                        <div className="text-right text-sm">
                          <div className="text-slate-500">
                            {formatNumber(vote.sponsorEngagement.bannerImpressions)} 노출
                          </div>
                          <div className="text-emerald-600 font-medium">
                            {formatNumber(vote.sponsorEngagement.bannerClicks)} 클릭
                          </div>
                        </div>
                      )}
                      {expandedId === vote.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === vote.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Engagement Stats */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-700 mb-3">
                            노출 통계
                          </h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500 flex items-center gap-2">
                                <Eye className="w-4 h-4" /> 배너 노출
                              </span>
                              <span className="font-medium">
                                {formatNumber(
                                  vote.sponsorEngagement?.bannerImpressions || 0
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500 flex items-center gap-2">
                                <MousePointer className="w-4 h-4" /> 배너 클릭
                              </span>
                              <span className="font-medium">
                                {formatNumber(
                                  vote.sponsorEngagement?.bannerClicks || 0
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500 flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" /> 링크 클릭
                              </span>
                              <span className="font-medium">
                                {formatNumber(vote.sponsorEngagement?.linkClicks || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Creative Info */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-700 mb-3">
                            광고 소재
                          </h4>
                          <div className="space-y-2 text-sm">
                            {vote.sponsorBannerUrl && (
                              <div className="flex items-start gap-2">
                                <Image className="w-4 h-4 text-slate-400 mt-0.5" />
                                <a
                                  href={vote.sponsorBannerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline truncate"
                                >
                                  배너 이미지
                                </a>
                              </div>
                            )}
                            {vote.sponsorMessage && (
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                                <span className="text-slate-700">
                                  {vote.sponsorMessage}
                                </span>
                              </div>
                            )}
                            {vote.sponsorLinkUrl && (
                              <div className="flex items-start gap-2">
                                <Link2 className="w-4 h-4 text-slate-400 mt-0.5" />
                                <a
                                  href={vote.sponsorLinkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline truncate"
                                >
                                  {vote.sponsorLinkUrl}
                                </a>
                              </div>
                            )}
                            {!vote.sponsorBannerUrl &&
                              !vote.sponsorMessage &&
                              !vote.sponsorLinkUrl && (
                                <p className="text-slate-400">등록된 소재 없음</p>
                              )}
                          </div>
                        </div>
                      </div>

                      {/* Vote Period */}
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="w-4 h-4" />
                        {new Date(vote.startsAt).toLocaleDateString('ko-KR')} ~{' '}
                        {new Date(vote.endsAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sponsor Modal */}
      {sponsorModalEvent && (
        <SponsorModal
          eventId={sponsorModalEvent.id}
          eventTitle={sponsorModalEvent.title}
          onClose={() => setSponsorModalEvent(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['sponsoredVotes'] });
            queryClient.invalidateQueries({ queryKey: ['sponsorStats'] });
            queryClient.invalidateQueries({ queryKey: ['activeFanVotes'] });
          }}
        />
      )}
    </Layout>
  );
}

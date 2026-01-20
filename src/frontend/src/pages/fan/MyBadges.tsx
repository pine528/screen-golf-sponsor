import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Award,
  Trophy,
  Star,
  Loader2,
  Calendar,
} from 'lucide-react';
import { cn } from '../../utils';

interface Badge {
  id: string;
  badgeType: string;
  name: string;
  description?: string;
  iconUrl?: string;
  awardedAt: string;
  seasonName: string;
}

const badgeIcons: Record<string, string> = {
  SEASON_GOLD: '🥇',
  SEASON_SILVER: '🥈',
  SEASON_BRONZE: '🥉',
  SEASON_TOP10: '🏆',
  SEASON_TOP100: '🎖️',
  PARTICIPATION: '⭐',
  VOTE_MASTER: '🗳️',
  SHOP_VIP: '💎',
  STREAK: '🔥',
};

const badgeColors: Record<string, string> = {
  SEASON_GOLD: 'from-amber-100 to-yellow-100 border-amber-300',
  SEASON_SILVER: 'from-slate-100 to-slate-200 border-slate-300',
  SEASON_BRONZE: 'from-orange-100 to-amber-100 border-orange-300',
  SEASON_TOP10: 'from-violet-100 to-purple-100 border-violet-300',
  SEASON_TOP100: 'from-blue-100 to-sky-100 border-blue-300',
  PARTICIPATION: 'from-emerald-100 to-teal-100 border-emerald-300',
  VOTE_MASTER: 'from-pink-100 to-rose-100 border-pink-300',
  SHOP_VIP: 'from-purple-100 to-indigo-100 border-purple-300',
  STREAK: 'from-red-100 to-orange-100 border-red-300',
};

export default function MyBadges() {
  const { data, isLoading } = useQuery({
    queryKey: ['myBadges'],
    queryFn: () => api.getMyBadges(),
  });

  const badges: Badge[] = data?.data || [];

  // 뱃지를 시즌별로 그룹화
  const badgesBySeason = badges.reduce((acc: Record<string, Badge[]>, badge) => {
    const key = badge.seasonName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(badge);
    return acc;
  }, {});

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">내 뱃지</h1>
              <p className="text-sm text-slate-500">
                시즌 참여로 획득한 뱃지 {badges.length}개
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : badges.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              아직 획득한 뱃지가 없습니다
            </h3>
            <p className="text-slate-500 text-sm">
              시즌에 참여하고 뱃지를 획득해보세요!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(badgesBySeason).map(([seasonName, seasonBadges]) => (
              <div key={seasonName} className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    {seasonName}
                  </h2>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {seasonBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className={cn(
                        'p-4 rounded-xl border-2 bg-gradient-to-br text-center',
                        badgeColors[badge.badgeType] || 'from-slate-100 to-slate-200 border-slate-300'
                      )}
                    >
                      <div className="text-4xl mb-2">
                        {badgeIcons[badge.badgeType] || '🏅'}
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1">
                        {badge.name}
                      </h3>
                      {badge.description && (
                        <p className="text-xs text-slate-600 mb-2">
                          {badge.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(badge.awardedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Badge Guide */}
        <div className="card p-6 mt-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            뱃지 종류
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span>🥇</span>
              <span className="text-slate-600">시즌 챔피언 (1위)</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🥈</span>
              <span className="text-slate-600">시즌 준우승 (2위)</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🥉</span>
              <span className="text-slate-600">시즌 3위</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span className="text-slate-600">TOP 10</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎖️</span>
              <span className="text-slate-600">TOP 100</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⭐</span>
              <span className="text-slate-600">시즌 참여자</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  Vote,
  Trophy,
  Clock,
  ArrowRight,
  Crown,
  Gift,
  Heart,
  Users,
  ChevronRight,
  Coins,
  CheckCircle,
  LogIn,
  Medal,
  FileText,
  ShoppingBag,
  Plus,
} from 'lucide-react';
import { cn } from '../../utils';

interface FanVoteEvent {
  id: string;
  title: string;
  question: string;
  options: string[];
  entryFeePoints: number;
  winnersCount: number;
  totalPool: number;
  status: string;
  startsAt: string;
  endsAt: string;
  _count?: {
    entries: number;
  };
  myEntry?: {
    optionIndex: number;
  } | null;
}

interface EndedVoteEvent extends FanVoteEvent {
  resultOptionIndex?: number;
  winners?: { nickname: string }[];
  isWinner?: boolean;
}

interface RankingItem {
  rank: number;
  nickname: string;
  points: string;
}

interface ShopItem {
  id: string;
  title: string;
  imageUrl?: string;
  pricePoints: string;
  stock: number;
}

interface FavoriteData {
  athletes: { id: string; name: string; profileImageUrl?: string }[];
  brands: { id: string; companyName: string; logoUrl?: string }[];
}

export default function FanDashboard() {
  const { isAuthenticated } = useAuth();

  // A) 내 포인트 (로그인 시만)
  const { data: pointData, isLoading: loadingPoints } = useQuery({
    queryKey: ['pointBalance'],
    queryFn: () => api.getMyPointBalance(),
    enabled: isAuthenticated,
  });

  // B) 진행중 투표 (리워드풀 기반)
  const { data: activeVotesData, isLoading: loadingActiveVotes } = useQuery({
    queryKey: ['activeVotes'],
    queryFn: () => api.getVotes({ status: 'OPEN' }),
  });

  // C) 최근 종료 투표 (리워드풀 기반)
  const { data: endedVotesData, isLoading: loadingEndedVotes } = useQuery({
    queryKey: ['endedVotes', 10],
    queryFn: () => api.getVotes({ status: 'CLOSED', pageSize: 10 }),
  });

  // D) 포인트 TOP 10
  const { data: rankingData, isLoading: loadingRanking } = useQuery({
    queryKey: ['pointRanking', 10],
    queryFn: () => api.getPointRanking(10),
  });

  // E) 추천 상품 4개
  const { data: shopData, isLoading: loadingShop } = useQuery({
    queryKey: ['shopItems', 4],
    queryFn: () => api.getShopItems({ pageSize: 4 }),
  });

  // F) 즐겨찾기 (로그인 시만)
  const { data: favoritesData, isLoading: loadingFavorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.getFavorites(),
    enabled: isAuthenticated,
  });

  const activeVotes: FanVoteEvent[] = activeVotesData?.data || [];
  const endedVotes: EndedVoteEvent[] = endedVotesData?.data || [];
  const ranking: RankingItem[] = rankingData?.data?.ranking || [];
  const shopItems: ShopItem[] = shopData?.data?.items || [];
  const favorites: FavoriteData = favoritesData?.data || { athletes: [], brands: [] };

  const formatNumber = (num: string | number) => Number(num).toLocaleString();

  const getTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return '종료됨';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-amber-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-slate-500">{rank}</span>;
    }
  };

  // 스켈레톤 컴포넌트
  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn('animate-pulse bg-slate-200 rounded', className)} />
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ========== A) 상단: 내 포인트 / 로그인 유도 ========== */}
        {isAuthenticated ? (
          <div className="card p-6 bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-emerald-100" />
                  <span className="text-emerald-100">내 포인트</span>
                </div>
                {loadingPoints ? (
                  <Skeleton className="h-10 w-32 bg-white/30" />
                ) : (
                  <div className="text-4xl font-bold">
                    {formatNumber(pointData?.data?.balance || 0)}
                    <span className="text-lg ml-1">P</span>
                  </div>
                )}
              </div>
              <Link
                to="/points"
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors"
              >
                상세보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="card p-6 bg-gradient-to-br from-slate-700 to-slate-800 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">로그인하고 참여하세요!</h2>
                <p className="text-slate-300 text-sm">투표에 참여하고 포인트를 획득할 수 있습니다</p>
              </div>
              <Link
                to="/fan/login"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                로그인
              </Link>
            </div>
          </div>
        )}

        {/* 퀵 링크 (로그인 시) */}
        {isAuthenticated && (
          <div className="grid grid-cols-4 gap-3">
            <Link
              to="/votes/my-created"
              className="card p-3 text-center hover:border-emerald-500/30 transition-all group"
            >
              <FileText className="w-5 h-5 text-violet-500 mx-auto mb-1" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-600">내가 만든 투표</span>
            </Link>
            <Link
              to="/votes"
              className="card p-3 text-center hover:border-emerald-500/30 transition-all group"
            >
              <Vote className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-600">참여한 투표</span>
            </Link>
            <Link
              to="/orders"
              className="card p-3 text-center hover:border-emerald-500/30 transition-all group"
            >
              <ShoppingBag className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-600">내 주문</span>
            </Link>
            <Link
              to="/votes/create"
              className="card p-3 text-center hover:border-emerald-500/30 transition-all group"
            >
              <Plus className="w-5 h-5 text-sky-500 mx-auto mb-1" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-600">투표 만들기</span>
            </Link>
          </div>
        )}

        {/* ========== B) 진행중 투표 ========== */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Vote className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900">진행중 투표</h2>
            </div>
            <Link
              to="/votes"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              전체보기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingActiveVotes ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-full h-24" />
                </div>
              ))}
            </div>
          ) : activeVotes.length === 0 ? (
            <div className="py-12 text-center">
              <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">진행중인 투표가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeVotes.slice(0, 5).map((vote) => (
                <div key={vote.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{vote.title}</h3>
                      <p className="text-sm text-slate-500 mb-2 line-clamp-1">{vote.question}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Coins className="w-3 h-3" />
                          참가비 {formatNumber(vote.entryFeePoints)}P
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Trophy className="w-3 h-3" />
                          당첨자 {vote.winnersCount}명
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users className="w-3 h-3" />
                          {vote._count?.entries || 0}명 참여
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <Clock className="w-3 h-3" />
                          {getTimeRemaining(vote.endsAt)}
                        </span>
                      </div>
                    </div>
                    {isAuthenticated ? (
                      vote.myEntry ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          참여완료
                        </span>
                      ) : (
                        <Link
                          to={`/votes/${vote.id}`}
                          className="btn btn-primary text-xs px-4 py-2"
                        >
                          참여하기
                        </Link>
                      )
                    ) : (
                      <Link
                        to="/fan/login"
                        className="btn btn-secondary text-xs px-4 py-2"
                      >
                        로그인 후 참여
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ========== C) 최근 종료 투표 ========== */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-slate-500" />
                <h2 className="font-bold text-slate-900">최근 종료 투표</h2>
              </div>
            </div>

            {loadingEndedVotes ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : endedVotes.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">종료된 투표가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {endedVotes.slice(0, 5).map((vote) => (
                  <Link
                    key={vote.id}
                    to={`/votes/${vote.id}`}
                    className="block p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 line-clamp-1">{vote.title}</span>
                          {vote.isWinner && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                              <Trophy className="w-3 h-3" />
                              당첨!
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {vote._count?.entries || 0}명 참여 · 당첨 {vote.winnersCount}명
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ========== D) 포인트 TOP 10 ========== */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-900">포인트 TOP 10</h2>
              </div>
              <Link
                to="/ranking"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loadingRanking ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : ranking.length === 0 ? (
              <div className="py-8 text-center">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">아직 랭킹 데이터가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {ranking.map((item) => (
                  <div
                    key={item.rank}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      item.rank === 1 && 'bg-amber-50/50'
                    )}
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getRankBadge(item.rank)}
                    </div>
                    <span className="flex-1 font-medium text-slate-900">{item.nickname}</span>
                    <span className="font-semibold text-emerald-600">
                      {formatNumber(item.points)}P
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== E) 추천 상품 ========== */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              <h2 className="font-bold text-slate-900">추천 상품</h2>
            </div>
            <Link
              to="/shop"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              전체보기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingShop ? (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : shopItems.length === 0 ? (
            <div className="py-12 text-center">
              <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">등록된 상품이 없습니다</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {shopItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/shop/${item.id}`}
                  className="group"
                >
                  <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-2">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-slate-900 text-sm line-clamp-1 group-hover:text-emerald-600">
                    {item.title}
                  </h3>
                  <p className="text-emerald-600 font-bold text-sm">
                    {formatNumber(item.pricePoints)}P
                  </p>
                  {item.stock <= 5 && item.stock > 0 && (
                    <p className="text-xs text-amber-600">잔여 {item.stock}개</p>
                  )}
                  {item.stock === 0 && (
                    <p className="text-xs text-red-500">품절</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ========== F) 즐겨찾기 (로그인 시) ========== */}
        {isAuthenticated && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-slate-900">내 즐겨찾기</h2>
              </div>
              <Link
                to="/favorites"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                관리하기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loadingFavorites ? (
              <div className="p-4">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : favorites.athletes.length === 0 && favorites.brands.length === 0 ? (
              <div className="py-8 text-center">
                <Heart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm mb-3">아직 즐겨찾기한 선수/브랜드가 없습니다</p>
                <Link to="/favorites" className="text-emerald-600 text-sm font-medium hover:underline">
                  즐겨찾기 추가하러 가기
                </Link>
              </div>
            ) : (
              <div className="p-4">
                {favorites.athletes.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-slate-500 mb-2">선수</h3>
                    <div className="flex flex-wrap gap-2">
                      {favorites.athletes.slice(0, 6).map((athlete) => (
                        <div
                          key={athlete.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full"
                        >
                          <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                            {athlete.profileImageUrl ? (
                              <img src={athlete.profileImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-3 h-3 m-1 text-slate-400" />
                            )}
                          </div>
                          <span className="text-sm text-slate-700">{athlete.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {favorites.brands.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 mb-2">브랜드</h3>
                    <div className="flex flex-wrap gap-2">
                      {favorites.brands.slice(0, 6).map((brand) => (
                        <div
                          key={brand.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full"
                        >
                          <span className="text-sm text-slate-700">{brand.companyName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

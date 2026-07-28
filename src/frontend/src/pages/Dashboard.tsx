import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Gavel, FileText, TrendingUp, Clock, DollarSign, ArrowUpRight, Users, Activity, Wallet, Home } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { formatCurrency, formatDate, formatTimeRemaining, getStatusLabel, cn } from '../utils';
import { getEventMonthLabel } from '../utils/eventMonth';

export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'BRAND') {
    return <BrandDashboard />;
  }

  if (user?.role === 'ATHLETE') {
    return <AthleteDashboard />;
  }

  return <AdminDashboard />;
}

function BrandDashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorData } = useQuery({
    queryKey: ['brand-stats'],
    queryFn: () => api.getMyBrandStats(),
    retry: 1,
  });

  const { data: liveAuctions, isLoading: auctionsLoading, isError: auctionsError } = useQuery({
    queryKey: ['live-auctions'],
    queryFn: () => api.getLiveAuctions(),
    retry: 1,
  });

  const { data: upcomingEvents, isLoading: eventsLoading, isError: eventsError } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => api.getUpcomingEvents(5),
    retry: 1,
  });

  // 활성 투표 조회 (리워드풀 기반)
  const { data: activeVotes, isLoading: votesLoading } = useQuery({
    queryKey: ['active-votes'],
    queryFn: async () => {
      const res = await api.getVotes({ status: 'OPEN' });
      return (res.data || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        type: 'vote' as const,
        participantCount: v._count?.participations ?? 0,
        endAt: v.closeAt,
        rewardBudgetEp: v.rewardBudgetEp,
      })).sort(
        (a: any, b: any) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
      );
    },
    retry: 1,
  });

  const isLoading = statsLoading || auctionsLoading || eventsLoading || votesLoading;
  const hasAnyError = statsError || auctionsError || eventsError;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">로딩 중...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (hasAnyError) {
    const errorMessage = (statsErrorData as any)?.response?.data?.message
      || (statsErrorData as any)?.message
      || '데이터를 불러오는데 실패했습니다';

    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600 text-lg font-medium">브랜드 정보를 불러오는데 실패했습니다</p>
            <p className="mt-2 text-slate-600">{errorMessage}</p>
            <p className="mt-2 text-slate-500 text-sm">브랜드 등록이 완료되었는지 확인해주세요.</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Link to="/profile" className="btn btn-primary">
                프로필 확인
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">브랜드 대시보드</h1>
            <p className="text-slate-600 mt-1">스폰서십 캠페인을 관리하세요</p>
          </div>
          <Link to="/" className="btn btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" />
            메인으로
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 입찰</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.data?.totalBids || 0}</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Gavel className="w-6 h-6 text-sky-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 계약</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.data?.totalContracts || 0}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 집행액</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(stats?.data?.totalSpent || 0)}</p>
              </div>
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Auctions */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-semibold text-slate-900">진행 중인 경매</h2>
              </div>
              <Link to="/auctions" className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
                전체 보기 <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-200">
              {liveAuctions?.data?.slice(0, 5).map((auction: any) => (
                <Link
                  key={auction.id}
                  to={`/auctions/${auction.id}`}
                  className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-900">{auction.slotInstance?.slotTemplate?.name}</p>
                    <p className="text-sm text-slate-500">
                      {auction.slotInstance?.athlete?.name} · {getEventMonthLabel(auction.slotInstance?.event)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatCurrency(auction.currentPrice)}</p>
                    <p className="text-sm text-red-600 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeRemaining(auction.endAt)}
                    </p>
                  </div>
                </Link>
              ))}
              {(!liveAuctions?.data || liveAuctions.data.length === 0) && (
                <div className="p-8 text-center text-slate-500">진행 중인 경매가 없습니다</div>
              )}
            </div>
          </div>

          {/* Active Votes */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-semibold text-slate-900">진행 중인 투표</h2>
              </div>
              <Link to="/brand/sponsored-votes" className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
                전체 보기 <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-200">
              {activeVotes?.slice(0, 5).map((vote: any) => (
                <Link
                  key={vote.id}
                  to={`/votes/${vote.id}`}
                  className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{vote.title}</p>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        vote.creatorRole === 'ADMIN' && 'bg-sky-100 text-sky-700',
                        vote.creatorRole === 'FAN' && 'bg-violet-100 text-violet-700',
                        vote.creatorRole === 'BRAND' && 'bg-emerald-100 text-emerald-700',
                        vote.creatorRole === 'ATHLETE' && 'bg-amber-100 text-amber-700'
                      )}>
                        {vote.creatorRole === 'ADMIN' && '관리자'}
                        {vote.creatorRole === 'FAN' && '팬'}
                        {vote.creatorRole === 'BRAND' && '브랜드'}
                        {vote.creatorRole === 'ATHLETE' && '선수'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {vote.questionType || (vote.prizePool ? `상금: ${Number(vote.prizePool).toLocaleString()}P` : '투표')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">
                      <Users className="w-3 h-3 inline mr-1" />
                      {vote.participantCount}명 참여
                    </p>
                    <p className="text-sm text-red-600 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeRemaining(vote.endAt)}
                    </p>
                  </div>
                </Link>
              ))}
              {(!activeVotes || activeVotes.length === 0) && (
                <div className="p-8 text-center text-slate-500">진행 중인 투표가 없습니다</div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Events - Full width */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">예정된 이벤트</h2>
            <Link to="/inventory" className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
              전체 보기 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200">
            {upcomingEvents?.data?.slice(0, 5).map((event: any) => (
              <Link
                key={event.id}
                to={`/inventory?eventId=${event.id}`}
                className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-900">{getEventMonthLabel(event)}</p>
                  <p className="text-sm text-slate-500">{event.tour}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">{formatDate(event.dateStart)}</p>
                  <p className="text-sm text-slate-500">슬롯 {event._count?.slotInstances || 0}개</p>
                </div>
              </Link>
            ))}
            {(!upcomingEvents?.data || upcomingEvents.data.length === 0) && (
              <div className="p-8 text-center text-slate-500">예정된 이벤트가 없습니다</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function AthleteDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['athlete-stats'],
    queryFn: () => api.getMyAthleteStats(),
  });

  const { data: contracts } = useQuery({
    queryKey: ['my-contracts'],
    queryFn: () => api.getMyContracts(),
  });

  const { data: settlementStats } = useQuery({
    queryKey: ['settlement-stats'],
    queryFn: () => api.getMySettlementStats(),
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">선수 대시보드</h1>
            <p className="text-slate-600 mt-1">스폰서십 현황을 확인하세요</p>
          </div>
          <Link to="/" className="btn btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" />
            메인으로
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">활성 슬롯</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.data?.activeSlots || 0}</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-sky-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 계약</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.data?.totalContracts || 0}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 수익</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(settlementStats?.data?.totalPaid || 0)}</p>
              </div>
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">정산 대기</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(settlementStats?.data?.pendingAmount || 0)}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Contracts */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">최근 계약</h2>
            <Link to="/contracts" className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
              전체 보기 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200">
            {contracts?.data?.slice(0, 5).map((contract: any) => (
              <Link
                key={contract.id}
                to={`/contracts/${contract.id}`}
                className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-900">{contract.brand?.name}</p>
                  <p className="text-sm text-slate-500">
                    {contract.auction?.slotInstance?.slotTemplate?.name} · {getEventMonthLabel(contract.auction?.slotInstance?.event)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatCurrency(contract.priceFinal)}</p>
                  <span
                    className={cn(
                      'badge',
                      contract.status === 'COMPLETED' ? 'badge-success' : contract.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                    )}
                  >
                    {getStatusLabel(contract.status)}
                  </span>
                </div>
              </Link>
            ))}
            {(!contracts?.data || contracts.data.length === 0) && (
              <div className="p-8 text-center text-slate-500">계약이 없습니다</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.getAdminDashboard(),
  });

  // 활성 투표 조회 (리워드풀 기반)
  const { data: activeVotes } = useQuery({
    queryKey: ['admin-active-votes'],
    queryFn: async () => {
      const res = await api.getVotes({ status: 'OPEN' });
      return (res.data || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        type: 'vote' as const,
        participantCount: v._count?.participations ?? 0,
        endAt: v.closeAt,
        rewardBudgetEp: v.rewardBudgetEp,
      })).sort(
        (a: any, b: any) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
      );
    },
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">관리자 대시보드</h1>
            <p className="text-slate-600 mt-1">플랫폼 현황을 모니터링하세요</p>
          </div>
          <Link to="/" className="btn btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" />
            메인으로
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-5 h-5 text-sky-600" />
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                KYC {stats?.data?.brands?.pendingKyc || 0}
              </span>
            </div>
            <p className="text-sm text-slate-600">브랜드</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.data?.brands?.total || 0}</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-5 h-5 text-emerald-600" />
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                KYC {stats?.data?.athletes?.pendingKyc || 0}
              </span>
            </div>
            <p className="text-sm text-slate-600">선수</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.data?.athletes?.total || 0}</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-red-600" />
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <p className="text-sm text-slate-600">진행 중 경매</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.data?.auctions?.live || 0}</p>
          </div>
          <div className="card p-6">
            <div className="mb-3">
              <Wallet className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-sm text-slate-600">정산 대기</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.data?.settlements?.pending || 0}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/admin/kyc" className="card p-6 hover:bg-slate-50 transition-colors group">
            <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">KYC 심사</h3>
            <p className="text-sm text-slate-500 mt-1">대기 중인 KYC 요청을 검토하세요</p>
          </Link>
          <Link to="/admin/auctions" className="card p-6 hover:bg-slate-50 transition-colors group">
            <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">경매 모니터링</h3>
            <p className="text-sm text-slate-500 mt-1">진행 중인 경매를 모니터링하세요</p>
          </Link>
          <Link to="/admin/reviews" className="card p-6 hover:bg-slate-50 transition-colors group">
            <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">검수 관리</h3>
            <p className="text-sm text-slate-500 mt-1">소재 및 부착 인증을 검토하세요</p>
          </Link>
        </div>

        {/* Active Votes */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <h2 className="text-lg font-semibold text-slate-900">진행 중인 투표</h2>
              <span className="text-sm text-slate-500">({activeVotes?.length || 0}개)</span>
            </div>
            <Link to="/admin/votes" className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
              전체 보기 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200">
            {activeVotes?.slice(0, 5).map((vote: any) => (
              <Link
                key={vote.id}
                to={`/admin/votes`}
                className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{vote.title}</p>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      vote.creatorRole === 'ADMIN' && 'bg-sky-100 text-sky-700',
                      vote.creatorRole === 'FAN' && 'bg-violet-100 text-violet-700',
                      vote.creatorRole === 'BRAND' && 'bg-emerald-100 text-emerald-700',
                      vote.creatorRole === 'ATHLETE' && 'bg-amber-100 text-amber-700'
                    )}>
                      {vote.creatorRole === 'ADMIN' && '관리자'}
                      {vote.creatorRole === 'FAN' && '팬'}
                      {vote.creatorRole === 'BRAND' && '브랜드'}
                      {vote.creatorRole === 'ATHLETE' && '선수'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {vote.questionType || (vote.prizePool ? `상금: ${Number(vote.prizePool).toLocaleString()}P` : '투표')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">
                    <Users className="w-3 h-3 inline mr-1" />
                    {vote.participantCount}명 참여
                  </p>
                  <p className="text-sm text-red-600 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeRemaining(vote.endAt)}
                  </p>
                </div>
              </Link>
            ))}
            {(!activeVotes || activeVotes.length === 0) && (
              <div className="p-8 text-center text-slate-500">진행 중인 투표가 없습니다</div>
            )}
          </div>
        </div>

        {/* Revenue */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-6">플랫폼 수익</h3>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900">{formatCurrency(stats?.data?.revenue?.total || 0)}</p>
              <p className="text-sm text-slate-500 mt-1">총 플랫폼 수수료</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Gavel, FileText, TrendingUp, Clock, DollarSign, ArrowUpRight, Users, Activity, Wallet, Home } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { formatCurrency, formatDate, formatTimeRemaining, getStatusLabel, cn } from '../utils';

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
  const { data: stats } = useQuery({
    queryKey: ['brand-stats'],
    queryFn: () => api.getMyBrandStats(),
  });

  const { data: liveAuctions } = useQuery({
    queryKey: ['live-auctions'],
    queryFn: () => api.getLiveAuctions(),
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => api.getUpcomingEvents(5),
  });

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
                      {auction.slotInstance?.athlete?.name} · {auction.slotInstance?.event?.name}
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

          {/* Upcoming Events */}
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
                    <p className="font-medium text-slate-900">{event.name}</p>
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
                    {contract.auction?.slotInstance?.slotTemplate?.name} · {contract.auction?.slotInstance?.event?.name}
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

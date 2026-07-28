import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Activity, DollarSign, Target, Gavel, FileText, ShieldCheck, BarChart3, Trophy } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils';

export default function AdminReports() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: () => api.getAdminDashboard(),
  });

  const { data: paymentStatsData } = useQuery({
    queryKey: ['paymentStats', dateRange],
    queryFn: () =>
      api.getPaymentStats({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
  });

  const { data: dailyPaymentsData } = useQuery({
    queryKey: ['dailyPayments'],
    queryFn: () => api.getDailyPaymentStats(30),
  });

  const { data: campaignStatsData } = useQuery({
    queryKey: ['campaignStats'],
    queryFn: () => api.getCampaignStats(),
  });

  const { data: athleteRankingData } = useQuery({
    queryKey: ['pointRanking'],
    queryFn: () => api.getPointRanking(10),
  });

  const dashboard = dashboardData?.data;
  const paymentStats = paymentStatsData?.data;
  const dailyPayments = dailyPaymentsData?.data || [];
  const campaignStats = campaignStatsData?.data;
  const athleteRanking = athleteRankingData?.data || [];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">통합 리포트</h1>
            <p className="text-slate-600 mt-1">플랫폼 전체 현황을 한눈에 확인하세요</p>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input w-auto"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input w-auto"
            />
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 사용자</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {(dashboard?.totalBrands || 0) + (dashboard?.totalAthletes || 0)}
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>브랜드: {dashboard?.totalBrands || 0}</span>
                  <span className="mx-2">|</span>
                  <span>선수: {dashboard?.totalAthletes || 0}</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-sky-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">진행중 경매</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{dashboard?.liveAuctions || 0}</p>
                <p className="mt-2 text-xs text-slate-500">
                  예정: {dashboard?.scheduledAuctions || 0}건
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 결제금액</p>
                <p className="text-3xl font-bold text-violet-600 mt-1">
                  {formatCurrency(paymentStats?.totalAmount || 0)}
                </p>
                <p className="mt-2 text-xs text-slate-500">{paymentStats?.totalCount || 0}건</p>
              </div>
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">활성 캠페인</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">
                  {campaignStats?.activeCampaigns || 0}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  총 예산: {formatCurrency(campaignStats?.totalBudget || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Payments Chart */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">일별 결제 추이</h3>
            </div>
            {dailyPayments.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                데이터가 없습니다
              </div>
            ) : (
              <div className="h-64">
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex items-end gap-1">
                    {dailyPayments.slice(-14).map((day: any, index: number) => {
                      const maxAmount = Math.max(...dailyPayments.map((d: any) => d.amount));
                      const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                      return (
                        <div
                          key={index}
                          className="flex-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t hover:from-emerald-400 hover:to-teal-300 transition-colors cursor-pointer group relative"
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        >
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg z-10">
                            {new Date(day.date).toLocaleDateString()}
                            <br />
                            {formatCurrency(day.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 mt-3 border-t border-slate-100 pt-3">
                    {dailyPayments.slice(-14).map((day: any, index: number) => (
                      <div key={index} className="flex-1 text-center">
                        <span className="text-xs text-slate-500">
                          {new Date(day.date).getDate()}일
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Athlete Ranking */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">선수 인기 랭킹 (투표 기준)</h3>
            </div>
            {athleteRanking.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                데이터가 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {athleteRanking.map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? 'bg-amber-100 text-amber-700'
                          : index === 1
                          ? 'bg-slate-200 text-slate-700'
                          : index === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.athlete?.name || '알 수 없음'}</p>
                      <p className="text-xs text-slate-500">{item.athlete?.tour || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{(item.totalPoints || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">포인트</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Auction Stats */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">경매 현황</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">진행중</span>
                <span className="font-bold text-emerald-600">{dashboard?.liveAuctions || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">예정</span>
                <span className="font-bold text-slate-700">{dashboard?.scheduledAuctions || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">종료</span>
                <span className="font-bold text-sky-600">{dashboard?.completedAuctions || 0}건</span>
              </div>
            </div>
          </div>

          {/* Contract Stats */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">계약 현황</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">총 계약</span>
                <span className="font-bold text-slate-900">{dashboard?.totalContracts || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">서명 대기</span>
                <span className="font-bold text-amber-600">{dashboard?.pendingSignatures || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">에셋 대기</span>
                <span className="font-bold text-orange-600">{dashboard?.pendingAssets || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">검수 대기</span>
                <span className="font-bold text-violet-600">{dashboard?.pendingVerifications || 0}건</span>
              </div>
            </div>
          </div>

          {/* KYC Stats */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">KYC 현황</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">승인 대기</span>
                <span className="font-bold text-amber-600">{dashboard?.pendingKyc || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">브랜드 KYC</span>
                <span className="font-bold text-slate-900">{dashboard?.pendingBrandKyc || 0}건</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">선수 KYC</span>
                <span className="font-bold text-slate-900">{dashboard?.pendingAthleteKyc || 0}건</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        {paymentStats?.byMethod && paymentStats.byMethod.length > 0 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">결제수단별 통계</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {paymentStats.byMethod.map((method: any) => (
                <div key={method.method} className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-600">
                    {method.method === 'CARD'
                      ? '카드'
                      : method.method === 'BANK_TRANSFER'
                      ? '계좌이체'
                      : method.method === 'VIRTUAL_ACCOUNT'
                      ? '가상계좌'
                      : method.method}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(method.amount || 0)}
                  </p>
                  <p className="text-sm text-slate-500">{method.count}건</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

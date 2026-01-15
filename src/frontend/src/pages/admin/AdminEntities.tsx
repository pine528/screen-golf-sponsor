import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Building2, Search, Filter, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, ShieldCheck, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

type Tab = 'athletes' | 'brands';
type KycStatus = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_SUBMITTED';
type ActiveStatus = '' | 'true' | 'false';

export default function AdminEntities() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('athletes');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [kycStatus, setKycStatus] = useState<KycStatus>('');
  const [isActive, setIsActive] = useState<ActiveStatus>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Athletes query
  const { data: athletesData, isLoading: athletesLoading } = useQuery({
    queryKey: ['adminAthletes', page, pageSize, search, kycStatus, isActive, dateFrom, dateTo],
    queryFn: () =>
      api.getAdminAthletes({
        page,
        pageSize,
        q: search || undefined,
        kycStatus: kycStatus || undefined,
        isActive: isActive || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
    enabled: activeTab === 'athletes',
  });

  // Brands query
  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: ['adminBrands', page, pageSize, search, kycStatus, isActive, dateFrom, dateTo],
    queryFn: () =>
      api.getAdminBrands({
        page,
        pageSize,
        q: search || undefined,
        kycStatus: kycStatus || undefined,
        isActive: isActive || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
    enabled: activeTab === 'brands',
  });

  // Toggle active mutations
  const toggleAthleteMutation = useMutation({
    mutationFn: (athleteId: string) => api.toggleAthleteActive(athleteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminAthletes'] });
    },
  });

  const toggleBrandMutation = useMutation({
    mutationFn: (brandId: string) => api.toggleBrandActive(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBrands'] });
    },
  });

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setKycStatus('');
    setIsActive('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const data = activeTab === 'athletes' ? athletesData?.data : brandsData?.data;
  const isLoading = activeTab === 'athletes' ? athletesLoading : brandsLoading;
  const items = activeTab === 'athletes' ? data?.athletes : data?.brands;
  const pagination = data?.pagination;
  const summary = data?.summary;

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-3 h-3" />
            승인됨
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            대기중
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            거부됨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <AlertCircle className="w-3 h-3" />
            미제출
          </span>
        );
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">등록 회원 현황</h1>
          <p className="text-slate-600 mt-1">선수 및 브랜드 등록 현황을 관리합니다</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-slate-600">총 {activeTab === 'athletes' ? '선수' : '브랜드'}</p>
              <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-600">KYC 대기</p>
              <p className="text-2xl font-bold text-amber-600">{summary.pendingKyc}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-600">KYC 승인</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.approvedKyc}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-600">활성 계정</p>
              <p className="text-2xl font-bold text-sky-600">{summary.active}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-8">
            <button
              onClick={() => handleTabChange('athletes')}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'athletes'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              선수
            </button>
            <button
              onClick={() => handleTabChange('brands')}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'brands'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              브랜드
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={activeTab === 'athletes' ? '이름, 실명, 이메일...' : '회사명, 담당자, 이메일...'}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 mb-1">KYC 상태</label>
              <select
                value={kycStatus}
                onChange={(e) => setKycStatus(e.target.value as KycStatus)}
                className="input w-full"
              >
                <option value="">전체</option>
                <option value="APPROVED">승인됨</option>
                <option value="PENDING">대기중</option>
                <option value="REJECTED">거부됨</option>
                <option value="NOT_SUBMITTED">미제출</option>
              </select>
            </div>

            <div className="w-32">
              <label className="block text-sm font-medium text-slate-700 mb-1">활성 상태</label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value as ActiveStatus)}
                className="input w-full"
              >
                <option value="">전체</option>
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>

            <div className="w-36">
              <label className="block text-sm font-medium text-slate-700 mb-1">가입일 (시작)</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="w-36">
              <label className="block text-sm font-medium text-slate-700 mb-1">가입일 (종료)</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                <Filter className="w-4 h-4 mr-1" />
                조회
              </button>
              <button type="button" onClick={clearFilters} className="btn btn-secondary">
                초기화
              </button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : items?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Users className="w-12 h-12 mb-4 text-slate-300" />
              <p>등록된 {activeTab === 'athletes' ? '선수' : '브랜드'}가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {activeTab === 'athletes' ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          선수
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          이메일
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          투어
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          계약/슬롯
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          KYC
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          가입일
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          상태
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          브랜드
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          이메일
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          카테고리
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          입찰/계약/캠페인
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          KYC
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          가입일
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          상태
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeTab === 'athletes'
                    ? items?.map((athlete: any) => (
                        <tr key={athlete.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {athlete.profileImageUrl ? (
                                <img
                                  src={athlete.profileImageUrl}
                                  alt={athlete.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-slate-900">{athlete.name}</p>
                                {athlete.realName && (
                                  <p className="text-sm text-slate-500">{athlete.realName}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{athlete.user?.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{athlete.tour || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {athlete._count?.contracts || 0} / {athlete._count?.slotInstances || 0}
                          </td>
                          <td className="px-6 py-4">{getKycStatusBadge(athlete.kycStatus)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(athlete.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleAthleteMutation.mutate(athlete.id)}
                              disabled={toggleAthleteMutation.isPending}
                              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                                athlete.user?.isActive
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-slate-400 hover:text-slate-500'
                              }`}
                            >
                              {athlete.user?.isActive ? (
                                <>
                                  <ToggleRight className="w-5 h-5" />
                                  활성
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-5 h-5" />
                                  비활성
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    : items?.map((brand: any) => (
                        <tr key={brand.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-slate-900">{brand.name}</p>
                              {brand.contactName && (
                                <p className="text-sm text-slate-500">담당: {brand.contactName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{brand.user?.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{brand.category || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {brand._count?.bids || 0} / {brand._count?.contracts || 0} /{' '}
                            {brand._count?.campaigns || 0}
                          </td>
                          <td className="px-6 py-4">{getKycStatusBadge(brand.kycStatus)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(brand.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleBrandMutation.mutate(brand.id)}
                              disabled={toggleBrandMutation.isPending}
                              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                                brand.user?.isActive
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-slate-400 hover:text-slate-500'
                              }`}
                            >
                              {brand.user?.isActive ? (
                                <>
                                  <ToggleRight className="w-5 h-5" />
                                  활성
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-5 h-5" />
                                  비활성
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                총 {pagination.total}건 중 {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}건
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

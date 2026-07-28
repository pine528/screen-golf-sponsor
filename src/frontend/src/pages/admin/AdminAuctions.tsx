import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Gavel,
  Search,
  Filter,
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  Eye,
  XCircle,
  Play,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Timer,
  DollarSign,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '../../utils';
import { getEventMonthLabel } from '../../utils/eventMonth';

export function AdminAuctions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    slotInstanceId: '',
    startAt: '',
    endAt: '',
    softCloseSec: 120,
    maxExtensionSec: 600,
    minBidIncrement: 10000,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: monitoringData, refetch: refetchMonitoring } = useQuery({
    queryKey: ['admin-auction-monitoring'],
    queryFn: () => api.getAuctionMonitoring(),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: auctionsData, isLoading: auctionsLoading, refetch: refetchAuctions } = useQuery({
    queryKey: ['admin-auctions', page, statusFilter],
    queryFn: () => api.getAuctions({ page, status: statusFilter !== 'all' ? statusFilter : undefined }),
  });

  // 경매 가능한 슬롯 인스턴스 조회 (OPEN 상태)
  const { data: availableSlotsData } = useQuery({
    queryKey: ['available-slots'],
    queryFn: () => api.getAvailableSlots({ status: 'OPEN' }),
    enabled: showCreateModal,
  });

  const availableSlots = availableSlotsData?.data || [];

  // 경매 생성 mutation
  const createAuctionMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.createAuction({
      slotInstanceId: data.slotInstanceId,
      startAt: new Date(data.startAt).toISOString(),
      endAt: new Date(data.endAt).toISOString(),
      softCloseSec: data.softCloseSec,
      maxExtensionSec: data.maxExtensionSec,
      minBidIncrement: data.minBidIncrement,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auction-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      setShowCreateModal(false);
      setCreateForm({
        slotInstanceId: '',
        startAt: '',
        endAt: '',
        softCloseSec: 120,
        maxExtensionSec: 600,
        minBidIncrement: 10000,
      });
      setCreateError(null);
    },
    onError: (error: any) => {
      setCreateError(error.response?.data?.error?.message || '경매 등록에 실패했습니다.');
    },
  });

  // 경매 시작 mutation
  const startAuctionMutation = useMutation({
    mutationFn: (id: string) => api.startAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auction-monitoring'] });
      alert('경매가 시작되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '경매 시작에 실패했습니다.');
    },
  });

  // 경매 취소 mutation
  const cancelAuctionMutation = useMutation({
    mutationFn: (id: string) => api.cancelAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auction-monitoring'] });
      alert('경매가 취소되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '경매 취소에 실패했습니다.');
    },
  });

  const monitoring = monitoringData?.data || {};
  const auctions = auctionsData?.data || [];

  const filteredAuctions = auctions.filter((auction: any) =>
    auction.slotInstance?.slotTemplate?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auction.slotInstance?.event?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusStyles: Record<string, string> = {
    SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-200',
    LIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ENDED: 'bg-sky-100 text-sky-700 border-sky-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
    EXTENDED: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const statusLabels: Record<string, string> = {
    SCHEDULED: '예정',
    LIVE: '진행중',
    ENDED: '종료',
    CANCELLED: '취소',
    EXTENDED: '연장',
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return '종료됨';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
    return `${minutes}분 남음`;
  };

  const handleRefresh = () => {
    refetchMonitoring();
    refetchAuctions();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">경매 모니터링</h1>
            <p className="text-slate-600 mt-1">실시간 경매 현황을 모니터링합니다</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              경매 등록
            </button>
            <button
              onClick={handleRefresh}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Gavel className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">진행중 경매</p>
                <p className="text-2xl font-bold text-slate-900">{monitoring.liveAuctions || 0}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Timer className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">마감 임박</p>
                <p className="text-2xl font-bold text-slate-900">{monitoring.endingSoon || 0}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">오늘 총 입찰액</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(monitoring.todayTotalBids || 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">활성 입찰자</p>
                <p className="text-2xl font-bold text-slate-900">{monitoring.activeBidders || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Auctions Alert */}
        {monitoring.alerts && monitoring.alerts.length > 0 && (
          <div className="card p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">주의가 필요한 경매</p>
                <p className="text-sm text-amber-700">{monitoring.alerts.length}개의 경매에 이슈가 있습니다</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="슬롯명 또는 이벤트명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 상태</option>
                <option value="SCHEDULED">예정</option>
                <option value="LIVE">진행중</option>
                <option value="ENDED">종료</option>
                <option value="EXTENDED">연장</option>
              </select>
            </div>
          </div>
        </div>

        {/* Auctions Table */}
        <div className="card overflow-hidden">
          {auctionsLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredAuctions.length === 0 ? (
            <div className="p-12 text-center">
              <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">경매가 없습니다</h3>
              <p className="text-slate-600">현재 조건에 맞는 경매가 없습니다</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      경매
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      현재 가격
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      입찰 수
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      남은 시간
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAuctions.map((auction: any) => (
                    <tr key={auction.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            auction.status === 'LIVE'
                              ? 'bg-emerald-100'
                              : 'bg-slate-100'
                          )}>
                            <Gavel className={cn(
                              'w-5 h-5',
                              auction.status === 'LIVE'
                                ? 'text-emerald-600'
                                : 'text-slate-500'
                            )} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {auction.slotInstance?.slotTemplate?.name || '슬롯'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {getEventMonthLabel(auction.slotInstance?.event) || '이벤트'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(auction.currentPrice || auction.startingPrice || 0)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          시작가: {formatCurrency(auction.startingPrice || 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Users className="w-4 h-4" />
                          <span>{auction.bidCount || 0}건</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className={cn(
                            'w-4 h-4',
                            auction.status === 'LIVE' ? 'text-emerald-600' : 'text-slate-400'
                          )} />
                          <span className={cn(
                            'text-sm',
                            auction.status === 'LIVE' ? 'text-emerald-700 font-medium' : 'text-slate-600'
                          )}>
                            {formatTime(auction.endTime)}
                          </span>
                        </div>
                        {auction.extensionCount > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {auction.extensionCount}회 연장됨
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'badge',
                          statusStyles[auction.status] || statusStyles.SCHEDULED
                        )}>
                          {statusLabels[auction.status] || '예정'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/auctions/${auction.id}`)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="상세 보기"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(auction.status === 'LIVE' || auction.status === 'SCHEDULED') && (
                            <button
                              onClick={() => {
                                if (confirm('정말 이 경매를 취소하시겠습니까?')) {
                                  cancelAuctionMutation.mutate(auction.id);
                                }
                              }}
                              disabled={cancelAuctionMutation.isPending}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="경매 취소"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {auction.status === 'SCHEDULED' && (
                            <button
                              onClick={() => {
                                if (confirm('이 경매를 지금 시작하시겠습니까?')) {
                                  startAuctionMutation.mutate(auction.id);
                                }
                              }}
                              disabled={startAuctionMutation.isPending}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="경매 시작"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  총 {filteredAuctions.length}개 경매
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    페이지 {page}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Auction Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">경매 등록</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  {createError}
                </div>
              )}

              {/* 슬롯 선택 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  슬롯 선택 <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.slotInstanceId}
                  onChange={(e) => setCreateForm({ ...createForm, slotInstanceId: e.target.value })}
                  className="input"
                >
                  <option value="">슬롯을 선택하세요</option>
                  {availableSlots.map((slot: any) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.slotTemplate?.name} - {slot.athlete?.name} ({getEventMonthLabel(slot.event)})
                      {slot.reservePrice && ` / 시작가: ${formatCurrency(slot.reservePrice)}`}
                    </option>
                  ))}
                </select>
                {availableSlots.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    경매 가능한 슬롯이 없습니다. 먼저 슬롯 인스턴스를 생성하세요.
                  </p>
                )}
              </div>

              {/* 시작 시간 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  경매 시작 시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={createForm.startAt}
                  onChange={(e) => setCreateForm({ ...createForm, startAt: e.target.value })}
                  className="input"
                />
              </div>

              {/* 종료 시간 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  경매 종료 시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={createForm.endAt}
                  onChange={(e) => setCreateForm({ ...createForm, endAt: e.target.value })}
                  className="input"
                />
              </div>

              {/* 고급 설정 */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-3">고급 설정</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      소프트 클로즈 (초)
                    </label>
                    <input
                      type="number"
                      value={createForm.softCloseSec}
                      onChange={(e) => setCreateForm({ ...createForm, softCloseSec: Number(e.target.value) })}
                      className="input text-sm"
                      min={0}
                    />
                    <p className="mt-1 text-xs text-slate-500">마감 전 입찰 시 연장 시간</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      최대 연장 (초)
                    </label>
                    <input
                      type="number"
                      value={createForm.maxExtensionSec}
                      onChange={(e) => setCreateForm({ ...createForm, maxExtensionSec: Number(e.target.value) })}
                      className="input text-sm"
                      min={0}
                    />
                    <p className="mt-1 text-xs text-slate-500">총 최대 연장 가능 시간</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs text-slate-600 mb-1">
                    최소 입찰 증분 (원)
                  </label>
                  <input
                    type="number"
                    value={createForm.minBidIncrement}
                    onChange={(e) => setCreateForm({ ...createForm, minBidIncrement: Number(e.target.value) })}
                    className="input text-sm"
                    min={1000}
                    step={1000}
                  />
                  <p className="mt-1 text-xs text-slate-500">입찰 시 최소 증가 금액</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => createAuctionMutation.mutate(createForm)}
                disabled={!createForm.slotInstanceId || !createForm.startAt || !createForm.endAt || createAuctionMutation.isPending}
                className="btn btn-primary"
              >
                {createAuctionMutation.isPending ? '등록 중...' : '경매 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

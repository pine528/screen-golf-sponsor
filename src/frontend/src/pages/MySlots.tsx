import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import {
  Calendar,
  Search,
  DollarSign,
  Eye,
  Gavel,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '../utils';
import { getEventMonthLabel } from '../utils/eventMonth';

export function MySlots() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const queryClient = useQueryClient();

  // Get athlete profile to get athlete ID
  const { data: athleteData, isLoading: athleteLoading } = useQuery({
    queryKey: ['my-athlete'],
    queryFn: () => api.getMyAthlete(),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  // Get slot templates
  const { data: templatesData } = useQuery({
    queryKey: ['slot-templates'],
    queryFn: () => api.getSlotTemplates(),
  });

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['my-athlete-slots'],
    queryFn: () => api.getMyAthleteSlots(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['my-athlete-stats'],
    queryFn: () => api.getMyAthleteStats(),
  });

  const athlete = athleteData?.data;
  const events = eventsData?.data || [];
  const slots = slotsData?.data || [];
  const stats = statsData?.data || {};
  const templates = templatesData?.data || [];

  // 월별 옵션 (7~12월 고정)
  const monthOptions = [
    { value: '2026-07', label: '7월' },
    { value: '2026-08', label: '8월' },
    { value: '2026-09', label: '9월' },
    { value: '2026-10', label: '10월' },
    { value: '2026-11', label: '11월' },
    { value: '2026-12', label: '12월' },
  ];

  // 선택 월에 해당하는 이벤트 ID 목록
  const selectedEventIds = useMemo(() => {
    if (selectedEvent === 'all') return null;
    return events
      .filter((ev: any) => {
        const d = ev.dateStart || ev.date_start;
        if (!d) return false;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedEvent;
      })
      .map((ev: any) => ev.id);
  }, [events, selectedEvent]);

  const filteredSlots = slots
    .filter((slot: any) => {
      // 월별 필터
      if (selectedEventIds && !selectedEventIds.includes(slot.event?.id)) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'auction' && slot.auction?.status !== 'LIVE') return false;
        if (statusFilter === 'contracted' && !slot.auction?.contract) return false;
        if (statusFilter === 'available' && (slot.auction || slot.auction?.contract)) return false;
      }
      return true;
    })
    .filter((slot: any) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          slot.slotTemplate?.name?.toLowerCase().includes(searchLower) ||
          slot.event?.name?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getSlotStatus = (slot: any) => {
    const contract = slot.auction?.contract;
    if (contract) {
      return { label: '계약됨', style: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    if (slot.auction?.status === 'LIVE') {
      return { label: '경매중', style: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    if (slot.auction?.status === 'SCHEDULED') {
      return { label: '경매 예정', style: 'bg-sky-100 text-sky-700 border-sky-200' };
    }
    // 바로 구매 활성화 + 가격 설정됨 = 판매중
    if (slot.enableDirectBuy && slot.directBuyPrice) {
      return { label: '판매중', style: 'bg-violet-100 text-violet-700 border-violet-200' };
    }
    // 경매 활성화 + 최소입찰가 + 마감일 설정됨 = 판매중
    if (slot.enableAuction && slot.auctionMinBid && slot.auctionEndAt) {
      return { label: '판매중', style: 'bg-violet-100 text-violet-700 border-violet-200' };
    }
    // 플래그만 설정됨 = 설정중
    if (slot.enableDirectBuy || slot.enableAuction) {
      return { label: '설정중', style: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    return { label: '미등록', style: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const getSaleModeLabel = (slot: any) => {
    const modes = [];
    if (slot.enableAuction) modes.push('경매');
    if (slot.enableDirectBuy) modes.push('바로 구매');
    return modes.length > 0 ? modes.join(' + ') : '미설정';
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">슬롯 관리</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">내 광고 슬롯을 관리합니다</p>
          </div>
          <button
            onClick={() => {
              if (!athlete) {
                alert('선수 프로필을 먼저 등록해주세요');
                return;
              }
              setShowCreateModal(true);
            }}
            disabled={athleteLoading}
            className="btn btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {athleteLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            슬롯 추가
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">총 슬롯</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900">{stats.totalSlots || slots.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">경매중</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900">
                  {stats.activeAuctions || slots.filter((s: any) => s.auction?.status === 'LIVE').length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">계약 완료</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900">
                  {stats.contractedSlots || slots.filter((s: any) => s.auction?.contract).length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">예상 수익</p>
                <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">
                  {formatCurrency(stats.expectedRevenue || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <input
                type="text"
                placeholder="슬롯명, 이벤트 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 sm:pl-10 text-sm sm:text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="input flex-1 min-w-[140px] text-sm sm:text-base"
              >
                <option value="all">전체 월</option>
                {monthOptions.map((opt: { value: string; label: string }) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input flex-1 min-w-[120px] text-sm sm:text-base"
              >
                <option value="all">전체 상태</option>
                <option value="auction">경매중</option>
                <option value="contracted">계약됨</option>
                <option value="available">미등록</option>
              </select>
            </div>
          </div>
        </div>

        {/* Slots List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-6 sm:p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600 text-sm sm:text-base">로딩 중...</p>
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">슬롯이 없습니다</h3>
              <p className="text-sm sm:text-base text-slate-600">등록된 이벤트에 슬롯이 배정되면 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredSlots.map((slot: any) => {
                const status = getSlotStatus(slot);
                return (
                  <div
                    key={slot.id}
                    className="p-3 sm:p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={cn(
                          'w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0',
                          slot.auction?.status === 'LIVE' ? 'bg-amber-100' :
                          slot.auction?.contract ? 'bg-emerald-100' : 'bg-slate-100'
                        )}>
                          <Calendar className={cn(
                            'w-5 h-5 sm:w-6 sm:h-6',
                            slot.auction?.status === 'LIVE' ? 'text-amber-600' :
                            slot.auction?.contract ? 'text-emerald-600' : 'text-slate-500'
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                              {slot.slotTemplate?.name}
                            </h3>
                            {/* 경매중 + 바로 구매 둘 다 설정된 경우 각각 배지 표시 */}
                            {slot.auction?.status === 'LIVE' && (
                              <span className="badge bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                경매중
                              </span>
                            )}
                            {slot.enableDirectBuy && slot.directBuyPrice && (
                              <span className="badge bg-violet-100 text-violet-700 border-violet-200 text-xs">
                                바로 구매
                              </span>
                            )}
                            {/* 경매도 바로 구매도 아닌 경우 기존 상태 배지 */}
                            {!(slot.auction?.status === 'LIVE') && !(slot.enableDirectBuy && slot.directBuyPrice) && (
                              <span className={cn('badge text-xs', status.style)}>
                                {status.label}
                              </span>
                            )}
                            {slot.auction?.status === 'LIVE' && (
                              <span className="badge bg-red-500 text-white border-red-500 animate-pulse text-xs">
                                LIVE
                              </span>
                            )}
                            {/* 공개/비공개 뱃지 */}
                            {slot.auction && (
                              <span className={cn(
                                'badge text-xs',
                                slot.auction.isFeatured
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              )}>
                                {slot.auction.isFeatured ? '공개' : '비공개'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="truncate">{slot.slotTemplate?.bodyPart || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>{formatCurrency(slot.reservePrice || slot.slotTemplate?.defaultReservePrice || 0)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="truncate">{getEventMonthLabel(slot.event)}</span>
                            </div>
                          </div>
                          {/* Sale Mode Info */}
                          {!slot.auction?.contract && !slot.auction && (
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm">
                              <span className="text-slate-500">판매방식:</span>
                              <span className={cn(
                                'font-medium',
                                (slot.enableAuction || slot.enableDirectBuy) ? 'text-violet-600' : 'text-slate-400'
                              )}>
                                {getSaleModeLabel(slot)}
                              </span>
                              {slot.enableDirectBuy && slot.directBuyPrice && (
                                <span className="text-slate-500">
                                  (즉시가: <strong className="text-emerald-600">{formatCurrency(Number(slot.directBuyPrice))}</strong>)
                                </span>
                              )}
                            </div>
                          )}
                          {slot.auction && (
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                              <span className="text-xs sm:text-sm text-slate-500">
                                시작가: <strong className="text-emerald-600">
                                  {formatCurrency(slot.auctionMinBid || slot.reservePrice || 0)}
                                </strong>
                              </span>
                              {slot.enableDirectBuy && slot.directBuyPrice && (
                                <span className="text-xs sm:text-sm text-slate-500">
                                  바로 구매: <strong className="text-violet-600">
                                    {formatCurrency(Number(slot.directBuyPrice))}
                                  </strong>
                                </span>
                              )}
                              <span className="text-xs sm:text-sm text-slate-500">
                                입찰: {slot.auction._count?.bids || 0}건
                              </span>
                            </div>
                          )}
                          {slot.auction?.contract && (
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                              <span className="text-slate-600">
                                계약금: <strong>{formatCurrency(slot.auction.contract.priceFinal || 0)}</strong>
                              </span>
                              <span className="text-slate-400 hidden sm:inline">|</span>
                              <span className="text-slate-600 truncate">
                                브랜드: {slot.auction.contract.brand?.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-13 sm:pl-0 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlot(slot);
                          }}
                          className="btn btn-secondary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          상세
                        </button>
                        {slot.auction?.status === 'LIVE' && (
                          <button className="btn btn-primary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            현황
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredSlots.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-slate-600">총 {filteredSlots.length}개 슬롯</p>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-600">페이지 {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slot Detail Modal */}
      {selectedSlot && (
        <SlotDetailModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['my-athlete-slots'] })}
        />
      )}

      {/* Create Slot Modal */}
      {showCreateModal && athlete && (
        <CreateSlotModal
          athleteId={athlete.id}
          events={events}
          templates={templates}
          existingSlots={slots}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['my-athlete-slots'] });
            setShowCreateModal(false);
          }}
        />
      )}
    </Layout>
  );
}

interface SlotDetailModalProps {
  slot: any;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  onUpdate: () => void;
}

function SlotDetailModal({ slot, onClose, formatCurrency, formatDate, onUpdate }: SlotDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info');

  // Sale mode state — 판매 방식 3종 중 택1 (경매 / 바로 구매 / 스폰픽 협의)
  const [saleMode, setSaleMode] = useState<'AUCTION' | 'DIRECT' | 'INQUIRY'>(
    slot.saleMode || (slot.enableDirectBuy ? 'DIRECT' : slot.enableAuction ? 'AUCTION' : 'INQUIRY')
  );
  const enableAuction = saleMode === 'AUCTION';
  const enableDirectBuy = saleMode === 'DIRECT';
  const [directBuyPrice, setDirectBuyPrice] = useState(slot.directBuyPrice ? String(slot.directBuyPrice) : '');
  const [auctionMinBid, setAuctionMinBid] = useState(slot.auctionMinBid ? String(Number(slot.auctionMinBid)) : String(Number(slot.reservePrice) || 100000));
  const [auctionEndAt, setAuctionEndAt] = useState(
    slot.auctionEndAt ? new Date(slot.auctionEndAt).toISOString().slice(0, 16) : ''
  );
  const [isPublic, setIsPublic] = useState(slot.auction?.isFeatured ?? false);
  const [saleModeError, setSaleModeError] = useState('');
  const [saleModeSuccess, setSaleModeSuccess] = useState(false);

  const saleModeSubmitting = useMutation({
    mutationFn: () => api.updateSlotSaleMode(slot.id, {
      saleMode,
      directBuyPrice: enableDirectBuy && directBuyPrice ? Number(directBuyPrice) : null,
      auctionMinBid: enableAuction && auctionMinBid ? Number(auctionMinBid) : null,
      auctionEndAt: enableAuction && auctionEndAt ? auctionEndAt : null,
      isPublic: enableAuction ? isPublic : undefined,
    }),
    onSuccess: () => {
      setSaleModeSuccess(true);
      setSaleModeError('');
      onUpdate();
      setTimeout(() => setSaleModeSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaleModeError(error.response?.data?.error?.message || '저장에 실패했습니다');
      setSaleModeSuccess(false);
    },
  });

  const handleSaleModeSubmit = () => {
    setSaleModeError('');

    if (enableDirectBuy && (!directBuyPrice || Number(directBuyPrice) <= 0)) {
      setSaleModeError('바로 구매 가격을 입력해주세요');
      return;
    }

    if (enableAuction) {
      if (!auctionMinBid || Number(auctionMinBid) <= 0) {
        setSaleModeError('최소 입찰가를 입력해주세요');
        return;
      }
      if (!auctionEndAt) {
        setSaleModeError('경매 마감일을 선택해주세요');
        return;
      }
      if (new Date(auctionEndAt) <= new Date()) {
        setSaleModeError('경매 마감일은 현재 시간 이후여야 합니다');
        return;
      }
    }

    saleModeSubmitting.mutate();
  };

  const canEditSaleMode = slot.status === 'OPEN' && !slot.auction?.contract && slot.auction?.status !== 'LIVE';

  const status = (() => {
    if (slot.auction?.contract) {
      return { label: '계약됨', style: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    if (slot.auction?.status === 'LIVE') {
      return { label: '경매중', style: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    if (slot.auction?.status === 'SCHEDULED') {
      return { label: '경매 예정', style: 'bg-sky-100 text-sky-700 border-sky-200' };
    }
    // 바로 구매 활성화 + 가격 설정됨 = 판매중
    if (slot.enableDirectBuy && slot.directBuyPrice) {
      return { label: '판매중', style: 'bg-violet-100 text-violet-700 border-violet-200' };
    }
    // 경매 활성화 + 최소입찰가 + 마감일 설정됨 = 판매중
    if (slot.enableAuction && slot.auctionMinBid && slot.auctionEndAt) {
      return { label: '판매중', style: 'bg-violet-100 text-violet-700 border-violet-200' };
    }
    // 플래그만 설정됨 = 설정중
    if (slot.enableDirectBuy || slot.enableAuction) {
      return { label: '설정중', style: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    return { label: '미등록', style: 'bg-slate-100 text-slate-700 border-slate-200' };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl sm:mx-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{slot.slotTemplate?.name}</h2>
              <p className="text-sm sm:text-base text-slate-600 truncate">{getEventMonthLabel(slot.event)}</p>
            </div>
            <span className={cn('badge text-xs flex-shrink-0', status.style)}>{status.label}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex px-4 sm:px-6">
            {[
              { id: 'info', label: '슬롯 정보' },
              { id: 'salemode', label: '판매 설정' },
              { id: 'auction', label: '경매 현황' },
              { id: 'stats', label: '성과 분석' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'info' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Slot Details */}
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">슬롯 정보</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                    <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">위치</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">{slot.slotTemplate?.bodyPart || '-'}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                    <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">최대 크기</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      {slot.slotTemplate?.sizeMaxWMm && slot.slotTemplate?.sizeMaxHMm
                        ? `${slot.slotTemplate.sizeMaxWMm}×${slot.slotTemplate.sizeMaxHMm}mm`
                        : '-'}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                    <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">최소가</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      {slot.reservePrice ? formatCurrency(slot.reservePrice) : formatCurrency(slot.slotTemplate?.defaultReservePrice || 0)}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                    <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">이벤트 기간</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      {formatDate(slot.event?.dateStart)} - {formatDate(slot.event?.dateEnd)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contract Info */}
              {slot.auction?.contract && (
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">계약 정보</h3>
                  <div className="p-3 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <span className="text-emerald-700 font-medium text-sm sm:text-base">계약 완료</span>
                      <span className="text-base sm:text-lg font-bold text-emerald-700">
                        {formatCurrency(slot.auction.contract.priceFinal || 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-emerald-600">브랜드</p>
                        <p className="font-medium text-emerald-900">{slot.auction.contract.brand?.name}</p>
                      </div>
                      <div>
                        <p className="text-emerald-600">계약 상태</p>
                        <p className="font-medium text-emerald-900">{slot.auction.contract.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'salemode' && (
            <div className="space-y-4 sm:space-y-6">
              {!canEditSaleMode ? (
                <div className="text-center py-8 sm:py-12">
                  <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">판매 설정을 수정할 수 없습니다</h3>
                  <p className="text-sm sm:text-base text-slate-600">
                    {slot.auction?.contract ? '이미 계약된 슬롯입니다' :
                     slot.auction?.status === 'LIVE' ? '경매 진행 중에는 수정할 수 없습니다' :
                     '슬롯 상태가 OPEN일 때만 수정 가능합니다'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Success/Error Messages */}
                  {saleModeSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                      판매 설정이 저장되었습니다
                    </div>
                  )}
                  {saleModeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      {saleModeError}
                    </div>
                  )}

                  {/* 판매 방식 선택 (택1) */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl">
                    <div className="text-sm font-bold text-slate-900 mb-1">판매 방식 선택</div>
                    <p className="text-xs text-slate-500 mb-3">슬롯마다 하나의 방식을 선택할 수 있습니다.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { key: 'AUCTION', label: '경매', desc: '브랜드 입찰로 낙찰', icon: '🔨' },
                        { key: 'DIRECT', label: '직접 구매', desc: '고정가 즉시 판매', icon: '🛒' },
                        { key: 'INQUIRY', label: '스폰픽 협의', desc: '슬롯만 오픈 후 상담 확정', icon: '💬' },
                      ] as const).map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setSaleMode(m.key)}
                          className={cn(
                            'text-left p-3 rounded-xl border-2 transition-all',
                            saleMode === m.key
                              ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-emerald-300'
                          )}
                        >
                          <div className="text-sm font-bold text-slate-900 mb-0.5">{m.icon} {m.label}</div>
                          <div className="text-[11px] text-slate-500 leading-snug">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 스폰픽 협의 안내 */}
                  {saleMode === 'INQUIRY' && (
                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl">
                      <div className="text-sm font-bold text-sky-900 mb-1">💬 스폰픽 협의 방식</div>
                      <p className="text-xs text-sky-800 leading-relaxed">
                        후원 가능 슬롯만 공개되고 가격은 노출되지 않습니다. 브랜드가 상담을 신청하면
                        스폰픽이 조건을 협의해 후원을 확정합니다.
                      </p>
                    </div>
                  )}

                  {/* Auction 설정 */}
                  <div className={cn('p-4 bg-slate-50 rounded-xl', !enableAuction && 'hidden')}>
                    <div className="flex items-center gap-2 mb-3">
                      <Gavel className="w-5 h-5 text-amber-600" />
                      <span className="font-medium text-slate-900">경매 설정</span>
                    </div>
                    {enableAuction && (
                      <div className="space-y-3 pt-3 border-t border-slate-200">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">최소 입찰가 (원)</label>
                          <input
                            type="number"
                            value={auctionMinBid}
                            onChange={(e) => setAuctionMinBid(e.target.value)}
                            className="input w-full text-sm"
                            placeholder="100000"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">경매 마감일</label>
                          <input
                            type="datetime-local"
                            value={auctionEndAt}
                            onChange={(e) => setAuctionEndAt(e.target.value)}
                            className="input w-full text-sm"
                          />
                        </div>
                        {/* 공개/비공개 토글 */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-slate-700">공개 경매</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPublic(!isPublic)}
                            className={cn(
                              'flex items-center gap-1 text-sm font-medium transition-colors',
                              isPublic ? 'text-blue-600' : 'text-slate-400'
                            )}
                          >
                            {isPublic ? (
                              <><ToggleRight className="w-7 h-7" /> 공개</>
                            ) : (
                              <><ToggleLeft className="w-7 h-7" /> 비공개</>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          공개: 모든 브랜드에게 노출 | 비공개: 직접 공유 시에만 노출
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 직접 구매 설정 */}
                  <div className={cn('p-4 bg-slate-50 rounded-xl', !enableDirectBuy && 'hidden')}>
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingCart className="w-5 h-5 text-violet-600" />
                      <span className="font-medium text-slate-900">직접 구매 설정</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <label className="block text-xs text-slate-600 mb-1">바로 구매 가격 (원)</label>
                      <input
                        type="number"
                        value={directBuyPrice}
                        onChange={(e) => setDirectBuyPrice(e.target.value)}
                        className="input w-full text-sm"
                        placeholder="500000"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaleModeSubmit}
                    disabled={saleModeSubmitting.isPending}
                    className="btn btn-primary w-full"
                  >
                    {saleModeSubmitting.isPending ? '저장 중...' : '판매 설정 저장'}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    * 경매와 바로 구매를 동시에 활성화하면 브랜드는 원하는 방식으로 구매할 수 있습니다
                  </p>
                </>
              )}
            </div>
          )}

          {activeTab === 'auction' && (
            <div className="space-y-4 sm:space-y-6">
              {slot.auction ? (
                <>
                  {/* Auction Status */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="p-2.5 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-200">
                      <p className="text-[10px] sm:text-xs text-emerald-600 mb-0.5 sm:mb-1">시작가</p>
                      <p className="text-sm sm:text-xl font-bold text-emerald-700">
                        {formatCurrency(slot.auctionMinBid || slot.reservePrice || 0)}
                      </p>
                    </div>
                    <div className="p-2.5 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                      <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">입찰 수</p>
                      <p className="text-sm sm:text-xl font-bold text-slate-900">{slot.auction._count?.bids || 0}건</p>
                    </div>
                    <div className="p-2.5 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                      <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">마감</p>
                      <p className="text-sm sm:text-xl font-bold text-slate-900">
                        {slot.auction.endTime
                          ? new Date(slot.auction.endTime).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Bid History */}
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">입찰 내역</h3>
                    {slot.auction.bids && slot.auction.bids.length > 0 ? (
                      <div className="space-y-1.5 sm:space-y-2">
                        {slot.auction.bids.slice(0, 5).map((bid: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className={cn(
                                'w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold',
                                index === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                              )}>
                                {index + 1}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-600">{bid.brand?.companyName || '익명'}</span>
                            </div>
                            <span className="font-semibold text-slate-900 text-xs sm:text-sm">{formatCurrency(bid.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 sm:py-8 bg-slate-50 rounded-lg sm:rounded-xl">
                        <Gavel className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs sm:text-sm">아직 입찰이 없습니다</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">경매가 등록되지 않았습니다</h3>
                  <p className="text-sm sm:text-base text-slate-600">이 슬롯은 아직 경매에 등록되지 않았습니다</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="p-3 sm:p-4 bg-sky-50 rounded-lg sm:rounded-xl border border-sky-200">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
                  <span className="font-medium text-sky-900 text-sm sm:text-base">성과 분석</span>
                </div>
                <p className="text-xs sm:text-sm text-sky-700">
                  이벤트 종료 후 광고 노출 성과를 확인할 수 있습니다
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">슬롯 위치</p>
                  <p className="text-sm sm:text-xl font-bold text-slate-900">
                    {slot.slotTemplate?.bodyPart || '-'}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">최대 크기</p>
                  <p className="text-sm sm:text-xl font-bold text-slate-900">
                    {slot.slotTemplate?.sizeMaxWMm && slot.slotTemplate?.sizeMaxHMm
                      ? `${slot.slotTemplate.sizeMaxWMm}×${slot.slotTemplate.sizeMaxHMm}mm`
                      : '-'}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">최소가</p>
                  <p className="text-sm sm:text-xl font-bold text-slate-900">
                    {formatCurrency(slot.reservePrice || slot.slotTemplate?.defaultReservePrice || 0)}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">이벤트 상태</p>
                  <p className="text-sm sm:text-xl font-bold text-slate-900">
                    {slot.event?.status || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-secondary w-full text-sm sm:text-base">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateSlotModalProps {
  athleteId: string;
  events: any[];
  templates: any[];
  existingSlots: any[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateSlotModal({
  athleteId,
  events,
  templates,
  existingSlots,
  onClose,
  onCreated,
}: CreateSlotModalProps) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  // 모든 이벤트의 슬롯을 가져와서 중복 체크 (페이지 필터와 무관하게)
  const { data: allSlotsData } = useQuery({
    queryKey: ['all-athlete-slots-for-create'],
    queryFn: () => api.getMyAthleteSlots(), // eventId 없이 전체 조회
    staleTime: 0, // 항상 최신 데이터 사용
    refetchOnMount: 'always',
  });
  const allExistingSlots = allSlotsData?.data || existingSlots;

  const createSlotsMutation = useMutation({
    mutationFn: () => api.bulkCreateSlotInstances(selectedEventId, athleteId, selectedTemplateIds),
    onSuccess: (response: any) => {
      const result = response?.data;
      if (result?.failed?.length > 0) {
        const failedNames = result.failed.map((f: any) => f.templateName).join(', ');
        setError(`일부 슬롯 생성 실패: ${failedNames} (이미 존재하거나 오류 발생)`);
      }
      if (result?.created?.length > 0) {
        onCreated();
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || '슬롯 생성에 실패했습니다');
    },
  });

  // Filter out templates that already have slots for this event
  // slotTemplate.id 또는 slotTemplateId 둘 다 체크 (API 응답 형식에 따라)
  const availableTemplates = templates.filter((template: any) => {
    if (!selectedEventId) return true;
    return !allExistingSlots.some(
      (slot: any) =>
        (slot.eventId === selectedEventId || slot.event?.id === selectedEventId) &&
        (slot.slotTemplateId === template.id || slot.slotTemplate?.id === template.id)
    );
  });

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSelectAll = () => {
    const availableIds = availableTemplates.map((t: any) => t.id);
    const allSelected = availableIds.every((id: string) => selectedTemplateIds.includes(id));
    if (allSelected) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(availableIds);
    }
  };

  const handleSubmit = () => {
    setError('');
    if (!selectedEventId) {
      setError('이벤트를 선택해주세요');
      return;
    }
    if (selectedTemplateIds.length === 0) {
      setError('최소 하나의 슬롯 유형을 선택해주세요');
      return;
    }
    createSlotsMutation.mutate();
  };

  // Sort events by date (future first, then past)
  const sortedEvents = [...events].sort((a: any, b: any) => {
    const dateA = new Date(a.dateEnd || a.endDate || 0);
    const dateB = new Date(b.dateEnd || b.endDate || 0);
    return dateB.getTime() - dateA.getTime();
  });

  // Check if event is active (end date in future)
  const isEventActive = (event: any) => {
    const endDate = new Date(event.dateEnd || event.endDate);
    return endDate >= new Date();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl sm:mx-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">슬롯 추가</h2>
              <p className="text-sm text-slate-600 mt-1">이벤트에 광고 슬롯을 등록합니다</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {events.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              등록된 이벤트가 없습니다. 관리자에게 이벤트 등록을 요청하세요.
            </div>
          )}

          {/* Event Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              이벤트 선택
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setSelectedTemplateIds([]);
              }}
              className="input w-full"
            >
              <option value="">이벤트를 선택하세요</option>
              {sortedEvents.map((event: any) => {
                const active = isEventActive(event);
                return (
                  <option key={event.id} value={event.id}>
                    {!active ? '[종료] ' : ''}{event.name} ({new Date(event.dateStart || event.startDate).toLocaleDateString('ko-KR')})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Template Selection */}
          {selectedEventId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  슬롯 유형 선택
                </label>
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  {availableTemplates.length > 0 &&
                  availableTemplates.every((t: any) => selectedTemplateIds.includes(t.id))
                    ? '전체 해제'
                    : '전체 선택'}
                </button>
              </div>
              {availableTemplates.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 text-sm">
                  이 이벤트에 등록 가능한 슬롯이 없습니다
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableTemplates.map((template: any) => (
                    <label
                      key={template.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                        selectedTemplateIds.includes(template.id)
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => handleTemplateToggle(template.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{template.name}</p>
                        <p className="text-xs text-slate-500">
                          {template.code}
                          {(template as any).category && ` · ${(template as any).category}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-emerald-600">
                          {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(
                            template.defaultReservePrice || 0
                          )}
                        </p>
                        <p className="text-xs text-slate-500">최소가</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Count */}
          {selectedTemplateIds.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-700">
                <span className="font-medium">{selectedTemplateIds.length}개</span> 슬롯이 선택됨
              </p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={createSlotsMutation.isPending || !selectedEventId || selectedTemplateIds.length === 0}
            className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
          >
            {createSlotsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                슬롯 생성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

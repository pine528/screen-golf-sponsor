import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import {
  Search,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Star,
  Eye,
  Gavel,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  ShoppingCart,
  Zap,
} from 'lucide-react';
import { cn } from '../utils';

export function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [page, setPage] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['available-slots', selectedEvent, page],
    queryFn: () => api.getAvailableSlots({
      eventId: selectedEvent !== 'all' ? selectedEvent : undefined,
      page,
    }),
  });

  const events = eventsData?.data || [];
  const slots = slotsData?.data || [];

  const filteredSlots = slots
    .filter((slot: any) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          slot.slotTemplate?.name?.toLowerCase().includes(searchLower) ||
          slot.athlete?.displayName?.toLowerCase().includes(searchLower) ||
          slot.event?.name?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter((slot: any) => {
      if (priceRange === 'all') return true;
      const price = slot.auction?.startingPrice || 0;
      switch (priceRange) {
        case 'under100': return price < 100000;
        case '100to300': return price >= 100000 && price < 300000;
        case '300to500': return price >= 300000 && price < 500000;
        case 'over500': return price >= 500000;
        default: return true;
      }
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case 'price_low': return (a.auction?.startingPrice || 0) - (b.auction?.startingPrice || 0);
        case 'price_high': return (b.auction?.startingPrice || 0) - (a.auction?.startingPrice || 0);
        case 'ending': return new Date(a.auction?.endTime || 0).getTime() - new Date(b.auction?.endTime || 0).getTime();
        default: return (b.athlete?.averageViewers || 0) - (a.athlete?.averageViewers || 0);
      }
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

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">인벤토리 탐색</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">입찰 가능한 광고 슬롯을 찾아보세요</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'grid'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              )}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              )}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <input
                type="text"
                placeholder="선수명, 슬롯명, 이벤트 검색..."
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
                <option value="all">전체 이벤트</option>
                {events.map((event: any) => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="input flex-1 min-w-[120px] text-sm sm:text-base"
              >
                <option value="all">전체 가격</option>
                <option value="under100">10만원 미만</option>
                <option value="100to300">10-30만원</option>
                <option value="300to500">30-50만원</option>
                <option value="over500">50만원 이상</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input flex-1 min-w-[120px] text-sm sm:text-base"
              >
                <option value="popular">인기순</option>
                <option value="price_low">가격 낮은순</option>
                <option value="price_high">가격 높은순</option>
                <option value="ending">마감 임박순</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-600">슬롯을 불러오는 중...</p>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="card p-8 sm:p-12 text-center">
            <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">슬롯이 없습니다</h3>
            <p className="text-sm sm:text-base text-slate-600">검색 조건을 변경해보세요</p>
          </div>
        ) : viewMode === 'grid' || window.innerWidth < 640 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSlots.map((slot: any) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                onSelect={() => setSelectedSlot(slot)}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">슬롯</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">선수</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">이벤트</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">시작가</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">입찰</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSlots.map((slot: any) => (
                  <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{slot.slotTemplate?.name}</p>
                          <p className="text-sm text-slate-500">{slot.slotTemplate?.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{slot.athlete?.displayName}</p>
                      <p className="text-sm text-slate-500">랭킹 {slot.athlete?.rank}위</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{slot.event?.name}</p>
                      <p className="text-xs text-slate-400">{formatDate(slot.event?.startDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(slot.auction?.startingPrice || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-info">{slot.auction?.bidCount || 0}건</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedSlot(slot)}
                        className="btn btn-primary btn-sm inline-flex items-center gap-1"
                      >
                        <Gavel className="w-4 h-4" />
                        입찰
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredSlots.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              총 {filteredSlots.length}개 슬롯
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 py-1 text-sm text-slate-600">페이지 {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
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
        />
      )}
    </Layout>
  );
}

interface SlotCardProps {
  slot: any;
  onSelect: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
}

function SlotCard({ slot, onSelect, formatCurrency, formatDate }: SlotCardProps) {
  return (
    <div className="card overflow-hidden hover:-translate-y-1 transition-all cursor-pointer group" onClick={onSelect}>
      {/* Header Image */}
      <div className="relative h-32 sm:h-40 bg-gradient-to-br from-emerald-100 to-teal-100">
        <div className="absolute inset-0 flex items-center justify-center">
          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-300" />
        </div>
        {slot.auction?.status === 'LIVE' && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
            <span className="badge bg-red-500 text-white border-red-500 animate-pulse text-xs">LIVE</span>
          </div>
        )}
        {slot.athlete?.rank && slot.athlete.rank <= 10 && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <span className="badge bg-amber-100 text-amber-700 border-amber-200 text-xs">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
              TOP 10
            </span>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 h-16 sm:h-20 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Content */}
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors text-sm sm:text-base">
              {slot.slotTemplate?.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">{slot.slotTemplate?.position}</p>
          </div>
          <span className="badge badge-info text-xs">{slot.slotTemplate?.duration}초</span>
        </div>

        {/* Athlete Info */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 p-2 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 text-sm sm:text-base truncate">{slot.athlete?.displayName}</p>
            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-slate-500">
              <span>랭킹 {slot.athlete?.rank}위</span>
              <span>•</span>
              <span className="truncate">{slot.athlete?.averageViewers?.toLocaleString()}명</span>
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4">
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="truncate">{slot.event?.name}</span>
          <span className="text-slate-300">|</span>
          <span className="flex-shrink-0">{formatDate(slot.event?.startDate)}</span>
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-100">
          <div>
            {slot.enableDirectBuy && slot.directBuyPrice ? (
              <>
                <p className="text-[10px] sm:text-xs text-violet-600 font-medium">즉시구매</p>
                <p className="text-base sm:text-lg font-bold text-violet-700">
                  {formatCurrency(Number(slot.directBuyPrice))}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] sm:text-xs text-slate-500">시작가</p>
                <p className="text-base sm:text-lg font-bold text-slate-900">
                  {formatCurrency(slot.reservePrice || slot.auction?.startingPrice || 0)}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-1.5">
            {slot.enableDirectBuy && (
              <button className="btn bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">바로</span>구매
              </button>
            )}
            {slot.enableAuction && (
              <button className="btn btn-primary inline-flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Gavel className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                입찰
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SlotDetailModalProps {
  slot: any;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  onBuySuccess?: () => void;
}

function SlotDetailModal({ slot, onClose, formatCurrency, formatDate, onBuySuccess }: SlotDetailModalProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [autoBid, setAutoBid] = useState(true);
  const [buyError, setBuyError] = useState('');
  const [buySuccess, setBuySuccess] = useState(false);
  const queryClient = useQueryClient();

  const buyNowMutation = useMutation({
    mutationFn: () => api.buySlotNow(slot.id),
    onSuccess: () => {
      setBuySuccess(true);
      setBuyError('');
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      onBuySuccess?.();
      setTimeout(() => onClose(), 2000);
    },
    onError: (error: any) => {
      setBuyError(error.response?.data?.error?.message || '구매에 실패했습니다. 다시 시도해주세요.');
    },
  });

  const handleBid = async () => {
    try {
      await api.placeBid(slot.auction?.id, parseInt(bidAmount), autoBid);
      alert('입찰이 완료되었습니다!');
      onClose();
    } catch (error) {
      alert('입찰에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleBuyNow = () => {
    if (window.confirm(`${formatCurrency(Number(slot.directBuyPrice))}에 즉시 구매하시겠습니까?`)) {
      buyNowMutation.mutate();
    }
  };

  const minimumBid = (slot.auction?.currentPrice || slot.auction?.startingPrice || slot.auctionMinBid || slot.reservePrice || 0) + 10000;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl sm:mx-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{slot.slotTemplate?.name}</h2>
          <p className="text-sm sm:text-base text-slate-600">{slot.event?.name}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Slot Details */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
              <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">위치</p>
              <p className="font-medium text-slate-900 text-sm sm:text-base">{slot.slotTemplate?.position}</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
              <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">노출 시간</p>
              <p className="font-medium text-slate-900 text-sm sm:text-base">{slot.slotTemplate?.duration}초</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
              <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">예상 노출</p>
              <p className="font-medium text-slate-900 text-sm sm:text-base">{slot.slotTemplate?.estimatedImpressions?.toLocaleString()}회</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
              <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">이벤트 기간</p>
              <p className="font-medium text-slate-900 text-sm sm:text-base">
                {formatDate(slot.event?.startDate)} - {formatDate(slot.event?.endDate)}
              </p>
            </div>
          </div>

          {/* Athlete Info */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">선수 정보</h3>
            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm sm:text-base">{slot.athlete?.displayName}</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-sm text-slate-600 mt-1">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                    랭킹 {slot.athlete?.rank}위
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    {slot.athlete?.socialFollowers?.toLocaleString()} 팔로워
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    평균 {slot.athlete?.averageViewers?.toLocaleString()}명
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Auction Info */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">경매 정보</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="p-2.5 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-200">
                <p className="text-[10px] sm:text-xs text-emerald-600 mb-0.5 sm:mb-1">현재 가격</p>
                <p className="text-sm sm:text-xl font-bold text-emerald-700">
                  {formatCurrency(slot.auction?.currentPrice || slot.auction?.startingPrice || 0)}
                </p>
              </div>
              <div className="p-2.5 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">입찰 수</p>
                <p className="text-sm sm:text-xl font-bold text-slate-900">{slot.auction?.bidCount || 0}건</p>
              </div>
              <div className="p-2.5 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">마감</p>
                <p className="text-sm sm:text-xl font-bold text-slate-900">
                  {slot.auction?.endTime
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
          </div>

          {/* Success/Error Messages */}
          {buySuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
              구매가 완료되었습니다! 계약 페이지에서 확인하세요.
            </div>
          )}
          {buyError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {buyError}
            </div>
          )}

          {/* Direct Buy Section */}
          {slot.enableDirectBuy && slot.directBuyPrice && (
            <div className="pt-3 sm:pt-4 border-t border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">즉시구매</h3>
              <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-violet-600">즉시구매가</p>
                    <p className="text-2xl font-bold text-violet-700">{formatCurrency(Number(slot.directBuyPrice))}</p>
                  </div>
                  <ShoppingCart className="w-10 h-10 text-violet-300" />
                </div>
                <button
                  onClick={handleBuyNow}
                  disabled={buyNowMutation.isPending || buySuccess}
                  className="btn bg-violet-600 hover:bg-violet-700 text-white w-full inline-flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {buyNowMutation.isPending ? '처리 중...' : '바로 구매하기'}
                </button>
                <p className="text-xs text-violet-600 mt-2 text-center">
                  * 즉시구매 시 바로 계약이 생성됩니다
                </p>
              </div>
            </div>
          )}

          {/* Bid Form - Only show if auction is enabled */}
          {slot.enableAuction && (
            <div className="pt-3 sm:pt-4 border-t border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">경매 입찰</h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="label text-xs sm:text-sm">최대 입찰가</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`최소 ${formatCurrency(minimumBid)}`}
                      className="input pr-10 sm:pr-12 text-sm sm:text-base"
                      min={minimumBid}
                      step={10000}
                    />
                    <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">원</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                    최소 입찰가: {formatCurrency(minimumBid)} (현재가 + 10,000원)
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">자동 입찰</p>
                    <p className="text-xs sm:text-sm text-slate-500">최대 입찰가 내에서 자동으로 경쟁합니다</p>
                  </div>
                  <button
                    onClick={() => setAutoBid(!autoBid)}
                    className={cn(
                      'w-10 h-5 sm:w-12 sm:h-6 rounded-full transition-colors relative flex-shrink-0',
                      autoBid ? 'bg-emerald-500' : 'bg-slate-300'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 sm:top-1 w-4 h-4 bg-white rounded-full transition-transform',
                        autoBid ? 'left-5 sm:left-7' : 'left-0.5 sm:left-1'
                      )}
                    />
                  </button>
                </div>

                <button
                  onClick={handleBid}
                  disabled={!bidAmount || parseInt(bidAmount) < minimumBid}
                  className="btn btn-primary w-full inline-flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                >
                  <Gavel className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  입찰하기
                </button>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="pt-3 sm:pt-4">
            <button onClick={onClose} className="btn btn-secondary w-full text-sm sm:text-base">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, User, Calendar, Gavel, AlertCircle, ShoppingCart, Tag, Trophy, Timer } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import {
  formatCurrency,
  formatTimeRemaining,
  formatDate,
  getBodyPartLabel,
  cn,
} from '../utils';

// 남은 시간 표시 (초 단위)
function formatRemainingSeconds(seconds: number): string {
  if (seconds <= 0) return '만료됨';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간`;
  }
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

export function Auctions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('LIVE');
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);

  // 즉시구매 모달 상태
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [selectedSlotForBuyNow, setSelectedSlotForBuyNow] = useState<any>(null);
  const [buyNowError, setBuyNowError] = useState<string | null>(null);

  const { data: auctions, isLoading } = useQuery({
    queryKey: ['auctions', statusFilter],
    queryFn: () => api.getAuctions({ status: statusFilter }),
    refetchInterval: statusFilter === 'LIVE' ? 5000 : false,
  });

  // 즉시구매 가능 슬롯 조회 (OPEN 상태 + enableDirectBuy)
  const { data: directBuySlots } = useQuery({
    queryKey: ['slots', 'directBuy'],
    queryFn: () => api.getSlotInstances({ status: 'OPEN' }),
    enabled: statusFilter === 'DIRECT_BUY',
  });

  // ★ Phase 9-3: 내 입찰 목록 (Brand only)
  const { data: myBids } = useQuery({
    queryKey: ['brands', 'me', 'bids'],
    queryFn: () => api.getMyAuctionBids(),
    enabled: statusFilter === 'MY_BIDS' && user?.role === 'BRAND',
    refetchInterval: statusFilter === 'MY_BIDS' ? 10000 : false,
  });

  // ★ Phase 9-3: 내 예약 목록 (Brand only)
  const { data: myReservations } = useQuery({
    queryKey: ['brands', 'me', 'reservations'],
    queryFn: () => api.getMyReservations(),
    enabled: statusFilter === 'MY_RESERVATIONS' && user?.role === 'BRAND',
    refetchInterval: statusFilter === 'MY_RESERVATIONS' ? 30000 : false,
  });

  const placeBidMutation = useMutation({
    mutationFn: ({ auctionId, maxBid }: { auctionId: string; maxBid: number }) =>
      api.placeBid(auctionId, maxBid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setSelectedAuction(null);
      setBidAmount('');
      setBidError(null);
    },
    onError: (error: any) => {
      setBidError(error.response?.data?.error?.message || '입찰에 실패했습니다');
    },
  });

  // 즉시구매 뮤테이션
  const buyNowMutation = useMutation({
    mutationFn: (slotId: string) => api.buySlotNow(slotId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setShowBuyNowModal(false);
      setSelectedSlotForBuyNow(null);
      setBuyNowError(null);
      // 계약 페이지로 이동
      if (data?.data?.id) {
        navigate(`/brand/contracts/${data.data.id}`);
      }
    },
    onError: (error: any) => {
      setBuyNowError(error.response?.data?.error || '즉시구매에 실패했습니다');
    },
  });

  const handleBid = () => {
    if (!selectedAuction || !bidAmount) return;

    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setBidError('유효한 금액을 입력하세요');
      return;
    }

    placeBidMutation.mutate({ auctionId: selectedAuction.id, maxBid: amount });
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">경매</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">스폰서 슬롯 경매에 참여하세요</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {['LIVE', 'DIRECT_BUY', ...(user?.role === 'BRAND' ? ['MY_BIDS', 'MY_RESERVATIONS'] : []), 'SCHEDULED', 'ENDED', 'UNSOLD'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                statusFilter === status
                  ? status === 'DIRECT_BUY' ? 'bg-blue-600 text-white'
                  : status === 'MY_BIDS' ? 'bg-purple-600 text-white'
                  : status === 'MY_RESERVATIONS' ? 'bg-orange-600 text-white'
                  : 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {status === 'LIVE' && '진행 중'}
              {status === 'DIRECT_BUY' && '즉시구매'}
              {status === 'MY_BIDS' && '내 입찰'}
              {status === 'MY_RESERVATIONS' && '내 예약'}
              {status === 'SCHEDULED' && '예정'}
              {status === 'ENDED' && '종료'}
              {status === 'UNSOLD' && '유찰'}
            </button>
          ))}
        </div>

        {/* Auction List */}
        {!['DIRECT_BUY', 'MY_BIDS', 'MY_RESERVATIONS'].includes(statusFilter) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-12 text-slate-500">로딩 중...</div>
            ) : auctions?.data?.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                해당하는 경매가 없습니다
              </div>
            ) : (
              auctions?.data?.map((auction: any) => (
                <div key={auction.id} className="card overflow-hidden">
                  <div className="p-4 sm:p-6">
                    {/* Slot Info */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                          {auction.slotInstance?.slotTemplate?.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600">
                          {getBodyPartLabel(auction.slotInstance?.slotTemplate?.bodyPart)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'badge text-xs',
                          auction.status === 'LIVE'
                            ? 'badge-success'
                            : auction.status === 'SCHEDULED'
                            ? 'badge-info'
                            : 'badge-warning'
                        )}
                      >
                        {auction.status === 'LIVE' && '진행 중'}
                        {auction.status === 'SCHEDULED' && '예정'}
                        {auction.status === 'ENDED' && '종료'}
                        {auction.status === 'UNSOLD' && '유찰'}
                      </span>
                    </div>

                    {/* Athlete & Event */}
                    <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{auction.slotInstance?.athlete?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{auction.slotInstance?.event?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        {formatDate(auction.slotInstance?.event?.dateStart)}
                      </div>
                    </div>

                    {/* Price & Time */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div>
                        <p className="text-xs sm:text-sm text-slate-600">현재가</p>
                        <p className="text-lg sm:text-xl font-bold text-slate-900">
                          {formatCurrency(auction.currentPrice)}
                        </p>
                      </div>
                      {auction.status === 'LIVE' && (
                        <div className="text-right">
                          <p className="text-xs sm:text-sm text-slate-600">남은 시간</p>
                          <p className="text-sm sm:text-lg font-semibold text-red-600 flex items-center justify-end gap-1">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            {formatTimeRemaining(auction.endAt)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bid Count */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4">
                      <Gavel className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      입찰 {auction._count?.bids || 0}건
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {user?.role === 'BRAND' && auction.status === 'LIVE' && (
                        <button
                          onClick={() => {
                            setSelectedAuction(auction);
                            setBidAmount(String(auction.currentPrice + auction.minBidIncrement));
                            setBidError(null);
                          }}
                          className="btn btn-primary flex-1 text-sm"
                        >
                          입찰하기
                        </button>
                      )}
                      <Link
                        to={`/auctions/${auction.id}`}
                        className={cn(
                          'btn btn-secondary text-center block text-sm',
                          user?.role === 'BRAND' && auction.status === 'LIVE' ? 'flex-1' : 'w-full'
                        )}
                      >
                        상세 보기
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ★ Phase 9-3: My Bids List (Brand only) */}
        {statusFilter === 'MY_BIDS' && user?.role === 'BRAND' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {!myBids ? (
              <div className="col-span-full text-center py-12 text-slate-500">로딩 중...</div>
            ) : (myBids as any).data?.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                입찰한 경매가 없습니다
              </div>
            ) : (
              (myBids as any).data?.map((bid: any) => (
                <div key={bid.id} className="card overflow-hidden border-l-4 border-l-purple-500">
                  <div className="p-4 sm:p-6">
                    {/* Slot Info */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                          {bid.slotName}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600">{bid.athleteName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {bid.isHighest && (
                          <span className="badge bg-amber-100 text-amber-800 text-xs flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            최고
                          </span>
                        )}
                        <span
                          className={cn(
                            'badge text-xs',
                            bid.status === 'LIVE' ? 'badge-success' : 'badge-warning'
                          )}
                        >
                          {bid.status === 'LIVE' ? '진행 중' : '종료'}
                        </span>
                      </div>
                    </div>

                    {/* Event */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mb-3">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{bid.eventName}</span>
                    </div>

                    {/* Bid Info */}
                    <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-4">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">내 입찰</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(bid.myBidAmount)}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">현재 최고가</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(bid.currentHighest)}</p>
                      </div>
                    </div>

                    {/* Time */}
                    {bid.status === 'LIVE' && bid.remainingSeconds > 0 && (
                      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          남은 시간
                        </span>
                        <span className="font-medium text-red-600">
                          {formatRemainingSeconds(bid.remainingSeconds)}
                        </span>
                      </div>
                    )}

                    {/* Action */}
                    <Link
                      to={`/auctions/${bid.auctionId}`}
                      className="btn btn-secondary w-full text-center text-sm"
                    >
                      경매 보기
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ★ Phase 9-3: My Reservations List (Brand only) */}
        {statusFilter === 'MY_RESERVATIONS' && user?.role === 'BRAND' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {!myReservations ? (
              <div className="col-span-full text-center py-12 text-slate-500">로딩 중...</div>
            ) : (myReservations as any).data?.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                예약된 슬롯이 없습니다
              </div>
            ) : (
              (myReservations as any).data?.map((reservation: any) => (
                <div
                  key={reservation.id}
                  className={cn(
                    'card overflow-hidden border-l-4',
                    reservation.isExpired ? 'border-l-slate-300' : 'border-l-orange-500'
                  )}
                >
                  <div className="p-4 sm:p-6">
                    {/* Slot Info */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                          {reservation.slotName}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600">{reservation.athleteName}</p>
                      </div>
                      <span
                        className={cn(
                          'badge text-xs',
                          reservation.type === 'AUCTION' ? 'badge-success' : 'badge-info'
                        )}
                      >
                        {reservation.type === 'AUCTION' ? '경매 낙찰' : '즉시구매'}
                      </span>
                    </div>

                    {/* Event */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mb-3">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{reservation.eventName}</span>
                    </div>

                    {/* Price */}
                    <div className="mb-3 sm:mb-4">
                      <p className="text-xs text-slate-500">계약 금액</p>
                      <p className="text-lg font-bold text-slate-900">{formatCurrency(reservation.price)}</p>
                    </div>

                    {/* Remaining Time */}
                    <div
                      className={cn(
                        'p-2 rounded-lg mb-3 sm:mb-4 flex items-center justify-between',
                        reservation.isExpired
                          ? 'bg-slate-100'
                          : reservation.remainingSeconds < 3600
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-amber-50'
                      )}
                    >
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        서명 대기
                      </span>
                      <span
                        className={cn(
                          'font-medium text-sm',
                          reservation.isExpired
                            ? 'text-slate-500'
                            : reservation.remainingSeconds < 3600
                            ? 'text-red-600'
                            : 'text-amber-700'
                        )}
                      >
                        {reservation.isExpired ? '만료됨' : formatRemainingSeconds(reservation.remainingSeconds)}
                      </span>
                    </div>

                    {/* Action */}
                    <Link
                      to={`/brand/contracts/${reservation.id}`}
                      className="btn btn-secondary w-full text-center text-sm"
                    >
                      계약 보기
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Direct Buy Slots List */}
        {statusFilter === 'DIRECT_BUY' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {!directBuySlots ? (
              <div className="col-span-full text-center py-12 text-slate-500">로딩 중...</div>
            ) : ((directBuySlots as any).data?.instances || []).filter(
                (slot: any) => slot.enableDirectBuy && slot.directBuyPrice
              ).length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                즉시구매 가능한 슬롯이 없습니다
              </div>
            ) : (
              ((directBuySlots as any).data?.instances || [])
                .filter((slot: any) => slot.enableDirectBuy && slot.directBuyPrice)
                .map((slot: any) => (
                  <div key={slot.id} className="card overflow-hidden border-l-4 border-l-blue-500">
                    <div className="p-4 sm:p-6">
                      {/* Slot Info */}
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {slot.slotTemplate?.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600">
                            {getBodyPartLabel(slot.slotTemplate?.bodyPart)}
                          </p>
                        </div>
                        <span className="badge badge-info text-xs flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          즉시구매
                        </span>
                      </div>

                      {/* Athlete & Event */}
                      <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{slot.athlete?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{slot.event?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          {formatDate(slot.event?.dateStart)}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-3 sm:mb-4">
                        <p className="text-xs sm:text-sm text-slate-600">즉시구매가</p>
                        <p className="text-lg sm:text-xl font-bold text-blue-600">
                          {formatCurrency(Number(slot.directBuyPrice))}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {user?.role === 'BRAND' && (
                          <button
                            onClick={() => {
                              setSelectedSlotForBuyNow(slot);
                              setShowBuyNowModal(true);
                              setBuyNowError(null);
                            }}
                            className="btn btn-primary flex-1 text-sm flex items-center justify-center gap-1"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            즉시구매
                          </button>
                        )}
                        <Link
                          to={`/slots/${slot.id}`}
                          className={cn(
                            'btn btn-secondary text-center block text-sm',
                            user?.role === 'BRAND' ? 'flex-1' : 'w-full'
                          )}
                        >
                          상세 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Bid Modal */}
        {selectedAuction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">입찰하기</h2>

              <div className="mb-4">
                <p className="font-medium text-slate-900">{selectedAuction.slotInstance?.slotTemplate?.name}</p>
                <p className="text-sm text-slate-600">
                  {selectedAuction.slotInstance?.athlete?.name} ·{' '}
                  {selectedAuction.slotInstance?.event?.name}
                </p>
              </div>

              <div className="mb-4 p-3 bg-slate-100 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">현재가</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(selectedAuction.currentPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">최소 증분</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(selectedAuction.minBidIncrement)}
                  </span>
                </div>
              </div>

              {bidError && (
                <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                  <AlertCircle className="w-4 h-4" />
                  {bidError}
                </div>
              )}

              <div className="mb-4">
                <label className="label">최대 입찰가</label>
                <input
                  type="number"
                  className="input"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="입찰 금액을 입력하세요"
                />
                <p className="text-xs text-slate-500 mt-1">
                  프록시 입찰: 다른 입찰자가 있으면 최소 증분씩 자동으로 경쟁합니다
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedAuction(null);
                    setBidError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={handleBid}
                  disabled={placeBidMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {placeBidMutation.isPending ? '처리 중...' : '입찰하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Buy Now Modal */}
        {showBuyNowModal && selectedSlotForBuyNow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                즉시구매 확인
              </h2>

              <div className="mb-4">
                <p className="font-medium text-slate-900">{selectedSlotForBuyNow.slotTemplate?.name}</p>
                <p className="text-sm text-slate-600">
                  {selectedSlotForBuyNow.athlete?.name} · {selectedSlotForBuyNow.event?.name}
                </p>
              </div>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">즉시구매가</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(Number(selectedSlotForBuyNow.directBuyPrice))}
                  </span>
                </div>
              </div>

              <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-sm text-amber-800">
                  <strong>안내:</strong> 구매 시 계약이 생성되며, 선수의 서명 후 결제가 진행됩니다.
                  잔액이 충분한지 확인해주세요.
                </p>
              </div>

              {buyNowError && (
                <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                  <AlertCircle className="w-4 h-4" />
                  {buyNowError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBuyNowModal(false);
                    setSelectedSlotForBuyNow(null);
                    setBuyNowError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={() => buyNowMutation.mutate(selectedSlotForBuyNow.id)}
                  disabled={buyNowMutation.isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-1"
                >
                  {buyNowMutation.isPending ? (
                    '처리 중...'
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      즉시구매
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

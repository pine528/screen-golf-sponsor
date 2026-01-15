import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, User, Calendar, Gavel, AlertCircle } from 'lucide-react';
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

export function Auctions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('LIVE');
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);

  const { data: auctions, isLoading } = useQuery({
    queryKey: ['auctions', statusFilter],
    queryFn: () => api.getAuctions({ status: statusFilter }),
    refetchInterval: statusFilter === 'LIVE' ? 5000 : false,
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
          {['LIVE', 'SCHEDULED', 'ENDED', 'UNSOLD'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                statusFilter === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {status === 'LIVE' && '진행 중'}
              {status === 'SCHEDULED' && '예정'}
              {status === 'ENDED' && '종료'}
              {status === 'UNSOLD' && '유찰'}
            </button>
          ))}
        </div>

        {/* Auction List */}
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
      </div>
    </Layout>
  );
}

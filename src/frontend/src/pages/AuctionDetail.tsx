import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  User,
  Calendar,
  Gavel,
  AlertCircle,
  ArrowLeft,
  Info,
  TrendingUp,
  Shield,
  CheckCircle,
  XCircle,
  Timer,
  DollarSign,
  MapPin,
  Ruler,
  FileText,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useAuctionSocket } from '../hooks/useSocket';
import { api } from '../services/api';
import {
  formatCurrency,
  formatTimeRemaining,
  formatDate,
  formatDateTime,
  getBodyPartLabel,
  cn,
} from '../utils';

export function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [newBidAlert, setNewBidAlert] = useState<string | null>(null);

  // Real-time socket connection
  const handleBidPlaced = useCallback((socketData: { brandName: string; currentPrice: number }) => {
    queryClient.invalidateQueries({ queryKey: ['auction', id] });
    setNewBidAlert(`${socketData.brandName}님이 ${formatCurrency(socketData.currentPrice)}에 입찰했습니다!`);
    setTimeout(() => setNewBidAlert(null), 3000);
  }, [id, queryClient]);

  const handleAuctionExtended = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['auction', id] });
  }, [id, queryClient]);

  const handleAuctionStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['auction', id] });
  }, [id, queryClient]);

  const { isConnected, viewerCount } = useAuctionSocket(id, {
    onBidPlaced: handleBidPlaced,
    onAuctionExtended: handleAuctionExtended,
    onAuctionStatus: handleAuctionStatus,
  });

  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', id],
    queryFn: () => api.getAuction(id!),
    enabled: !!id,
    refetchInterval: (query): number | false => {
      const auctionData = query.state.data?.data;
      return auctionData?.status === 'LIVE' ? 3000 : false;
    },
  });

  const placeBidMutation = useMutation({
    mutationFn: ({ auctionId, maxBid }: { auctionId: string; maxBid: number }) =>
      api.placeBid(auctionId, maxBid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      setShowBidModal(false);
      setBidAmount('');
      setBidError(null);
    },
    onError: (error: any) => {
      setBidError(error.response?.data?.error?.message || '입찰에 실패했습니다');
    },
  });

  const handleBid = () => {
    if (!bidAmount) return;

    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setBidError('유효한 금액을 입력하세요');
      return;
    }

    placeBidMutation.mutate({ auctionId: id!, maxBid: amount });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">경매 정보를 불러오는 중...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!auction?.data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-slate-600 mb-4">경매를 찾을 수 없습니다</p>
          <Link to="/auctions" className="btn btn-primary">
            경매 목록으로
          </Link>
        </div>
      </Layout>
    );
  }

  const auctionData = auction.data;
  const slot = auctionData.slotInstance;
  const template = slot?.slotTemplate;
  const athlete = slot?.athlete;
  const event = slot?.event;
  const bids = auctionData.bids || [];

  const getStatusInfo = () => {
    switch (auctionData.status) {
      case 'LIVE':
        return { label: '진행 중', color: 'bg-emerald-500', icon: Timer };
      case 'SCHEDULED':
        return { label: '예정', color: 'bg-blue-500', icon: Calendar };
      case 'ENDED':
        return { label: '종료', color: 'bg-slate-500', icon: CheckCircle };
      case 'UNSOLD':
        return { label: '유찰', color: 'bg-amber-500', icon: XCircle };
      case 'CANCELLED':
        return { label: '취소됨', color: 'bg-red-500', icon: XCircle };
      default:
        return { label: auctionData.status, color: 'bg-slate-500', icon: Info };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Real-time Bid Alert */}
        {newBidAlert && (
          <div className="fixed top-4 right-4 z-50 animate-pulse">
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              <span className="font-medium">{newBidAlert}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">뒤로 가기</span>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {template?.name}
              </h1>
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-white text-xs font-medium flex items-center gap-1',
                  statusInfo.color
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </span>
              {/* Real-time indicators */}
              <div className="flex items-center gap-2 ml-auto">
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1',
                  isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isConnected ? '실시간' : '연결 중...'}
                </span>
                {auctionData.status === 'LIVE' && viewerCount > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {viewerCount}명 시청
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">
              {athlete?.name} · {event?.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price & Timer Card */}
            <div className="card p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">현재가</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                    {formatCurrency(auctionData.currentPrice)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    시작가: {formatCurrency(slot?.reservePrice || 0)}
                  </p>
                </div>
                <div className="text-right">
                  {auctionData.status === 'LIVE' ? (
                    <>
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">남은 시간</p>
                      <p className="text-2xl sm:text-3xl font-bold text-red-600 flex items-center justify-end gap-2">
                        <Clock className="w-6 h-6 sm:w-7 sm:h-7" />
                        {formatTimeRemaining(auctionData.endAt)}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        마감: {formatDateTime(auctionData.endAt)}
                      </p>
                    </>
                  ) : auctionData.status === 'SCHEDULED' ? (
                    <>
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">시작까지</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-600 flex items-center justify-end gap-2">
                        <Clock className="w-6 h-6 sm:w-7 sm:h-7" />
                        {formatTimeRemaining(auctionData.startAt)}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        시작: {formatDateTime(auctionData.startAt)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">종료일</p>
                      <p className="text-lg sm:text-xl font-semibold text-slate-700">
                        {formatDateTime(auctionData.endAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Bid Button */}
              {user?.role === 'BRAND' && auctionData.status === 'LIVE' && (
                <button
                  onClick={() => {
                    setBidAmount(String(auctionData.currentPrice + auctionData.minBidIncrement));
                    setBidError(null);
                    setShowBidModal(true);
                  }}
                  className="btn btn-primary w-full mt-6 py-3 text-lg flex items-center justify-center gap-2"
                >
                  <Gavel className="w-5 h-5" />
                  입찰하기
                </button>
              )}

              {/* Auction Info */}
              <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500">입찰 수</p>
                  <p className="text-lg font-semibold text-slate-900">{bids.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">최소 증분</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(auctionData.minBidIncrement)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">연장 횟수</p>
                  <p className="text-lg font-semibold text-slate-900">{auctionData.totalExtended || 0}회</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">배율</p>
                  <p className="text-lg font-semibold text-slate-900">{event?.multiplier || 1.0}x</p>
                </div>
              </div>
            </div>

            {/* Slot Specifications */}
            <div className="card p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-emerald-600" />
                슬롯 규격
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">부착 위치</p>
                  <p className="font-medium text-slate-900">{getBodyPartLabel(template?.bodyPart)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">최대 크기</p>
                  <p className="font-medium text-slate-900">
                    {template?.sizeMaxWMm} x {template?.sizeMaxHMm} mm
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">권장 크기</p>
                  <p className="font-medium text-slate-900">
                    {template?.recommendedWMm} x {template?.recommendedHMm} mm
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">최대 둘레</p>
                  <p className="font-medium text-slate-900">{template?.perimeterMaxMm} mm</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">재질 규칙</p>
                  <p className="font-medium text-slate-900">
                    {template?.materialRules === 'PRINTED_ONLY'
                      ? '인쇄만 가능'
                      : template?.materialRules === 'EMBROIDERY_OK'
                      ? '자수 가능'
                      : '제한 없음'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">필수 촬영 각도</p>
                  <p className="font-medium text-slate-900">
                    {template?.requiredAngles?.join(', ') || 'front'}
                  </p>
                </div>
              </div>
              {template?.forbiddenNotes && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium mb-1">주의사항</p>
                  <p className="text-sm text-amber-800">{template.forbiddenNotes}</p>
                </div>
              )}
            </div>

            {/* Bid History */}
            <div className="card overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  입찰 내역
                </h2>
              </div>
              {bids.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  아직 입찰이 없습니다
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
                  {bids.map((bid: any, index: number) => (
                    <div
                      key={bid.id}
                      className={cn(
                        'p-4 flex items-center justify-between',
                        index === 0 && 'bg-emerald-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                            index === 0 ? 'bg-emerald-500' : 'bg-slate-400'
                          )}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {bid.brand?.name || '익명 브랜드'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(bid.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'font-semibold',
                          index === 0 ? 'text-emerald-600' : 'text-slate-700'
                        )}>
                          {formatCurrency(bid.currentProxy)}
                        </p>
                        {bid.isWinning && (
                          <span className="text-xs text-emerald-600 font-medium">
                            최고 입찰
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Athlete Info */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                선수 정보
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {athlete?.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">{athlete?.name}</p>
                  <p className="text-sm text-slate-600">{athlete?.tour}</p>
                </div>
              </div>
              {athlete?.bio && (
                <p className="text-sm text-slate-600 mb-4">{athlete.bio}</p>
              )}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'badge',
                    athlete?.kycStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'
                  )}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {athlete?.kycStatus === 'APPROVED' ? 'KYC 인증됨' : 'KYC 대기'}
                </span>
              </div>
            </div>

            {/* Event Info */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                이벤트 정보
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">대회명</p>
                  <p className="font-medium text-slate-900">{event?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">투어</p>
                  <p className="font-medium text-slate-900">{event?.tour}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">일정</p>
                  <p className="font-medium text-slate-900">
                    {formatDate(event?.dateStart)} ~ {formatDate(event?.dateEnd)}
                  </p>
                </div>
                {event?.venue && (
                  <div>
                    <p className="text-xs text-slate-500">장소</p>
                    <p className="font-medium text-slate-900 flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {event.venue}
                    </p>
                  </div>
                )}
                {event?.broadcastEpisode && (
                  <div>
                    <p className="text-xs text-slate-500">방송 회차</p>
                    <p className="font-medium text-slate-900">{event.broadcastEpisode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                관련 링크
              </h3>
              <div className="space-y-2">
                {/* 경매 종료 후 계약 보러가기 버튼 */}
                {auctionData.status === 'ENDED' && auctionData.contract?.id && (
                  <Link
                    to={`/contracts?highlight=${auctionData.contract.id}`}
                    className="btn btn-primary w-full text-sm flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    계약 보러가기
                  </Link>
                )}
                <Link
                  to="/auctions"
                  className="btn btn-secondary w-full text-sm"
                >
                  다른 경매 보기
                </Link>
                <Link
                  to="/inventory"
                  className="btn btn-secondary w-full text-sm"
                >
                  슬롯 인벤토리
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bid Modal */}
        {showBidModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <div className="bg-white rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md sm:mx-4 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Gavel className="w-6 h-6 text-emerald-600" />
                입찰하기
              </h2>

              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{template?.name}</p>
                <p className="text-sm text-slate-600">
                  {athlete?.name} · {event?.name}
                </p>
              </div>

              <div className="mb-4 p-4 bg-emerald-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">현재가</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(auctionData.currentPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">최소 증분</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(auctionData.minBidIncrement)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">최소 입찰가</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(auctionData.currentPrice + auctionData.minBidIncrement)}
                  </span>
                </div>
              </div>

              {bidError && (
                <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {bidError}
                </div>
              )}

              <div className="mb-6">
                <label className="label">최대 입찰가</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    className="input pl-10"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="입찰 금액을 입력하세요"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  프록시 입찰: 다른 입찰자가 있으면 최대 입찰가까지 자동으로 경쟁합니다
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBidModal(false);
                    setBidError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={handleBid}
                  disabled={placeBidMutation.isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {placeBidMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Gavel className="w-4 h-4" />
                      입찰하기
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

/**
 * 공개 선수 상세 페이지 (/athletes/:id)
 *
 * docx "SPONPIK 론칭 준비 개발과업지시서" 3-9 구조:
 *   상단: 기본 프로필 + 진행 중 슬롯
 *   중단: 슬롯별 실시간 경매 현황 (좌 슬롯목록 / 우 호가창·입찰내역)
 *         - 첫 슬롯 디폴트 선택, 클릭 시 우측 즉시 변경
 *         - WebSocket으로 실시간 입찰 반영
 *   하단: 미디어 노출 / 풀퍼널 리포트 / 최근 대회 결과
 *
 * 원칙:
 *   - 모든 값 실데이터 (mock/이미지 제거)
 *   - Null/빈값 → "-"
 *   - 슬롯 0개일 때 "현재 진행 중인 슬롯이 없습니다" 안내
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Trophy, Instagram, Globe,
  Gavel, Clock, TrendingUp, AlertCircle, Users, Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuctionSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

// 빈 값 → '-' 표기 헬퍼
const dash = (v: any, suffix = ''): string => {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '-';
  return `${v}${suffix}`;
};
const dashKRW = (v: any): string => {
  if (v == null || v === '' || isNaN(Number(v))) return '-';
  return `₩${Number(v).toLocaleString()}`;
};

export default function PublicAthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['public-athlete', id],
    queryFn: () => api.getPublicAthlete(id!),
    enabled: !!id,
  });

  // ROI 대시보드 (docx 3-5)
  const { data: roiResp } = useQuery({
    queryKey: ['public-athlete-roi', id],
    queryFn: () => api.getPublicAthleteRoiDashboard(id!),
    enabled: !!id,
  });
  const roi = (roiResp?.data as any) || null;

  const athlete = resp?.data?.athlete;
  const slotInstances: any[] = (resp?.data as any)?.slotInstances || [];
  const recentEvents: any[] = (resp?.data as any)?.recentEvents || [];
  const eventResults: any[] = (resp?.data as any)?.eventResults || [];

  // 슬롯 동적 생성 + 첫 슬롯 디폴트 선택 (3-2)
  // OPEN/IN_AUCTION 우선, 그 다음 SOLD/CLOSED
  const orderedSlots = useMemo(() => {
    return [...slotInstances].sort((a, b) => {
      const order = ['IN_AUCTION', 'OPEN', 'RESERVED', 'SOLD', 'CLOSED'];
      const ai = order.indexOf(a.status);
      const bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [slotInstances]);

  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);

  // 슬롯 로드되면 첫 슬롯 자동 선택
  useEffect(() => {
    if (orderedSlots.length > 0 && !selectedSlotId) {
      setSelectedSlotId(orderedSlots[0].id);
    }
  }, [orderedSlots, selectedSlotId]);

  const selectedSlot = orderedSlots.find((s) => s.id === selectedSlotId) || orderedSlots[0];
  const auction = selectedSlot?.auction;

  // WebSocket 실시간 (3-3)
  useAuctionSocket(auction?.id, {
    onBidPlaced: () => {
      queryClient.invalidateQueries({ queryKey: ['public-athlete', id] });
    },
    onAuctionExtended: () => queryClient.invalidateQueries({ queryKey: ['public-athlete', id] }),
    onAuctionStatus: () => queryClient.invalidateQueries({ queryKey: ['public-athlete', id] }),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">로딩 중...</div>;
  if (error || !athlete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <div className="text-base font-semibold text-slate-700 mb-1">선수를 찾을 수 없습니다</div>
        <Link to="/athletes" className="text-sm text-emerald-600 hover:underline mt-3">선수 목록으로</Link>
      </div>
    );
  }

  const social = (athlete.socialLinks || {}) as Record<string, string>;
  const sponsors = (athlete.primarySponsors || []) as any[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 상단: Hero 프로필 (실데이터) */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
          <Link to="/athletes" className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">
            <ArrowLeft className="w-3 h-3" /> 선수 목록
          </Link>
        </div>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-12 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6 items-start">
          {/* 프로필 사진 */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden bg-white/20 backdrop-blur border-4 border-white/40 shadow-2xl mx-auto sm:mx-0">
            {athlete.profileImageUrl ? (
              <img src={athlete.profileImageUrl} alt={athlete.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl font-extrabold">{athlete.name.charAt(0)}</div>
            )}
          </div>
          {/* 기본 정보 (실데이터, 없으면 -) */}
          <div className="text-center sm:text-left">
            <div className="inline-flex flex-wrap items-center gap-1 mb-2 justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full">
                <Trophy className="w-3 h-3" /> {dash(athlete.tour)}
              </span>
              {athlete.sportType && (
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full">
                  🏅 {athlete.sportType === 'GOLF' ? '골프' : athlete.sportType === 'SCREEN_GOLF' ? '스크린골프' : athlete.sportType}
                </span>
              )}
              {athlete.affiliation && (
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full">
                  🤝 {athlete.affiliation}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">{athlete.name}</h1>
            {athlete.realName && athlete.realName !== athlete.name && (
              <div className="text-sm opacity-90 mb-2">본명: {athlete.realName}</div>
            )}
            {/* SPONPIK 4. 권장 데이터: 신장 · 지역 · 데뷔연도 (구조화 필드) */}
            {(athlete.height || athlete.region || athlete.debutYear) && (
              <div className="text-sm opacity-95 mb-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 justify-center sm:justify-start">
                {athlete.height && (
                  <span className="inline-flex items-center gap-1">📏 {athlete.height}cm</span>
                )}
                {athlete.region && (
                  <>
                    {athlete.height && <span className="opacity-50">·</span>}
                    <span className="inline-flex items-center gap-1">📍 {athlete.region}</span>
                  </>
                )}
                {athlete.debutYear && (
                  <>
                    {(athlete.height || athlete.region) && <span className="opacity-50">·</span>}
                    <span className="inline-flex items-center gap-1">🎯 {athlete.debutYear}년 데뷔</span>
                  </>
                )}
              </div>
            )}
            <p className="text-sm sm:text-base opacity-95 leading-relaxed max-w-2xl mb-4">
              {dash(athlete.bio)}
            </p>

            {/* 소셜 링크 */}
            {(social.instagram || social.youtube || social.website) && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {social.instagram && (
                  <a href={social.instagram.startsWith('http') ? social.instagram : `https://instagram.com/${social.instagram}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold">
                    <Instagram className="w-3.5 h-3.5" /> Instagram
                  </a>
                )}
                {social.youtube && (
                  <a href={social.youtube} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold">
                    🎥 YouTube
                  </a>
                )}
                {social.website && (
                  <a href={social.website} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold">
                    <Globe className="w-3.5 h-3.5" /> 웹사이트
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 중단: 슬롯별 실시간 경매 현황 (3-2 + 3-3 + 3-4) */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <h2 className="text-xl font-extrabold text-slate-900 mb-4 inline-flex items-center gap-2">
          <Gavel className="w-5 h-5 text-emerald-500" />
          진행 중인 광고 슬롯
          {orderedSlots.length > 0 && (
            <span className="text-sm font-semibold text-slate-500">({orderedSlots.length}개)</span>
          )}
        </h2>

        {orderedSlots.length === 0 ? (
          /* 슬롯 0개 케이스 (3-2 예외 처리) */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-900 mb-1">현재 진행 중인 슬롯이 없습니다</h3>
            <p className="text-sm text-slate-500">{athlete.name} 선수의 슬롯이 등록되면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* 좌측: 슬롯 목록 (동적 생성, 클릭 변경) */}
            <div className="space-y-2">
              {orderedSlots.map((s, i) => (
                <SlotCard
                  key={s.id}
                  slot={s}
                  selected={s.id === selectedSlotId}
                  index={i + 1}
                  onClick={() => setSelectedSlotId(s.id)}
                />
              ))}
            </div>

            {/* 우측: 호가창 + 입찰 내역 (선택 슬롯 기준 즉시 갱신) */}
            <div className="space-y-4">
              {selectedSlot && (
                <SlotAuctionPanel
                  slot={selectedSlot}
                  athleteName={athlete.name}
                  isAuthenticated={isAuthenticated}
                  userRole={user?.role}
                  onLoginRedirect={() => navigate('/login')}
                  onPlaced={() => queryClient.invalidateQueries({ queryKey: ['public-athlete', id] })}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* ROI 대시보드 풀 섹션 (docx 3-5: 5카테고리 13지표) */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> ROI 대시보드
          </h2>
          {roi?.meta && (
            <span className="text-[10px] text-slate-400">
              수집률 {roi.meta.collectionProgress.collected}/{roi.meta.collectionProgress.total} 지표
            </span>
          )}
        </div>
        <RoiDashboard roi={roi} />
      </section>

      {/* 하단: 최근 경기 / 메인 스폰서 */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 슬롯 요약 (간소화) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Gavel className="w-4 h-4 text-emerald-500" /> 슬롯 현황
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="전체 슬롯" value={dash(orderedSlots.length)} />
            <Stat label="진행 중" value={String(orderedSlots.filter((s) => s.status === 'OPEN' || s.status === 'IN_AUCTION').length)} />
            <Stat label="낙찰" value={String(orderedSlots.filter((s) => s.status === 'SOLD').length)} />
            <Stat label="가입일" value={athlete.createdAt ? new Date(athlete.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }) : '-'} />
          </div>
        </div>

        {/* 최근 참가 경기 (3-9 하단) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" /> 최근 참가 대회
          </h2>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">최근 대회 정보가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{e.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {e.tour} · {e.dateStart ? new Date(e.dateStart).toLocaleDateString('ko-KR') : '-'}
                      {e.venue && ` · ${e.venue}`}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${
                    e.status === 'LIVE' ? 'bg-rose-100 text-rose-700'
                    : e.status === 'UPCOMING' ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                  }`}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 경기결과 / 분석 (docx 3-6, 연도별 그룹핑 + 최신순) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-slate-900 inline-flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-500" /> 경기결과 / 분석
            </h2>
            {eventResults.length > 0 && (
              <span className="text-[10px] text-slate-400">
                업데이트: {new Date(eventResults[0].sourceUpdatedAt).toLocaleDateString('ko-KR')}
              </span>
            )}
          </div>

          {eventResults.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg">
              📡 최신 경기 정보 준비 중
            </div>
          ) : (
            <EventResultsByYear results={eventResults} />
          )}
        </div>

        {/* 메인 스폰서 */}
        {sponsors.length > 0 && (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-base font-extrabold text-slate-900 mb-3">🏆 메인 스폰서</h2>
            <div className="flex flex-wrap gap-2">
              {sponsors.map((s: any, i: number) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-semibold">
                  {typeof s === 'string' ? s : s.name || s.brand || ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** 좌측 슬롯 카드 — 클릭 시 우측 호가창 변경 */
function SlotCard({ slot, selected, index, onClick }: { slot: any; selected: boolean; index: number; onClick: () => void }) {
  const auction = slot.auction;
  const isLive = auction?.status === 'LIVE';
  const isOpen = slot.status === 'OPEN' || slot.status === 'IN_AUCTION';
  const tpl = slot.slotTemplate || {};

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-emerald-500 bg-emerald-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-emerald-300'
      } ${!isOpen ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-slate-400">#{index}</span>
        {isLive && <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{slot.status}</span>
      </div>
      <div className="text-sm font-extrabold text-slate-900">{dash(tpl.name || tpl.code)}</div>
      <div className="text-[10px] text-slate-500 mb-2">{dash(tpl.bodyPart)}{tpl.grade && ` · ${tpl.grade}등급`}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">현재가</span>
        <span className="font-bold text-emerald-600">{dashKRW(auction?.currentPrice)}</span>
      </div>
    </button>
  );
}

/** 우측 호가창 + 입찰 내역 + 입찰 영역 (3-3 + 3-4) */
function SlotAuctionPanel({ slot, athleteName, isAuthenticated, userRole, onLoginRedirect, onPlaced }: any) {
  const auction = slot.auction;
  const tpl = slot.slotTemplate || {};

  const placeBidMut = useMutation({
    mutationFn: ({ amount }: { amount: number }) => api.placeBid(auction.id, amount),
    onSuccess: () => {
      onPlaced?.();
      setBidError('');
    },
    onError: (e: any) => {
      setBidError(e?.response?.data?.error?.message || '입찰 실패');
    },
  });

  const [customBid, setCustomBid] = useState('');
  const [bidError, setBidError] = useState('');

  const currentPrice = auction?.currentPrice || 0;
  const minIncrement = auction?.minBidIncrement || 10000;
  const minNextBid = currentPrice + minIncrement;

  // 카운트다운
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remainingMs = auction?.endAt ? new Date(auction.endAt).getTime() - now : null;
  const isEnded = remainingMs != null && remainingMs <= 0;
  const remainingText = remainingMs == null
    ? '-'
    : isEnded
      ? '경매 종료'
      : formatRemaining(remainingMs);

  const handleQuickBid = (delta: number) => {
    if (!isAuthenticated) return onLoginRedirect();
    if (userRole !== 'BRAND') {
      setBidError('입찰은 브랜드 계정만 가능합니다.');
      return;
    }
    setBidError('');
    placeBidMut.mutate({ amount: currentPrice + delta });
  };

  const handleCustomBid = () => {
    const amt = Number(customBid.replace(/,/g, ''));
    if (!isAuthenticated) return onLoginRedirect();
    if (userRole !== 'BRAND') return setBidError('입찰은 브랜드 계정만 가능합니다.');
    if (isNaN(amt) || amt < minNextBid) return setBidError(`최소 ${dashKRW(minNextBid)} 이상 입력해주세요.`);
    setBidError('');
    placeBidMut.mutate({ amount: amt });
  };

  const bids = auction?.bids || [];

  return (
    <>
      {/* 호가창 카드 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">{athleteName} · {dash(tpl.name || tpl.code)}</h3>
            <div className="text-[10px] text-slate-400">{dash(tpl.bodyPart)}{tpl.grade && ` · ${tpl.grade}등급`}</div>
          </div>
          {auction?.status === 'LIVE' && <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-1 rounded animate-pulse">● LIVE</span>}
        </div>

        {!auction ? (
          /* 경매 미생성 슬롯 */
          <div className="text-center py-8 bg-slate-50 rounded-xl">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm text-slate-500">아직 경매가 시작되지 않은 슬롯입니다.</div>
          </div>
        ) : (
          <>
            {/* 현재가 + 카운트다운 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-xl p-3">
                <div className="text-[10px] font-bold text-emerald-700 mb-1">현재가</div>
                <div className="text-2xl font-extrabold text-emerald-600">{dashKRW(currentPrice)}</div>
              </div>
              <div className={`rounded-xl p-3 ${isEnded ? 'bg-slate-100' : remainingMs && remainingMs < 60000 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                <div className="text-[10px] font-bold text-slate-700 mb-1 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 남은 시간
                </div>
                <div className={`text-xl font-extrabold tabular-nums ${isEnded ? 'text-slate-400' : remainingMs && remainingMs < 60000 ? 'text-rose-600' : 'text-slate-900'}`}>{remainingText}</div>
              </div>
            </div>

            {/* 메타 정보 */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
              <div className="bg-slate-50 rounded p-2">
                <div className="text-[9px] text-slate-500">입찰 건수</div>
                <div className="font-bold">{dash(bids.length, '건')}</div>
              </div>
              <div className="bg-slate-50 rounded p-2">
                <div className="text-[9px] text-slate-500">최소 단위</div>
                <div className="font-bold">{dashKRW(minIncrement)}</div>
              </div>
              <div className="bg-slate-50 rounded p-2">
                <div className="text-[9px] text-slate-500">상태</div>
                <div className="font-bold text-[11px]">{dash(auction.status)}</div>
              </div>
            </div>

            {/* SPONPIK 3-3: 호가 리스트 (단계별 가격대) + 다음 5단계 + 총합 */}
            <BidTierLadder
              currentPrice={currentPrice}
              minIncrement={minIncrement}
              onTierClick={(tierAmt) => {
                if (!isAuthenticated) return onLoginRedirect();
                if (userRole !== 'BRAND') {
                  setBidError('입찰은 브랜드 계정만 가능합니다.');
                  return;
                }
                setBidError('');
                placeBidMut.mutate({ amount: tierAmt });
              }}
              disabled={placeBidMut.isPending || auction.status !== 'LIVE' || isEnded}
            />

            {/* 입찰 영역 */}
            {auction.status === 'LIVE' && !isEnded && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[500000, 1000000, 5000000].map((delta) => (
                    <button
                      key={delta}
                      onClick={() => handleQuickBid(delta)}
                      disabled={placeBidMut.isPending}
                      className="px-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                    >
                      +₩{(delta / 10000).toLocaleString()}만
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customBid}
                    onChange={(e) => setCustomBid(e.target.value)}
                    placeholder={`최소 ${dashKRW(minNextBid)}`}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleCustomBid}
                    disabled={placeBidMut.isPending || !customBid}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                  >
                    입찰
                  </button>
                </div>
                {bidError && (
                  <div className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded mb-2">{bidError}</div>
                )}
                {!isAuthenticated && (
                  <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded">
                    로그인 후 입찰 가능합니다.{' '}
                    <button onClick={onLoginRedirect} className="font-bold underline">로그인하기</button>
                  </div>
                )}
              </>
            )}

            {isEnded && (
              <div className="text-center py-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-500">
                ⏰ 경매가 종료되었습니다
              </div>
            )}
          </>
        )}
      </div>

      {/* 최근 입찰 내역 (3-4) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" /> 최근 입찰 내역
        </h3>
        {bids.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">아직 입찰 내역이 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {bids.slice(0, 10).map((b: any, i: number) => (
              <div key={b.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${i === 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {i === 0 && <span className="text-[9px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded">최고</span>}
                  <span className="font-semibold truncate">{maskBrand(b.brand?.name)}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{dashKRW(b.currentProxy || b.maxBid)}</div>
                  <div className="text-[9px] text-slate-400">{b.createdAt ? formatRelativeTime(b.createdAt) : '-'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * SPONPIK 3-3 — 호가 리스트 (Bid Tier Ladder)
 * 현재가 기준 다음 5단계 가격을 보여주고, 클릭으로 즉시 입찰.
 * 총합(누적 5단계 합)도 표시 — 브랜드가 "5단계까지 가면 얼마"인지 한눈에 파악.
 */
function BidTierLadder({
  currentPrice,
  minIncrement,
  onTierClick,
  disabled,
}: {
  currentPrice: number;
  minIncrement: number;
  onTierClick: (amt: number) => void;
  disabled: boolean;
}) {
  // 단계별 호가 (현재가 + 1*N, 2*N, ..., 5*N)
  const tiers = Array.from({ length: 5 }, (_, i) => ({
    step: i + 1,
    amount: currentPrice + minIncrement * (i + 1),
    delta: minIncrement * (i + 1),
  }));
  const totalSum = tiers.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-extrabold text-emerald-700 inline-flex items-center gap-1">
          📊 호가 리스트 (다음 5단계)
        </div>
        <div className="text-[10px] text-slate-500">
          5단계 누적 <span className="font-bold text-emerald-700">₩{totalSum.toLocaleString()}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {tiers.map((t) => (
          <button
            key={t.step}
            onClick={() => onTierClick(t.amount)}
            disabled={disabled}
            className="bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg px-1.5 py-2 text-center disabled:opacity-50 disabled:hover:bg-white transition-colors group"
            title={`${t.step}단계: ₩${t.amount.toLocaleString()}`}
          >
            <div className="text-[9px] font-bold text-emerald-600">{t.step}단계</div>
            <div className="text-[11px] font-extrabold text-slate-900 group-hover:text-emerald-700 truncate">
              ₩{t.amount.toLocaleString()}
            </div>
            <div className="text-[8px] text-slate-400">+₩{t.delta.toLocaleString()}</div>
          </button>
        ))}
      </div>
      <div className="text-[9px] text-slate-500 mt-1.5 text-center">
        💡 단계 버튼을 클릭하면 해당 가격으로 즉시 입찰됩니다
      </div>
    </div>
  );
}

/** ROI 대시보드 (docx 3-5: 5카테고리 13지표) */
function RoiDashboard({ roi }: { roi: any }) {
  if (!roi) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">ROI 지표 로딩 중...</div>;
  }

  const fmt = (v: any, type: 'number' | 'currency' | 'percent' | 'time' = 'number'): string => {
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '-';
    if (type === 'currency') return `₩${Math.round(Number(v)).toLocaleString()}`;
    if (type === 'percent') return `${(Number(v) * 100).toFixed(2)}%`;
    if (type === 'time') {
      const sec = Number(v);
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}분 ${s}초`;
    }
    return Number(v).toLocaleString();
  };

  const cards = [
    {
      title: '📺 미디어 노출',
      color: 'rose',
      metrics: [
        { label: '중계 노출 횟수', value: fmt(roi.mediaExposure.broadcastCount) },
        { label: '중계 노출 시간', value: fmt(roi.mediaExposure.broadcastSeconds, 'time') },
        { label: '캡처 수', value: fmt(roi.mediaExposure.captureCount) },
      ],
    },
    {
      title: '🎬 콘텐츠 반응',
      color: 'sky',
      metrics: [
        { label: '조회수', value: fmt(roi.contentEngagement.videoViews) },
        { label: '도달수', value: fmt(roi.contentEngagement.reach) },
      ],
    },
    {
      title: '🎯 랜딩 유입',
      color: 'emerald',
      metrics: [
        { label: '클릭수', value: fmt(roi.landingTraffic.clicks) },
        { label: '방문수', value: fmt(roi.landingTraffic.visits) },
      ],
    },
    {
      title: '💰 구매 / 전환 / ROI',
      color: 'amber',
      metrics: [
        { label: '전환율', value: fmt(roi.conversion.conversionRate, 'percent') },
        { label: '매출액', value: fmt(roi.conversion.revenue, 'currency') },
        { label: 'CAC', value: fmt(roi.conversion.cac, 'currency') },
        { label: 'ROAS', value: fmt(roi.conversion.roas) },
      ],
    },
    {
      title: '🏆 선수 성과 연계',
      color: 'violet',
      metrics: [
        { label: '쿠폰 사용량', value: fmt(roi.athletePerformance.couponUsage) },
        { label: '최신 순위', value: roi.athletePerformance.latestRank ? `${roi.athletePerformance.latestRank}위` : '-' },
        { label: '최신 대회', value: roi.athletePerformance.latestEventName || '-', truncate: true },
      ],
    },
  ];

  const colorMap: Record<string, string> = {
    rose: 'border-rose-200 bg-rose-50/30',
    sky: 'border-sky-200 bg-sky-50/30',
    emerald: 'border-emerald-200 bg-emerald-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    violet: 'border-violet-200 bg-violet-50/30',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.title} className={`border rounded-2xl p-4 ${colorMap[c.color]}`}>
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">{c.title}</h3>
          <div className="space-y-2">
            {c.metrics.map((m: any) => (
              <div key={m.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{m.label}</span>
                <span className={`text-sm font-extrabold ${m.value === '-' ? 'text-slate-400' : 'text-slate-900'} ${m.truncate ? 'truncate max-w-[140px]' : ''}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-3 text-[10px] text-slate-400 text-right">
        ※ "-" 표시 = 아직 수집되지 않은 지표 (데이터 들어오면 자동 반영)
      </div>
    </div>
  );
}

/** 경기결과 — 연도별 그룹핑 + 같은 연도 내 최신순 (docx 3-6) */
function EventResultsByYear({ results }: { results: any[] }) {
  // 연도별 그룹
  const byYear = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const r of results) {
      const y = new Date(r.eventDate).getFullYear();
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    }
    // 각 연도 내에서 최신순 정렬
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    }
    // 연도 내림차순
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }, [results]);

  return (
    <div className="space-y-4">
      {byYear.map(([year, items]) => (
        <div key={year}>
          <h3 className="text-sm font-extrabold text-emerald-700 mb-2 inline-flex items-center gap-1">
            {year}년 <span className="text-[10px] text-slate-400 font-normal">({items.length}개)</span>
          </h3>
          <div className="space-y-1.5">
            {items.map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 py-2 px-3 bg-slate-50 hover:bg-emerald-50/30 rounded-lg transition-colors">
                {/* 순위 */}
                <div className="w-12 text-center">
                  {r.rank != null ? (
                    <div className={`text-lg font-extrabold ${r.rank === 1 ? 'text-amber-500' : r.rank <= 3 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {r.rank}{r.rank === 1 ? '위' : r.rank <= 10 ? '위' : ''}
                    </div>
                  ) : (
                    <div className="text-base text-slate-400">-</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{r.eventName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(r.eventDate).toLocaleDateString('ko-KR')}
                    {r.category && <span className="ml-2 px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">{r.category}</span>}
                    {r.source !== 'MANUAL' && (
                      <span className="ml-2 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">{r.source}</span>
                    )}
                  </div>
                  {r.summary && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.summary}</p>
                  )}
                </div>
                {r.score && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">스코어</div>
                    <div className="text-sm font-bold text-slate-900">{r.score}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}일 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function maskBrand(name?: string): string {
  if (!name) return '익명';
  if (name.length <= 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name.slice(-1);
}

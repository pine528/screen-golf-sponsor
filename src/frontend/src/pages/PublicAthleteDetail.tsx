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
  ArrowLeft, Trophy, Instagram,
  Gavel, Clock, TrendingUp, AlertCircle, Users, Calendar, MapPin,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuctionSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import LegalNotice from '../components/LegalNotice';
import UnifiedPurchase from '../components/purchase/UnifiedPurchase';

// 빈 값 → '-' 표기 헬퍼
const dash = (v: any, suffix = ''): string => {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '-';
  return `${v}${suffix}`;
};
const dashKRW = (v: any): string => {
  if (v == null || v === '' || isNaN(Number(v))) return '-';
  return `₩${Number(v).toLocaleString()}`;
};
// SlotGrade enum → 표시용 (A_PLUS → A+)
const fmtGrade = (g?: string | null): string | null => (g ? g.replace('A_PLUS', 'A+') : null);

export default function PublicAthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  // ROI 대시보드 view mode (BASIC/EXTENDED) — RoiDashboard ↔ ScoringAndDataSources 동기화
  // docx §10 G-1/G-2 — 점수 산정 기준은 현재 보고 있는 viewMode와 반드시 일치해야 함
  const [roiViewMode, setRoiViewMode] = useState<'BASIC' | 'EXTENDED'>('BASIC');

  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['public-athlete', id],
    queryFn: () => api.getPublicAthlete(id!),
    enabled: !!id,
  });

  // 개편 Phase 2 — 기간별 슬롯 인벤토리 (통합 구매화면 데이터 소스)
  const { data: invResp, isLoading: inventoryLoading } = useQuery({
    queryKey: ['public-athlete-inventory', id],
    queryFn: () => api.getAthleteInventory(id!),
    enabled: !!id,
  });
  const inventorySlots: any[] = (invResp?.data as any)?.slots || [];

  // ROI 대시보드 (docx 3-5)
  const { data: roiResp } = useQuery({
    queryKey: ['public-athlete-roi', id],
    queryFn: () => api.getPublicAthleteRoiDashboard(id!),
    enabled: !!id,
  });
  const roi = (roiResp?.data as any) || null;

  // SPONPIK Phase 2 SNS — YouTube 채널 데이터 (콘텐츠 반응 카테고리)
  const { data: ytResp } = useQuery({
    queryKey: ['public-athlete-youtube', id],
    queryFn: () => api.getYoutubeAthleteAggregate(id!),
    enabled: !!id,
  });
  const youtube = (ytResp?.data as any) || null;

  // SPONPIK Phase 2 SNS 옵션 B — 출연 영상 (mention) 집계
  const { data: mentionsResp } = useQuery({
    queryKey: ['public-athlete-mentions', id],
    queryFn: () => api.getAthleteMentionsAggregate(id!),
    enabled: !!id,
  });
  const mentions = (mentionsResp?.data as any) || null;

  const athlete = resp?.data?.athlete;
  const sponpikTemp = (resp?.data as any)?.sponpikTemp || null;
  const slotInstances: any[] = (resp?.data as any)?.slotInstances || [];
  const recentEvents: any[] = (resp?.data as any)?.recentEvents || [];
  const eventResults: any[] = (resp?.data as any)?.eventResults || [];

  // 슬롯 동적 생성 + 첫 슬롯 디폴트 선택 (docx 3-2 + 4)
  // 1순위: 관리자 slotOrder (낮을수록 먼저)
  // 2순위: 상태 (IN_AUCTION/OPEN 우선)
  // 3순위: createdAt (등록 순)
  const orderedSlots = useMemo(() => {
    return [...slotInstances].sort((a, b) => {
      // slot_order 우선 적용 (null/undefined는 최하위)
      const ao = a.slotOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = b.slotOrder ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;

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

  // docx §13 화면명 'selectedAthlete? > ROI 대시보드' — 브라우저 페이지 타이틀 동기화
  const athleteName = (resp?.data as any)?.athlete?.name;
  useEffect(() => {
    const prev = document.title;
    document.title = athleteName
      ? `${athleteName} - 선수 상세 > ROI 대시보드 | SPONPIK`
      : '선수 상세 > ROI 대시보드 | SPONPIK';
    return () => {
      document.title = prev;
    };
  }, [athleteName]);

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
    /* pb-24: 모바일 하단 고정 구매바가 최하단 콘텐츠를 가리지 않도록 */
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0">
      {/* === A. 선수 프로필 상단 (2026-07 개편: 좌 프로필/온도 · 중 기본정보/활동/성적 · 우 지수/SNS) === */}
      <AthleteHeroV2
        athlete={athlete}
        social={social}
        sponpikTemp={sponpikTemp}
        roi={roi}
        eventResults={eventResults}
        slotsCount={orderedSlots.length}
        isAuthenticated={isAuthenticated}
        userRole={user?.role}
        onLogin={() => navigate('/login')}
      />

      {/* 중단: 슬롯별 실시간 경매 현황 (3-2 + 3-3 + 3-4) */}
      {/* 개편 Phase 2 (WF-04): 선수정보·슬롯 인벤토리·구매 패널 통합 3열 */}
      <UnifiedPurchase
        athlete={athlete}
        slotInstances={orderedSlots}
        inventorySlots={inventorySlots}
        inventoryLoading={inventoryLoading}
        isAuthenticated={isAuthenticated}
        userRole={user?.role}
        onLogin={() => navigate('/login')}
      />

      <section data-section="slots" className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <h2 className="text-xl font-extrabold text-slate-900 mb-4 inline-flex items-center gap-2">
          <Gavel className="w-5 h-5 text-emerald-500" />
          슬롯별 경매 현황
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

        {/* 권리관계 고정 안내문 (개편 LEG-04) */}
        <LegalNotice className="mt-4" />
      </section>

      {/* ROI 대시보드 풀 섹션 (docx §13 화면명: 선수 상세 > ROI 대시보드) */}
      <section data-section="roi" className="max-w-6xl mx-auto px-5 sm:px-8 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> ROI 대시보드
          </h2>
          {roi?.meta && (
            <span className="text-[10px] text-slate-400">
              수집률 {roi.meta.collectionProgress.collected}/{roi.meta.collectionProgress.total}
            </span>
          )}
        </div>
        <RoiDashboard roi={roi} youtube={youtube} mentions={mentions} viewMode={roiViewMode} onViewModeChange={setRoiViewMode} isAuthenticated={isAuthenticated} onLoginClick={() => navigate('/login')} />
      </section>

      {/* === E. 운영 현황 (docx §8 — 슬롯 / 최근 대회 / 예정 대회) === */}
      <section data-section="profile-detail" className="max-w-6xl mx-auto px-5 sm:px-8 pb-12">
        <h2 className="text-xl font-extrabold text-slate-900 mb-4 inline-flex items-center gap-2">
          <Gavel className="w-5 h-5 text-emerald-500" />
          운영 현황
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* E-1. 슬롯 현황 카드 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Gavel className="w-4 h-4 text-emerald-500" /> 슬롯 현황
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="전체 슬롯" value={dash(orderedSlots.length)} />
            <Stat label="진행 중" value={String(orderedSlots.filter((s) => s.status === 'OPEN' || s.status === 'IN_AUCTION').length)} />
            <Stat label="낙찰" value={String(orderedSlots.filter((s) => s.status === 'SOLD').length)} />
            <Stat label="계약 시작일" value={athlete.createdAt ? new Date(athlete.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }) : '-'} />
          </div>
          {/* 계약 상태 (docx E-1) */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">계약 상태</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
              ● 활동중
            </span>
          </div>
        </div>

        {/* E-2. 최근 참가 대회 카드 (docx §8 — 최근 성적 포함) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" /> 최근 참가 대회
          </h2>
          {recentEvents.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">최근 대회 정보가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {recentEvents.slice(0, 3).map((e: any) => {
                // docx §8 — 최근 성적: eventResults에서 같은 이름의 결과 찾기
                const matched = eventResults.find((r: any) =>
                  r.eventName && e.name && (
                    r.eventName === e.name ||
                    r.eventName.includes(e.name) ||
                    e.name.includes(r.eventName)
                  )
                );
                return (
                  <div key={e.id} className="py-2 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{e.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {e.tour} · {e.dateStart ? new Date(e.dateStart).toLocaleDateString('ko-KR') : '-'}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        e.status === 'LIVE' ? 'bg-rose-100 text-rose-700'
                        : e.status === 'UPCOMING' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>{e.status}</span>
                    </div>
                    {/* 최근 성적 (rank + score) */}
                    {matched ? (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        {matched.rank != null && (
                          <span className={`font-extrabold ${
                            matched.rank <= 3 ? 'text-amber-600'
                            : matched.rank <= 10 ? 'text-emerald-600'
                            : 'text-slate-700'
                          }`}>
                            🏆 {matched.rank}위
                          </span>
                        )}
                        {matched.score && <span className="text-slate-500 font-mono">{matched.score}</span>}
                      </div>
                    ) : e.status === 'COMPLETED' ? (
                      <div className="mt-1.5 text-[10px] text-slate-400">📡 성적 수집 준비 중</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* E-3. 다음 참가 예정 대회 카드 (신규 — docx E-3) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-500" /> 다음 참가 예정 대회
          </h2>
          {(() => {
            const upcoming = recentEvents.filter((e: any) => e.status === 'UPCOMING' && new Date(e.dateStart) >= new Date());
            const next = upcoming[0] || roi?.athletePerformance?.nextEvent || roi?.operations?.nextEvent;
            if (!next) {
              return <div className="text-center py-6 text-sm text-slate-400">예정된 대회가 없습니다.</div>;
            }
            return (
              <div className="space-y-2">
                <div className="text-sm font-extrabold text-slate-900">{next.name}</div>
                <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {next.dateStart ? new Date(next.dateStart).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                </div>
                {next.venue && (
                  <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {next.venue}
                  </div>
                )}
                {next.tour && (
                  <div>
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {next.tour}
                    </span>
                  </div>
                )}
                <span className="inline-block text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full mt-1">
                  📅 UPCOMING
                </span>
              </div>
            );
          })()}
        </div>
        </div>
      </section>

      {/* 경기결과 + 메인 스폰서 (별도 행) */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* === F. 경기결과 / 분석 (docx §9) === */}
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

          {/* F 추가 권장 항목 (docx §9): 최근 3개 대회 평균순위 / 시즌 누적 성적 / 추이 / 향후 일정 */}
          {roi?.matchAnalysis && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-500">최근 3개 대회 평균순위</div>
                <div className="text-lg font-extrabold text-emerald-700">
                  {roi.matchAnalysis.recentAvgRank != null ? `${roi.matchAnalysis.recentAvgRank}위` : '-'}
                </div>
              </div>
              <div className="bg-sky-50 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-500">시즌 누적 성적</div>
                <div className="text-lg font-extrabold text-sky-700">
                  {roi.matchAnalysis.seasonAvgRank != null ? `평균 ${roi.matchAnalysis.seasonAvgRank}위` : '-'}
                </div>
                <div className="text-[9px] text-slate-400">출전 {roi.matchAnalysis.seasonTotalEvents}회</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-500">시즌 최고</div>
                <div className="text-lg font-extrabold text-amber-700">
                  {roi.matchAnalysis.seasonBestRank != null ? `${roi.matchAnalysis.seasonBestRank}위` : '-'}
                </div>
                <div className="text-[9px] text-slate-400">TOP3 {roi.matchAnalysis.seasonTop3Count}회</div>
              </div>
              <div className="bg-violet-50 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-500">TOP 10 진입</div>
                <div className="text-lg font-extrabold text-violet-700">
                  {roi.matchAnalysis.seasonTop10Count}회
                </div>
                <div className="text-[9px] text-slate-400">시즌 누적</div>
              </div>
            </div>
          )}

          {/* 최근 5개 추이 (간단 라인 차트) */}
          {roi?.matchAnalysis?.recentTrend?.length >= 2 && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700">📈 최근 대회 추이</span>
                <span className="text-[9px] text-slate-400">최근 5개 (낮을수록 좋음)</span>
              </div>
              <div className="flex items-end justify-between gap-2 h-16">
                {roi.matchAnalysis.recentTrend.map((t: any, i: number) => {
                  const rank = t.rank || 99;
                  // 1위 = 100% 높이, 50위+ = 10% 높이
                  const heightPct = Math.max(10, Math.min(100, 100 - (rank - 1) * 2));
                  const color = rank <= 3 ? 'bg-amber-500' : rank <= 10 ? 'bg-emerald-500' : rank <= 30 ? 'bg-sky-500' : 'bg-slate-400';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${t.eventName} · ${t.rank}위`}>
                      <div className="text-[10px] font-bold text-slate-600">{rank}위</div>
                      <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${heightPct}%`, minHeight: '4px' }} />
                      <div className="text-[8px] text-slate-400 truncate max-w-full">
                        {t.eventDate ? new Date(t.eventDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {eventResults.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg">
              📡 최신 경기 정보 준비 중
            </div>
          ) : (
            <EventResultsByYear results={eventResults} fallbackTour={athlete.tour} />
          )}

          {/* 향후 대회 일정 (docx §9 추가 권장) */}
          {roi?.operations?.upcomingList?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-2 inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-500" /> 향후 대회 일정 ({roi.operations.upcomingList.length})
              </h3>
              <div className="space-y-1.5">
                {roi.operations.upcomingList.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-sky-50/50 hover:bg-sky-50 transition-colors text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold truncate">{e.name}</span>
                      {e.category && (
                        <span className="ml-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          {e.category}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 ml-2 whitespace-nowrap">
                      {new Date(e.dateStart).toLocaleDateString('ko-KR')}{e.venue ? ` · ${e.venue}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

      {/* G. 점수 산정 기준 / 데이터 출처 섹션은 사용자 요청으로 페이지에서 숨김.
          ScoringAndDataSources 컴포넌트는 코드에 보존 (가중치는 B-1 카드의 호버 툴팁으로 노출). */}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 * 2026-07 선수화면 개편 — 상단 3컬럼 히어로
 *  좌: 사진/온도/버튼 · 중: 기본정보/활동분야/이력·성적 · 우: 지수 레이더/SNS
 * ════════════════════════════════════════════════════════════════ */
function AthleteHeroV2({ athlete, social, sponpikTemp, roi, eventResults, slotsCount, isAuthenticated, userRole, onLogin }: any) {
  const [favDone, setFavDone] = useState(false);
  const favMut = useMutation({
    mutationFn: () => api.addFavoriteAthlete(athlete.id),
    onSuccess: () => setFavDone(true),
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message;
      if (e?.response?.status === 409) setFavDone(true);
      else alert(msg || '관심 등록에 실패했습니다. 팬 계정으로 로그인해주세요.');
    },
  });

  // 나이 계산 (birthDate "1996.07.30")
  const age = (() => {
    const m = String(athlete.birthDate || '').match(/(\d{4})[.](\d{1,2})[.](\d{1,2})/);
    if (!m) return null;
    const bd = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    let a = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) a--;
    return a;
  })();

  const act = (athlete.activityFields || {}) as Record<string, boolean>;
  const tourLabel = athlete.tour === 'KPGA' ? 'KPGA 1부 투어' : athlete.tour === 'KLPGA' ? 'KLPGA 1부 투어' : `${athlete.tour || ''} 투어`;
  const ACT_TILES = [
    { key: 'tour1', label: tourLabel },
    { key: 'gtour', label: 'GTOUR' },
    { key: 'sns', label: '인스타그램' },
    { key: 'lesson', label: '레슨' },
    { key: 'proAm', label: '프로암' },
    { key: 'youtube', label: '유튜브' },
  ];
  const hasActivityData = Object.keys(act).length > 0;

  const sns = (athlete.snsStats || {}) as Record<string, string>;
  const highlights: string[] = Array.isArray(athlete.highlights) ? athlete.highlights : [];
  // 이력이 없으면 수상/경력에서 폴백 생성
  const fallbackHighlights = highlights.length > 0 ? highlights : [
    ...(athlete.awards ? String(athlete.awards).split(' · ') : []),
    ...(athlete.career ? String(athlete.career).split(' · ') : []),
  ].filter(Boolean);

  const fmtFollower = (v?: string | null) => {
    if (!v) return null;
    const n = Number(String(v).replace(/,/g, ''));
    if (!isNaN(n) && n > 0) return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만` : n.toLocaleString();
    return v; // "1.2만", "약 6000명" 등 원문
  };
  const instaFollowers = fmtFollower(sns.instagramFollowers);

  // 레이더 5축 — ROI 축 점수 + 활동 부문(활성 타일 비율)
  const activityScore = hasActivityData ? Math.round((ACT_TILES.filter((t) => act[t.key]).length / ACT_TILES.length) * 100) : null;
  const axes = [
    { label: '미디어 지수', value: roi?.mediaExposure?.score ?? null },
    { label: '콘텐츠 지수', value: roi?.contentEngagement?.score ?? null },
    { label: '팬덤 지수', value: roi?.fandom?.score ?? null },
    { label: '선수 성과', value: roi?.athletePerformance?.score ?? null },
    { label: '활동 부문', value: activityScore },
  ];
  const overall = roi?.summary?.basicScore ?? roi?.summary?.score ?? null;

  const isNew = athlete.createdAt && Date.now() - new Date(athlete.createdAt).getTime() < 60 * 86400000;
  const results = (eventResults || []).slice(0, 10);
  const temp = sponpikTemp?.value ?? null;
  const stats = sponpikTemp?.stats || {};

  const scrollTo = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });

  const onFavorite = () => {
    if (!isAuthenticated) return onLogin();
    if (userRole && userRole !== 'FAN') { alert('관심 선수 등록은 팬 계정에서 이용할 수 있습니다.'); return; }
    if (!favDone) favMut.mutate();
  };

  return (
    <div className="bg-slate-100/70 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <Link to="/athletes" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-3 h-3" /> 선수 목록
        </Link>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_250px] gap-4 items-start">

        {/* ───────── 좌측: 사진 · 온도 · 버튼 ───────── */}
        <div className="space-y-3">
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100 shadow-lg border border-white">
            {athlete.profileImageUrl ? (
              <img src={athlete.profileImageUrl} alt={athlete.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl font-extrabold text-emerald-300">{athlete.name.charAt(0)}</div>
            )}
            {athlete.tour && (
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-white/95 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                <Trophy className="w-3 h-3" /> {athlete.tour}
              </span>
            )}
            {social.instagram && instaFollowers && (
              <a
                href={`https://instagram.com/${String(social.instagram).replace(/^@/, '')}`} target="_blank" rel="noreferrer"
                className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-black/55 hover:bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur"
              >
                <Instagram className="w-3 h-3" /> 팔로워 {instaFollowers}
              </a>
            )}
          </div>

          <div className="px-1 flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900">
              {athlete.name} <span className="text-sm font-bold text-slate-500">프로</span>
            </h1>
            {isNew && (
              <span className="text-[9px] font-extrabold text-white bg-rose-500 px-1.5 py-0.5 rounded-full">NEW</span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">● 활동중</span>
          </div>

          {/* SPONPIK 온도 */}
          <div className="relative bg-white rounded-2xl border border-slate-200 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-800 inline-flex items-center gap-1">
                SPONPIK 온도 <span className="text-slate-300" title="관심 등록·투표·커뮤니티·구매 활동 기반 인기척도 (기본 30℃ ~ 최대 100℃)">ⓘ</span>
              </span>
              <span className="text-[9px] text-slate-400">팬심·반응 기반 인기척도</span>
            </div>
            <div className={isAuthenticated ? '' : 'blur-[6px] select-none pointer-events-none'}>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-extrabold text-emerald-600 leading-none">{temp != null ? temp : '--'}</span>
                <span className="text-lg font-extrabold text-emerald-500">℃</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 transition-all"
                  style={{ width: `${Math.min(100, temp ?? 0)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <div className="text-[9px] text-slate-500">팬</div>
                  <div className="text-xs font-extrabold text-slate-800">{(stats.fans ?? 0).toLocaleString()}명</div>
                </div>
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <div className="text-[9px] text-slate-500">VOTE 등록</div>
                  <div className="text-xs font-extrabold text-slate-800">{(stats.votesCreated ?? 0).toLocaleString()}건</div>
                </div>
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <div className="text-[9px] text-slate-500">실제 투표</div>
                  <div className="text-xs font-extrabold text-slate-800">{(stats.voteParticipants ?? 0).toLocaleString()}회</div>
                </div>
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <div className="text-[9px] text-slate-500">커뮤니티 지수</div>
                  <div className="text-xs font-extrabold text-slate-800">{(stats.community ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
            {!isAuthenticated && (
              <div className="absolute inset-0 top-8 flex flex-col items-center justify-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-full bg-slate-800/85 text-white flex items-center justify-center text-sm">🔒</div>
                <div className="text-[11px] font-bold text-slate-600">로그인 시 보실 수 있습니다</div>
              </div>
            )}
          </div>

          {/* 버튼 3종 */}
          <button
            onClick={() => alert('선수 커뮤니티는 오픈 준비 중입니다.')}
            className="w-full h-11 rounded-xl border-2 border-emerald-500 text-emerald-600 text-sm font-extrabold hover:bg-emerald-50 transition-colors inline-flex items-center justify-center gap-1"
          >
            선수커뮤니티 바로가기 <span className="text-[9px] font-bold text-emerald-400">(준비중)</span>
          </button>
          <button
            onClick={onFavorite}
            disabled={favMut.isPending}
            className={`w-full h-11 rounded-xl text-sm font-extrabold transition-colors inline-flex items-center justify-center gap-1.5 ${
              favDone
                ? 'bg-amber-100 text-amber-700 border-2 border-amber-200 cursor-default'
                : 'border-2 border-slate-300 text-slate-700 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            ★ {favDone ? '관심 선수 등록됨' : '관심 선수 등록'}
          </button>
          <button
            onClick={() => scrollTo('[data-section="slots"]')}
            className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Gavel className="w-4 h-4" /> 진행중인 스폰서십 슬롯
            {slotsCount > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{slotsCount}</span>}
          </button>
        </div>

        {/* ───────── 중앙: 기본정보 · 활동분야 · 이력/성적 ───────── */}
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-4">기본 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3.5">
              <HeroInfoRow label="이름" value={athlete.name} />
              <HeroInfoRow label="소속 협회" value={athlete.tour} />
              <HeroInfoRow label="나이" value={age != null ? `${age}세${athlete.birthDate ? ` (${athlete.birthDate})` : ''}` : athlete.birthDate || null} />
              <HeroInfoRow label="투어 자격" value={athlete.tourQualification} />
              <HeroInfoRow label="프로 입회연도" value={athlete.debutYear ? `${athlete.debutYear}년` : null} />
              <HeroInfoRow label="현재 소속" value={athlete.affiliation} />
              <HeroInfoRow label="출신지역" value={athlete.birthplace} />
              <HeroInfoRow label="거주지" value={athlete.region} />
              <HeroInfoRow label="출신학교" value={athlete.education} />
              <HeroInfoRow label="신장" value={athlete.height ? `${athlete.height}cm` : null} />
            </div>
          </div>

          {/* 현재 활동 분야 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-3.5">현재 활동 분야</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ACT_TILES.map((t) => {
                const active = !!act[t.key];
                return (
                  <div
                    key={t.key}
                    className={`rounded-xl border p-2.5 text-center transition-colors ${
                      active ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-150 bg-slate-50 opacity-70'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-800 leading-tight mb-1 break-keep">{t.label}</div>
                    <div className={`text-[9px] font-extrabold ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasActivityData ? (active ? '활동 중' : '준비 중') : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 주요 이력 및 성적 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-3.5">주요 이력 및 성적</h2>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-2">주요 이력</div>
                {fallbackHighlights.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3">등록된 이력이 없습니다.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {fallbackHighlights.slice(0, 14).map((h: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700 leading-relaxed break-keep">
                        <span className="text-emerald-500 mt-0.5">•</span> <span className="min-w-0">{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-2">주요 대회 성적</div>
                {results.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3">등록된 대회 성적이 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                          <th className="text-left py-1.5 pr-2 font-semibold whitespace-nowrap">연도</th>
                          <th className="text-left py-1.5 pr-2 font-semibold">대회명</th>
                          <th className="text-right py-1.5 pr-2 font-semibold whitespace-nowrap">성적</th>
                          <th className="text-right py-1.5 font-semibold whitespace-nowrap">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r: any) => (
                          <tr key={r.id} className="border-b border-slate-50 last:border-0">
                            <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{r.eventDate ? new Date(r.eventDate).getFullYear() : '-'}</td>
                            <td className="py-1.5 pr-2 font-semibold text-slate-800 max-w-[300px] truncate" title={r.eventName}>{r.eventName}</td>
                            <td className={`py-1.5 pr-2 text-right font-extrabold whitespace-nowrap ${r.rank != null && r.rank <= 3 ? 'text-amber-600' : 'text-slate-700'}`}>
                              {r.rank != null ? `${r.rank}위` : r.score || '-'}
                            </td>
                            <td className="py-1.5 text-right text-[10px] text-slate-400 whitespace-nowrap">{r.rank != null ? '출전' : '본선 진출'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-[9px] text-slate-400 mt-1.5">* 최근 자료 기준</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ───────── 우측: 지수 레이더 · SNS ───────── */}
        <div className="space-y-4">
          <div className="relative bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-extrabold text-slate-900">Sponpik Index &amp; Ad Impact Score</h2>
              <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">지수 기준 ⓘ</span>
            </div>
            <div className={isAuthenticated ? '' : 'blur-[7px] select-none pointer-events-none'}>
              <RadarPentagon axes={axes} overall={overall} />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-slate-400">* 최근 3개월 기준</span>
                <button
                  onClick={() => scrollTo('[data-section="roi"]') as any}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1"
                >
                  자세히 보기 →
                </button>
              </div>
            </div>
            {!isAuthenticated && (
              <div className="absolute inset-0 top-8 flex flex-col items-center justify-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-full bg-slate-800/85 text-white flex items-center justify-center text-sm">🔒</div>
                <div className="text-[11px] font-bold text-slate-600">로그인 시 보실 수 있습니다</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-3">SNS &amp; 콘텐츠 채널</h2>
            <div className="space-y-2">
              <a
                href={social.instagram ? `https://instagram.com/${String(social.instagram).replace(/^@/, '')}` : undefined}
                target="_blank" rel="noreferrer"
                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 ${social.instagram ? 'hover:border-pink-200 hover:bg-pink-50/40' : 'opacity-60 cursor-default'}`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 text-white flex items-center justify-center shrink-0">
                    <Instagram className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    인스타그램{social.instagram ? <span className="text-slate-400 font-semibold"> @{String(social.instagram).replace(/^@/, '')}</span> : null}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  {instaFollowers ? `팔로워 ${instaFollowers}` : '-'}
                </span>
              </a>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0">▶</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{sns.youtubeChannel || '유튜브'}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  {sns.youtubeSubs ? `구독자 ${fmtFollower(sns.youtubeSubs)}` : '준비 중'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroInfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="shrink-0 w-20 text-[11px] font-bold text-slate-400 pt-0.5">{label}</span>
      <span className="font-semibold text-slate-800 leading-snug">{value || '-'}</span>
    </div>
  );
}

/** 오각형 레이더 차트 (SVG, 라이브러리 無) — 미디어/콘텐츠/팬덤/선수성과/활동 */
function RadarPentagon({ axes, overall }: { axes: { label: string; value: number | null }[]; overall: number | null }) {
  const size = 260;
  const cx = size / 2, cy = size / 2 + 6, R = 86;
  const pt = (i: number, r: number) => {
    const ang = (-90 + i * 72) * (Math.PI / 180);
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const ringPath = (r: number) => axes.map((_, i) => pt(i, r).join(',')).join(' ');
  const valuePath = axes.map((a, i) => pt(i, ((a.value ?? 0) / 100) * R).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPath(R * f)} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <polygon points={valuePath} fill="rgba(16,185,129,0.18)" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, ((a.value ?? 0) / 100) * R);
        return <circle key={i} cx={x} cy={y} r={3} fill="#10b981" />;
      })}
      {/* 축 라벨 + 값 */}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 24);
        return (
          <g key={i} textAnchor="middle">
            <text x={x} y={y - 5} fontSize={10} fontWeight={700} fill="#475569">{a.label}</text>
            <text x={x} y={y + 8} fontSize={11} fontWeight={800} fill="#0f766e">{a.value != null ? a.value : '-'}</text>
          </g>
        );
      })}
      {/* 중앙 종합 점수 */}
      <circle cx={cx} cy={cy} r={30} fill="white" stroke="#a7f3d0" strokeWidth={2} />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={15} fontWeight={800} fill="#059669">
        {overall != null ? overall : '--'}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={8} fill="#94a3b8">종합 / 100</text>
    </svg>
  );
}

/** 좌측 슬롯 카드 — 클릭 시 우측 호가창 변경 */
function SlotCard({ slot, selected, index, onClick }: { slot: any; selected: boolean; index: number; onClick: () => void }) {
  const auction = slot.auction;
  const isLive = auction?.status === 'LIVE';
  const isOpen = slot.status === 'OPEN' || slot.status === 'IN_AUCTION';
  const isDirectBuy = !!slot.enableDirectBuy && slot.directBuyPrice != null;
  const isInquiry = slot.saleMode === 'INQUIRY' || (!slot.enableAuction && !slot.enableDirectBuy);
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
        {!auction && isDirectBuy && <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">바로 구매</span>}
        {!auction && isInquiry && <span className="text-[9px] font-extrabold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">협의</span>}
        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{slot.status}</span>
      </div>
      {/* docx 4: slot_name 우선, 없으면 SlotTemplate.name fallback */}
      <div className="text-sm font-extrabold text-slate-900">{dash(slot.slotName || tpl.name || tpl.code)}</div>
      <div className="text-[10px] text-slate-500 mb-2">{dash(tpl.bodyPart)}{tpl.grade && ` · ${fmtGrade(tpl.grade)}등급`}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{auction ? '현재가' : isDirectBuy ? '바로 구매가' : isInquiry ? '후원 조건' : '기준가'}</span>
        <span className={`font-bold ${auction ? 'text-emerald-600' : isInquiry ? 'text-violet-600' : 'text-sky-600'}`}>
          {isInquiry && !auction ? '협의' : dashKRW(auction?.currentPrice ?? (isDirectBuy ? slot.directBuyPrice : slot.reservePrice))}
        </span>
      </div>
    </button>
  );
}

/** 우측 호가창 + 입찰 내역 + 입찰 영역 (3-3 + 3-4) */
function SlotAuctionPanel({ slot, athleteName, isAuthenticated, userRole, onLoginRedirect, onPlaced }: any) {
  const auction = slot.auction;
  const tpl = slot.slotTemplate || {};
  const navigate = useNavigate();

  // 판매 방식: AUCTION 경매 / DIRECT 바로 구매 / INQUIRY 스폰픽 협의(카카오 상담)
  const isInquiry = slot.saleMode === 'INQUIRY' || (!slot.enableAuction && !slot.enableDirectBuy);
  const isDirectBuy = !!slot.enableDirectBuy && slot.directBuyPrice != null;
  const openInquiry = () => {
    const channelId = (import.meta.env.VITE_KAKAO_CHANNEL_ID as string) || '_xmpxknX';
    const slotLabel = `${athleteName} · ${slot.slotName || tpl.name || tpl.code}`;
    if (channelId) {
      window.open(`https://pf.kakao.com/${channelId}/chat`, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = `mailto:support@sponpik.com?subject=${encodeURIComponent(`[후원 문의] ${slotLabel}`)}`;
    }
  };
  const isSold = slot.status === 'SOLD' || slot.status === 'RESERVED';
  const [buyError, setBuyError] = useState('');
  const buyNowMut = useMutation({
    mutationFn: () => api.buySlotNow(slot.id),
    onSuccess: (res: any) => {
      onPlaced?.();
      const contractId = res?.data?.id;
      if (contractId) navigate(`/contracts/${contractId}`);
    },
    onError: (e: any) => {
      const err = e?.response?.data?.error;
      setBuyError((typeof err === 'object' ? err?.message : err) || '바로 구매에 실패했습니다');
    },
  });
  const handleBuyNow = () => {
    if (!isAuthenticated) return onLoginRedirect();
    if (userRole !== 'BRAND') { setBuyError('바로 구매는 브랜드 계정만 가능합니다.'); return; }
    if (!confirm(`${dashKRW(slot.directBuyPrice)}에 바로 구매하시겠습니까?\n구매 시 계약이 생성되며 선수 서명 후 확정됩니다.`)) return;
    setBuyError('');
    buyNowMut.mutate();
  };

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

  // docx 3-3: 입찰 사전 검증 — 마감/비활성/현재가/최소단위
  const validateBid = (amt: number): string | null => {
    if (auction?.status !== 'LIVE') return '진행 중인 경매가 아닙니다';
    if (isEnded) return '경매가 종료되었습니다';
    if (slot.isActive === false) return '비활성 상태인 슬롯입니다';
    if (isNaN(amt) || amt <= 0) return '유효한 금액을 입력해주세요';
    if (amt <= currentPrice) return `현재가(${dashKRW(currentPrice)})보다 높은 금액을 입력하세요`;
    if (amt < minNextBid) return `최소 ${dashKRW(minNextBid)} 이상 입력해주세요`;
    return null;
  };

  const handleQuickBid = (delta: number) => {
    if (!isAuthenticated) return onLoginRedirect();
    if (userRole !== 'BRAND') {
      setBidError('입찰은 브랜드 계정만 가능합니다.');
      return;
    }
    const amt = currentPrice + delta;
    const err = validateBid(amt);
    if (err) return setBidError(err);
    setBidError('');
    placeBidMut.mutate({ amount: amt });
  };

  const handleCustomBid = () => {
    const amt = Number(customBid.replace(/,/g, ''));
    if (!isAuthenticated) return onLoginRedirect();
    if (userRole !== 'BRAND') return setBidError('입찰은 브랜드 계정만 가능합니다.');
    const err = validateBid(amt);
    if (err) return setBidError(err);
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
            <h3 className="text-sm font-bold text-slate-700">{athleteName} · {dash(slot.slotName || tpl.name || tpl.code)}</h3>
            <div className="text-[10px] text-slate-400">{dash(tpl.bodyPart)}{tpl.grade && ` · ${fmtGrade(tpl.grade)}등급`}</div>
          </div>
          {auction?.status === 'LIVE' && <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-1 rounded animate-pulse">● LIVE</span>}
        </div>

        {!auction ? (
          isInquiry ? (
            /* 협의 문의 슬롯 — 가격 비공개, 스폰픽 상담으로 확정 */
            <div>
              <div className="bg-violet-50 rounded-xl p-4 mb-3">
                <div className="text-[10px] font-bold text-violet-700 mb-1">스폰픽 협의 후원</div>
                <div className="text-lg font-extrabold text-violet-700">가격 협의</div>
                <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  이 슬롯은 후원 가능 상태로만 공개되어 있습니다. 상담을 신청하시면 스폰픽이 노출 조건·기간·금액을 협의해 후원을 확정해 드립니다.
                </div>
              </div>
              <button
                onClick={openInquiry}
                className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-extrabold shadow-md transition-colors inline-flex items-center justify-center gap-1.5"
              >
                💬 스폰픽 상담 문의
              </button>
              <div className="text-[10px] text-slate-400 text-center mt-2">카카오톡 채널로 연결됩니다</div>
            </div>
          ) : isDirectBuy ? (
            /* 바로 구매 슬롯 (경매 없이 고정가 판매) */
            <div>
              <div className="bg-sky-50 rounded-xl p-4 mb-3">
                <div className="text-[10px] font-bold text-sky-700 mb-1">바로 구매가</div>
                <div className="text-2xl font-extrabold text-sky-600">{dashKRW(slot.directBuyPrice)}</div>
                <div className="text-[10px] text-slate-500 mt-1">경매 없이 바로 구매하며, 결제 후 계약이 생성됩니다.</div>
              </div>
              {isSold ? (
                <div className="text-center py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-500">
                  {slot.status === 'SOLD' ? '판매 완료된 슬롯입니다' : '구매 진행 중인 슬롯입니다'}
                </div>
              ) : (
                <>
                  <button
                    onClick={handleBuyNow}
                    disabled={buyNowMut.isPending}
                    className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-extrabold shadow-md transition-colors disabled:opacity-50"
                  >
                    {buyNowMut.isPending ? '처리 중...' : '🛒 바로 구매'}
                  </button>
                  {buyError && <div className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded mt-2">{buyError}</div>}
                  {!isAuthenticated && (
                    <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded mt-2">
                      브랜드 계정으로 로그인 후 구매할 수 있습니다.{' '}
                      <button onClick={onLoginRedirect} className="font-bold underline">로그인하기</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* 경매 미생성 + 바로 구매도 아닌 슬롯 */
            <div className="text-center py-8 bg-slate-50 rounded-xl">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">아직 판매가 시작되지 않은 슬롯입니다.</div>
            </div>
          )
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
/**
 * SPONPIK 선수 ROI 대시보드 (docx 2026-05-04 '선수 상세 페이지 수정개발')
 *
 * 계약유형별 2단 구조:
 *  - BASIC (기본형, 모든 사용자): 4개 카드 — 미디어/콘텐츠/팬덤/선수성과
 *  - EXTENDED (확장형, 중장기 계약 브랜드): + 랜딩 유입 + 구매·전환·ROI
 *
 * 가중치:
 *  - BASIC: 미디어(30) + 콘텐츠(20) + 팬덤(20) + 선수성과(30)
 *  - EXTENDED: 미디어(20) + 콘텐츠(15) + 팬덤(15) + 선수성과(20) + 랜딩(10) + 구매(20)
 *
 * 등급: A (≥80) / B (≥65) / C (≥50) / D (≥35) / E (<35)
 * 상태 배지: 공식 산정 (≥70%) / 예비 산정 (40-69%) / 산정중 (<40%)
 */
function RoiDashboard({
  roi,
  youtube,
  viewMode: viewModeProp,
  onViewModeChange,
  isAuthenticated = false,
  onLoginClick,
}: {
  roi: any;
  youtube?: any;
  mentions?: any;
  viewMode?: 'BASIC' | 'EXTENDED';
  onViewModeChange?: (m: 'BASIC' | 'EXTENDED') => void;
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
}) {
  // 부모(PublicAthleteDetail)가 viewMode 를 끌어올려 G 섹션과 공유 — controlled mode
  // props 전달 안 됐을 때만 자체 로컬 상태로 동작 (uncontrolled fallback)
  const [internalMode, setInternalMode] = useState<'BASIC' | 'EXTENDED'>('BASIC');
  const viewMode = viewModeProp ?? internalMode;
  const setViewMode = (m: 'BASIC' | 'EXTENDED') => {
    if (onViewModeChange) onViewModeChange(m);
    else setInternalMode(m);
  };
  if (!roi) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">ROI 지표 로딩 중...</div>;
  }

  const fmt = (v: any, type: 'number' | 'currency' | 'percent' | 'time' = 'number'): string => {
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '-';
    if (type === 'currency') return `₩${Math.round(Number(v)).toLocaleString()}`;
    if (type === 'percent') return `${Number(v).toFixed(2)}%`;
    if (type === 'time') {
      const sec = Number(v);
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}분 ${s}초`;
    }
    return Number(v).toLocaleString();
  };

  const sum = roi.summary || {};
  const score = viewMode === 'EXTENDED' ? sum.extendedScore : sum.basicScore;
  // docx §11 — 산정중 상태에서 보수적 처리는 backend toGrade()에서 적용되므로
  // backend 가 보낸 basicGrade/extendedGrade 를 우선 사용 (frontend 자체 매핑 금지)
  const backendGrade = viewMode === 'EXTENDED' ? sum.extendedGrade : sum.basicGrade;
  const grade = backendGrade ?? (score == null ? null
    : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E');
  const gradeColor = grade === 'A' ? 'emerald' : grade === 'B' ? 'sky' : grade === 'C' ? 'amber' : grade === 'D' ? 'orange' : grade === 'E' ? 'rose' : 'slate';
  const gradeBgs: Record<string, string> = {
    emerald: 'from-emerald-100 to-teal-50 text-emerald-700 border-emerald-300',
    sky: 'from-sky-100 to-blue-50 text-sky-700 border-sky-300',
    amber: 'from-amber-100 to-yellow-50 text-amber-700 border-amber-300',
    orange: 'from-orange-100 to-amber-50 text-orange-700 border-orange-300',
    rose: 'from-rose-100 to-pink-50 text-rose-700 border-rose-300',
    slate: 'from-slate-100 to-slate-50 text-slate-400 border-slate-200',
  };

  const statusBadgeClass = sum.statusBadge === 'OFFICIAL' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : sum.statusBadge === 'PRELIMINARY' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

  const isExtended = viewMode === 'EXTENDED';

  return (
    <div className="space-y-4">
      {/* === B. 종합 광고효과 요약 영역 === */}
      <div className={`border-2 rounded-2xl p-5 bg-gradient-to-br ${gradeBgs[gradeColor]}`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-bold opacity-70">📊 SPONPIK Ad Impact Score</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-current/10">
                {isExtended ? '확장형' : '기본형'}
              </span>
            </div>
            <div className="text-[10px] opacity-60">
              {isExtended ? '광고효과 + 유입 + 전환 종합 점수' : '미디어 · 콘텐츠 · 팬덤 · 선수성과 기준 산정'}
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-help ${statusBadgeClass}`}
            title={
              '점수 상태 매핑 (docx §11):\n' +
              '· 공식 산정: 데이터 수집률 70% 이상\n' +
              '· 예비 산정: 40~69%\n' +
              '· 산정중: 40% 미만 (등급 보수적 처리)'
            }
          >
            {sum.statusLabel || '-'}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-5xl font-black tabular-nums leading-none">
              {score != null ? score.toFixed(1) : '-'}
              {score != null && <span className="text-xl font-bold opacity-70 ml-1">/ 100</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold opacity-70 mb-0.5">등급</div>
            <div className="text-4xl font-black leading-none">{grade ?? '-'}</div>
          </div>
        </div>
        {/* B-2 보조 정보 — 최근 업데이트 + 최근 성과 2개만 (데이터 수집률/신뢰도 제거) */}
        <div className="mt-4 pt-3 border-t border-current/10 grid grid-cols-2 gap-2 text-[10px]">
          <AuxStat
            label="최근 업데이트"
            hint="점수 갱신 시각"
            value={sum.updatedAt
              ? (() => {
                  const d = new Date(sum.updatedAt);
                  const yy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  const hh = String(d.getHours()).padStart(2, '0');
                  const mi = String(d.getMinutes()).padStart(2, '0');
                  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
                })()
              : '-'}
          />
          <AuxStat
            label="최근 성과"
            hint="대회명 / 순위"
            value={sum.latestPerformance?.eventName && sum.latestPerformance?.rank
              ? `${sum.latestPerformance.eventName} / ${sum.latestPerformance.rank}위`
              : sum.latestPerformance?.rank
              ? `${sum.latestPerformance.rank}위`
              : '-'}
          />
        </div>
        {/* 뷰 토글 */}
        <div className="mt-3 flex items-center justify-end gap-1 text-[10px]">
          <span className="opacity-60">대시보드 유형:</span>
          <button
            onClick={() => setViewMode('BASIC')}
            className={`px-2 py-1 rounded font-bold ${viewMode === 'BASIC' ? 'bg-white shadow text-slate-900' : 'opacity-50'}`}
          >
            기본형
          </button>
          <button
            onClick={() => setViewMode('EXTENDED')}
            className={`px-2 py-1 rounded font-bold ${viewMode === 'EXTENDED' ? 'bg-white shadow text-slate-900' : 'opacity-50'}`}
          >
            확장형
          </button>
        </div>
      </div>

      {/* === C. 핵심 성과 카드 영역 (기본형 4종) === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {/* C-1. 미디어노출지수 — docx §6 C-1 '데이터 없을 때 상태 문구: 데이터 수집 전' */}
        <RoiCard
          title="📺 미디어노출지수"
          color="rose"
          score={roi.mediaExposure?.score}
          subtitle="방송/중계/외부노출 기준"
          purpose="선수가 실제 방송·중계·기사·하이라이트 등에서 얼마나 노출되었는지 보여주는 핵심 지표"
          emptyLabel="데이터 수집 전"
          showMetrics={isAuthenticated}
          onLoginClick={onLoginClick}
          metrics={[
            // docx §6 C-1 정확 라벨 — 횟수/수 등 단위 명시
            { label: '중계 노출 횟수', value: fmt(roi.mediaExposure?.broadcastCount) },
            { label: '중계 노출 시간', value: fmt(roi.mediaExposure?.broadcastSeconds, 'time') },
            { label: '패치/로고 노출 추정 횟수', value: fmt(roi.mediaExposure?.patchExposureEstimate) },
            { label: '기사/외부 언급 수', value: fmt(roi.mediaExposure?.articleMentions) },
            { label: '하이라이트 노출 수', value: fmt(roi.mediaExposure?.highlightCount) },
            { label: '출연 영상 (YT 자동)', value: roi.mediaExposure?.mentionVideos ? `${roi.mediaExposure.mentionVideos}건` : '-' },
          ]}
        />

        {/* C-2. 콘텐츠 반응 */}
        <RoiCard
          title="🎬 콘텐츠 반응"
          color="sky"
          score={roi.contentEngagement?.score}
          subtitle="SNS 및 콘텐츠 반응 기준"
          purpose="선수 관련 콘텐츠가 얼마나 주목받고 반응을 일으켰는지 보여줌"
          // YouTube 동기화 실패 시 docx §11 '오류: 데이터 확인 필요' 표시
          error={youtube?.syncStatus === 'FAILED' ? `YouTube 동기화 실패: ${youtube?.syncError || '알 수 없는 오류'}` : undefined}
          showMetrics={isAuthenticated}
          onLoginClick={onLoginClick}
          metrics={[
            { label: '조회수', value: fmt(roi.contentEngagement?.videoViews) },
            { label: '도달수 (구독자)', value: fmt(roi.contentEngagement?.reach) },
            { label: '좋아요', value: fmt(roi.contentEngagement?.likes) },
            { label: '댓글', value: fmt(roi.contentEngagement?.comments) },
            { label: '저장', value: fmt(roi.contentEngagement?.saves) },
            { label: '공유', value: fmt(roi.contentEngagement?.shares) },
            { label: '참여율 (ER)', value: roi.contentEngagement?.engagementRate != null ? `${roi.contentEngagement.engagementRate}%` : '-' },
          ]}
        />

        {/* C-3. 팬덤지수 */}
        <RoiCard
          title="💜 팬덤지수"
          color="violet"
          score={roi.fandom?.score}
          subtitle="팬 반응 및 참여 데이터 기준"
          purpose="선수의 팬 기반 규모와 반응성, 브랜드 친화력을 보여주는 지표"
          error={youtube?.syncStatus === 'FAILED' ? 'YouTube 동기화 실패 — 팔로워 정보 확인 필요' : undefined}
          showMetrics={isAuthenticated}
          onLoginClick={onLoginClick}
          metrics={[
            // docx §6 C-3 정확 라벨
            { label: '팔로워 수', value: fmt(roi.fandom?.followers) },
            { label: '최근 증가율', value: roi.fandom?.followerGrowthPct != null ? `${roi.fandom.followerGrowthPct}%` : '-' },
            { label: '팬 댓글/멘션 수', value: fmt(roi.fandom?.fanCommentsMentions) },
            { label: '응원/참여 이벤트 수', value: fmt(roi.fandom?.fanEvents) },
            { label: '팬 투표 참여율', value: roi.fandom?.voteParticipationRate != null ? `${roi.fandom.voteParticipationRate}%` : '-' },
            { label: 'UGC 건수', value: fmt(roi.fandom?.ugcCount) },
          ]}
        />

        {/* C-4. 선수성과 / 대회가치 */}
        <RoiCard
          title="🏆 선수성과 / 대회가치"
          color="emerald"
          score={roi.athletePerformance?.score}
          subtitle="공식 대회 기록 및 일정 기준"
          purpose="선수의 최근 경기력과 향후 대회 노출 기대치를 함께 반영"
          showMetrics={isAuthenticated}
          onLoginClick={onLoginClick}
          metrics={[
            // docx §6 C-4 정확 라벨
            { label: '최근 순위', value: roi.athletePerformance?.latestRank ? `${roi.athletePerformance.latestRank}위` : '-' },
            { label: '최근 3개 대회 평균 순위', value: roi.athletePerformance?.recentAvgRank != null ? `${roi.athletePerformance.recentAvgRank}위` : '-' },
            { label: '최근 대회명', value: roi.athletePerformance?.latestEventName || '-', truncate: true },
            { label: '다음 참가 예정 대회', value: roi.athletePerformance?.nextEvent?.name || '-', truncate: true },
            { label: '노출 기대지수', value: fmt(roi.athletePerformance?.exposureExpectation) },
          ]}
        />
      </div>

      {/* === D. 확장형 추가 카드 (중장기 계약 브랜드 전용) === */}
      {isExtended && (
        <div className="text-[11px] font-bold text-amber-600 inline-flex items-center gap-1.5 pt-1">
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">확장 전용</span>
          <span className="text-slate-500">랜딩 유입 + 구매/전환/ROI</span>
        </div>
      )}
      {isExtended && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RoiCard
            title="🎯 랜딩 유입"
            color="amber"
            score={roi.landingTraffic?.score}
            subtitle="브랜드 전용 트래킹 데이터 기준"
            purpose="노출이 실제 브랜드 페이지 방문으로 이어졌는지 보여주는 확장 지표"
            extendedBadge
            showMetrics={isAuthenticated}
            onLoginClick={onLoginClick}
            metrics={[
              // docx §6 D-1 정확 라벨
              { label: '클릭 수', value: fmt(roi.landingTraffic?.clicks) },
              { label: '방문 수', value: fmt(roi.landingTraffic?.visits) },
              { label: 'CTR', value: roi.landingTraffic?.ctr != null ? `${roi.landingTraffic.ctr}%` : '-' },
              { label: '신규 방문자 수', value: fmt(roi.landingTraffic?.newVisitors) },
              { label: '평균 체류시간', value: fmt(roi.landingTraffic?.avgDwellTime, 'time') },
            ]}
          />
          <RoiCard
            title="💰 구매 / 전환 / ROI"
            color="orange"
            score={roi.conversion?.score}
            subtitle="중장기 계약 브랜드 전용 성과지표"
            purpose="브랜드 입장에서 실제 매출성과를 보여주는 최종 퍼널 지표"
            extendedBadge
            showMetrics={isAuthenticated}
            onLoginClick={onLoginClick}
            metrics={[
              { label: '전환 수', value: fmt(roi.conversion?.conversions) },
              { label: '구매 건수', value: fmt(roi.conversion?.purchases) },
              { label: '매출액', value: fmt(roi.conversion?.revenue, 'currency') },
              { label: '쿠폰 사용량', value: fmt(roi.conversion?.couponUsage) },
              { label: 'CVR', value: roi.conversion?.cvr != null ? `${roi.conversion.cvr}%` : '-' },
              { label: 'CAC', value: fmt(roi.conversion?.cac, 'currency') },
              { label: 'ROAS', value: fmt(roi.conversion?.roas) },
            ]}
          />
        </div>
      )}
      {!isExtended && (
        <button
          onClick={() => setViewMode('EXTENDED')}
          className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 transition-colors text-left"
        >
          🔒 랜딩 유입·구매/전환/ROI 카드는 중장기 계약 브랜드 전용 — <span className="font-bold text-emerald-600">확장형 미리보기 →</span>
        </button>
      )}
    </div>
  );
}

/**
 * G. 점수 산정 기준 + 데이터 출처 (docx §10, §13)
 * - 페이지 최하단 (F 경기결과 이후)에 별도 섹션으로 배치
 * - 사용자 요청으로 페이지에서 숨김 처리됨 (underscore prefix 로 미사용 표시)
 * - 향후 다시 필요 시 export 또는 호출 부분 추가하면 즉시 복구 가능
 */
// @ts-ignore — 의도적으로 미사용 (나중 복구용 보존)
function _ScoringAndDataSources({ roi, viewMode }: { roi: any; viewMode: 'BASIC' | 'EXTENDED' }) {
  if (!roi) return null;
  const isExtended = viewMode === 'EXTENDED';
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-12">
      {/* docx §10 G. '점수 산정 기준 안내' 정확 영역명 + G-3 '데이터 출처' */}
      <h2 className="text-xl font-extrabold text-slate-900 mb-4 inline-flex items-center gap-2">
        <Trophy className="w-5 h-5 text-emerald-500" />
        점수 산정 기준
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-2">📐 {isExtended ? '확장형' : '기본형'} 점수 산정 기준</h3>
          <div className="space-y-1.5 text-[11px]">
            {(isExtended ? roi.scoringRules?.extended : roi.scoringRules?.basic)?.map((r: any) => (
              <div key={r.axis} className="flex items-center justify-between">
                <span className="text-slate-600">{r.axis}</span>
                <span className="font-bold text-slate-900">{r.weight}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            {isExtended
              ? '중장기 계약 브랜드에 한해 확장 성과지표가 제공됩니다.'
              : '대회별 기본 입찰 및 직접 구매형 스폰서십에 제공되는 기본 광고효과 지표입니다. 랜딩 유입 및 구매전환 데이터는 중장기 계약 브랜드 전용 리포트에서 제공됩니다.'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          {/* docx §10 G-3 정확 카드명 '데이터 출처 카드' */}
          <h3 className="text-sm font-extrabold text-slate-900 mb-2">📦 데이터 출처 카드</h3>
          <div className="space-y-1.5 text-[11px]">
            {roi.dataSources?.map((s: any) => (
              <div key={s.code} className="flex items-center justify-between">
                <span className="text-slate-600">{s.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  s.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {s.status === 'OK' ? '연결됨' : '미수집'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}

/** ROI 카드 — 영역 점수 + 지표 목록 */
function RoiCard({
  title, color, score, subtitle, purpose, metrics, extendedBadge, error, emptyLabel,
  showMetrics = true,
  onLoginClick,
}: {
  title: string;
  color: 'rose' | 'sky' | 'violet' | 'emerald' | 'amber' | 'orange';
  score?: number | null;
  subtitle?: string;
  purpose?: string;   // docx §6 카드별 '목적' 명시 설명문 (호버 툴팁 + ? 아이콘)
  metrics: { label: string; value: string; truncate?: boolean }[];
  extendedBadge?: boolean;
  error?: string | null;  // docx §11 — 오류 상태: "데이터 확인 필요"
  emptyLabel?: string;    // docx §6 카드별 '데이터 없을 때 상태 문구' (예: C-1 '데이터 수집 전')
  showMetrics?: boolean;  // 비로그인 시 세부 지표 숨김 (영역 점수만 표시)
  onLoginClick?: () => void;
}) {
  const colorMap: Record<string, { border: string; bg: string; scoreText: string }> = {
    rose: { border: 'border-rose-200', bg: 'bg-rose-50/30', scoreText: 'text-rose-700' },
    sky: { border: 'border-sky-200', bg: 'bg-sky-50/30', scoreText: 'text-sky-700' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50/30', scoreText: 'text-violet-700' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/30', scoreText: 'text-emerald-700' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-50/30', scoreText: 'text-amber-700' },
    orange: { border: 'border-orange-200', bg: 'bg-orange-50/30', scoreText: 'text-orange-700' },
  };
  const c = colorMap[color];
  return (
    <div className={`border rounded-2xl p-4 ${c.border} ${c.bg}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          {/* docx §6 카드별 '목적' 명시 설명문 — ? 아이콘 호버 툴팁 */}
          {purpose && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold cursor-help"
              title={`📌 카드 목적 (docx §6)\n${purpose}`}
              aria-label={`카드 목적: ${purpose}`}
            >
              ?
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {error && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200" title={error}>
              ⚠ 데이터 확인 필요
            </span>
          )}
          {extendedBadge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
              확장 전용
            </span>
          )}
        </div>
      </div>
      {/* 목적은 ? 호버 툴팁으로만 노출 (본문에서는 제거) — 가독성 우선 */}
      {subtitle && <p className="text-[10px] text-slate-500 mb-2">{subtitle}</p>}
      <div className="flex items-baseline gap-2 mb-3 pb-2 border-b border-current/10">
        <span className="text-[10px] text-slate-500">영역 점수</span>
        <span className={`text-2xl font-black tabular-nums ${score == null ? 'text-slate-400' : c.scoreText}`}>
          {score != null ? score.toFixed(1) : '-'}
        </span>
        {/* docx §4 B-1 형식 '00 / 100' (공백 포함) - B-1 메인 카드와 통일 */}
        {score != null && <span className="text-[10px] text-slate-400">/ 100</span>}
        {score == null && (
          <span className="text-[9px] text-slate-400 italic ml-auto">📡 {emptyLabel || '수집 준비 중'}</span>
        )}
      </div>
      {showMetrics ? (
        <>
          <div className="space-y-1.5">
            {metrics.map((m) => {
              // docx 11. 상태값 처리 — 미수집 항목은 "-" 대신 의미있는 라벨 (옵션)
              const isEmpty = m.value === '-' || m.value === '' || m.value == null;
              return (
                <div key={m.label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">{m.label}</span>
                  <span className={`text-xs font-bold ${isEmpty ? 'text-slate-400' : 'text-slate-900'} ${m.truncate ? 'truncate max-w-[140px]' : ''}`}>
                    {m.value}
                  </span>
                </div>
              );
            })}
          </div>
          {/* 모든 지표 미수집 시 docx §11 '수집 준비 중' (또는 카드별 명시 라벨, 예: C-1 '데이터 수집 전') */}
          {metrics.every(m => m.value === '-' || !m.value) && (
            <div className="mt-3 pt-2 border-t border-current/10 text-[10px] text-center text-slate-400">
              📡 {emptyLabel || '수집 준비 중'}
            </div>
          )}
        </>
      ) : (
        // 비로그인 상태 — 영역 점수만 노출 + 로그인 CTA
        <button
          type="button"
          onClick={onLoginClick}
          className="w-full text-center py-3 px-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-dashed border-slate-200 hover:border-emerald-300 text-[11px] text-slate-500 hover:text-emerald-700 transition-colors"
        >
          🔒 세부 지표 {metrics.length}개 항목은 <span className="font-bold">로그인 후</span> 확인 가능
        </button>
      )}
    </div>
  );
}

/** 보조 정보 (수집률/신뢰도/업데이트/최근성과) */
function AuxStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-center" title={hint || undefined}>
      <div className="opacity-60 mb-0.5">{label}</div>
      <div className="font-bold text-[12px] truncate">{value}</div>
    </div>
  );
}

/**
 * 경기결과 — 연도별 그룹핑 + 같은 연도 내 최신순 (docx 3-6 + §9 F)
 * docx §9 각 대회별 표시 항목: 순위 / 대회명 / 개최일 / 투어명 / 스코어 / 분석 코멘트
 *  - 투어명은 r.tour > fallbackTour(선수.tour) 순으로 표시
 */
function EventResultsByYear({ results, fallbackTour }: { results: any[]; fallbackTour?: string }) {
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
                  <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{new Date(r.eventDate).toLocaleDateString('ko-KR')}</span>
                    {/* docx §9 — 투어명 (r.tour > 선수 tour fallback) */}
                    {(r.tour || fallbackTour) && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold text-[9px]">
                        🏌️ {r.tour || fallbackTour}
                      </span>
                    )}
                    {r.category && <span className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">{r.category}</span>}
                    {r.source !== 'MANUAL' && (
                      <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded">{r.source}</span>
                    )}
                  </div>
                  {r.summary && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 italic">{r.summary}</p>
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

/**
 * 공개 선수 둘러보기 페이지 (/athletes)
 *
 * - 메인 → "선수 둘러보기" 버튼 / 상단 메뉴 "선수" 진입점
 * - 검색 + 투어 필터
 * - 가로 슬라이드(추천) + 세로 카드 그리드
 * - 카드 클릭 → /athletes/:id 상세
 */

import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Users, ExternalLink, Trophy, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

const TOUR_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'KLPGA', label: 'KLPGA' },
  { value: 'KPGA', label: 'KPGA' },
  { value: 'LPGA', label: 'LPGA' },
  { value: 'PGA', label: 'PGA' },
];

// SPONPIK 3-8 + 2-4 — 1차 종목 (골프 > 스크린골프)
const SPORT_OPTIONS = [
  { value: '', label: '전체 종목' },
  { value: 'GOLF', label: '🏌️ 골프' },
  { value: 'SCREEN_GOLF', label: '⛳ 스크린골프' },
];

export default function PublicAthletes() {
  const [q, setQ] = useState('');
  const [tour, setTour] = useState('');
  const [sport, setSport] = useState('');
  const sliderRef = useRef<HTMLDivElement>(null);
  const newSliderRef = useRef<HTMLDivElement>(null);
  // 메인에서 '신규등록선수 > 전체보기'로 진입하면 추천 라인은 숨기고 신규부터 노출 (?filter=new)
  const [searchParams] = useSearchParams();
  const onlyNew = searchParams.get('filter') === 'new';

  const { data: resp, isLoading } = useQuery({
    queryKey: ['public-athletes', q, tour, sport],
    queryFn: () => api.listPublicAthletes({ q: q || undefined, tour: tour || undefined, sport: sport || undefined, limit: 50 } as any),
  });
  const items = resp?.data?.items || [];
  const total = resp?.data?.total || 0;

  const scrollBy = (ref: React.RefObject<HTMLDivElement>, dir: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  };
  const scroll = (dir: 'left' | 'right') => scrollBy(sliderRef, dir);

  // 2026-07 항목2 — 추천은 운영 지정(isRecommended) 선수만, 신규는 가입 최신순
  const featured = items
    .filter((a: any) => a.isRecommended)
    .sort((a: any, b: any) => (a.recommendOrder ?? 999) - (b.recommendOrder ?? 999));
  const newList = items
    .filter((a: any) => isNewAthlete(a))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const allList = items;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white">
        {/* 상단 nav: 홈으로 버튼 별도 줄로 분리 */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-5">
          <Link to="/" className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100 font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> 홈으로
          </Link>
        </div>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-12 sm:pb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 inline-flex items-center gap-3">
            <Users className="w-8 h-8" /> 후원 가능한 선수 찾기
          </h1>
          <p className="text-sm sm:text-base opacity-90 max-w-xl">
            스폰픽에 등록된 프로 골퍼들을 만나보세요. 마음에 드는 선수의 슬롯을 직접 후원할 수 있습니다.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold">
            <Trophy className="w-3.5 h-3.5" /> 총 {total.toLocaleString()}명 등록
          </div>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-5 space-y-3">
          {/* 검색 + 투어 필터 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="선수명, 투어, 소속, 지역으로 검색해보세요"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {TOUR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTour(opt.value)}
                  className={`px-3.5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-colors ${
                    tour === opt.value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* SPONPIK 3-8 — 종목별 소팅 (1차: 골프/스크린골프) */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">종목</span>
            <div className="flex gap-1.5 overflow-x-auto">
              {SPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSport(opt.value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-colors ${
                    sport === opt.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-10">
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">선수 목록을 불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-slate-500">검색 결과가 없습니다. 다른 키워드로 시도해보세요.</div>
          </div>
        ) : (
          <>
            {/* 가로 슬라이드 - 추천 (운영 지정 선수만) — ?filter=new 진입 시 숨김 */}
            {!q && !onlyNew && featured.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">⭐ 추천 선수</h2>
                  <div className="flex gap-1">
                    <button onClick={() => scroll('left')} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => scroll('right')} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div ref={sliderRef} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                  {featured.map((a: any) => (
                    <FeaturedCard key={a.id} athlete={a} />
                  ))}
                </div>
              </section>
            )}

            {/* 신규 등록 선수 — 가입 최신순, 가로 슬라이드 (2026-07 항목2) */}
            {!q && newList.length > 0 && (
              <section id="new-athletes" className="scroll-mt-24">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 inline-flex items-center gap-2">
                    🆕 신규 등록 선수
                    <span className="text-xs font-semibold text-slate-400">최근 가입순</span>
                  </h2>
                  <div className="flex gap-1">
                    <button onClick={() => scrollBy(newSliderRef, 'left')} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => scrollBy(newSliderRef, 'right')} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div ref={newSliderRef} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                  {newList.map((a: any) => (
                    <FeaturedCard key={a.id} athlete={a} />
                  ))}
                </div>
              </section>
            )}

            {/* 세로 그리드 - 전체 */}
            <section>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-4">
                {q ? `"${q}" 검색 결과 (${items.length}명)` : `전체 선수 (${total}명)`}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {allList.map((a: any) => (
                  <AthleteCard key={a.id} athlete={a} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** 신규 기준: 가입(등록) 60일 이내 */
function isNewAthlete(a: any): boolean {
  return !!a?.createdAt && Date.now() - new Date(a.createdAt).getTime() < 60 * 86400000;
}

/** 반짝이는 추천/신규 뱃지 (우측 상단) */
function AthleteBadges({ athlete, size = 'md' }: { athlete: any; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5';
  if (!athlete.isRecommended && !isNewAthlete(athlete)) return null;
  return (
    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
      {athlete.isRecommended && (
        <span className={`inline-flex items-center gap-0.5 bg-amber-400 text-white font-extrabold rounded-full shadow-md animate-pulse ${cls}`}>
          ✨ 추천
        </span>
      )}
      {isNewAthlete(athlete) && (
        <span className={`inline-flex items-center gap-0.5 bg-rose-500 text-white font-extrabold rounded-full shadow-md animate-pulse ${cls}`}>
          NEW
        </span>
      )}
    </div>
  );
}

function FeaturedCard({ athlete }: { athlete: any }) {
  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className="group flex-shrink-0 w-[260px] sm:w-[280px] snap-start bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-emerald-300 hover:shadow-xl transition-all"
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100">
        {athlete.profileImageUrl ? (
          <img
            src={athlete.profileImageUrl}
            alt={athlete.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl font-extrabold text-emerald-300">
            {athlete.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">
            <Trophy className="w-2.5 h-2.5" /> {athlete.tour || 'PRO'}
          </span>
        </div>
        <AthleteBadges athlete={athlete} />
      </div>
      <div className="p-4">
        <h3 className="text-base font-extrabold text-slate-900 mb-1">{athlete.name}</h3>
        {/* SPONPIK 4. 권장 데이터: 신장 · 지역 · 데뷔 (구조화) */}
        {(athlete.height || athlete.region || athlete.debutYear) && (
          <div className="text-[11px] text-slate-600 font-semibold mb-1 flex flex-wrap items-center gap-x-1.5">
            {athlete.height && <span>📏 {athlete.height}cm</span>}
            {athlete.region && <span>📍 {athlete.region}</span>}
            {athlete.debutYear && <span>🎯 {athlete.debutYear}</span>}
          </div>
        )}
        <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">{athlete.bio || '프로 골퍼'}</p>
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:gap-2 transition-all">
          프로필 보기 <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function AthleteCard({ athlete }: { athlete: any }) {
  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all"
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100">
        {athlete.profileImageUrl ? (
          <img
            src={athlete.profileImageUrl}
            alt={athlete.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl font-extrabold text-emerald-300">
            {athlete.name.charAt(0)}
          </div>
        )}
        <AthleteBadges athlete={athlete} size="sm" />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-extrabold text-slate-900 truncate">{athlete.name}</h3>
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{athlete.tour || 'PRO'}</span>
        </div>
        {(athlete.height || athlete.region) && (
          <div className="text-[10px] text-slate-600 font-semibold mb-0.5 truncate">
            {athlete.height && <span>{athlete.height}cm</span>}
            {athlete.height && athlete.region && <span className="opacity-50"> · </span>}
            {athlete.region && <span>{athlete.region}</span>}
          </div>
        )}
        <p className="text-[10px] text-slate-500 line-clamp-1">{athlete.bio || '프로 골퍼'}</p>
      </div>
    </Link>
  );
}

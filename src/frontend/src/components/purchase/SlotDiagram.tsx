/**
 * 개편 Phase 2 (WF-04 §7.5) — 슬롯 인벤토리 도식
 *
 * 실루엣과 슬롯 마커를 하나의 SVG 좌표계 안에서 그린다.
 * (마커를 CSS %로 따로 얹으면 SVG 레터박스 때문에 그림과 어긋난다 — 2026-07-29 수정)
 *
 * viewBox 75×100 = 컨테이너 3:4 비율과 동일하므로 여백 없이 정확히 채워진다.
 * 좌표는 백분율(x%, y%)로 저장되며 svgX = x% × 0.75, svgY = y% 로 매핑한다.
 */

export type SlotStatusKind = 'AVAILABLE' | 'AUCTION_ACTIVE' | 'HELD' | 'SOLD' | 'RESTRICTED' | 'PENDING_APPROVAL' | 'UNAVAILABLE';

export const STATUS_META: Record<string, { label: string; dot: string; fill: string; text: string; selectable: boolean }> = {
  AVAILABLE: { label: '구매 가능', dot: 'bg-emerald-500', fill: '#10b981', text: 'text-emerald-700', selectable: true },
  AUCTION_ACTIVE: { label: '경매 진행중', dot: 'bg-amber-500', fill: '#f59e0b', text: 'text-amber-700', selectable: true },
  HELD: { label: '예약중', dot: 'bg-slate-400', fill: '#94a3b8', text: 'text-slate-500', selectable: false },
  SOLD: { label: '판매완료', dot: 'bg-slate-300', fill: '#cbd5e1', text: 'text-slate-400', selectable: false },
  RESTRICTED: { label: '제한', dot: 'bg-rose-400', fill: '#fb7185', text: 'text-rose-600', selectable: false },
  PENDING_APPROVAL: { label: '승인 대기', dot: 'bg-violet-400', fill: '#a78bfa', text: 'text-violet-600', selectable: false },
  UNAVAILABLE: { label: '판매 안함', dot: 'bg-slate-300', fill: '#cbd5e1', text: 'text-slate-400', selectable: false },
};

export type DiagramSlot = {
  id: string;
  code: string;
  name: string;
  x: number | null;
  y: number | null;
  status: string;
  price: number | null;
};

/** 백분율 좌표 → SVG 좌표 (viewBox 75×100) */
const sx = (xPct: number) => xPct * 0.75;

export default function SlotDiagram({
  slots,
  selectedId,
  onSelect,
}: {
  slots: DiagramSlot[];
  selectedId?: string | null;
  onSelect: (slot: DiagramSlot) => void;
}) {
  const placed = slots.filter((s) => s.x != null && s.y != null);
  const unplaced = slots.filter((s) => s.x == null || s.y == null);

  return (
    <div>
      <div className="relative w-full max-w-[320px] mx-auto aspect-[3/4] rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <svg viewBox="0 0 75 100" className="w-full h-full" role="img" aria-label="선수 착장 슬롯 도식">
          <defs>
            <linearGradient id="sp-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e8edf3" />
            </linearGradient>
          </defs>

          {/* 모자 크라운 / 챙 */}
          <path d="M28.5 14 Q37.5 -4 46.5 14 Z" fill="#cbd5e1" />
          <rect x="24.75" y="13.5" width="25.5" height="3.5" rx="1.75" fill="#94a3b8" />
          {/* 머리 · 목 */}
          <ellipse cx="37.5" cy="19" rx="6.75" ry="8.5" fill="#e2e8f0" />
          <rect x="34.875" y="25" width="5.25" height="4.5" fill="#dbe2ea" />
          {/* 상의(소매 포함) */}
          <path
            d="M37.5 27 L27 29 L20.25 31 L14.25 44 L21.75 46 L24 36 L23.25 57 L51.75 57 L51 36 L53.25 46 L60.75 44 L54.75 31 L48 29 Z"
            fill="url(#sp-body)"
            stroke="#cbd5e1"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          {/* 카라 */}
          <path d="M34.875 27 L37.5 33 L40.125 27 Z" fill="#cbd5e1" />
          {/* 하의 */}
          <path
            d="M23.25 57 L23.25 96 L32.5 96 L36 72 L39 72 L42.5 96 L51.75 96 L51.75 57 Z"
            fill="#e8edf3"
            stroke="#cbd5e1"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />

          {/* 슬롯 마커 */}
          {placed.map((s) => {
            const meta = STATUS_META[s.status] || STATUS_META.UNAVAILABLE;
            const active = s.id === selectedId;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`${s.name} ${meta.label}`}
                aria-pressed={active}
                onClick={() => onSelect(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(s);
                  }
                }}
                className="cursor-pointer focus:outline-none"
              >
                {active && <circle cx={sx(s.x!)} cy={s.y!} r={4.4} fill="#0f172a" opacity={0.12} />}
                <circle
                  cx={sx(s.x!)}
                  cy={s.y!}
                  r={active ? 2.8 : 2.1}
                  fill={meta.fill}
                  stroke="#ffffff"
                  strokeWidth={active ? 1 : 0.8}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3">
        {['AVAILABLE', 'AUCTION_ACTIVE', 'HELD', 'SOLD'].map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_META[k].dot}`} />
            {STATUS_META[k].label}
          </span>
        ))}
      </div>

      {unplaced.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          도식 미표기 슬롯 {unplaced.length}개는 아래 목록에서 선택할 수 있습니다.
        </p>
      )}
    </div>
  );
}

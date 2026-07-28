/**
 * 개편 Phase 2 (WF-04 §7.5) — 슬롯 인벤토리 도식
 * 표준 착장 실루엣 위에 slotTemplate.displayX/Y(%) 좌표로 슬롯 마커를 배치한다.
 * 마커 색상 = 기간 선택에 따른 재고 상태.
 */

export type SlotStatusKind = 'AVAILABLE' | 'AUCTION_ACTIVE' | 'HELD' | 'SOLD' | 'RESTRICTED' | 'PENDING_APPROVAL' | 'UNAVAILABLE';

export const STATUS_META: Record<string, { label: string; dot: string; ring: string; text: string; selectable: boolean }> = {
  AVAILABLE: { label: '구매 가능', dot: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', selectable: true },
  AUCTION_ACTIVE: { label: '경매 진행중', dot: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700', selectable: true },
  HELD: { label: '예약중', dot: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-500', selectable: false },
  SOLD: { label: '판매완료', dot: 'bg-slate-300', ring: 'ring-slate-200', text: 'text-slate-400', selectable: false },
  RESTRICTED: { label: '제한', dot: 'bg-rose-400', ring: 'ring-rose-200', text: 'text-rose-600', selectable: false },
  PENDING_APPROVAL: { label: '승인 대기', dot: 'bg-violet-400', ring: 'ring-violet-200', text: 'text-violet-600', selectable: false },
  UNAVAILABLE: { label: '판매 안함', dot: 'bg-slate-300', ring: 'ring-slate-200', text: 'text-slate-400', selectable: false },
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

/** 상반신 중심 표준 착장 실루엣 (모자·상의·하의 상단) */
function Silhouette() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="sp-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      {/* 모자 */}
      <path d="M36 13 q14 -9 28 0 v3 h-28 z" fill="#cbd5e1" />
      <path d="M33 16 h34 q3 0 3 2 h-40 q0 -2 3 -2 z" fill="#94a3b8" />
      {/* 머리 */}
      <ellipse cx="50" cy="16.5" rx="7.5" ry="8" fill="#e2e8f0" />
      {/* 목 */}
      <rect x="46.5" y="22" width="7" height="4" fill="#e2e8f0" />
      {/* 상의 */}
      <path
        d="M50 25 L38 28 Q26 31 22 40 L18 52 L27 55 L30 46 L30 72 L70 72 L70 46 L73 55 L82 52 L78 40 Q74 31 62 28 Z"
        fill="url(#sp-body)"
        stroke="#cbd5e1"
        strokeWidth="0.6"
      />
      {/* 카라 */}
      <path d="M44 26.5 L50 33 L56 26.5 L50 25 Z" fill="#cbd5e1" />
      {/* 하의 */}
      <path d="M31 72 L31 96 L45 96 L48 78 L52 78 L55 96 L69 96 L69 72 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.6" />
    </svg>
  );
}

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
        <Silhouette />
        {placed.map((s) => {
          const meta = STATUS_META[s.status] || STATUS_META.UNAVAILABLE;
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              title={`${s.name} · ${meta.label}`}
              aria-label={`${s.name} ${meta.label}`}
              aria-pressed={active}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                active ? 'w-5 h-5 ring-4 ring-slate-900/15 z-10' : 'w-3.5 h-3.5 ring-2 hover:w-4 hover:h-4'
              } ${meta.dot} ${active ? '' : meta.ring}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            />
          );
        })}
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

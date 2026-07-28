/**
 * 개편 Phase 2 (WF-05) — 슬롯 상세 드로어
 * 슬롯 클릭 시 화면을 이탈하지 않고 상세정보를 확인한다.
 */
import { X } from 'lucide-react';
import { STATUS_META } from './SlotDiagram';

const krw = (v: any) => (v == null ? '—' : `${Number(v).toLocaleString()}원`);

export default function SlotDetailDrawer({
  open,
  slot,
  periodLabel,
  onClose,
  onSelect,
  alternatives,
  onPickAlternative,
}: {
  open: boolean;
  slot: any | null;
  periodLabel: string;
  onClose: () => void;
  onSelect?: () => void;
  alternatives?: { id: string; name: string; status: string }[];
  onPickAlternative?: (id: string) => void;
}) {
  if (!open || !slot) return null;
  const meta = STATUS_META[slot.status] || STATUS_META.UNAVAILABLE;
  const tpl = slot.template || {};
  const sizeText =
    tpl.recommendedWMm && tpl.recommendedHMm
      ? `${(tpl.recommendedWMm / 10).toFixed(0)}cm × ${(tpl.recommendedHMm / 10).toFixed(0)}cm`
      : '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${slot.name} 슬롯 상세`}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="닫기" />
      <div className="relative w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto animate-[slideIn_.2s_ease-out]">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-base font-extrabold text-slate-900">{slot.name}</div>
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold mt-0.5 ${meta.text}`}>
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              {meta.label}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="닫기">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {tpl.uiHeadline && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-sm font-bold text-slate-900">{tpl.uiHeadline}</div>
              {tpl.uiCopy && <p className="text-xs text-slate-600 mt-1 leading-relaxed break-keep">{tpl.uiCopy}</p>}
            </div>
          )}

          <dl className="space-y-2.5">
            <Row label="권장 크기" value={sizeText} />
            <Row label="계약 가능기간" value={periodLabel} />
            <Row label="거래방식" value={slot.saleModeLabel || '—'} />
            <Row label="가격" value={krw(slot.price)} />
            {tpl.grade && <Row label="슬롯 등급" value={String(tpl.grade).replace('A_PLUS', 'A+')} />}
            {tpl.material && <Row label="재질" value={tpl.material} />}
          </dl>

          {tpl.forbiddenNotes && (
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1">운영상 제한사항</div>
              <p className="text-xs text-slate-600 leading-relaxed break-keep">{tpl.forbiddenNotes}</p>
            </div>
          )}

          {alternatives && alternatives.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">대체 가능 슬롯</div>
              <div className="flex flex-wrap gap-1.5">
                {alternatives.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onPickAlternative?.(a.id)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 hover:border-slate-900 hover:bg-slate-50"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta.selectable && onSelect && (
            <button
              type="button"
              onClick={() => {
                onSelect();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
            >
              이 슬롯 선택
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className="text-xs font-semibold text-slate-900 text-right break-keep">{value}</dd>
    </div>
  );
}

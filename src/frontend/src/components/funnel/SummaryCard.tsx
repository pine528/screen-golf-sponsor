/**
 * SummaryCard - KPI 요약 카드 (전일 대비 증감 포함)
 *
 * Refs: wireframe_spec.docx > 3. 공통 구성 요소 > Summary Card
 */

import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;          // 전일 대비 증감률 (%)
  icon?: LucideIcon;
  hint?: string;
  variant?: 'default' | 'highlight';
  format?: 'number' | 'currency' | 'percent' | 'decimal';
}

export function SummaryCard({ label, value, unit, delta, icon: Icon, hint, variant = 'default', format = 'number' }: Props) {
  const formatted = formatValue(value, format);
  const isUp = delta !== undefined && delta > 0;
  const isDown = delta !== undefined && delta < 0;

  return (
    <div className={`bg-white border rounded-xl p-4 ${variant === 'highlight' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${variant === 'highlight' ? 'text-emerald-500' : 'text-slate-400'}`} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-extrabold ${variant === 'highlight' ? 'text-emerald-700' : 'text-slate-900'}`}>{formatted}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {delta !== undefined && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${isUp ? 'text-emerald-600' : isDown ? 'text-rose-600' : 'text-slate-500'}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-slate-400">{hint}</span>}
        </div>
      )}
    </div>
  );
}

function formatValue(v: string | number, format: string): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isNaN(n)) return String(v);
  if (format === 'currency') return `₩${Math.round(n).toLocaleString()}`;
  if (format === 'percent') return `${(n * 100).toFixed(1)}%`;
  if (format === 'decimal') return n.toFixed(2);
  return Math.round(n).toLocaleString();
}

/**
 * GlobalFilter - 풀 퍼널 화면 공통 필터
 * 기간(from/to), 캠페인, 선수, 채널, 코드 필터
 *
 * Refs: wireframe_spec.docx > 3. 공통 구성 요소 > Global Filter
 */

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

export interface GlobalFilterValue {
  from?: string;
  to?: string;
  campaignId?: string;
  athleteId?: string;
  channel?: string;
  code?: string;
}

interface Props {
  value: GlobalFilterValue;
  onChange: (v: GlobalFilterValue) => void;
  campaigns?: { id: string; name: string }[];
  athletes?: { id: string; name: string }[];
  hideCampaign?: boolean;
  hideAthlete?: boolean;
}

const QUICK_RANGES = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

export function GlobalFilter({ value, onChange, campaigns = [], athletes = [], hideCampaign, hideAthlete }: Props) {
  const [open, setOpen] = useState(true);

  const setQuickRange = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    onChange({
      ...value,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  const clear = () => onChange({});

  const hasActive = value.from || value.to || value.campaignId || value.athleteId || value.channel || value.code;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Calendar className="w-4 h-4 text-emerald-500" />
          필터
        </div>
        <div className="flex items-center gap-2">
          {hasActive && (
            <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <X className="w-3 h-3" /> 초기화
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="text-xs text-emerald-600 font-semibold">
            {open ? '접기' : '펼치기'}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Quick range chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setQuickRange(r.days)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-full transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* 입력 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">시작일</label>
              <input
                type="date"
                value={value.from || ''}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">종료일</label>
              <input
                type="date"
                value={value.to || ''}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
              />
            </div>
            {!hideCampaign && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">캠페인</label>
                <select
                  value={value.campaignId || ''}
                  onChange={(e) => onChange({ ...value, campaignId: e.target.value || undefined })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="">전체</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!hideAthlete && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">선수</label>
                <select
                  value={value.athleteId || ''}
                  onChange={(e) => onChange({ ...value, athleteId: e.target.value || undefined })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="">전체</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

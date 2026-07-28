/**
 * FunnelChart - Recharts 기반 퍼널 시각화 (drop-off 포함)
 *
 * Refs: wireframe_spec.docx > REP-01 > 퍼널 차트
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

export interface FunnelStep {
  name: string;
  value: number;
  color?: string;
}

interface Props {
  steps: FunnelStep[];
  height?: number;
}

const DEFAULT_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#fb923c', '#f87171', '#a78bfa', '#60a5fa'];

export function FunnelChart({ steps, height = 360 }: Props) {
  if (steps.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-slate-400">데이터가 없습니다</div>;
  }

  const max = Math.max(...steps.map((s) => s.value), 1);
  const dataWithRate = steps.map((s, i) => {
    const dropoffRate = i === 0 ? 1 : steps[i - 1].value > 0 ? s.value / steps[i - 1].value : 0;
    const overallRate = s.value / max;
    return {
      ...s,
      dropoffRate,
      overallRate,
      label: `${s.value.toLocaleString()} (${(overallRate * 100).toFixed(1)}%)`,
    };
  });

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart layout="vertical" data={dataWithRate} margin={{ left: 80, right: 60, top: 10, bottom: 10 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#475569' }} />
          <Tooltip
            formatter={((v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} (drop-off ${(p.payload.dropoffRate * 100).toFixed(1)}%)`, '카운트']) as any}
            cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {dataWithRate.map((entry, idx) => (
              <Cell key={idx} fill={entry.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
            ))}
            <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: '#475569' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

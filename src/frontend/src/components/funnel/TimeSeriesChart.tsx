/**
 * TimeSeriesChart - 일자별 추이 차트 (라인/막대)
 *
 * Refs: wireframe_spec.docx > BRD-01 > 추이 차트 일자별 유입/주문/매출
 */

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

export interface TimeSeriesPoint {
  date: string;
  landingViews?: number;
  clicks?: number;
  purchases?: number;
  netRevenue?: number;
}

interface Props {
  data: TimeSeriesPoint[];
  height?: number;
  showRevenue?: boolean;
}

export function TimeSeriesChart({ data, height = 320, showRevenue = true }: Props) {
  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-slate-400">기간 내 데이터가 없습니다</div>;
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 0, right: 30, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
          {showRevenue && (
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
          )}
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={((v: any, name: any) => {
              if (name === '순매출') return `₩${Number(v).toLocaleString()}`;
              return Number(v).toLocaleString();
            }) as any}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="landingViews" name="유입" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="purchases" name="주문" fill="#34d399" radius={[4, 4, 0, 0]} />
          {showRevenue && (
            <Line yAxisId="right" type="monotone" dataKey="netRevenue" name="순매출" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

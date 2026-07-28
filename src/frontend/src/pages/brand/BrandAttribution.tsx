/**
 * Phase 3: Multi-touch Attribution 분석
 *
 * - 모델별 매출 분배 비교 (First/Last/Linear/Time-decay/Position-based)
 * - 선수별 attributed_revenue 비교
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { GlobalFilter, GlobalFilterValue } from '../../components/funnel/GlobalFilter';
import { api } from '../../services/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const MODELS = [
  { value: 'FIRST_TOUCH', label: 'First Touch (첫 터치 100%)' },
  { value: 'LAST_TOUCH', label: 'Last Touch (마지막 터치 100%)' },
  { value: 'LINEAR', label: 'Linear (균등 분배)' },
  { value: 'TIME_DECAY', label: 'Time Decay (반감기 7일)' },
  { value: 'POSITION_BASED', label: 'Position Based (40-20-40)' },
];

export default function BrandAttribution() {
  const [filter, setFilter] = useState<GlobalFilterValue>({});
  const [model, setModel] = useState('LAST_TOUCH');

  const { data: meResp } = useQuery({
    queryKey: ['my-brand'],
    queryFn: async () => (await api.get('/brands/me')).data,
  });
  const brandId = (meResp as any)?.id;

  const { data: attrResp, isLoading } = useQuery({
    queryKey: ['brand-attribution', brandId, model, filter],
    queryFn: () => api.getBrandAttribution(brandId!, model, filter),
    enabled: !!brandId,
  });
  const distribution = attrResp?.data?.distribution || [];

  const chartData = distribution.slice(0, 10).map((d: any) => ({
    name: d.athleteId.slice(0, 8),
    revenue: Math.round(d.attributedRevenue / 10000),
    weight: Number((d.weight * 100).toFixed(1)),
  }));

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Multi-touch Attribution (Phase 3)</h1>
        <p className="text-sm text-slate-500 mb-6">여러 터치 포인트에 가중치를 분배하여 선수/캠페인별 진짜 기여도를 분석합니다</p>

        <GlobalFilter value={filter} onChange={setFilter} hideAthlete hideCampaign />

        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div className="text-xs font-semibold text-slate-500 mb-2">어트리뷰션 모델</div>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  model === m.value ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">로딩 중...</div>
        ) : distribution.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400 bg-slate-50 rounded-xl">
            어트리뷰션 데이터가 없습니다. 다중 터치 포인트가 기록된 후 표시됩니다.
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-bold mb-3">{MODELS.find(m => m.value === model)?.label} — 선수별 매출 분배</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}만`} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#10b981" name="기여매출(만원)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold mb-3">상세 분배 결과</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2">캠페인</th>
                    <th className="text-left py-2">선수</th>
                    <th className="text-right py-2">가중치</th>
                    <th className="text-right py-2">기여 매출</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2"><code className="text-xs">{d.campaignId.slice(0, 8)}</code></td>
                      <td className="py-2"><code className="text-xs">{d.athleteId.slice(0, 8)}</code></td>
                      <td className="text-right py-2">{(d.weight * 100).toFixed(1)}%</td>
                      <td className="text-right py-2 font-bold">₩{Math.round(d.attributedRevenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

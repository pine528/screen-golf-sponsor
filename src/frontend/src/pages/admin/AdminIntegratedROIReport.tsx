/**
 * REP-01: 통합 ROI 리포트
 *
 * Refs: wireframe_spec.docx > REP-01
 * - 노출 → 클릭 → 유입 → 장바구니 → 결제 → 구매 풀 퍼널 KPI
 * - 퍼널 차트
 * - 미디어 노출 + 매출 증명 통합
 * - PDF 다운로드 (브라우저 인쇄)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { GlobalFilter, GlobalFilterValue } from '../../components/funnel/GlobalFilter';
import { SummaryCard } from '../../components/funnel/SummaryCard';
import { FunnelChart, FunnelStep } from '../../components/funnel/FunnelChart';
import { TimeSeriesChart } from '../../components/funnel/TimeSeriesChart';
import { DataSourceBadge } from '../../components/funnel/DataSourceBadge';
import { api } from '../../services/api';
import { Eye, MousePointer, Users, ShoppingBag, CreditCard, ShoppingCart, BadgePercent, Printer, Share2, TrendingUp, TrendingDown } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export default function AdminIntegratedROIReport() {
  const [filter, setFilter] = useState<GlobalFilterValue>({});
  const [campaignId, setCampaignId] = useState<string>('');

  const { data: campaignsResp } = useQuery({
    queryKey: ['admin-funnel-campaigns'],
    queryFn: () => api.listFunnelCampaigns(),
  });
  const campaigns = (campaignsResp?.data || []) as any[];

  const { data: reportResp, isLoading } = useQuery({
    queryKey: ['integrated-report', campaignId, filter],
    queryFn: () => api.getCampaignFunnelReport(campaignId, filter),
    enabled: !!campaignId,
  });
  const report = reportResp?.data;
  const summary = report?.summary || {};

  // 기간 비교 — 사용자가 비교 기간 선택
  const [compareMode, setCompareMode] = useState<'previous' | 'last_year' | 'none'>('previous');
  const compareDateRange = (() => {
    if (compareMode === 'none' || !filter.from || !filter.to) return null;
    const f = new Date(filter.from);
    const t = new Date(filter.to);
    const span = t.getTime() - f.getTime();
    if (compareMode === 'previous') {
      return { from: new Date(f.getTime() - span).toISOString().slice(0, 10), to: new Date(t.getTime() - span).toISOString().slice(0, 10) };
    }
    // last_year: 같은 기간 1년 전
    const yf = new Date(f); yf.setFullYear(yf.getFullYear() - 1);
    const yt = new Date(t); yt.setFullYear(yt.getFullYear() - 1);
    return { from: yf.toISOString().slice(0, 10), to: yt.toISOString().slice(0, 10) };
  })();

  const { data: compareResp } = useQuery({
    queryKey: ['period-compare', report?.campaign?.brandId, filter, compareMode],
    queryFn: async () => {
      // 백엔드는 from/to만 받으면 자동으로 직전 동일 기간 계산
      // last_year 모드는 prev_from/prev_to 별도 전달
      const params: any = { from: filter.from, to: filter.to };
      if (compareDateRange) {
        params.prev_from = compareDateRange.from;
        params.prev_to = compareDateRange.to;
      }
      const r = await api.get(`/reports/brand/${report?.campaign?.brandId}/period-compare`, params);
      return r;
    },
    enabled: !!campaignId && !!report?.campaign?.brandId && compareMode !== 'none',
  });
  const compare = compareResp?.data;

  // 공유 링크 생성
  const shareMut = useMutation({
    mutationFn: async () => {
      const r = await api.post('/reports/share-link', { campaignId, from: filter.from, to: filter.to });
      return r;
    },
    onSuccess: (resp) => {
      const url = (resp as any)?.data?.shareUrl;
      if (url) navigator.clipboard.writeText(url);
      alert(`공유 링크 복사됨 (7일 유효):\n${url}`);
    },
  });

  const funnelSteps: FunnelStep[] = [
    { name: '노출', value: report?.campaign?.actualImpressions || 0 },
    { name: '클릭', value: summary.linkClicks || 0 },
    { name: '유입', value: summary.landingViews || 0 },
    { name: '상품조회', value: summary.productViews || 0 },
    { name: '장바구니', value: summary.addToCarts || 0 },
    { name: '결제시작', value: summary.beginCheckouts || 0 },
    { name: '구매완료', value: summary.purchases || 0 },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">통합 ROI 리포트</h1>
            <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-2">
              미디어 노출 지표와 매출 지표를 한 화면에서 연결한 통합 보고서 (REP-01)
              <DataSourceBadge type="measured" />
              <DataSourceBadge type="integrated" />
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => shareMut.mutate()}
              disabled={!campaignId || shareMut.isPending}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" /> 공유 링크
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> PDF 다운로드
            </button>
          </div>
        </div>

        {/* 캠페인 선택 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">캠페인:</span>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="flex-1 max-w-md text-sm border border-slate-200 rounded-lg px-3 py-1.5"
          >
            <option value="">선택해주세요</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.brand?.name})</option>
            ))}
          </select>
        </div>

        <GlobalFilter value={filter} onChange={setFilter} hideAthlete hideCampaign />

        {!campaignId ? (
          <div className="text-center py-16 text-sm text-slate-400 bg-slate-50 rounded-xl">캠페인을 선택해주세요</div>
        ) : isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">로딩 중...</div>
        ) : (
          <>
            {/* 상단 풀 퍼널 KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2 mb-6">
              <SummaryCard label="노출" value={report?.campaign?.actualImpressions || 0} icon={Eye} />
              <SummaryCard label="도달" value={Math.round((report?.campaign?.actualImpressions || 0) * 0.6)} icon={Users} hint="추정" />
              <SummaryCard label="클릭" value={summary.linkClicks || 0} icon={MousePointer} />
              <SummaryCard label="유입" value={summary.landingViews || 0} icon={Users} variant="highlight" />
              <SummaryCard label="장바구니" value={summary.addToCarts || 0} icon={ShoppingBag} />
              <SummaryCard label="결제시작" value={summary.beginCheckouts || 0} icon={CreditCard} />
              <SummaryCard label="구매" value={summary.purchases || 0} icon={ShoppingCart} variant="highlight" />
              <SummaryCard label="순매출" value={summary.netRevenue || 0} format="currency" variant="highlight" />
              <SummaryCard label="ROAS" value={summary.roas?.toFixed(2) || '-'} icon={BadgePercent} />
            </div>

            {/* 데이터 출처 범례 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 flex items-center gap-4 flex-wrap text-xs">
              <span className="font-bold text-slate-700">📌 데이터 범례:</span>
              <div className="flex items-center gap-2">
                <DataSourceBadge type="measured" />
                <span className="text-slate-600">유입·주문·매출 (스폰픽 내부 실측)</span>
              </div>
              <div className="flex items-center gap-2">
                <DataSourceBadge type="integrated" />
                <span className="text-slate-600">외부몰 픽셀 (Phase 2)</span>
              </div>
              <div className="flex items-center gap-2">
                <DataSourceBadge type="estimated" />
                <span className="text-slate-600">도달수 (노출 × 평균 0.6)</span>
              </div>
            </div>

            {/* 퍼널 차트 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">퍼널 시각화 (드롭오프 분석)</h3>
                <DataSourceBadge type="measured" />
              </div>
              <FunnelChart steps={funnelSteps} />
            </div>

            {/* 추이 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">일자별 추이</h3>
              <TimeSeriesChart data={report?.timeseries || []} />
            </div>

            {/* 좌/우 요약 박스 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-emerald-700 mb-3">📺 미디어 노출 증빙</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <div>총 노출: <strong>{(report?.campaign?.actualImpressions || 0).toLocaleString()}</strong></div>
                  <div>총 클릭: <strong>{summary.linkClicks.toLocaleString()}</strong></div>
                  <div>CTR: <strong>{(summary.ctr * 100).toFixed(2)}%</strong></div>
                </div>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-sky-700 mb-3">💰 매출 증빙</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <div>주문 수: <strong>{summary.purchases.toLocaleString()}</strong></div>
                  <div>순매출: <strong>₩{Math.round(summary.netRevenue).toLocaleString()}</strong></div>
                  <div>ROAS: <strong>{summary.roas?.toFixed(2) || '-'}</strong></div>
                  <div>CAC: <strong>₩{Math.round(summary.cac || 0).toLocaleString()}</strong></div>
                </div>
              </div>
            </div>

            {/* 기간 비교 (사용자 선택 옵션) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-bold">📊 기간 비교</h3>
                <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-xs">
                  <button onClick={() => setCompareMode('previous')} className={`px-2 py-1 rounded ${compareMode === 'previous' ? 'bg-white shadow-sm font-bold' : 'text-slate-500'}`}>직전 동일 기간</button>
                  <button onClick={() => setCompareMode('last_year')} className={`px-2 py-1 rounded ${compareMode === 'last_year' ? 'bg-white shadow-sm font-bold' : 'text-slate-500'}`}>전년 동기</button>
                  <button onClick={() => setCompareMode('none')} className={`px-2 py-1 rounded ${compareMode === 'none' ? 'bg-white shadow-sm font-bold' : 'text-slate-500'}`}>비교 안 함</button>
                </div>
              </div>
              {compareMode === 'none' ? (
                <div className="text-xs text-slate-400 text-center py-4">비교 기간을 선택하세요</div>
              ) : !compare || !compare.previous?.purchases ? (
                <div className="text-xs text-slate-400 text-center py-4">비교 기간 데이터가 부족합니다</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <DeltaCard label="유입" current={compare.current.landingViews} previous={compare.previous.landingViews} delta={compare.delta.landingViews} />
                  <DeltaCard label="주문" current={compare.current.purchases} previous={compare.previous.purchases} delta={compare.delta.purchases} />
                  <DeltaCard label="순매출" current={compare.current.netRevenue} previous={compare.previous.netRevenue} delta={compare.delta.netRevenue} format="currency" />
                  <DeltaCard label="CVR" current={compare.current.cvr} previous={compare.previous.cvr} delta={compare.delta.cvr} format="percent" />
                </div>
              )}
            </div>

            {/* 해석 코멘트 */}
            <div className="bg-slate-900 text-white rounded-xl p-6">
              <h3 className="text-sm font-bold text-emerald-400 mb-2">📊 결론 (자동 생성)</h3>
              <p className="text-sm leading-relaxed">
                {generateExecutiveSummary(report)}
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function DeltaCard({ label, current, previous, delta, format }: { label: string; current: number; previous: number; delta: number | null; format?: 'currency' | 'percent' }) {
  const fmt = (v: number) => format === 'currency' ? `₩${Math.round(v).toLocaleString()}` : format === 'percent' ? `${(v * 100).toFixed(1)}%` : Math.round(v).toLocaleString();
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] font-semibold text-slate-500">{label}</div>
      <div className="text-lg font-extrabold">{fmt(current)}</div>
      <div className="text-[10px] text-slate-400">이전: {fmt(previous)}</div>
      {delta !== null && (
        <div className={`text-xs font-bold inline-flex items-center gap-0.5 mt-1 ${isUp ? 'text-emerald-600' : isDown ? 'text-rose-600' : 'text-slate-500'}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null}
          {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function generateExecutiveSummary(report: any): string {
  if (!report) return '';
  const s = report.summary || {};
  const c = report.campaign || {};
  const msgs: string[] = [];

  msgs.push(`이 캠페인은 ${(c.actualImpressions || 0).toLocaleString()}회의 미디어 노출을 발생시켰으며,`);
  msgs.push(`${s.purchases || 0}건의 구매로 이어져 ₩${Math.round(s.netRevenue || 0).toLocaleString()}의 순매출을 기록했습니다.`);
  if (s.roas) {
    if (s.roas >= 3) msgs.push(`ROAS ${s.roas.toFixed(2)}x로 매우 우수한 효율성을 보였습니다.`);
    else if (s.roas >= 1) msgs.push(`ROAS ${s.roas.toFixed(2)}x로 양호한 성과를 보였습니다.`);
    else msgs.push(`ROAS ${s.roas.toFixed(2)}x로 추가 최적화가 필요합니다.`);
  }
  return msgs.join(' ');
}

/**
 * ATH-01: 선수 성과 대시보드
 *
 * Refs: wireframe_spec.docx > ATH-01
 * - 본인 클릭/유입/주문/매출 기여
 * - 콘텐츠별 성과
 * - 자산 박스 (전용 링크/코드/QR)
 * - 주문자 개인정보와 타 선수 비교 데이터는 비노출
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { GlobalFilter, GlobalFilterValue } from '../../components/funnel/GlobalFilter';
import { SummaryCard } from '../../components/funnel/SummaryCard';
import { TimeSeriesChart } from '../../components/funnel/TimeSeriesChart';
import { ActionBar } from '../../components/funnel/ActionBar';
import { api } from '../../services/api';
import { MousePointer, Users, ShoppingCart, DollarSign, Tag, Link2, Megaphone, Sparkles, Copy, Ticket } from 'lucide-react';

export default function AthleteFunnelDashboard() {
  const [filter, setFilter] = useState<GlobalFilterValue>({});
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');

  const { data: meResp } = useQuery({
    queryKey: ['my-athlete'],
    queryFn: async () => (await api.get('/athletes/me')).data,
  });
  const athleteId = (meResp as any)?.id;

  // 본인 참여 캠페인 목록
  const { data: campaignsResp } = useQuery({
    queryKey: ['athlete-campaigns', athleteId],
    queryFn: async () => {
      const r = await api.get(`/reports/athlete/${athleteId}/campaigns`);
      return r;
    },
    enabled: !!athleteId,
  });
  const campaigns = (campaignsResp?.data || []) as any[];

  const reportFilter = { ...filter, campaignId: selectedCampaign || undefined };
  const { data: reportResp, isLoading } = useQuery({
    queryKey: ['athlete-funnel-report', athleteId, reportFilter],
    queryFn: () => api.getAthleteFunnelReport(athleteId!, reportFilter),
    enabled: !!athleteId,
  });
  const report = reportResp?.data;
  const summary = report?.summary || {};
  const assets = report?.assets || { links: [], codes: [] };

  // 어필용 자동 요약
  const pitch = generatePitch(report?.athlete?.name, summary);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">내 성과 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">내 SNS·콘텐츠 활동으로 발생한 클릭·유입·주문·매출 기여를 확인하세요 (ATH-01)</p>
        </div>

        <GlobalFilter value={filter} onChange={setFilter} hideAthlete hideCampaign />

        {/* 캠페인 선택 */}
        {campaigns.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-600">내 캠페인:</span>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="flex-1 max-w-md text-sm border border-slate-200 rounded px-2 py-1"
            >
              <option value="">전체</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.brand?.name})</option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">로딩 중...</div>
        ) : (
          <>
            {/* 어필용 자동 요약 */}
            {pitch && (
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> 브랜드 설득용 자동 요약</h3>
                  <button onClick={() => navigator.clipboard.writeText(pitch)} className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs">
                    <Copy className="w-3 h-3" /> 복사
                  </button>
                </div>
                <p className="text-sm leading-relaxed">{pitch}</p>
              </div>
            )}

            {/* KPI 카드 (본인 데이터만) - wireframe TABLE 26: 클릭/유입/주문/매출 기여/코드 사용 수 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <SummaryCard label="내 클릭수" value={summary.linkClicks || 0} icon={MousePointer} />
              <SummaryCard label="내 유입수" value={summary.landingViews || 0} icon={Users} />
              <SummaryCard label="내 주문수" value={summary.purchases || 0} icon={ShoppingCart} variant="highlight" />
              <SummaryCard label="내 매출 기여" value={summary.netRevenue || 0} format="currency" icon={DollarSign} variant="highlight" />
              <SummaryCard
                label="내 코드 사용 수"
                value={(assets.codes || []).reduce((s: number, c: any) => s + (c.usageCount || 0), 0)}
                icon={Ticket}
                hint={`${(assets.codes || []).length}개 코드`}
              />
            </div>

            {/* 추이 차트 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4">일자별 클릭/주문/매출</h3>
              <TimeSeriesChart data={report?.timeseries || []} />
            </div>

            {/* 콘텐츠 + 자산 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 콘텐츠별 성과 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">콘텐츠별 성과</h3>
                <div className="space-y-2">
                  {(report?.contents || []).map((c: any) => (
                    <div key={c.contentId} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">{c.contentId}</code>
                      <div className="flex items-center gap-4 text-xs">
                        <span>클릭 <strong>{c.clicks || 0}</strong></span>
                        <span>유입 <strong>{c.landingViews || 0}</strong></span>
                        <span className="text-emerald-600">주문 <strong>{c.purchases || 0}</strong></span>
                      </div>
                    </div>
                  ))}
                  {(!report?.contents || report.contents.length === 0) && (
                    <div className="text-center py-8 text-xs text-slate-400">콘텐츠별 데이터가 없습니다</div>
                  )}
                </div>
              </div>

              {/* 자산 박스 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">내 전용 자산</h3>

                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2 inline-flex items-center gap-1"><Tag className="w-3 h-3" /> 프로모션 코드</div>
                  <div className="space-y-2">
                    {assets.codes?.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 bg-emerald-50/30 border border-emerald-100 rounded">
                        <code className="text-xs font-bold flex-1">{c.code}</code>
                        <span className="text-[10px] text-slate-500">사용 {c.usageCount}</span>
                        <ActionBar actions={[{ type: 'copy', value: c.code }]} />
                      </div>
                    ))}
                    {(!assets.codes || assets.codes.length === 0) && <div className="text-xs text-slate-400">발급된 코드가 없습니다</div>}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2 inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> 단축 링크 / QR</div>
                  <div className="space-y-2">
                    {assets.links?.map((l: any) => (
                      <div key={l.id} className="p-2 bg-slate-50 border border-slate-100 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs flex-1 font-mono">{window.location.origin}/s/{l.shortCode}</code>
                          <span className="text-[10px] text-slate-500">{l.clickCount}회</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          {l.qrUrl && <img src={l.qrUrl} alt="" className="w-12 h-12 rounded border" />}
                          <ActionBar actions={[
                            { type: 'copy', value: `${window.location.origin}/s/${l.shortCode}` },
                            ...(l.qrUrl ? [{ type: 'download' as const, label: 'QR', onClick: () => { const a = document.createElement('a'); a.href = l.qrUrl; a.download = `qr-${l.shortCode}.png`; a.click(); } }] : []),
                          ]} />
                        </div>
                      </div>
                    ))}
                    {(!assets.links || assets.links.length === 0) && <div className="text-xs text-slate-400">발급된 링크가 없습니다</div>}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function generatePitch(name: string | undefined, summary: any): string {
  if (!name || !summary || !summary.purchases) return '';
  const parts = [
    `${name} 프로의 최근 활동으로 ${summary.linkClicks?.toLocaleString() || 0}회의 클릭과 ${summary.landingViews?.toLocaleString() || 0}회의 유입을 발생시켰습니다.`,
    `이는 ${summary.purchases?.toLocaleString() || 0}건의 구매와 ₩${Math.round(summary.netRevenue || 0).toLocaleString()}의 순매출 기여로 이어졌습니다.`,
  ];
  if (summary.cvr > 0) parts.push(`전환율(CVR)은 ${(summary.cvr * 100).toFixed(2)}%로 시장 평균 대비 안정적입니다.`);
  return parts.join(' ');
}

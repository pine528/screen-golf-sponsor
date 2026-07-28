/**
 * ADM-03: 프로모션 코드·트래킹 링크 관리
 *
 * Refs: wireframe_spec.docx > ADM-03
 * - 탭: 코드 / 링크 / QR
 * - 캠페인별 필터
 * - 코드 비활성화, 링크 재생성, 콘텐츠별 추가 발급
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { ActionBar } from '../../components/funnel/ActionBar';
import { DetailTable, Column } from '../../components/funnel/DetailTable';
import { api } from '../../services/api';
import { Tag, Link2, QrCode, X, Plus, Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type Tab = 'codes' | 'links' | 'qr';

export default function AdminPromoCodesLinks() {
  const [tab, setTab] = useState<Tab>('codes');
  const [campaignId, setCampaignId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [contentFilter, setContentFilter] = useState<string>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [athleteFilter, setAthleteFilter] = useState<string>('');
  const [issuedAfter, setIssuedAfter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: campaignsResp } = useQuery({
    queryKey: ['admin-funnel-campaigns'],
    queryFn: () => api.listFunnelCampaigns(),
  });
  const campaigns = (campaignsResp?.data || []) as any[];

  const { data: codesResp } = useQuery({
    queryKey: ['promo-codes', campaignId],
    queryFn: () => api.listPromoCodes(campaignId),
    enabled: !!campaignId && tab === 'codes',
  });
  const { data: linksResp } = useQuery({
    queryKey: ['tracking-links', campaignId],
    queryFn: () => api.listTrackingLinks(campaignId),
    enabled: !!campaignId && (tab === 'links' || tab === 'qr'),
  });

  const allCodes = (codesResp?.data || []) as any[];
  const allLinks = (linksResp?.data || []) as any[];
  const codes = allCodes
    .filter((c) => !statusFilter || c.status === statusFilter)
    .filter((c) => !athleteFilter || c.athleteId === athleteFilter)
    .filter((c) => !issuedAfter || new Date(c.createdAt) >= new Date(issuedAfter));
  const links = allLinks
    .filter((l) => !statusFilter || l.status === statusFilter)
    .filter((l) => !contentFilter || (l.contentId || '').includes(contentFilter))
    .filter((l) => !contentTypeFilter || l.contentType === contentTypeFilter)
    .filter((l) => !athleteFilter || l.athleteId === athleteFilter)
    .filter((l) => !issuedAfter || new Date(l.createdAt) >= new Date(issuedAfter));

  // 선수 옵션 (현재 선택된 캠페인의 선수)
  const selectedCampaignForFilter = campaigns.find((c) => c.id === campaignId);
  const athleteOptions = selectedCampaignForFilter?.athletes || [];

  const disableCode = useMutation({
    mutationFn: (id: string) => api.disablePromoCode(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promo-codes', campaignId] }),
  });

  const [newLink, setNewLink] = useState({ contentId: '' });
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  const createLink = useMutation({
    mutationFn: () => api.createTrackingLink({
      campaignId,
      brandId: selectedCampaign?.brand?.id,
      athleteId: selectedCampaign?.athletes?.[0]?.id,
      contentId: newLink.contentId || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracking-links', campaignId] });
      setNewLink({ contentId: '' });
    },
  });

  // 일자별 추이 (캠페인 리포트 timeseries 활용)
  const { data: tsResp } = useQuery({
    queryKey: ['campaign-ts', campaignId],
    queryFn: async () => {
      const r = await api.getCampaignFunnelReport(campaignId, {});
      return r;
    },
    enabled: !!campaignId,
  });
  const timeseries = (tsResp?.data?.timeseries || []) as any[];

  const downloadCsv = (kind: 'codes' | 'links') => {
    if (!campaignId) return;
    const path = kind === 'codes' ? 'promo-codes.csv' : 'tracking-links.csv';
    const token = localStorage.getItem('accessToken');
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/admin/${path}?campaignId=${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${kind}-${campaignId}.csv`;
      a.click();
    });
  };

  // wireframe TABLE 11: 코드명 | 적용률 | 주문수 | 매출
  const codeColumns: Column<any>[] = [
    { key: 'code', label: '코드명', render: (r) => <code className="font-mono font-bold">{r.code}</code> },
    { key: 'usageRate', label: '적용률', sortable: true, align: 'right',
      render: (r) => {
        if (r.usageRate != null) return `${(r.usageRate * 100).toFixed(0)}% (${r.usageCount}/${r.maxUsage})`;
        return `${r.usageCount}회`;
      },
    },
    { key: 'orderCount', label: '주문수', sortable: true, align: 'right' },
    { key: 'revenue', label: '매출', sortable: true, align: 'right',
      render: (r) => `₩${Math.round(r.revenue || 0).toLocaleString()}`,
    },
    { key: 'discount', label: '할인',
      render: (r) => r.discountType === 'PERCENT'
        ? `${Number(r.discountValue)}%`
        : `₩${Number(r.discountValue).toLocaleString()}`,
    },
    { key: 'status', label: '상태', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: '발급일', render: (r) => r.createdAt?.slice(0, 10) },
    { key: 'action', label: '액션', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigator.clipboard.writeText(r.code)} className="p-1 text-slate-500 hover:text-slate-700"><Tag className="w-3 h-3" /></button>
          {r.status === 'ACTIVE' && (
            <button onClick={() => disableCode.mutate(r.id)} className="p-1 text-rose-500 hover:text-rose-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const linkColumns: Column<any>[] = [
    { key: 'shortCode', label: '단축코드', render: (r) => <code className="font-mono">{r.shortCode}</code> },
    { key: 'contentId', label: '콘텐츠 ID', render: (r) => r.contentId || <span className="text-slate-400">기본</span> },
    { key: 'clickCount', label: '클릭', sortable: true, align: 'right' },
    { key: 'status', label: '상태', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'action', label: '액션', align: 'right',
      render: (r) => <ActionBar actions={[{ type: 'copy', value: `${window.location.origin}/s/${r.shortCode}` }]} />,
    },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">프로모션 코드·트래킹 링크 관리</h1>
        <p className="text-sm text-slate-500 mb-6">코드와 링크를 콘텐츠 단위로 세분 발급하고 활성/비활성 및 성과를 함께 관리합니다 (ADM-03)</p>

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

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-4">
          <TabButton active={tab === 'codes'} onClick={() => setTab('codes')} icon={Tag}>Promo Codes ({codes.length})</TabButton>
          <TabButton active={tab === 'links'} onClick={() => setTab('links')} icon={Link2}>Tracking Links ({links.length})</TabButton>
          <TabButton active={tab === 'qr'} onClick={() => setTab('qr')} icon={QrCode}>QR Assets ({links.filter(l => l.qrUrl).length})</TabButton>
        </div>

        {!campaignId ? (
          <div className="text-center py-16 text-sm text-slate-400 bg-slate-50 rounded-xl">캠페인을 선택해주세요</div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4">
          {/* 좌측 필터 패널 (wireframe TABLE 11: 선수/콘텐츠 유형/상태/발급일) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 h-fit">
            <h3 className="text-xs font-bold text-slate-500 mb-2">필터</h3>

            <div className="mb-3">
              <label className="text-[10px] font-semibold text-slate-500">선수</label>
              <select value={athleteFilter} onChange={(e) => setAthleteFilter(e.target.value)} className="w-full text-xs border border-slate-200 rounded p-1.5 mt-1">
                <option value="">전체 ({athleteOptions.length}명)</option>
                {athleteOptions.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {tab === 'links' && (
              <div className="mb-3">
                <label className="text-[10px] font-semibold text-slate-500">콘텐츠 유형</label>
                <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value)} className="w-full text-xs border border-slate-200 rounded p-1.5 mt-1">
                  <option value="">전체</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="BLOG">블로그</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="text-[10px] font-semibold text-slate-500">상태</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full text-xs border border-slate-200 rounded p-1.5 mt-1">
                <option value="">전체</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
                <option value="EXPIRED">Expired</option>
                <option value="OVERUSED">Overused</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-semibold text-slate-500">발급일 이후</label>
              <input type="date" value={issuedAfter} onChange={(e) => setIssuedAfter(e.target.value)} className="w-full text-xs border border-slate-200 rounded p-1.5 mt-1" />
            </div>

            {tab === 'links' && (
              <div className="mb-3">
                <label className="text-[10px] font-semibold text-slate-500">콘텐츠 ID 검색</label>
                <input type="text" value={contentFilter} onChange={(e) => setContentFilter(e.target.value)} placeholder="instagram_..." className="w-full text-xs border border-slate-200 rounded p-1.5 mt-1" />
              </div>
            )}

            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              총 {tab === 'codes' ? codes.length : links.length}건
            </div>
          </div>

          {/* 중앙 - 목록 (기존) */}
          <div>
        {tab === 'codes' ? (
          <>
            <div className="flex justify-end mb-2">
              <button onClick={() => downloadCsv('codes')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded"><Download className="w-3 h-3" /> CSV</button>
            </div>
            <DetailTable data={codes} columns={codeColumns} pageSize={15} />
          </>
        ) : tab === 'links' ? (
          <>
            <div className="flex items-center justify-between mb-2 gap-3">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={newLink.contentId}
                  onChange={(e) => setNewLink({ contentId: e.target.value })}
                  placeholder="콘텐츠 ID (예: instagram_reel_01) - 비워두면 캠페인 기본 링크"
                  className="flex-1 max-w-md text-sm border border-slate-200 rounded px-2 py-1.5"
                />
                <button
                  onClick={() => createLink.mutate()}
                  disabled={createLink.isPending || !selectedCampaign?.athletes?.[0]}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" /> 링크 추가 발급
                </button>
              </div>
              <button onClick={() => downloadCsv('links')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded"><Download className="w-3 h-3" /> CSV</button>
            </div>
            <DetailTable data={links} columns={linkColumns} pageSize={15} />
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {links.filter(l => l.qrUrl).map((l) => (
              <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <img src={l.qrUrl} alt={l.shortCode} className="w-full aspect-square mb-2 rounded" />
                <code className="text-xs font-mono">{l.shortCode}</code>
                <div className="text-[10px] text-slate-400 mt-1">{l.clickCount}회 클릭</div>
              </div>
            ))}
            {links.filter(l => l.qrUrl).length === 0 && <div className="col-span-full text-center py-12 text-sm text-slate-400">QR 자산이 없습니다</div>}
          </div>
        )}
          </div>

          {/* 우측 상세 패널 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 h-fit">
            <h3 className="text-xs font-bold text-slate-500 mb-3">📊 빠른 분석</h3>
            {tab === 'codes' ? (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">전체 코드</span><span className="font-bold">{allCodes.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">활성</span><span className="font-bold text-emerald-600">{allCodes.filter(c => c.status === 'ACTIVE').length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">총 사용</span><span className="font-bold">{allCodes.reduce((s, c) => s + c.usageCount, 0)}회</span></div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">최근 사용</h4>
                  {allCodes.slice(0, 3).map((c) => (
                    <div key={c.id} className="text-xs py-1">
                      <code className="font-mono">{c.code}</code>
                      <span className="text-slate-400 ml-2">{c.usageCount}회</span>
                    </div>
                  ))}
                </div>
              </>
            ) : tab === 'links' ? (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">전체 링크</span><span className="font-bold">{allLinks.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">총 클릭</span><span className="font-bold text-emerald-600">{allLinks.reduce((s, l) => s + l.clickCount, 0)}회</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">콘텐츠별</span><span className="font-bold">{new Set(allLinks.map(l => l.contentId).filter(Boolean)).size}개</span></div>
                </div>
                {/* 일자별 클릭 추이 (wireframe TABLE 11) */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">📈 일자별 클릭/유입 추이</h4>
                  {timeseries.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">데이터 없음</div>
                  ) : (
                    <div style={{ width: '100%', height: 120 }}>
                      <ResponsiveContainer>
                        <LineChart data={timeseries.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip contentStyle={{ fontSize: 10 }} />
                          <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={1.5} dot={false} name="클릭" />
                          <Line type="monotone" dataKey="landingViews" stroke="#0ea5e9" strokeWidth={1.5} dot={false} name="유입" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">TOP 링크</h4>
                  {[...allLinks].sort((a, b) => b.clickCount - a.clickCount).slice(0, 3).map((l) => (
                    <div key={l.id} className="text-xs py-1 flex justify-between">
                      <code className="font-mono">{l.shortCode}</code>
                      <span className="text-emerald-600 font-bold">{l.clickCount}회</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">QR 자산은 트래킹 링크와 동일하게 집계됩니다.</div>
            )}
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-2 ${
        active ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}

/**
 * Phase 3: AdminPerformanceSettlement
 *
 * - CPA/CPS/HYBRID 캠페인 일일 정산 결과 조회
 * - 수동 정산 트리거
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { GlobalFilter, GlobalFilterValue } from '../../components/funnel/GlobalFilter';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { DetailTable, Column } from '../../components/funnel/DetailTable';
import { SummaryCard } from '../../components/funnel/SummaryCard';
import { api } from '../../services/api';
import { Coins, Play, Calendar } from 'lucide-react';

export default function AdminPerformanceSettlement() {
  const [filter, setFilter] = useState<GlobalFilterValue>({});
  const [runDate, setRunDate] = useState<string>(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['admin-settlements', filter],
    queryFn: async () => {
      const r = await api.get('/admin/funnel/settlements', { from: filter.from, to: filter.to });
      return r;
    },
  });
  const settlements = (resp?.data || []) as any[];

  const runMut = useMutation({
    mutationFn: async () => {
      const r = await api.post('/admin/funnel/settlements/run', { date: runDate });
      return r;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-settlements'] }),
  });

  const summary = {
    total: settlements.length,
    settled: settlements.filter((s) => s.status === 'SETTLED').length,
    totalAmount: settlements.reduce((sum, s) => sum + Number(s.settledAmount), 0),
    totalConversions: settlements.reduce((sum, s) => sum + s.conversionCount, 0),
  };

  const columns: Column<any>[] = [
    { key: 'periodStart', label: '정산 기간', sortable: true,
      render: (r) => `${new Date(r.periodStart).toISOString().slice(0, 10)}`,
    },
    { key: 'campaign', label: '캠페인', render: (r) => r.campaign?.name || r.campaignId.slice(0, 8) },
    { key: 'brand', label: '브랜드', render: (r) => r.brand?.name || '-' },
    { key: 'pricingModel', label: '모델', render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.pricingModel}</code> },
    { key: 'conversionCount', label: '전환', sortable: true, align: 'right' },
    { key: 'totalRevenue', label: '총매출', align: 'right',
      render: (r) => `₩${Math.round(Number(r.totalRevenue)).toLocaleString()}`,
    },
    { key: 'settledAmount', label: '정산액', sortable: true, align: 'right',
      render: (r) => <strong>₩{Math.round(Number(r.settledAmount)).toLocaleString()}</strong>,
    },
    { key: 'status', label: '상태', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'settledAt', label: '정산일시', render: (r) => r.settledAt ? new Date(r.settledAt).toLocaleString() : '-' },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2 inline-flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-500" />
          성과형 정산 관리 (Phase 3)
        </h1>
        <p className="text-sm text-slate-500 mb-6">CPA/CPS/HYBRID 캠페인의 일일 자동 정산 결과를 확인하고 수동으로도 실행할 수 있습니다</p>

        <GlobalFilter value={filter} onChange={setFilter} hideAthlete hideCampaign />

        {/* 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="총 정산 건수" value={summary.total} icon={Coins} />
          <SummaryCard label="완료" value={summary.settled} variant="highlight" />
          <SummaryCard label="총 전환 수" value={summary.totalConversions} />
          <SummaryCard label="누적 정산액" value={summary.totalAmount} format="currency" variant="highlight" />
        </div>

        {/* 수동 트리거 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">수동 정산 실행</span>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="text-sm border border-amber-300 rounded px-2 py-1.5 bg-white"
          />
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded inline-flex items-center gap-1"
          >
            <Play className="w-3 h-3" /> {runMut.isPending ? '실행 중...' : '정산 실행'}
          </button>
          {runMut.isSuccess && <span className="text-xs text-emerald-600 font-semibold">✓ 완료 ({(runMut.data as any)?.data?.length || 0}건)</span>}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">로딩 중...</div>
        ) : (
          <DetailTable data={settlements} columns={columns} pageSize={20} emptyMessage="정산 기록이 없습니다" />
        )}
      </div>
    </Layout>
  );
}

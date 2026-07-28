/**
 * ADM-01: 캠페인 목록 / 자산 상태 관리
 *
 * Refs: wireframe_spec.docx > ADM-01
 * - 검색/기간/상태/브랜드 선수 필터
 * - 요약 카드 (전체/Active/Draft/Expired)
 * - 목록 테이블 (캠페인명/브랜드/선수/기간/코드·링크·스토어 상태)
 * - 자산 생성 실패 건은 "재시도" 버튼
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { GlobalFilter, GlobalFilterValue } from '../../components/funnel/GlobalFilter';
import { SummaryCard } from '../../components/funnel/SummaryCard';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { DetailTable, Column } from '../../components/funnel/DetailTable';
import { api } from '../../services/api';
import { Megaphone, CheckCircle2, FileEdit, AlarmClock, RefreshCw, Search, Plus, Pause, Play, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CampaignRow {
  id: string;
  name: string;
  brand: { id: string; name: string };
  athletes: { id: string; name: string }[];
  status: string;
  dateStart: string | null;
  dateEnd: string | null;
  assetStatus: { promoCode: string; trackingLink: string; miniStore: string };
}

export default function AdminFunnelCampaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<GlobalFilterValue>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [athleteFilter, setAthleteFilter] = useState<string>('');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['admin-funnel-campaigns'],
    queryFn: () => api.listFunnelCampaigns(),
  });
  const all = (resp?.data || []) as CampaignRow[];

  const filtered = useMemo(() => {
    return all.filter((c) => {
      if (filter.from && c.dateStart && new Date(c.dateStart) < new Date(filter.from)) return false;
      if (filter.to && c.dateEnd && new Date(c.dateEnd) > new Date(filter.to)) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (brandFilter && c.brand.id !== brandFilter) return false;
      if (athleteFilter && !c.athletes.some((a) => a.id === athleteFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const inName = c.name.toLowerCase().includes(q);
        const inBrand = c.brand.name.toLowerCase().includes(q);
        const inAth = c.athletes.some((a) => a.name.toLowerCase().includes(q));
        if (!inName && !inBrand && !inAth) return false;
      }
      return true;
    });
  }, [all, filter, search, statusFilter]);

  const STATUS_CHIPS = [
    { value: '', label: '전체' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'COMPLETED', label: '완료' },
    { value: 'CANCELLED', label: '취소' },
  ];

  // 브랜드/선수 고유 목록 추출
  const brandOptions = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((c) => map.set(c.brand.id, c.brand.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [all]);
  const athleteOptions = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((c) => c.athletes.forEach((a) => map.set(a.id, a.name)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [all]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      total: all.length,
      active: all.filter((c) => c.status === 'ACTIVE').length,
      // 만료 예정: 종료일이 7일 이내 + 아직 active
      expiringSoon: all.filter((c) => c.status === 'ACTIVE' && c.dateEnd && new Date(c.dateEnd).getTime() - now < 7 * 86400000 && new Date(c.dateEnd).getTime() > now).length,
      // 발급 실패: 자산 중 하나라도 MISSING
      assetFailed: all.filter((c) => c.assetStatus.promoCode === 'MISSING' || c.assetStatus.trackingLink === 'MISSING' || c.assetStatus.miniStore === 'MISSING').length,
      weekNew: all.filter((c) => c.dateStart && (now - new Date(c.dateStart).getTime() < 7 * 86400000)).length,
    };
  }, [all]);

  const generateMut = useMutation({
    mutationFn: (campaignId: string) => api.generateCampaignAssets(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-funnel-campaigns'] }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/funnel/campaigns/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-funnel-campaigns'] }),
  });

  const copyCampaign = (c: CampaignRow) => {
    const text = `${c.name} (${c.brand.name})\n선수: ${c.athletes.map(a => a.name).join(', ')}\n기간: ${c.dateStart?.slice(0, 10) || '-'} ~ ${c.dateEnd?.slice(0, 10) || '-'}`;
    navigator.clipboard.writeText(text);
  };

  const columns: Column<CampaignRow>[] = [
    { key: 'name', label: '캠페인명', sortable: true,
      render: (r) => <button className="text-emerald-600 hover:underline font-semibold" onClick={(e) => { e.stopPropagation(); navigate(`/admin/funnel/campaigns/${r.id}`); }}>{r.name}</button>
    },
    { key: 'brand', label: '브랜드', render: (r) => r.brand.name },
    { key: 'athletes', label: '선수', render: (r) => r.athletes.map(a => a.name).join(', ') || '-' },
    { key: 'period', label: '기간',
      render: (r) => `${r.dateStart?.slice(0, 10) || '-'} ~ ${r.dateEnd?.slice(0, 10) || '-'}`,
    },
    { key: 'codeStatus', label: '코드', align: 'center',
      render: (r) => <StatusBadge status={r.assetStatus.promoCode} />,
    },
    { key: 'linkStatus', label: '링크', align: 'center',
      render: (r) => <StatusBadge status={r.assetStatus.trackingLink} />,
    },
    { key: 'storeStatus', label: '스토어', align: 'center',
      render: (r) => <StatusBadge status={r.assetStatus.miniStore} />,
    },
    { key: 'status', label: '상태', align: 'center',
      render: (r) => <StatusBadge status={r.status} />,
    },
    { key: 'action', label: '액션', align: 'right',
      render: (r) => {
        const allMissing = r.assetStatus.promoCode === 'MISSING' || r.assetStatus.trackingLink === 'MISSING' || r.assetStatus.miniStore === 'MISSING';
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {allMissing && (
              <button
                onClick={() => generateMut.mutate(r.id)}
                disabled={generateMut.isPending}
                title="자산 재발급"
                className="inline-flex items-center gap-1 px-1.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                <RefreshCw className={`w-3 h-3 ${generateMut.isPending ? 'animate-spin' : ''}`} />
              </button>
            )}
            {r.status === 'ACTIVE' ? (
              <button
                onClick={() => statusMut.mutate({ id: r.id, status: 'PAUSED' })}
                disabled={statusMut.isPending}
                title="일시중지"
                className="p-1 text-amber-600 hover:bg-amber-50 rounded"
              >
                <Pause className="w-3 h-3" />
              </button>
            ) : r.status === 'PAUSED' ? (
              <button
                onClick={() => statusMut.mutate({ id: r.id, status: 'ACTIVE' })}
                title="재개"
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              >
                <Play className="w-3 h-3" />
              </button>
            ) : null}
            <button
              onClick={() => copyCampaign(r)}
              title="복사"
              className="p-1 text-slate-500 hover:bg-slate-50 rounded"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-emerald-500" />
            캠페인 목록 / 자산 상태 관리
          </h1>
          <p className="text-sm text-slate-500 mt-1">활성/대기/종료 캠페인을 한 화면에서 조회하고 자산 발급 상태를 확인합니다 (ADM-01)</p>
        </div>

        {/* 헤더: 검색/상태칩/신규 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="캠페인명/브랜드/선수 검색"
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => setStatusFilter(c.value)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-full border ${statusFilter === c.value ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Link to="/campaigns" className="ml-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 신규 캠페인
          </Link>
        </div>

        {/* 브랜드/선수 드롭다운 (wireframe TABLE 6) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">브랜드</span>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 max-w-[200px]">
            <option value="">전체 ({brandOptions.length}개)</option>
            {brandOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="text-xs font-semibold text-slate-500 ml-2">선수</span>
          <select value={athleteFilter} onChange={(e) => setAthleteFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 max-w-[200px]">
            <option value="">전체 ({athleteOptions.length}명)</option>
            {athleteOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <GlobalFilter value={filter} onChange={setFilter} hideCampaign hideAthlete />

        {/* Summary cards (wireframe TABLE 6) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <SummaryCard label="전체 캠페인" value={counts.total} icon={Megaphone} />
          <SummaryCard label="활성" value={counts.active} icon={CheckCircle2} variant="highlight" />
          <SummaryCard label="만료 예정 (7일↓)" value={counts.expiringSoon} icon={AlarmClock} hint="조기 알림" />
          <SummaryCard label="발급 실패" value={counts.assetFailed} icon={FileEdit} hint="자산 미발급" />
          <SummaryCard label="이번 주 신규" value={counts.weekNew} />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">로딩 중...</div>
        ) : (
          <DetailTable data={filtered} columns={columns} pageSize={20}
            onRowClick={(r) => navigate(`/admin/funnel/campaigns/${r.id}`)}
          />
        )}
      </div>
    </Layout>
  );
}

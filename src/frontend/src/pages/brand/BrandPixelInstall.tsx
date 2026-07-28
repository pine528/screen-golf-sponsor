/**
 * Phase 2: 브랜드 픽셀 설치 가이드 화면
 *
 * - 픽셀 키 발급
 * - 도메인 화이트리스트 관리
 * - 설치 가이드 + 코드 복사
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ActionBar } from '../../components/funnel/ActionBar';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { api } from '../../services/api';
import { Code, Plus, X, Globe } from 'lucide-react';

export default function BrandPixelInstall() {
  const queryClient = useQueryClient();

  const { data: meResp } = useQuery({
    queryKey: ['my-brand'],
    queryFn: async () => (await api.get('/brands/me')).data,
  });
  const brandId = (meResp as any)?.id;

  const { data: pixelResp } = useQuery({
    queryKey: ['my-pixel', brandId],
    queryFn: () => api.getPixel(brandId!),
    enabled: !!brandId,
    retry: false,
  });
  const pixel = pixelResp?.data;

  const createMut = useMutation({
    mutationFn: () => api.createPixel(brandId, []),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-pixel', brandId] }),
  });

  const [domains, setDomains] = useState<string[]>(pixel?.domains || []);
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => { if (pixel?.domains) setDomains(pixel.domains); }, [pixel]);

  const updateMut = useMutation({
    mutationFn: () => api.updatePixel(brandId!, { domains }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-pixel', brandId] }),
  });

  const installCode = pixel ? `<script async src="${window.location.origin}/pixel/sponpik-pixel.js" data-pixel-key="${pixel.pixelKey}"></script>
<script>
  // 페이지 진입 자동 트래킹
  sponpik('landing_view', { campaign_id: 'YOUR_CAMPAIGN_ID' });
  // 구매 완료 시 호출
  sponpik('purchase', {
    order_id: 'ORDER_NUMBER',
    campaign_id: 'YOUR_CAMPAIGN_ID',
    gross_amount: 59000,
    net_amount: 47200,
    items: [{ product_id: 'PRD_001', qty: 1, unit_price: 59000 }]
  });
</script>` : '';

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">외부몰 픽셀 설치 (Phase 2)</h1>
        <p className="text-sm text-slate-500 mb-6">자사몰에 JS 스크립트를 설치하여 외부 구매 데이터를 자동 트래킹합니다</p>

        {!pixel ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">아직 픽셀이 발급되지 않았습니다</p>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg"
            >
              {createMut.isPending ? '발급 중...' : '픽셀 키 발급받기'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 픽셀 정보 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold inline-flex items-center gap-2"><Code className="w-4 h-4" /> 픽셀 키</h3>
                <StatusBadge status={pixel.status} />
              </div>
              <div className="bg-slate-50 px-3 py-2 rounded font-mono text-sm break-all mb-3">{pixel.pixelKey}</div>
              <ActionBar actions={[{ type: 'copy', value: pixel.pixelKey }]} />
            </div>

            {/* 도메인 화이트리스트 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold mb-3">허용 도메인 (CORS 화이트리스트)</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {domains.map((d, i) => (
                  <div key={i} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs">
                    {d}
                    <button onClick={() => setDomains(domains.filter((_, idx) => idx !== i))} className="text-emerald-500 hover:text-emerald-700">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {domains.length === 0 && <span className="text-xs text-slate-400">도메인 없음 (모든 도메인 허용)</span>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5"
                />
                <button onClick={() => { if (newDomain) { setDomains([...domains, newDomain]); setNewDomain(''); } }} className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" /> 추가
                </button>
                <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg">
                  저장
                </button>
              </div>
            </div>

            {/* 설치 코드 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold mb-3">설치 코드</h3>
              <p className="text-xs text-slate-500 mb-3">아래 코드를 자사몰의 <code>&lt;head&gt;</code>에 추가하세요</p>
              <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre">{installCode}</pre>
              <div className="mt-3">
                <ActionBar actions={[{ type: 'copy', value: installCode, label: '코드 복사' }]} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

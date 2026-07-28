/**
 * ADM-04: 브랜드 미니스토어 설정·미리보기
 *
 * Refs: wireframe_spec.docx > ADM-04
 * - 좌: 설정 패널 (로고/선수 이미지/혜택 문구/CTA)
 * - 우: 모바일/PC 미리보기
 * - 게시/비게시 전환
 * - 상품 추가/순서 변경
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { api } from '../../services/api';
import { Eye, Save, Globe, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Smartphone, Monitor } from 'lucide-react';

export default function AdminMiniStoreSettings() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mini-store', campaignId],
    queryFn: () => api.getMiniStore(campaignId!),
    enabled: !!campaignId,
  });
  const store = data?.data;

  const [form, setForm] = useState({
    brandLogoUrl: '', themeColor: '#10b981', heroImageUrl: '', athleteImageUrl: '', mainCopy: '', benefitBadge: '', ctaText: '구매하기',
  });

  useEffect(() => {
    if (store) {
      setForm({
        brandLogoUrl: store.brandLogoUrl || '',
        themeColor: store.themeColor || '#10b981',
        heroImageUrl: store.heroImageUrl || '',
        athleteImageUrl: store.athleteImageUrl || '',
        mainCopy: store.mainCopy || '',
        benefitBadge: store.benefitBadge || '',
        ctaText: store.ctaText || '구매하기',
      });
    }
  }, [store]);

  const PRESET_COLORS = [
    { value: '#10b981', label: '에메랄드' },
    { value: '#0ea5e9', label: '스카이' },
    { value: '#8b5cf6', label: '바이올렛' },
    { value: '#f59e0b', label: '앰버' },
    { value: '#ef4444', label: '로즈' },
    { value: '#1e293b', label: '슬레이트' },
  ];

  const saveMut = useMutation({
    mutationFn: () => api.updateMiniStore(campaignId!, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mini-store', campaignId] }),
  });

  const publishMut = useMutation({
    mutationFn: (status: 'PUBLISHED' | 'HIDDEN') => api.publishMiniStore(campaignId!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mini-store', campaignId] }),
  });

  const addProductMut = useMutation({
    mutationFn: (body: any) => api.addStoreProduct(campaignId!, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mini-store', campaignId] }),
  });

  const deleteProductMut = useMutation({
    mutationFn: (productId: string) => api.deleteStoreProduct(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mini-store', campaignId] }),
  });

  const [newProd, setNewProd] = useState({ name: '', imageUrl: '', price: 0, discountPrice: 0, stock: 100 });
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  const reorderMut = useMutation({
    mutationFn: (args: { productId: string; sortOrder: number }) => api.updateStoreProduct(args.productId, { sortOrder: args.sortOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mini-store', campaignId] }),
  });

  const moveProduct = (products: any[], idx: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= products.length) return;
    const cur = products[idx];
    const swap = products[target];
    reorderMut.mutate({ productId: cur.id, sortOrder: swap.sortOrder });
    reorderMut.mutate({ productId: swap.id, sortOrder: cur.sortOrder });
  };

  if (isLoading) return <Layout><div className="p-6">로딩 중...</div></Layout>;
  if (!store) return <Layout><div className="p-6">미니스토어가 없습니다. 먼저 캠페인 자산을 생성해주세요.</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">미니스토어 설정</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
              <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{store.slug}</code>
              <StatusBadge status={store.status} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
              <Save className="w-4 h-4" /> 저장
            </button>
            {store.status === 'PUBLISHED' ? (
              <button onClick={() => publishMut.mutate('HIDDEN')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
                <EyeOff className="w-4 h-4" /> 비게시
              </button>
            ) : (
              <button onClick={() => publishMut.mutate('PUBLISHED')} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> 게시
              </button>
            )}
            <a href={`/store/brand/${store.slug}`} target="_blank" rel="noreferrer" className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> 미리보기
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 좌: 설정 패널 */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">기본 설정</h3>
              <div className="space-y-3">
                <FormField label="브랜드 로고 URL" value={form.brandLogoUrl} onChange={(v: string) => setForm({ ...form, brandLogoUrl: v })} placeholder="https://... (Hero 좌상단 표시)" />
                <FormField label="Hero 이미지 URL" value={form.heroImageUrl} onChange={(v: string) => setForm({ ...form, heroImageUrl: v })} placeholder="https://..." />
                <FormField label="선수 이미지 URL" value={form.athleteImageUrl} onChange={(v: string) => setForm({ ...form, athleteImageUrl: v })} placeholder="https://..." />
                <FormField label="메인 카피" value={form.mainCopy} onChange={(v: string) => setForm({ ...form, mainCopy: v })} placeholder="OO선수와 함께하는 특별한 혜택" />
                <FormField label="혜택 배지" value={form.benefitBadge} onChange={(v: string) => setForm({ ...form, benefitBadge: v })} placeholder="선수 추천 단독 20% 할인" />
                <FormField label="CTA 버튼 텍스트" value={form.ctaText} onChange={(v: string) => setForm({ ...form, ctaText: v })} placeholder="구매하기" />

                {/* 테마 컬러 (wireframe TABLE 14) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">테마 컬러</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setForm({ ...form, themeColor: c.value })}
                        className={`w-8 h-8 rounded-full border-2 ${form.themeColor === c.value ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-300' : 'border-white shadow'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.themeColor}
                      onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                      title="커스텀 컬러"
                    />
                    <code className="text-xs text-slate-500 ml-2">{form.themeColor}</code>
                  </div>
                </div>
              </div>
            </div>

            {/* 상품 관리 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">상품 ({store.products?.length || 0})</h3>
              <div className="space-y-2 mb-4">
                {(store.products || []).map((p: any, idx: number) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
                    <div className="flex flex-col">
                      <button onClick={() => moveProduct(store.products, idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveProduct(store.products, idx, 'down')} disabled={idx === (store.products.length - 1)} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                    <div className="relative">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 bg-slate-100 rounded" />}
                      {p.soldOut && <span className="absolute inset-0 bg-rose-500/80 text-white text-[9px] font-extrabold rounded flex items-center justify-center">품절</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">₩{Number(p.price).toLocaleString()} {p.discountPrice && `→ ₩${Number(p.discountPrice).toLocaleString()}`}</div>
                    </div>
                    {p.soldOut ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">품절</span>
                    ) : p.stock <= 5 ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">재고 {p.stock}</span>
                    ) : (
                      <span className="text-xs text-slate-400">재고 {p.stock}</span>
                    )}
                    <button onClick={() => deleteProductMut.mutate(p.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(!store.products || store.products.length === 0) && (
                  <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded">아직 상품이 없습니다</div>
                )}
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <input type="text" placeholder="상품명" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5" />
                <input type="text" placeholder="이미지 URL" value={newProd.imageUrl} onChange={(e) => setNewProd({ ...newProd, imageUrl: e.target.value })} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" placeholder="가격" value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: Number(e.target.value) })} className="text-sm border border-slate-200 rounded px-2 py-1.5" />
                  <input type="number" placeholder="할인가" value={newProd.discountPrice} onChange={(e) => setNewProd({ ...newProd, discountPrice: Number(e.target.value) })} className="text-sm border border-slate-200 rounded px-2 py-1.5" />
                  <input type="number" placeholder="재고" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: Number(e.target.value) })} className="text-sm border border-slate-200 rounded px-2 py-1.5" />
                </div>
                <button
                  onClick={() => { addProductMut.mutate(newProd); setNewProd({ name: '', imageUrl: '', price: 0, discountPrice: 0, stock: 100 }); }}
                  disabled={!newProd.name || addProductMut.isPending}
                  className="w-full px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded inline-flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> 상품 추가
                </button>
              </div>
            </div>
          </div>

          {/* 우: 미리보기 */}
          <div className="bg-slate-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">실시간 미리보기</span>
              <div className="inline-flex bg-white rounded-lg p-0.5">
                <button onClick={() => setPreviewMode('mobile')} className={`px-2 py-1 rounded inline-flex items-center gap-1 text-xs ${previewMode === 'mobile' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}>
                  <Smartphone className="w-3 h-3" /> 모바일
                </button>
                <button onClick={() => setPreviewMode('desktop')} className={`px-2 py-1 rounded inline-flex items-center gap-1 text-xs ${previewMode === 'desktop' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}>
                  <Monitor className="w-3 h-3" /> PC
                </button>
              </div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm mx-auto overflow-hidden ${previewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'}`}>
              <div
                className="text-white p-5 relative"
                style={{ background: `linear-gradient(135deg, ${form.themeColor} 0%, ${darken(form.themeColor, 15)} 100%)` }}
              >
                {/* 브랜드 로고 (좌상단) */}
                {form.brandLogoUrl && (
                  <img src={form.brandLogoUrl} alt="brand" className="absolute top-3 left-3 h-8 bg-white/90 rounded px-2 py-0.5 object-contain" />
                )}
                {form.athleteImageUrl && <img src={form.athleteImageUrl} alt="" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white object-cover" />}
                <div className="text-center">
                  <div className="text-lg font-bold">{form.mainCopy || '메인 카피를 입력하세요'}</div>
                  {form.benefitBadge && <div className="inline-block mt-2 px-3 py-1 bg-yellow-300 text-slate-900 text-xs font-bold rounded-full">{form.benefitBadge}</div>}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {(store.products || []).slice(0, 3).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 border border-slate-100 rounded-lg">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 bg-slate-100 rounded" />}
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{p.name}</div>
                      <div className="text-xs text-emerald-600 font-bold">₩{Number(p.discountPrice || p.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full text-white py-3 font-bold text-sm" style={{ backgroundColor: form.themeColor }}>{form.ctaText}</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// hex 컬러 darken 헬퍼 (간단한 버전)
function darken(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0xff) - amt);
  const B = Math.max(0, (num & 0xff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function FormField({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
      />
    </div>
  );
}

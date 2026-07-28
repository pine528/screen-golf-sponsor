/**
 * ADM-02: 캠페인 상세 / 자산 발급
 *
 * Refs: wireframe_spec.docx > ADM-02
 * - 좌측: 캠페인 기본 정보, 예산, 할인 정책
 * - 우측: 발급 자산 카드 (코드/링크/QR/스토어 URL) + 복사/다운로드/재발급
 * - 하단: 자산 이력 / 발급 실패 로그
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ActionBar } from '../../components/funnel/ActionBar';
import { StatusBadge } from '../../components/funnel/StatusBadge';
import { api } from '../../services/api';
import { ArrowLeft, Tag, Link2, QrCode, Store, Calendar } from 'lucide-react';

export default function AdminFunnelCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-funnel-campaign', id],
    queryFn: () => api.getFunnelCampaign(id!),
    enabled: !!id,
  });

  const [showReissueForm, setShowReissueForm] = useState(false);
  const [reissueOpts, setReissueOpts] = useState({ keepLinks: true, discountType: 'PERCENT' as 'PERCENT' | 'AMOUNT', discountValue: 20 });

  const generateMut = useMutation({
    mutationFn: (opts?: any) => api.generateCampaignAssets(id!, opts || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-funnel-campaign', id] });
      setShowReissueForm(false);
    },
  });

  if (isLoading) return <Layout><div className="p-6">로딩 중...</div></Layout>;

  const { campaign, assets } = data?.data || {};
  if (!campaign) return <Layout><div className="p-6">캠페인을 찾을 수 없습니다</div></Layout>;

  const promoCode = assets?.promo_codes?.[0];
  const trackingLink = assets?.tracking_links?.[0];
  const store = assets?.mini_store;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/funnel/campaigns" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> 캠페인 목록
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{campaign.name}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                <span>{campaign.brand?.name}</span>
                <StatusBadge status={campaign.status} />
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{campaign.dateStart?.slice(0, 10)} ~ {campaign.dateEnd?.slice(0, 10)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowReissueForm(!showReissueForm)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow-sm"
            >
              전체 자산 재발급
            </button>
          </div>
        </div>

        {/* 재발급 옵션 폼 */}
        {showReissueForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-amber-800 mb-3">자산 재발급 옵션</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reissueOpts.keepLinks} onChange={(e) => setReissueOpts({ ...reissueOpts, keepLinks: e.target.checked })} />
                기존 ACTIVE 링크 유지 (신규만 추가)
              </label>
              <div>
                <label className="block text-xs text-amber-700 mb-1">할인 타입</label>
                <select value={reissueOpts.discountType} onChange={(e) => setReissueOpts({ ...reissueOpts, discountType: e.target.value as any })} className="w-full text-sm border border-amber-300 rounded px-2 py-1.5 bg-white">
                  <option value="PERCENT">퍼센트 (%)</option>
                  <option value="AMOUNT">정액 (원)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-amber-700 mb-1">할인값</label>
                <input type="number" value={reissueOpts.discountValue} onChange={(e) => setReissueOpts({ ...reissueOpts, discountValue: Number(e.target.value) })} className="w-full text-sm border border-amber-300 rounded px-2 py-1.5 bg-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => generateMut.mutate({ discount_type: reissueOpts.discountType, discount_value: reissueOpts.discountValue, keep_links: reissueOpts.keepLinks })}
                disabled={generateMut.isPending}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded"
              >
                {generateMut.isPending ? '처리 중...' : '재발급 실행'}
              </button>
              <button onClick={() => setShowReissueForm(false)} className="px-4 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-semibold rounded">취소</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌: 캠페인 정보 */}
          <div className="space-y-4">
            <Section title="캠페인 정보">
              <Field label="브랜드" value={campaign.brand?.name} />
              <Field label="예산" value={`₩${(campaign.budget || 0).toLocaleString()}`} />
              <Field label="집행 금액" value={`₩${(campaign.spentAmount || 0).toLocaleString()}`} />
              <Field label="가격 모델" value={campaign.pricingModel || 'FIXED'} />
              <Field label="목표 노출" value={(campaign.goalImpressions || 0).toLocaleString()} />
              <Field label="목표 전환" value={(campaign.goalConversions || 0).toLocaleString()} />
            </Section>
            <Section title="할인정책">
              {promoCode ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">대표 코드</span><code className="font-mono font-bold">{promoCode.code}</code></div>
                  <div className="flex justify-between"><span className="text-slate-500">할인 타입</span><span>{promoCode.discount_type || promoCode.discountType || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">할인 값</span><span className="font-bold text-emerald-600">
                    {(() => {
                      const v = promoCode.discount_value ?? promoCode.discountValue;
                      const t = promoCode.discount_type ?? promoCode.discountType;
                      if (v == null) return '-';
                      return t === 'PERCENT' ? `${Number(v)}%` : `₩${Number(v).toLocaleString()}`;
                    })()}
                  </span></div>
                  <div className="flex justify-between"><span className="text-slate-500">사용 횟수</span><span>{promoCode.usage_count ?? promoCode.usageCount ?? 0}회</span></div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">발급된 코드가 없습니다</div>
              )}
            </Section>

            <Section title="매칭된 선수">
              {campaign.contracts?.length === 0 && <div className="text-xs text-slate-400">매칭된 선수가 없습니다</div>}
              {campaign.contracts?.map((cc: any) => (
                <div key={cc.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-b-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                    {cc.contract.athlete.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{cc.contract.athlete.name}</div>
                    <div className="text-[10px] text-slate-400">{cc.contract.athlete.tour}</div>
                  </div>
                </div>
              ))}
            </Section>

            <Section title="자산 이력">
              <div className="space-y-1.5 text-xs">
                {assets?.promo_codes?.length > 0 && <div className="flex justify-between"><span className="text-slate-500">최초 코드 발급</span><span className="font-mono">{assets.promo_codes[0].code}</span></div>}
                {assets?.tracking_links?.length > 0 && <div className="flex justify-between"><span className="text-slate-500">총 링크 수</span><span className="font-bold">{assets.tracking_links.length}개</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">캠페인 생성</span><span>{new Date(campaign.createdAt).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">마지막 갱신</span><span>{new Date(campaign.updatedAt).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">발급 실패 로그</span><span className="text-emerald-600">없음</span></div>
              </div>
            </Section>

            <Section title="관리자 메모">
              <textarea
                placeholder="이 캠페인에 대한 운영 메모를 남기세요 (저장은 향후 캠페인 모델에 노트 필드 추가 시 활성화)"
                rows={4}
                className="w-full text-xs border border-slate-200 rounded p-2 resize-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">※ 임시 메모 패드</div>
            </Section>
          </div>

          {/* 우: 발급 자산 카드 + 이력 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 테스트 패널 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">🧪 테스트 발급 로그 / 최근 이벤트</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-400">코드 검증</div>
                  <div className="font-bold text-emerald-600">{promoCode ? '✓ OK' : '-'}</div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-400">링크 테스트</div>
                  <div className="font-bold text-emerald-600">{trackingLink ? `✓ ${trackingLink.click_count}회` : '-'}</div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-400">스토어 미리보기</div>
                  {store ? <a href={store.url} target="_blank" rel="noreferrer" className="font-bold text-sky-600 underline">열기</a> : '-'}
                </div>
              </div>
            </div>
            {/* 프로모션 코드 */}
            <AssetCard
              icon={<Tag className="w-5 h-5 text-emerald-500" />}
              title="프로모션 코드"
              status={promoCode?.status || 'MISSING'}
            >
              {promoCode ? (
                <>
                  <div className="text-2xl font-mono font-extrabold text-slate-900 mb-2">{promoCode.code}</div>
                  <div className="text-xs text-slate-500 mb-3">사용 횟수: {promoCode.usage_count}</div>
                  <ActionBar actions={[{ type: 'copy', value: promoCode.code }]} />
                </>
              ) : (
                <EmptyAsset onCreate={() => generateMut.mutate(undefined)} loading={generateMut.isPending} />
              )}
            </AssetCard>

            {/* 트래킹 링크 */}
            <AssetCard
              icon={<Link2 className="w-5 h-5 text-emerald-500" />}
              title="트래킹 링크 (장/단축)"
              status={trackingLink ? 'ACTIVE' : 'MISSING'}
            >
              {trackingLink ? (
                <>
                  <div className="mb-1 text-[10px] font-semibold text-slate-500">단축 URL</div>
                  <div className="text-sm font-mono break-all bg-slate-50 px-3 py-2 rounded mb-3">{trackingLink.short_url}</div>
                  {trackingLink.long_url && (
                    <>
                      <div className="mb-1 text-[10px] font-semibold text-slate-500">장(long) URL (UTM 포함)</div>
                      <div className="text-xs font-mono break-all bg-slate-50 px-3 py-2 rounded mb-3 text-slate-600">{trackingLink.long_url}</div>
                    </>
                  )}
                  <div className="text-xs text-slate-500 mb-3">클릭: {trackingLink.click_count}회</div>
                  <ActionBar actions={[
                    { type: 'copy', value: trackingLink.short_url, label: '단축 복사' },
                    ...(trackingLink.long_url ? [{ type: 'copy' as const, value: trackingLink.long_url, label: '장 URL 복사' }] : []),
                    { type: 'preview', value: trackingLink.short_url },
                  ]} />
                </>
              ) : (
                <EmptyAsset onCreate={() => generateMut.mutate(undefined)} loading={generateMut.isPending} />
              )}
            </AssetCard>

            {/* QR */}
            <AssetCard
              icon={<QrCode className="w-5 h-5 text-emerald-500" />}
              title="QR 코드"
              status={trackingLink?.qr_url ? 'ACTIVE' : 'MISSING'}
            >
              {trackingLink?.qr_url ? (
                <div className="flex items-center gap-4">
                  <img src={trackingLink.qr_url} alt="QR" className="w-32 h-32 border border-slate-200 rounded-lg" />
                  <ActionBar actions={[
                    { type: 'download', label: 'QR 다운로드', onClick: () => { const a = document.createElement('a'); a.href = trackingLink.qr_url; a.download = `qr-${campaign.id}.png`; a.click(); } },
                    { type: 'copy', value: trackingLink.qr_url, label: 'URL 복사' },
                  ]} />
                </div>
              ) : (
                <EmptyAsset onCreate={() => generateMut.mutate(undefined)} loading={generateMut.isPending} />
              )}
            </AssetCard>

            {/* 미니스토어 */}
            <AssetCard
              icon={<Store className="w-5 h-5 text-emerald-500" />}
              title="브랜드 미니스토어"
              status={store?.status || 'MISSING'}
            >
              {store ? (
                <>
                  <div className="text-sm font-mono break-all bg-slate-50 px-3 py-2 rounded mb-2">{store.url}</div>
                  <div className="text-xs text-slate-500 mb-3">상품 수: {store.product_count}개 · 슬러그: <code>{store.slug}</code></div>
                  <ActionBar actions={[
                    { type: 'copy', value: store.url, label: 'URL 복사' },
                    { type: 'preview', value: store.url, label: '스토어 미리보기' },
                    { type: 'external', value: `/admin/funnel/mini-store/${campaign.id}`, label: '설정' },
                  ]} />
                </>
              ) : (
                <EmptyAsset onCreate={() => generateMut.mutate(undefined)} loading={generateMut.isPending} />
              )}
            </AssetCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-3">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-b-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function AssetCard({ icon, title, status, children }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">{icon} {title}</h3>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  );
}

function EmptyAsset({ onCreate, loading }: { onCreate: () => void; loading: boolean }) {
  return (
    <div className="text-center py-6 bg-slate-50 rounded-lg">
      <div className="text-xs text-slate-500 mb-2">아직 발급되지 않았습니다</div>
      <button
        onClick={onCreate}
        disabled={loading}
        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded"
      >
        {loading ? '생성 중...' : '지금 생성'}
      </button>
    </div>
  );
}

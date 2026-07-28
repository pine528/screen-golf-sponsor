/**
 * 개편 Phase 2 (WF-04) — 선수 상세 통합 구매화면
 *
 * 데스크톱 3열: 선수정보 요약 · 슬롯 인벤토리(착장 도식) · 후원상품 구성 패널
 * 모바일 1열 + 하단 고정 구매바 (§26 반응형 기준)
 *
 * 완료조건(§7.10)
 *  - 선수정보와 슬롯정보가 동일 화면에 표시
 *  - 선택 결과가 우측 패널·하단바에 실시간 반영
 *  - 페이지 이동 없이 기간·슬롯·추가활동 변경 가능
 *  - 동일 슬롯 중복판매 차단 (서버 SlotInventory 상태 기준)
 */
import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Gavel, ShoppingCart, MessageCircle, Info } from 'lucide-react';
import { api } from '../../services/api';
import LegalNotice from '../LegalNotice';
import SlotDiagram, { STATUS_META, type DiagramSlot } from './SlotDiagram';
import SlotDetailDrawer from './SlotDetailDrawer';

const krw = (v: any) => (v == null ? '—' : `${Number(v).toLocaleString()}원`);

type PeriodKey = 'SINGLE_EVENT' | 'DAYS_30' | 'MONTHS_6' | 'MONTHS_12';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'SINGLE_EVENT', label: '1회 출전' },
  { key: 'DAYS_30', label: '30일' },
  { key: 'MONTHS_6', label: '6개월' },
  { key: 'MONTHS_12', label: '12개월' },
];

type ProductType = 'APPAREL' | 'SNS' | 'STORE';
const PRODUCT_TYPES: { key: ProductType; label: string }[] = [
  { key: 'APPAREL', label: '착장' },
  { key: 'SNS', label: 'SNS' },
  { key: 'STORE', label: '매장' },
];

const ADDONS = [
  { key: 'SNS_STORY', label: 'SNS 스토리' },
  { key: 'SNS_FEED', label: 'SNS 피드' },
  { key: 'STORE_VISIT', label: '매장 방문' },
  { key: 'EVENT', label: '행사 참석' },
];

function openKakaoConsult() {
  const channelId = (import.meta.env.VITE_KAKAO_CHANNEL_ID as string) || '_xmpxknX';
  window.open(`https://pf.kakao.com/${channelId}/chat`, '_blank', 'noopener,noreferrer');
}

export default function UnifiedPurchase({
  athlete,
  slotInstances,
  inventorySlots,
  inventoryLoading,
  isAuthenticated,
  userRole,
  onLogin,
}: {
  athlete: any;
  slotInstances: any[];
  inventorySlots: any[];
  inventoryLoading: boolean;
  isAuthenticated: boolean;
  userRole?: string;
  onLogin: () => void;
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('SINGLE_EVENT');
  const [productType, setProductType] = useState<ProductType>('APPAREL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [error, setError] = useState('');

  /** 인벤토리(재고·상태) + 기존 슬롯 인스턴스(가격·거래방식·경매)를 병합 */
  const slots = useMemo(() => {
    const byInstanceId = new Map(slotInstances.map((si: any) => [si.id, si]));
    return inventorySlots.map((as: any) => {
      const inv = (as.inventories || [])[0] || null;
      const instance = inv?.slotInstanceId ? byInstanceId.get(inv.slotInstanceId) : undefined;
      const isInquiry = !!instance && !instance.enableAuction && !instance.enableDirectBuy;
      const saleMode: 'AUCTION' | 'DIRECT' | 'INQUIRY' = instance?.auction
        ? 'AUCTION'
        : isInquiry
          ? 'INQUIRY'
          : 'DIRECT';
      return {
        id: as.id,
        code: as.slotTemplate?.code,
        name: as.slotTemplate?.nameKr || as.slotTemplate?.name || as.slotTemplate?.code,
        x: as.slotTemplate?.displayX ?? null,
        y: as.slotTemplate?.displayY ?? null,
        status: inv?.status || 'UNAVAILABLE',
        price: instance?.directBuyPrice ?? instance?.reservePrice ?? null,
        template: as.slotTemplate,
        inventory: inv,
        instance,
        saleMode,
        saleModeLabel: saleMode === 'AUCTION' ? '경매' : saleMode === 'INQUIRY' ? '스폰픽 협의' : '바로 구매',
      };
    });
  }, [inventorySlots, slotInstances]);

  /** 현재 기간에 실제 판매 가능한 슬롯 — 1회 출전 외 기간은 아직 인벤토리 없음 */
  const periodSlots = period === 'SINGLE_EVENT' ? slots : [];
  const eventName = slotInstances[0]?.event?.name || '';
  const periodLabel = period === 'SINGLE_EVENT' ? eventName || '1회 출전' : PERIODS.find((p) => p.key === period)!.label;

  const selected = periodSlots.find((s) => s.id === selectedId) || null;
  const drawerSlot = periodSlots.find((s) => s.id === drawerId) || null;
  const selectable = (s: any) => STATUS_META[s.status]?.selectable;

  const alternatives = useMemo(
    () =>
      periodSlots
        .filter((s) => s.id !== drawerId && selectable(s))
        .slice(0, 6)
        .map((s) => ({ id: s.id, name: s.name, status: s.status })),
    [periodSlots, drawerId]
  );

  /**
   * 개편 Phase 3 (§13.2): 바로 구매는 즉시 계약이 아니라 15분 임시예약 후 주문확인 화면으로 간다.
   */
  const buyNowMut = useMutation({
    mutationFn: (instanceId: string) => api.holdSlot(instanceId),
    onSuccess: (_res, instanceId) => {
      navigate(`/checkout/slots/${instanceId}`);
    },
    onError: (e: any) => {
      const err = e?.response?.data?.error;
      setError((typeof err === 'object' ? err?.message : err) || '슬롯 예약에 실패했습니다');
    },
  });

  const handleCta = () => {
    setError('');
    if (!selected) return;
    if (selected.saleMode === 'INQUIRY') return openKakaoConsult();
    if (!isAuthenticated) return onLogin();
    if (userRole !== 'BRAND') {
      setError('브랜드 계정만 구매·입찰할 수 있습니다.');
      return;
    }
    if (selected.saleMode === 'AUCTION') {
      const auctionId = selected.instance?.auction?.id;
      if (auctionId) navigate(`/auctions/${auctionId}`);
      return;
    }
    if (!selected.instance?.id) {
      setError('구매 가능한 슬롯 정보를 찾을 수 없습니다.');
      return;
    }
    // 추가활동은 가격 정책 확정 전이라 자동 결제에 포함하지 않는다 (§14 가격정책 미확정)
    if (addons.length > 0 && !confirm('추가활동(SNS·매장 등)은 별도 협의 항목입니다.\n슬롯만 먼저 진행하고 추가활동은 상담으로 이어갈까요?')) return;
    buyNowMut.mutate(selected.instance.id);
  };

  const ctaLabel =
    !selected
      ? '슬롯을 선택해 주세요'
      : selected.saleMode === 'AUCTION'
        ? '입찰하기'
        : selected.saleMode === 'INQUIRY'
          ? '파트너십 제안'
          : '바로 구매';
  const ctaDisabled = !selected || !selectable(selected) || buyNowMut.isPending;

  return (
    <section data-section="purchase" className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
      <h2 className="text-xl font-extrabold text-slate-900 mb-1 inline-flex items-center gap-2">
        <Gavel className="w-5 h-5 text-emerald-500" />
        진행중인 스폰서십 슬롯
        {periodSlots.length > 0 && <span className="text-sm font-semibold text-slate-500">({periodSlots.length}개)</span>}
      </h2>
      <p className="text-sm text-slate-500 mb-4 break-keep">
        기간과 슬롯을 고르면 오른쪽에서 바로 계약을 시작할 수 있습니다.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-5 items-start">
        {/* ── 좌: 선수정보 요약 ── */}
        <AthleteSummaryColumn athlete={athlete} />

        {/* ── 중: 슬롯 인벤토리 ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm font-bold text-slate-900 mb-3">슬롯 인벤토리</div>

          {inventoryLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">슬롯 정보를 불러오는 중...</div>
          ) : periodSlots.length === 0 ? (
            <EmptyPeriod onOtherPeriod={() => setPeriod('SINGLE_EVENT')} onPropose={openKakaoConsult} />
          ) : (
            <>
              <SlotDiagram
                slots={periodSlots as DiagramSlot[]}
                selectedId={selectedId}
                onSelect={(s) => setDrawerId(s.id)}
              />

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-xs font-bold text-slate-700 mb-2">슬롯 목록</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {periodSlots.map((s) => {
                    const meta = STATUS_META[s.status] || STATUS_META.UNAVAILABLE;
                    const on = s.id === selectedId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => (selectable(s) ? setSelectedId(s.id) : setDrawerId(s.id))}
                        className={`text-left px-2.5 py-2 rounded-xl border transition ${
                          on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-400 bg-white'
                        } ${selectable(s) ? '' : 'opacity-60'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          <span className="text-[11px] font-bold truncate">{s.name}</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${on ? 'text-slate-300' : 'text-slate-500'}`}>
                          {s.price ? krw(s.price) : meta.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 우: 후원상품 구성 ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:sticky lg:top-4">
          <div className="text-sm font-bold text-slate-900 mb-4">후원상품 구성</div>

          <Step n={1} label="기간">
            <div className="grid grid-cols-2 gap-1.5">
              {PERIODS.map((p) => (
                <Chip key={p.key} on={period === p.key} onClick={() => { setPeriod(p.key); setSelectedId(null); }}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </Step>

          <Step n={2} label="상품유형">
            <div className="grid grid-cols-3 gap-1.5">
              {PRODUCT_TYPES.map((t) => (
                <Chip key={t.key} on={productType === t.key} onClick={() => setProductType(t.key)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            {productType !== 'APPAREL' && (
              <p className="mt-2 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 break-keep">
                {productType === 'SNS' ? 'SNS' : '매장'} 상품은 선수별 조건이 달라 상담으로 구성합니다.
              </p>
            )}
          </Step>

          <Step n={3} label="슬롯">
            {selected ? (
              <div className="rounded-xl border border-slate-200 px-3 py-2.5">
                <div className="text-xs font-bold text-slate-900">{selected.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {selected.saleModeLabel} · {periodLabel}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">도식이나 목록에서 슬롯을 선택해 주세요.</p>
            )}
          </Step>

          <Step n={4} label="추가활동">
            <div className="flex flex-wrap gap-1.5">
              {ADDONS.map((a) => {
                const on = addons.includes(a.key);
                return (
                  <Chip
                    key={a.key}
                    on={on}
                    onClick={() => setAddons((prev) => (on ? prev.filter((k) => k !== a.key) : [...prev, a.key]))}
                  >
                    {a.label}
                  </Chip>
                );
              })}
            </div>
            {addons.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500 break-keep">
                추가활동은 협의 항목으로, 아래 금액에 포함되지 않습니다.
              </p>
            )}
          </Step>

          {/* 가격 구성 — 표시 금액과 실제 결제 금액은 반드시 일치해야 한다 (우선순위표 §15) */}
          <div className="mt-4 border-t border-slate-100 pt-3 space-y-1.5">
            <PriceRow label="슬롯 기본가격" value={selected ? krw(selected.price) : '—'} />
            {addons.length > 0 && <PriceRow label={`추가활동 ${addons.length}건`} value="협의" muted />}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700">
                {selected?.saleMode === 'AUCTION'
                  ? '현재 입찰 시작가'
                  : selected?.saleMode === 'INQUIRY'
                    ? '협의 기준가'
                    : '총 결제 예정금액'}
              </span>
              <span className="text-lg font-extrabold text-slate-900">{selected ? krw(selected.price) : '—'}</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed break-keep flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              {selected?.saleMode === 'INQUIRY'
                ? '협의 슬롯은 상담을 통해 조건과 금액을 확정합니다.'
                : '부가세·플랫폼 이용료 정책 확정 전으로, 표시 금액이 실제 결제 금액입니다.'}
            </p>
          </div>

          {error && <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">{error}</div>}

          <button
            type="button"
            onClick={handleCta}
            disabled={ctaDisabled}
            className="mt-4 w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 inline-flex items-center justify-center gap-2"
          >
            {selected?.saleMode === 'AUCTION' ? <Gavel className="w-4 h-4" /> : selected?.saleMode === 'INQUIRY' ? <MessageCircle className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
            {buyNowMut.isPending ? '처리 중...' : ctaLabel}
          </button>

          <button
            type="button"
            onClick={openKakaoConsult}
            className="mt-2 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
          >
            장기 파트너십 제안하기
          </button>
        </div>
      </div>

      <LegalNotice className="mt-4" />

      {/* 모바일 하단 고정 구매바 (§26 — 모바일에서도 구매 CTA가 항상 확인되어야 한다) */}
      {selected && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-500 truncate">
              {selected.name} · {periodLabel}
            </div>
            <div className="text-sm font-extrabold text-slate-900">{krw(selected.price)}</div>
          </div>
          <button
            type="button"
            onClick={handleCta}
            disabled={ctaDisabled}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"
          >
            {buyNowMut.isPending ? '처리 중...' : ctaLabel}
          </button>
        </div>
      )}

      <SlotDetailDrawer
        open={!!drawerSlot}
        slot={drawerSlot}
        periodLabel={periodLabel}
        onClose={() => setDrawerId(null)}
        onSelect={drawerSlot && selectable(drawerSlot) ? () => setSelectedId(drawerSlot.id) : undefined}
        alternatives={alternatives}
        onPickAlternative={(id) => setDrawerId(id)}
      />
    </section>
  );
}

function AthleteSummaryColumn({ athlete }: { athlete: any }) {
  const links = [
    { id: 'profile-detail', label: '주요 이력' },
    { id: 'profile-detail', label: '활동·대회 성적' },
    { id: 'roi', label: '미디어 노출' },
    { id: 'roi', label: 'SNS 콘텐츠' },
    { id: 'roi', label: '후원 성과' },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-sm font-bold text-slate-900 mb-3">선수정보</div>
      <dl className="space-y-2 mb-3">
        <SumRow label="협회·자격" value={athlete?.tourQualification || athlete?.tour} />
        <SumRow label="활동 분야" value={activityFieldsText(athlete?.activityFields)} />
        <SumRow label="소속" value={athlete?.affiliation || athlete?.team} />
      </dl>
      <div className="border-t border-slate-100 pt-2.5 space-y-1">
        {links.map((l, i) => (
          <button
            key={i}
            type="button"
            onClick={() => document.querySelector(`[data-section="${l.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="block w-full text-left text-[11px] text-slate-600 hover:text-slate-900 hover:underline py-0.5"
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** activityFields는 배열·문자열·객체 어느 형태로도 올 수 있어 표시용으로 정규화한다 */
function activityFieldsText(v: any): string {
  if (!v) return '';
  if (Array.isArray(v)) return v.slice(0, 2).join(', ');
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return Object.keys(v).filter((k) => v[k]).slice(0, 2).join(', ');
  return '';
}

function SumRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] text-slate-400">{label}</dt>
      <dd className="text-[11px] font-semibold text-slate-800 break-keep">{value}</dd>
    </div>
  );
}

function EmptyPeriod({ onOtherPeriod, onPropose }: { onOtherPeriod: () => void; onPropose: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="text-sm font-bold text-slate-900 mb-1">선택한 기간에는 구매 가능한 슬롯이 없습니다</div>
      <p className="text-xs text-slate-500 mb-4">다른 기간을 선택하거나 장기 파트너십으로 제안해 보세요.</p>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={onOtherPeriod} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          다른 기간 보기
        </button>
        <button type="button" onClick={onPropose} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
          장기 파트너십 제안
        </button>
      </div>
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-slate-700 mb-1.5">
        {n}. {label}
      </div>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition ${
        on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

function PriceRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-semibold ${muted ? 'text-slate-400' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

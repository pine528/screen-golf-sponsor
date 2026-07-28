/**
 * 개편 Phase 3 (BUY-03/04, 핸드오프 §13.3) — 직접구매 주문확인 화면
 *
 * 진입 시 슬롯이 15분간 임시예약(HELD)된 상태이며, 남은 시간을 카운트다운으로 보여준다.
 * 만료되면 예약이 풀리고 재예약을 안내한다. 결제(계약 생성) 성공 시 계약 상세로 이동.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Clock, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import LegalNotice from '../components/LegalNotice';

const krw = (v: any) => (v == null ? '—' : `${Number(v).toLocaleString()}원`);
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('ko-KR') : '—');

function mmss(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SlotCheckout() {
  const { slotId } = useParams<{ slotId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [remain, setRemain] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const { data: quoteResp, isLoading } = useQuery({
    queryKey: ['slot-quote', slotId],
    queryFn: () => api.getSlotQuote(slotId!),
    enabled: !!slotId,
  });
  const quote = (quoteResp?.data as any) || null;

  const { data: holdResp, refetch: refetchHold } = useQuery({
    queryKey: ['slot-hold', slotId],
    queryFn: () => api.getSlotHold(slotId!),
    enabled: !!slotId && isAuthenticated && user?.role === 'BRAND',
  });
  const hold = (holdResp?.data as any) || null;

  // 예약이 없으면 진입 시 자동으로 15분 예약을 잡는다
  const holdMut = useMutation({
    mutationFn: () => api.holdSlot(slotId!),
    onSuccess: () => refetchHold(),
    onError: (e: any) => {
      const err = e?.response?.data?.error;
      setError((typeof err === 'object' ? err?.message : err) || '슬롯 예약에 실패했습니다');
    },
  });

  useEffect(() => {
    if (!hold || hold.heldByMe || holdMut.isPending) return;
    holdMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.heldByMe]);

  // 카운트다운
  useEffect(() => {
    if (!hold?.heldByMe || !hold.reservedUntil) {
      setRemain(null);
      return;
    }
    const end = new Date(hold.reservedUntil).getTime();
    const tick = () => setRemain(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [hold?.reservedUntil, hold?.heldByMe]);

  const buyMut = useMutation({
    mutationFn: () => api.buySlotNow(slotId!),
    onSuccess: (res: any) => {
      const contractId = res?.data?.id;
      navigate(contractId ? `/contracts/${contractId}` : '/brand/contracts');
    },
    onError: (e: any) => {
      const err = e?.response?.data?.error;
      setError((typeof err === 'object' ? err?.message : err) || '구매 처리에 실패했습니다');
    },
  });

  const cancel = async () => {
    try {
      await api.releaseSlotHold(slotId!);
    } catch {
      /* 예약 해제 실패는 만료로 자연 복구되므로 이동을 막지 않는다 */
    }
    navigate(-1);
  };

  if (!isAuthenticated || user?.role !== 'BRAND') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-base font-bold text-slate-900 mb-1">브랜드 계정으로 로그인해 주세요</div>
        <p className="text-sm text-slate-500 mb-4">슬롯 구매는 브랜드 계정만 가능합니다.</p>
        <Link to="/login" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">로그인</Link>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">불러오는 중...</div>;
  if (!quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-base font-bold text-slate-900 mb-1">슬롯 정보를 찾을 수 없습니다</div>
        <Link to="/athletes" className="text-sm text-emerald-600 hover:underline mt-2">선수 목록으로</Link>
      </div>
    );
  }

  const expired = remain === 0;
  // 예약 자체가 거절된 상태(대회 규칙·업종 충돌·타 브랜드 선점 등)
  const blocked = !hold?.heldByMe && holdMut.isError;
  const tpl = quote.slot?.template || {};

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6">
        <button type="button" onClick={cancel} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> 돌아가기
        </button>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">주문 확인</h1>
        <p className="text-sm text-slate-500 mb-5">내용을 확인하고 계약을 생성합니다. 선수 서명 후 계약이 확정됩니다.</p>

        {/* 임시예약 타이머 (BUY-03) */}
        <div
          className={`rounded-2xl border px-4 py-3 mb-5 flex items-center gap-3 ${
            expired || blocked ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <Clock className={`w-5 h-5 shrink-0 ${expired || blocked ? 'text-rose-500' : 'text-amber-500'}`} />
          <div className="min-w-0 flex-1">
            {blocked ? (
              <>
                <div className="text-sm font-bold text-rose-700">슬롯을 예약하지 못했습니다</div>
                <p className="text-xs text-rose-600 break-keep">아래 안내를 확인한 뒤 다시 시도해 주세요.</p>
              </>
            ) : expired ? (
              <>
                <div className="text-sm font-bold text-rose-700">임시예약이 만료되었습니다</div>
                <p className="text-xs text-rose-600">다시 예약하면 15분간 슬롯이 확보됩니다.</p>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-amber-800">
                  임시예약 {remain != null ? mmss(remain) : '--:--'} 남음
                </div>
                <p className="text-xs text-amber-700">이 시간 동안 다른 브랜드가 해당 슬롯을 구매할 수 없습니다.</p>
              </>
            )}
          </div>
          {(expired || blocked) && (
            <button
              type="button"
              onClick={() => { setError(''); holdMut.mutate(); }}
              disabled={holdMut.isPending}
              className="shrink-0 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:bg-slate-300"
            >
              다시 예약
            </button>
          )}
        </div>

        {/* §13.3 주문확인 항목 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
            {quote.athlete?.profileImageUrl && (
              <img src={quote.athlete.profileImageUrl} alt="" className="w-12 h-16 object-cover rounded-lg bg-slate-100" />
            )}
            <div>
              <div className="text-base font-extrabold text-slate-900">{quote.athlete?.name}</div>
              <div className="text-xs text-slate-500">{quote.athlete?.tourQualification || ''}</div>
            </div>
          </div>

          <dl className="space-y-2.5">
            <Row label="기간" value={`${quote.event?.name || '—'} (${fmtDate(quote.event?.dateStart)} ~ ${fmtDate(quote.event?.dateEnd)})`} />
            <Row label="슬롯" value={tpl.nameKr || tpl.name || tpl.code || '—'} />
            <Row
              label="제공 항목"
              value={`착장 노출${tpl.recommendedWMm && tpl.recommendedHMm ? ` · 권장 ${(tpl.recommendedWMm / 10).toFixed(0)}cm × ${(tpl.recommendedHMm / 10).toFixed(0)}cm` : ''}${tpl.material ? ` · ${tpl.material}` : ''}`}
            />
            <Row label="추가활동" value="선택 안 함 (상담으로 별도 구성)" />
            <Row label="초상·콘텐츠 사용권" value="계약서에 명시된 범위 내 사용" />
            <Row label="대체이행 조건" value="차기 출전 이월 · 동일 등급 슬롯 변경 · SNS 콘텐츠 대체 · 부분/전액 환불" />
            <Row label="결제방법" value="브랜드 지갑 잔액 (에스크로 보관)" />
            <Row label="계약 당사자" value={`${quote.athlete?.name} 선수 ↔ 우리 브랜드 (플랫폼: 스폰픽)`} />
            <Row label="환불 기준" value="선수 미서명·미이행 시 전액 환불, 그 외는 계약서 환불 조항에 따름" />
          </dl>
        </div>

        {/* 금액 (BUY-05/06) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="text-sm font-bold text-slate-900 mb-3">결제 금액</div>
          <div className="space-y-1.5">
            <PriceRow label="슬롯 기본가격" value={krw(quote.price?.basePrice)} />
            <PriceRow label="플랫폼 이용료" value={quote.price?.platformFeeIncluded ? '포함' : krw(quote.price?.platformFee)} muted />
            <PriceRow label="부가세" value={quote.price?.vatIncluded ? '포함' : krw(quote.price?.vat)} muted />
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-700">총 결제 예정금액</span>
            <span className="text-xl font-extrabold text-slate-900">{krw(quote.price?.total)}</span>
          </div>
          {quote.price?.note && <p className="mt-2 text-[11px] text-slate-400 break-keep">{quote.price.note}</p>}
        </div>

        <LegalNotice className="mb-4" />

        <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-slate-900" />
          <span className="text-xs text-slate-600 break-keep">
            위 주문 내용과 계약 조건, 권리관계 안내를 확인했으며 계약 생성에 동의합니다.
          </span>
        </label>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-keep">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={cancel} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-white">
            취소
          </button>
          <button
            type="button"
            onClick={() => { setError(''); buyMut.mutate(); }}
            disabled={!agreed || expired || blocked || !hold?.heldByMe || buyMut.isPending}
            className="flex-1 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {buyMut.isPending ? '처리 중...' : '결제하고 계약 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className="text-xs font-semibold text-slate-900 text-right break-keep">{value}</dd>
    </div>
  );
}

function PriceRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${muted ? 'text-slate-400' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

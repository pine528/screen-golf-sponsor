/**
 * 개편 Phase 5 (WF-10) — 장기 파트너십 제안 작성
 * 5단계: 기본기간 → 슬롯 → 활동 → 권리 → 예산. 하단 고정: 임시저장 / 미리보기 / 제안 제출
 */
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Send, Eye, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import LegalNotice from '../components/LegalNotice';

const krw = (v: any) => (v ? `${Number(v).toLocaleString()}원` : '—');

const STEPS = ['기본 기간', '슬롯', '활동', '권리', '예산'];

export default function ProposalNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const athleteId = params.get('athleteId') || '';

  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<any>({
    athleteId,
    durationType: 'MONTHS_12',
    startDate: '',
    endDate: '',
    desiredSlots: [],
    allowAlternative: true,
    minAppearances: '',
    snsActivity: { feed: 0, story: 0, reels: 0 },
    storeVisits: { count: 0 },
    corporateEvents: { count: 0 },
    contentShoots: { count: 0 },
    imageUsageScope: '온라인 광고 · 매장 POP',
    imageUsageMonths: 12,
    allowSecondaryEdit: false,
    allowPaidMedia: false,
    categoryExclusive: false,
    totalBudget: '',
    installmentPlan: { enabled: false, times: 1 },
    brandNote: '',
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const { data: athleteResp } = useQuery({
    queryKey: ['public-athlete', athleteId],
    queryFn: () => api.getPublicAthlete(athleteId),
    enabled: !!athleteId,
  });
  const athlete = (athleteResp?.data as any)?.athlete;

  const { data: invResp } = useQuery({
    queryKey: ['public-athlete-inventory', athleteId],
    queryFn: () => api.getAthleteInventory(athleteId),
    enabled: !!athleteId,
  });
  const slots: any[] = (invResp?.data as any)?.slots || [];

  const payload = () => ({
    ...form,
    minAppearances: form.minAppearances ? Number(form.minAppearances) : null,
    totalBudget: Number(form.totalBudget || 0),
    imageUsageMonths: Number(form.imageUsageMonths || 0),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (draftId) return api.updateProposal(draftId, payload());
      const res = await api.createProposal(payload());
      setDraftId((res.data as any)?.id);
      return res;
    },
    onError: (e: any) => setError(msg(e) || '임시저장에 실패했습니다'),
    onSuccess: () => setError(''),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      let id = draftId;
      if (!id) {
        const res = await api.createProposal(payload());
        id = (res.data as any)?.id;
        setDraftId(id!);
      } else {
        await api.updateProposal(id, payload());
      }
      return api.submitProposal(id!);
    },
    onSuccess: () => navigate('/proposals'),
    onError: (e: any) => setError(msg(e) || '제안 제출에 실패했습니다'),
  });

  if (!isAuthenticated || user?.role !== 'BRAND') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-base font-bold text-slate-900 mb-1">브랜드 계정으로 로그인해 주세요</div>
        <p className="text-sm text-slate-500 mb-4">장기 파트너십 제안은 브랜드 계정만 가능합니다.</p>
        <Link to="/login" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">로그인</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> 돌아가기
        </button>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">장기 파트너십 제안</h1>
        <p className="text-sm text-slate-500 mb-5 break-keep">
          {athlete?.name ? `${athlete.name} 선수에게 ` : ''}6개월 또는 12개월 후원 조건을 구성해 제안합니다. 관리자 검토 후 선수에게 전달됩니다.
        </p>

        {/* 단계 표시 */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
                i === step ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          {step === 0 && (
            <>
              <Field label="계약기간">
                <div className="flex gap-2">
                  {[['MONTHS_6', '6개월'], ['MONTHS_12', '12개월']].map(([v, l]) => (
                    <Chip key={v} on={form.durationType === v} onClick={() => set('durationType', v)}>{l}</Chip>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="희망 시작일"><input type="date" className="w-full input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
                <Field label="희망 종료일"><input type="date" className="w-full input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="희망 슬롯">
                {slots.length === 0 ? (
                  <p className="text-xs text-slate-400">이 선수의 슬롯 정보가 아직 없습니다. 상담으로 구성할 수 있습니다.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {slots.map((s) => {
                      const name = s.slotTemplate?.nameKr || s.slotTemplate?.name;
                      const on = form.desiredSlots.includes(s.id);
                      return (
                        <Chip key={s.id} on={on} onClick={() => set('desiredSlots', on ? form.desiredSlots.filter((x: string) => x !== s.id) : [...form.desiredSlots, s.id])}>
                          {name}
                        </Chip>
                      );
                    })}
                  </div>
                )}
                {form.desiredSlots.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">선택 순서가 우선순위로 저장됩니다 ({form.desiredSlots.length}개 선택).</p>
                )}
              </Field>
              <Toggle label="대체 슬롯 허용" value={form.allowAlternative} onChange={(v) => set('allowAlternative', v)} hint="희망 슬롯이 판매된 경우 동일 등급 슬롯으로 대체합니다." />
            </>
          )}

          {step === 2 && (
            <>
              <Field label="최소 출전 횟수"><input type="number" min={0} className="w-full input" value={form.minAppearances} onChange={(e) => set('minAppearances', e.target.value)} placeholder="예: 12" /></Field>
              <div className="grid grid-cols-3 gap-3">
                <NumField label="SNS 피드" value={form.snsActivity.feed} onChange={(v) => set('snsActivity', { ...form.snsActivity, feed: v })} />
                <NumField label="SNS 스토리" value={form.snsActivity.story} onChange={(v) => set('snsActivity', { ...form.snsActivity, story: v })} />
                <NumField label="릴스·숏폼" value={form.snsActivity.reels} onChange={(v) => set('snsActivity', { ...form.snsActivity, reels: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumField label="매장 방문" value={form.storeVisits.count} onChange={(v) => set('storeVisits', { count: v })} />
                <NumField label="기업 행사" value={form.corporateEvents.count} onChange={(v) => set('corporateEvents', { count: v })} />
                <NumField label="콘텐츠 촬영" value={form.contentShoots.count} onChange={(v) => set('contentShoots', { count: v })} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="이미지 사용범위"><input className="w-full input" value={form.imageUsageScope} onChange={(e) => set('imageUsageScope', e.target.value)} placeholder="예: 온라인 광고 · 매장 POP" /></Field>
              <Field label="사용 기간(개월)"><input type="number" min={0} className="w-full input" value={form.imageUsageMonths} onChange={(e) => set('imageUsageMonths', e.target.value)} /></Field>
              <Toggle label="2차 편집 허용" value={form.allowSecondaryEdit} onChange={(v) => set('allowSecondaryEdit', v)} />
              <Toggle label="유료 광고 집행" value={form.allowPaidMedia} onChange={(v) => set('allowPaidMedia', v)} />
              <Toggle label="업종 독점" value={form.categoryExclusive} onChange={(v) => set('categoryExclusive', v)} hint="계약 기간 동안 동일 업종 브랜드의 후원을 제한합니다." />
            </>
          )}

          {step === 4 && (
            <>
              <Field label="총 예산">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₩</span>
                  <input type="number" min={0} className="w-full input pl-8" value={form.totalBudget} onChange={(e) => set('totalBudget', e.target.value)} placeholder="0" />
                </div>
                {form.totalBudget ? <p className="mt-1 text-[11px] text-slate-500">{krw(form.totalBudget)}</p> : null}
              </Field>
              <Toggle label="분할 결제 희망" value={form.installmentPlan.enabled} onChange={(v) => set('installmentPlan', { ...form.installmentPlan, enabled: v })} />
              {form.installmentPlan.enabled && (
                <NumField label="분할 횟수" value={form.installmentPlan.times} onChange={(v) => set('installmentPlan', { ...form.installmentPlan, times: v })} />
              )}
              <Field label="브랜드 요청사항">
                <textarea rows={4} className="w-full input" value={form.brandNote} onChange={(e) => set('brandNote', e.target.value)} placeholder="원하시는 조건이나 참고 사항을 적어주세요." />
              </Field>
            </>
          )}
        </div>

        <LegalNotice className="mt-4" />

        {error && <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 break-keep">{error}</div>}

        {preview && (
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-sm font-bold text-slate-900 mb-3">제안 미리보기</div>
            <dl className="space-y-2">
              <Row label="선수" value={athlete?.name || '—'} />
              <Row label="계약기간" value={`${form.durationType === 'MONTHS_6' ? '6개월' : '12개월'} (${form.startDate || '—'} ~ ${form.endDate || '—'})`} />
              <Row label="희망 슬롯" value={form.desiredSlots.length ? `${form.desiredSlots.length}개 · 대체 ${form.allowAlternative ? '허용' : '불가'}` : '미선택'} />
              <Row label="활동" value={`출전 ${form.minAppearances || 0}회 · 피드 ${form.snsActivity.feed} · 스토리 ${form.snsActivity.story} · 촬영 ${form.contentShoots.count}`} />
              <Row label="권리" value={`${form.imageUsageScope} · ${form.imageUsageMonths}개월 · 독점 ${form.categoryExclusive ? '요청' : '없음'}`} />
              <Row label="총 예산" value={krw(form.totalBudget)} />
            </dl>
          </div>
        )}
      </div>

      {/* 하단 고정 영역 (§13.3) */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <Save className="w-4 h-4" /> {saveMut.isPending ? '저장 중...' : draftId ? '임시저장됨' : '임시저장'}
          </button>
          <button type="button" onClick={() => setPreview((v) => !v)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> 미리보기
          </button>
          <button type="button" onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 inline-flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {submitMut.isPending ? '제출 중...' : '제안 제출'}
          </button>
        </div>
      </div>
    </div>
  );
}

function msg(e: any) {
  const err = e?.response?.data?.error;
  return typeof err === 'object' ? err?.message : err;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-700 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: any; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" min={0} className="w-full input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-slate-900" />
      <span>
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500 break-keep">{hint}</span>}
      </span>
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>
      {children}
    </button>
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

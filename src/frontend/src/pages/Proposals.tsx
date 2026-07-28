/**
 * 개편 Phase 5 — 장기 파트너십 제안 목록/상세
 * 브랜드(보낸 제안) · 선수(받은 제안) · 관리자(전체 검토)를 한 화면에서 역할별로 처리한다.
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Handshake, ArrowLeft, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import LegalNotice from '../components/LegalNotice';

const krw = (v: any) => (v == null ? '—' : `${Number(v).toLocaleString()}원`);
const day = (d?: string) => (d ? new Date(d).toLocaleDateString('ko-KR') : '—');

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '작성 중', cls: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: '제안 완료', cls: 'bg-sky-100 text-sky-700' },
  ADMIN_REVIEW: { label: '관리자 검토', cls: 'bg-amber-100 text-amber-700' },
  ATHLETE_REVIEW: { label: '선수 검토', cls: 'bg-violet-100 text-violet-700' },
  REVISION_REQUESTED: { label: '수정 요청', cls: 'bg-orange-100 text-orange-700' },
  BRAND_REVISING: { label: '브랜드 수정 중', cls: 'bg-orange-100 text-orange-700' },
  APPROVED: { label: '승인', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '거절', cls: 'bg-rose-100 text-rose-700' },
  EXPIRED: { label: '만료', cls: 'bg-slate-100 text-slate-500' },
  CONTRACTING: { label: '계약 진행', cls: 'bg-emerald-100 text-emerald-700' },
  CONTRACTED: { label: '계약 완료', cls: 'bg-emerald-600 text-white' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${s.cls}`}>{s.label}</span>;
}

export default function Proposals() {
  const { id } = useParams<{ id: string }>();
  return id ? <ProposalDetail id={id} /> : <ProposalList />;
}

function ProposalList() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['proposals'], queryFn: () => api.listProposals() });
  const list: any[] = (data?.data as any) || [];

  const title = user?.role === 'ATHLETE' ? '받은 제안' : user?.role === 'ADMIN' ? '장기 제안 검토' : '보낸 제안';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1 inline-flex items-center gap-2">
          <Handshake className="w-6 h-6 text-emerald-500" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mb-5">6개월·12개월 장기 파트너십은 제안을 통해 조건을 맞춘 뒤 계약합니다.</p>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">불러오는 중...</div>
        ) : list.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-sm font-bold text-slate-900 mb-1">아직 제안이 없습니다</div>
            <p className="text-xs text-slate-500 mb-4">
              {user?.role === 'BRAND' ? '선수 상세에서 장기 파트너십을 제안해 보세요.' : '제안이 도착하면 여기에 표시됩니다.'}
            </p>
            {user?.role === 'BRAND' && (
              <Link to="/athletes" className="inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">후원 가능한 선수 찾기</Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <Link key={p.id} to={`/proposals/${p.id}`} className="block bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {p.athlete?.name || p.brand?.name || '—'}
                      </span>
                      <Badge status={p.status} />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {p.durationType === 'MONTHS_6' ? '6개월' : '12개월'} · {day(p.startDate)} ~ {day(p.endDate)}
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 shrink-0">{krw(p.totalBudget)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['proposal', id], queryFn: () => api.getProposal(id) });
  const p = (data?.data as any) || null;

  const mut = useMutation({
    mutationFn: ({ to }: { to: string }) => api.transitionProposal(id, to, note || undefined),
    onSuccess: () => {
      setNote('');
      setError('');
      qc.invalidateQueries({ queryKey: ['proposal', id] });
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (e: any) => {
      const err = e?.response?.data?.error;
      setError((typeof err === 'object' ? err?.message : err) || '처리에 실패했습니다');
    },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">불러오는 중...</div>;
  if (!p) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">제안을 찾을 수 없습니다</div>;

  const role = user?.role;
  const actions: { to: string; label: string; primary?: boolean }[] = [];
  if (role === 'ADMIN') {
    if (p.status === 'ADMIN_REVIEW') actions.push({ to: 'ATHLETE_REVIEW', label: '선수에게 전달', primary: true }, { to: 'REVISION_REQUESTED', label: '수정 요청' }, { to: 'REJECTED', label: '거절' });
    if (p.status === 'APPROVED') actions.push({ to: 'CONTRACTING', label: '계약 진행', primary: true });
    if (p.status === 'CONTRACTING') actions.push({ to: 'CONTRACTED', label: '계약 완료 처리', primary: true });
  }
  if (role === 'ATHLETE' && p.status === 'ATHLETE_REVIEW') {
    actions.push({ to: 'APPROVED', label: '승인', primary: true }, { to: 'REVISION_REQUESTED', label: '수정 요청' }, { to: 'REJECTED', label: '거절' });
  }
  if (role === 'BRAND' && p.status === 'REVISION_REQUESTED') {
    actions.push({ to: 'BRAND_REVISING', label: '수정 시작', primary: true });
  }

  const sns = p.snsActivity || {};

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6">
        <button type="button" onClick={() => navigate('/proposals')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>

        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-extrabold text-slate-900">{p.athlete?.name} 선수 파트너십</h1>
          <Badge status={p.status} />
        </div>
        <p className="text-sm text-slate-500 mb-5">
          {p.brand?.name && `${p.brand.name} · `}
          {p.durationType === 'MONTHS_6' ? '6개월' : '12개월'} · {day(p.startDate)} ~ {day(p.endDate)}
        </p>

        {p.expiresAt && !['CONTRACTED', 'REJECTED', 'EXPIRED'].includes(p.status) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-800">검토 기한 {day(p.expiresAt)} — 기한이 지나면 자동 만료됩니다.</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <dl className="space-y-2.5">
            <Row label="희망 슬롯" value={`${(p.desiredSlots || []).length}개 · 대체 ${p.allowAlternative ? '허용' : '불가'}`} />
            <Row label="최소 출전" value={p.minAppearances ? `${p.minAppearances}회` : '—'} />
            <Row label="SNS" value={`피드 ${sns.feed ?? 0} · 스토리 ${sns.story ?? 0} · 릴스 ${sns.reels ?? 0}`} />
            <Row label="매장·행사·촬영" value={`${p.storeVisits?.count ?? 0} / ${p.corporateEvents?.count ?? 0} / ${p.contentShoots?.count ?? 0}`} />
            <Row label="이미지 사용" value={`${p.imageUsageScope || '—'} · ${p.imageUsageMonths ?? 0}개월 · 2차편집 ${p.allowSecondaryEdit ? '허용' : '불가'} · 유료광고 ${p.allowPaidMedia ? '허용' : '불가'}`} />
            <Row label="업종 독점" value={p.categoryExclusive ? '요청' : '없음'} />
            <Row label="총 예산" value={krw(p.totalBudget)} />
            <Row label="분할 결제" value={p.installmentPlan?.enabled ? `${p.installmentPlan.times}회 분할 희망` : '일시 결제'} />
            {p.brandNote && <Row label="요청사항" value={p.brandNote} />}
            {p.reviewNote && <Row label="검토 의견" value={p.reviewNote} />}
          </dl>
        </div>

        <LegalNotice className="mb-4" />

        {actions.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="text-sm font-bold text-slate-900 mb-2">검토 처리</div>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="의견을 남기면 상대방에게 전달됩니다 (선택)" className="w-full input mb-3" />
            {error && <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">{error}</div>}
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => mut.mutate({ to: a.to })}
                  disabled={mut.isPending}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${
                    a.primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* §14.3 변경 이력 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm font-bold text-slate-900 mb-3">진행 이력</div>
          <ol className="space-y-2">
            {(p.history || []).map((h: any) => (
              <li key={h.id} className="flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">
                    {STATUS[h.toStatus]?.label || h.toStatus}
                    {h.actorRole && <span className="ml-1.5 text-[10px] text-slate-400">{h.actorRole}</span>}
                  </div>
                  {h.note && <div className="text-[11px] text-slate-600 break-keep">{h.note}</div>}
                  <div className="text-[10px] text-slate-400">{new Date(h.createdAt).toLocaleString('ko-KR')}</div>
                </div>
              </li>
            ))}
          </ol>
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

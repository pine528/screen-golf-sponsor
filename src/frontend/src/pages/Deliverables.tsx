/**
 * 개편 Phase 6 — 이행·증빙 (OPS-03~08, REP-01)
 *
 * 선수: 내 이행 항목에 증빙 등록 / 대체이행 요청
 * 브랜드: 계약 이행 현황 확인
 * 관리자: 증빙 검수 · 대체이행 승인
 *
 * 진행률은 검수 완료된 이행만 반영하고, 검수 대기 수치는 따로 표시한다 (LEG-06).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Upload, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '예정', cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: '진행 중', cls: 'bg-sky-100 text-sky-700' },
  SUBMITTED: { label: '검수 대기', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: '이행 완료', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '반려', cls: 'bg-rose-100 text-rose-700' },
  SUBSTITUTED: { label: '대체이행', cls: 'bg-violet-100 text-violet-700' },
  CANCELLED: { label: '취소', cls: 'bg-slate-100 text-slate-500' },
};

const SUBSTITUTION = [
  { key: 'CARRY_OVER', label: '차기 출전 이월' },
  { key: 'ALTERNATE_SLOT', label: '동일 등급 슬롯 변경' },
  { key: 'SNS_CONTENT', label: 'SNS 콘텐츠 대체' },
  { key: 'PARTIAL_REFUND', label: '부분 환불' },
  { key: 'FULL_REFUND', label: '전액 환불' },
];

const day = (d?: string) => (d ? new Date(d).toLocaleDateString('ko-KR') : '기한 없음');

export default function Deliverables() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const { data: listResp, isLoading } = useQuery({ queryKey: ['deliverables'], queryFn: () => api.listDeliverables() });
  const { data: sumResp } = useQuery({ queryKey: ['deliverable-summary'], queryFn: () => api.getDeliverableSummary() });
  const items: any[] = (listResp?.data as any) || [];
  const summary: any = (sumResp?.data as any) || null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deliverables'] });
    qc.invalidateQueries({ queryKey: ['deliverable-summary'] });
  };
  const onError = (e: any) => {
    const err = e?.response?.data?.error;
    setError((typeof err === 'object' ? err?.message : err) || '처리에 실패했습니다');
  };

  const evidenceMut = useMutation({
    mutationFn: ({ id, fileUrl, linkUrl, note }: any) => api.submitDeliverableEvidence(id, { fileUrl, linkUrl, note }),
    onSuccess: () => { setError(''); refresh(); },
    onError,
  });
  const reviewMut = useMutation({
    mutationFn: ({ evidenceId, approve, note }: any) => api.reviewDeliverableEvidence(evidenceId, approve, note),
    onSuccess: () => { setError(''); refresh(); },
    onError,
  });
  const subMut = useMutation({
    mutationFn: ({ id, type, note }: any) => api.requestDeliverableSubstitution(id, type, note),
    onSuccess: () => { setError(''); refresh(); },
    onError,
  });
  const subReviewMut = useMutation({
    mutationFn: ({ id, approve }: any) => api.reviewDeliverableSubstitution(id, approve),
    onSuccess: () => { setError(''); refresh(); },
    onError,
  });

  const role = user?.role;
  const title = role === 'ATHLETE' ? '내 이행·증빙' : role === 'ADMIN' ? '증빙 검수' : '계약 이행 현황';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1 inline-flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-500" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mb-5 break-keep">
          계약에서 약속한 활동을 항목별로 관리합니다. 증빙은 검수를 통과해야 이행으로 인정됩니다.
        </p>

        {summary && summary.totalTarget > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="flex items-end justify-between mb-2">
              <div className="text-sm font-bold text-slate-900">이행 진행률</div>
              <div className="text-2xl font-extrabold text-slate-900">{summary.progressRate}%</div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${summary.progressRate}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <Stat label="검증 완료" value={`${summary.verifiedCount}/${summary.totalTarget}`} />
              <Stat label="검수 대기" value={String(summary.pendingReviewCount)} muted />
              <Stat label="대체이행" value={String(summary.substitutedCount)} muted />
              <Stat label="기한 경과" value={String(summary.overdueCount)} danger={summary.overdueCount > 0} />
            </div>
            <p className="mt-3 text-[11px] text-slate-400 break-keep">{summary.note}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span className="break-keep">{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-sm font-bold text-slate-900 mb-1">이행 항목이 없습니다</div>
            <p className="text-xs text-slate-500">계약이 시작되면 약속한 활동이 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((d) => (
              <DeliverableCard
                key={d.id}
                d={d}
                role={role}
                onSubmitEvidence={(payload: any) => evidenceMut.mutate({ id: d.id, ...payload })}
                onReviewEvidence={(evidenceId: string, approve: boolean, note?: string) => reviewMut.mutate({ evidenceId, approve, note })}
                onRequestSub={(type: string, note?: string) => subMut.mutate({ id: d.id, type, note })}
                onReviewSub={(approve: boolean) => subReviewMut.mutate({ id: d.id, approve })}
                busy={evidenceMut.isPending || reviewMut.isPending || subMut.isPending || subReviewMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeliverableCard({ d, role, onSubmitEvidence, onReviewEvidence, onRequestSub, onReviewSub, busy }: any) {
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [note, setNote] = useState('');
  const [subType, setSubType] = useState('CARRY_OVER');
  const [subOpen, setSubOpen] = useState(false);

  const st = STATUS[d.status] || STATUS.PENDING;
  const overdue = d.dueDate && new Date(d.dueDate) < new Date() && !['APPROVED', 'SUBSTITUTED', 'CANCELLED'].includes(d.status);
  const pendingEvidence = (d.evidence || []).filter((e: any) => e.status === 'SUBMITTED');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-slate-900">{d.title}</span>
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${st.cls}`}>{st.label}</span>
            {d.substitutionStatus === 'REQUESTED' && (
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-700">대체이행 요청</span>
            )}
            {overdue && <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-700">기한 경과</span>}
          </div>
          <div className="text-[11px] text-slate-500">
            {d.completedCount}/{d.targetCount} 이행 · 기한 {day(d.dueDate)}
            {role === 'ADMIN' && d.athlete?.name ? ` · ${d.athlete.name}` : ''}
            {role !== 'BRAND' && d.brand?.name ? ` · ${d.brand.name}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {role === 'ATHLETE' && !['APPROVED', 'SUBSTITUTED', 'CANCELLED'].includes(d.status) && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold inline-flex items-center gap-1">
              <Upload className="w-3 h-3" /> 증빙 등록
            </button>
          )}
          {['ATHLETE', 'BRAND'].includes(role) && !d.substitutionStatus && d.status !== 'APPROVED' && (
            <button type="button" onClick={() => setSubOpen((v) => !v)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 대체이행
            </button>
          )}
          {role === 'ADMIN' && d.substitutionStatus === 'REQUESTED' && (
            <>
              <button type="button" disabled={busy} onClick={() => onReviewSub(true)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold">대체 승인</button>
              <button type="button" disabled={busy} onClick={() => onReviewSub(false)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-semibold">거절</button>
            </>
          )}
        </div>
      </div>

      {d.substitutionType && (
        <div className="mt-2 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 break-keep">
          대체이행: {SUBSTITUTION.find((s) => s.key === d.substitutionType)?.label}
          {d.substitutionStatus === 'APPROVED' ? ' (승인됨)' : d.substitutionStatus === 'REJECTED' ? ' (거절됨)' : ' (검토 대기)'}
          {d.substitutionNote ? ` — ${d.substitutionNote}` : ''}
        </div>
      )}

      {subOpen && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-[11px] font-bold text-slate-700 mb-1.5">대체이행 수단</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUBSTITUTION.map((s) => (
              <button key={s.key} type="button" onClick={() => setSubType(s.key)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${subType === s.key ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-700'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <input className="w-full input mb-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (선택)" />
          <button type="button" disabled={busy} onClick={() => { onRequestSub(subType, note); setSubOpen(false); setNote(''); }} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
            대체이행 요청
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          <input className="w-full input" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="증빙 이미지 주소 (필수)" />
          <input className="w-full input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="게시물 링크 (선택)" />
          <input className="w-full input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="설명 (선택)" />
          <button
            type="button"
            disabled={busy || !fileUrl}
            onClick={() => { onSubmitEvidence({ fileUrl, linkUrl, note }); setOpen(false); setFileUrl(''); setLinkUrl(''); setNote(''); }}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400"
          >
            증빙 제출
          </button>
        </div>
      )}

      {(d.evidence || []).length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-[11px] font-bold text-slate-700 mb-1.5">증빙 {d.evidence.length}건</div>
          <ul className="space-y-1.5">
            {d.evidence.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <a href={e.linkUrl || e.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-700 hover:underline truncate block">
                    {e.note || e.linkUrl || e.fileUrl}
                  </a>
                  <span className={`text-[10px] ${e.status === 'APPROVED' ? 'text-emerald-600' : e.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-600'}`}>
                    {e.status === 'APPROVED' ? '승인' : e.status === 'REJECTED' ? `반려${e.reviewNote ? ` · ${e.reviewNote}` : ''}` : '검수 대기'}
                  </span>
                </div>
                {role === 'ADMIN' && e.status === 'SUBMITTED' && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" disabled={busy} onClick={() => onReviewEvidence(e.id, true)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold">승인</button>
                    <button type="button" disabled={busy} onClick={() => onReviewEvidence(e.id, false, prompt('반려 사유를 입력하세요') || undefined)} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 text-[10px] font-semibold">반려</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {role === 'ADMIN' && pendingEvidence.length > 0 && (
            <p className="mt-2 text-[10px] text-amber-600">검수 대기 {pendingEvidence.length}건</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, muted, danger }: { label: string; value: string; muted?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <div className={`text-sm font-extrabold ${danger ? 'text-rose-600' : muted ? 'text-slate-500' : 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

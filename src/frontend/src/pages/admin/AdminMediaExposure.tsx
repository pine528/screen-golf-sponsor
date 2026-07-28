/**
 * 관리자: 선수 미디어 노출 데이터 관리 (docx §6 C-1 미구현 항목)
 *
 * - 선수 선택 → 미디어 노출 기록 목록 (시기별)
 * - 추가/수정/삭제 (방송, 패치 노출, 하이라이트 등)
 * - 자동 수집 트리거 (네이버 뉴스, 팔로워 스냅샷)
 * - source: MANUAL (수동) / GTOUR_API / CRAWLER / AI_VIDEO
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { Tv, Plus, Edit2, Trash2, X, Calendar, Newspaper, Users, RefreshCw, FileText, Award } from 'lucide-react';

interface ExposureForm {
  broadcastCount: number | '';
  broadcastSeconds: number | '';
  patchExposureEstimate: number | '';
  articleMentions: number | '';
  highlightCount: number | '';
  periodStart: string;
  periodEnd: string;
  source: 'MANUAL' | 'GTOUR_API' | 'CRAWLER' | 'AI_VIDEO';
  notes: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthAgoIso = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const EMPTY_FORM: ExposureForm = {
  broadcastCount: '',
  broadcastSeconds: '',
  patchExposureEstimate: '',
  articleMentions: '',
  highlightCount: '',
  periodStart: monthAgoIso(),
  periodEnd: todayIso(),
  source: 'MANUAL',
  notes: '',
};

export default function AdminMediaExposure() {
  const queryClient = useQueryClient();
  const [athleteId, setAthleteId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExposureForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const { data: athletesResp } = useQuery({
    queryKey: ['public-athletes-all'],
    queryFn: () => api.listPublicAthletes({ limit: 50 }),
  });
  const athletes = athletesResp?.data?.items || [];
  const selectedAthlete = athletes.find((a: any) => a.id === athleteId);

  const { data: resp, refetch } = useQuery({
    queryKey: ['admin-media-exposures', athleteId],
    queryFn: () => api.getAthleteMediaExposures(athleteId),
    enabled: !!athleteId,
  });
  const exposures = (resp?.data || []) as any[];

  const invalidateRoi = () => queryClient.invalidateQueries({ queryKey: ['public-athlete-roi', athleteId] });

  const createMut = useMutation({
    mutationFn: (body: any) => api.createAthleteMediaExposure(athleteId, body),
    onSuccess: () => { resetForm(); refetch(); invalidateRoi(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => api.updateAthleteMediaExposure(id, body),
    onSuccess: () => { resetForm(); refetch(); invalidateRoi(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteAthleteMediaExposure(id),
    onSuccess: () => { refetch(); invalidateRoi(); },
  });

  // 자동 수집 트리거
  const newsMut = useMutation({
    mutationFn: () => api.syncAthleteNews(athleteId),
    onSuccess: (r: any) => {
      setStatusMsg(`📰 네이버 뉴스 ${r.data?.saved ?? 0}건 수집/갱신`);
      invalidateRoi();
    },
    onError: () => setStatusMsg('❌ 뉴스 수집 실패 (NAVER_CLIENT_ID/SECRET 환경변수 확인)'),
  });
  const followersMut = useMutation({
    mutationFn: () => api.syncAllFollowers(),
    onSuccess: (r: any) => setStatusMsg(`👥 전체 팔로워 스냅샷: 캡처 ${r.data?.captured}, 건너뜀 ${r.data?.skipped}`),
    onError: () => setStatusMsg('❌ 팔로워 스냅샷 실패'),
  });
  const newsAllMut = useMutation({
    mutationFn: () => api.syncAllNews(),
    onSuccess: (r: any) => setStatusMsg(`📰 전체 뉴스 동기화 완료, 신규/갱신 ${r.data?.saved ?? 0}건`),
    onError: () => setStatusMsg('❌ 전체 뉴스 동기화 실패'),
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };
  const startEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      broadcastCount: e.broadcastCount ?? '',
      broadcastSeconds: e.broadcastSeconds ?? '',
      patchExposureEstimate: e.patchExposureEstimate ?? '',
      articleMentions: e.articleMentions ?? '',
      highlightCount: e.highlightCount ?? '',
      periodStart: e.periodStart ? new Date(e.periodStart).toISOString().slice(0, 10) : monthAgoIso(),
      periodEnd: e.periodEnd ? new Date(e.periodEnd).toISOString().slice(0, 10) : todayIso(),
      source: e.source || 'MANUAL',
      notes: e.notes || '',
    });
    setShowForm(true);
  };

  const submit = () => {
    const body = {
      broadcastCount: form.broadcastCount === '' ? 0 : Number(form.broadcastCount),
      broadcastSeconds: form.broadcastSeconds === '' ? 0 : Number(form.broadcastSeconds),
      patchExposureEstimate: form.patchExposureEstimate === '' ? 0 : Number(form.patchExposureEstimate),
      articleMentions: form.articleMentions === '' ? 0 : Number(form.articleMentions),
      highlightCount: form.highlightCount === '' ? 0 : Number(form.highlightCount),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      source: form.source,
      notes: form.notes || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, body });
    else createMut.mutate(body);
  };

  const totals = exposures.reduce((acc: any, e: any) => ({
    broadcastCount: acc.broadcastCount + (e.broadcastCount || 0),
    broadcastSeconds: acc.broadcastSeconds + (e.broadcastSeconds || 0),
    patchExposureEstimate: acc.patchExposureEstimate + (e.patchExposureEstimate || 0),
    articleMentions: acc.articleMentions + (e.articleMentions || 0),
    highlightCount: acc.highlightCount + (e.highlightCount || 0),
  }), { broadcastCount: 0, broadcastSeconds: 0, patchExposureEstimate: 0, articleMentions: 0, highlightCount: 0 });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-5 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1 inline-flex items-center gap-2">
          <Tv className="w-6 h-6 text-rose-500" />
          미디어 노출 데이터 관리
        </h1>
        <p className="text-sm text-slate-500 mb-5">
          docx §6 C-1 — 방송 중계, 패치/로고 노출, 하이라이트 등 자동 수집이 어려운 항목 관리자 수기 입력
        </p>

        {/* 자동 수집 트리거 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <div className="text-sm font-bold text-emerald-800 mb-2 inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 자동 수집 즉시 실행 (cron 외 수동 트리거)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!athleteId || newsMut.isPending}
              onClick={() => newsMut.mutate()}
              className="text-xs bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded font-bold hover:bg-emerald-100 disabled:opacity-50"
            >
              📰 선택 선수 네이버 뉴스 수집
            </button>
            <button
              disabled={newsAllMut.isPending}
              onClick={() => newsAllMut.mutate()}
              className="text-xs bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded font-bold hover:bg-emerald-100 disabled:opacity-50"
            >
              📰 전체 선수 뉴스 동기화
            </button>
            <button
              disabled={followersMut.isPending}
              onClick={() => followersMut.mutate()}
              className="text-xs bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded font-bold hover:bg-emerald-100 disabled:opacity-50"
            >
              👥 전체 팔로워 스냅샷 캡처
            </button>
          </div>
          {statusMsg && (
            <div className="mt-2 text-xs text-emerald-900 bg-white border border-emerald-200 rounded px-2 py-1">{statusMsg}</div>
          )}
          <p className="text-[10px] text-emerald-700 mt-2 leading-relaxed">
            ※ 네이버 뉴스 자동 수집은 <code className="bg-white px-1 rounded">NAVER_CLIENT_ID</code> + <code className="bg-white px-1 rounded">NAVER_CLIENT_SECRET</code> 환경변수 필요 (
            <a href="https://developers.naver.com/apps/#/list" target="_blank" rel="noreferrer" className="underline">발급</a>, 무료 일 25,000건)
            <br />
            ※ 매일 04:30/05:00 KST 자동 cron 실행. 수동 트리거는 디버깅/긴급용.
          </p>
        </div>

        {/* 선수 선택 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
          <label className="text-xs font-bold text-slate-700 block mb-1.5">선수 선택</label>
          <select
            value={athleteId}
            onChange={(e) => { setAthleteId(e.target.value); resetForm(); setStatusMsg(''); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— 선수를 선택하세요 —</option>
            {athletes.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name} ({a.tour})</option>
            ))}
          </select>
        </div>

        {athleteId && (
          <>
            {/* 누적 합계 (현재 ROI 대시보드에 반영되는 값) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              <SumCard icon={<Tv className="w-4 h-4 text-rose-500" />} label="중계 노출 횟수" value={totals.broadcastCount} />
              <SumCard icon={<Calendar className="w-4 h-4 text-rose-500" />} label="중계 시간(초)" value={totals.broadcastSeconds} />
              <SumCard icon={<Award className="w-4 h-4 text-rose-500" />} label="패치/로고 노출" value={totals.patchExposureEstimate} />
              <SumCard icon={<Newspaper className="w-4 h-4 text-rose-500" />} label="기사 언급(수동)" value={totals.articleMentions} hint="자동 수집 별도" />
              <SumCard icon={<FileText className="w-4 h-4 text-rose-500" />} label="하이라이트" value={totals.highlightCount} />
            </div>

            {/* 추가 버튼 */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-slate-900">{selectedAthlete?.name} 입력 기록 ({exposures.length}건)</h2>
              {!showForm && (
                <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-lg">
                  <Plus className="w-3.5 h-3.5" /> 새 기록 추가
                </button>
              )}
            </div>

            {/* 입력 폼 */}
            {showForm && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-rose-900">{editingId ? '기록 수정' : '새 미디어 노출 기록 추가'}</h3>
                  <button onClick={resetForm}><X className="w-4 h-4 text-slate-500" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="기간 시작" type="date" value={form.periodStart} onChange={(v) => setForm({ ...form, periodStart: v })} />
                  <FormField label="기간 종료" type="date" value={form.periodEnd} onChange={(v) => setForm({ ...form, periodEnd: v })} />
                  <FormField label="중계 노출 횟수" type="number" value={form.broadcastCount} onChange={(v) => setForm({ ...form, broadcastCount: v === '' ? '' : Number(v) })} />
                  <FormField label="중계 노출 시간(초)" type="number" value={form.broadcastSeconds} onChange={(v) => setForm({ ...form, broadcastSeconds: v === '' ? '' : Number(v) })} />
                  <FormField label="패치/로고 노출 추정" type="number" value={form.patchExposureEstimate} onChange={(v) => setForm({ ...form, patchExposureEstimate: v === '' ? '' : Number(v) })} />
                  <FormField label="기사/외부 언급 (수동)" type="number" value={form.articleMentions} onChange={(v) => setForm({ ...form, articleMentions: v === '' ? '' : Number(v) })} hint="자동 수집은 별도, 추가 수기만" />
                  <FormField label="하이라이트 노출" type="number" value={form.highlightCount} onChange={(v) => setForm({ ...form, highlightCount: v === '' ? '' : Number(v) })} />
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">데이터 출처</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as any })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="MANUAL">MANUAL (수기)</option>
                      <option value="GTOUR_API">GTOUR_API (외부)</option>
                      <option value="CRAWLER">CRAWLER (크롤러)</option>
                      <option value="AI_VIDEO">AI_VIDEO (영상 분석)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">메모 (선택)</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      placeholder="예: KLPGA 중계 4회, 하이라이트 영상 6편 (5월 1주차)"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                  <button onClick={resetForm} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded">취소</button>
                  <button onClick={submit} disabled={createMut.isPending || updateMut.isPending} className="px-4 py-1.5 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded disabled:opacity-50">
                    {editingId ? '수정' : '추가'}
                  </button>
                </div>
              </div>
            )}

            {/* 기록 리스트 */}
            <div className="space-y-2">
              {exposures.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
                  등록된 미디어 노출 기록이 없습니다. "새 기록 추가" 또는 자동 수집 트리거를 사용하세요.
                </div>
              ) : exposures.map((e: any) => (
                <div key={e.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-slate-500">
                        {new Date(e.periodStart).toLocaleDateString('ko-KR')} ~ {new Date(e.periodEnd).toLocaleDateString('ko-KR')}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        e.source === 'MANUAL' ? 'bg-slate-100 text-slate-600'
                        : e.source === 'GTOUR_API' ? 'bg-emerald-100 text-emerald-700'
                        : e.source === 'CRAWLER' ? 'bg-sky-100 text-sky-700'
                        : 'bg-violet-100 text-violet-700'
                      }`}>{e.source}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {e.broadcastCount > 0 && <span><b className="text-rose-600">중계:</b> {e.broadcastCount}회 ({Math.round(e.broadcastSeconds / 60)}분)</span>}
                      {e.patchExposureEstimate > 0 && <span><b className="text-rose-600">패치:</b> {e.patchExposureEstimate}회</span>}
                      {e.articleMentions > 0 && <span><b className="text-rose-600">기사:</b> {e.articleMentions}건</span>}
                      {e.highlightCount > 0 && <span><b className="text-rose-600">하이라이트:</b> {e.highlightCount}회</span>}
                    </div>
                    {e.notes && <p className="text-[11px] text-slate-500 mt-1">📝 {e.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(e)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('이 기록을 삭제하시겠습니까?')) deleteMut.mutate(e.id); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!athleteId && (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-sm text-slate-500">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            상단에서 선수를 선택하면 미디어 노출 기록을 관리할 수 있습니다.
          </div>
        )}
      </div>
    </Layout>
  );
}

function SumCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-slate-600">{label}</span>
      </div>
      <div className="text-lg font-extrabold text-slate-900 tabular-nums">{value.toLocaleString()}</div>
      {hint && <div className="text-[9px] text-slate-400">{hint}</div>}
    </div>
  );
}

function FormField({ label, type, value, onChange, hint }: { label: string; type: string; value: any; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-slate-700 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
      />
      {hint && <p className="text-[9px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}


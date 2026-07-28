/**
 * 관리자: 선수 경기결과 관리 (docx 3-6 후속)
 *
 * - 선수 선택 → 경기결과 목록 (연도별 그룹)
 * - 추가/수정/삭제
 * - source: MANUAL (수기) / GTOUR_API (외부) / CRAWLER 표시
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { Trophy, Plus, Edit2, Trash2, X, Calendar, Award } from 'lucide-react';

interface ResultForm {
  eventName: string;
  eventDate: string;
  category: string;
  rank: number | '';
  score: string;
  totalRounds: number | '';
  summary: string;
  source: 'MANUAL' | 'GTOUR_API' | 'CRAWLER';
}

const EMPTY_FORM: ResultForm = {
  eventName: '',
  eventDate: new Date().toISOString().slice(0, 10),
  category: '',
  rank: '',
  score: '',
  totalRounds: '',
  summary: '',
  source: 'MANUAL',
};

export default function AdminAthleteEventResults() {
  const queryClient = useQueryClient();
  const [athleteId, setAthleteId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResultForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  // 선수 목록 (공개 API 활용)
  const { data: athletesResp } = useQuery({
    queryKey: ['public-athletes-all'],
    queryFn: () => api.listPublicAthletes({ limit: 50 }),
  });
  const athletes = athletesResp?.data?.items || [];

  // 선택된 선수의 경기결과
  const { data: resultsResp, refetch } = useQuery({
    queryKey: ['admin-athlete-event-results', athleteId],
    queryFn: () => api.getAthleteEventResults(athleteId),
    enabled: !!athleteId,
  });
  const results = resultsResp?.data || [];

  const createMut = useMutation({
    mutationFn: (body: any) => api.createAthleteEventResult(athleteId, body),
    onSuccess: () => { resetForm(); refetch(); queryClient.invalidateQueries({ queryKey: ['public-athlete', athleteId] }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => api.updateAthleteEventResult(id, body),
    onSuccess: () => { resetForm(); refetch(); queryClient.invalidateQueries({ queryKey: ['public-athlete', athleteId] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteAthleteEventResult(id),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ['public-athlete', athleteId] }); },
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };
  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      eventName: r.eventName || '',
      eventDate: r.eventDate ? new Date(r.eventDate).toISOString().slice(0, 10) : '',
      category: r.category || '',
      rank: r.rank ?? '',
      score: r.score || '',
      totalRounds: r.totalRounds ?? '',
      summary: r.summary || '',
      source: r.source || 'MANUAL',
    });
    setShowForm(true);
  };

  const submit = () => {
    if (!form.eventName || !form.eventDate) {
      alert('대회명, 개최일은 필수입니다.');
      return;
    }
    const body = {
      eventName: form.eventName,
      eventDate: form.eventDate,
      category: form.category || null,
      rank: form.rank === '' ? null : Number(form.rank),
      score: form.score || null,
      totalRounds: form.totalRounds === '' ? null : Number(form.totalRounds),
      summary: form.summary || null,
      source: form.source,
    };
    if (editingId) updateMut.mutate({ id: editingId, body });
    else createMut.mutate(body);
  };

  // 연도별 그룹
  const byYear = results.reduce((acc: Record<number, any[]>, r: any) => {
    const y = new Date(r.eventDate).getFullYear();
    (acc[y] = acc[y] || []).push(r);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2 inline-flex items-center gap-2">
          <Trophy className="w-6 h-6 text-emerald-500" /> 선수 경기결과 관리
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          GTOUR 등 외부 대회의 선수별 경기결과를 수기로 등록·관리합니다 (docx 3-6).
        </p>

        {/* 선수 선택 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">선수:</span>
          <select
            value={athleteId}
            onChange={(e) => { setAthleteId(e.target.value); resetForm(); }}
            className="flex-1 max-w-md text-sm border border-slate-200 rounded-lg px-3 py-2"
          >
            <option value="">선택해주세요</option>
            {athletes.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name} ({a.tour})</option>
            ))}
          </select>
          {athleteId && (
            <button
              onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> 신규 등록
            </button>
          )}
        </div>

        {!athleteId ? (
          <div className="text-center py-16 text-sm text-slate-400 bg-slate-50 rounded-xl">선수를 선택해주세요</div>
        ) : (
          <>
            {/* 폼 */}
            {showForm && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-amber-800">
                    {editingId ? '경기결과 수정' : '신규 경기결과 등록'}
                  </h3>
                  <button onClick={resetForm} className="text-amber-700 hover:text-amber-900"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="대회명 *" value={form.eventName} onChange={(v) => setForm({ ...form, eventName: v })} placeholder="2026 KLPGA 시즌 오픈전" />
                  <Input label="개최일 *" type="date" value={form.eventDate} onChange={(v) => setForm({ ...form, eventDate: v })} />
                  <Input label="경기 구분" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="정규투어 / 메이저 / 시범경기" />
                  <Input label="순위" type="number" value={String(form.rank)} onChange={(v) => setForm({ ...form, rank: v === '' ? '' : Number(v) })} placeholder="14" />
                  <Input label="스코어" value={form.score} onChange={(v) => setForm({ ...form, score: v })} placeholder="-3 (69-72-71-71)" />
                  <Input label="총 라운드" type="number" value={String(form.totalRounds)} onChange={(v) => setForm({ ...form, totalRounds: v === '' ? '' : Number(v) })} placeholder="4" />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-amber-800 mb-1">분석 요약</label>
                    <textarea
                      value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                      placeholder="바람 영향에도 안정적인 아이언샷으로 컷 통과 후 14위 마무리"
                      rows={3}
                      className="w-full text-sm border border-amber-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">데이터 출처</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as any })}
                      className="w-full text-sm border border-amber-300 rounded-lg p-2 bg-white"
                    >
                      <option value="MANUAL">수기 등록</option>
                      <option value="GTOUR_API">GTOUR API</option>
                      <option value="CRAWLER">크롤링</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={submit} disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg">
                    {editingId ? '수정' : '등록'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-bold rounded-lg">취소</button>
                </div>
              </div>
            )}

            {/* 결과 목록 (연도별) */}
            {results.length === 0 ? (
              <div className="text-center py-16 text-sm text-slate-400 bg-slate-50 rounded-xl">등록된 경기결과가 없습니다. "신규 등록"으로 추가하세요.</div>
            ) : (
              <div className="space-y-6">
                {years.map((y) => (
                  <div key={y}>
                    <h3 className="text-base font-extrabold text-emerald-700 mb-3 inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {y}년 ({byYear[y].length}건)
                    </h3>
                    <div className="space-y-2">
                      {byYear[y].map((r: any) => (
                        <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4">
                          <div className="w-16 text-center">
                            {r.rank != null ? (
                              <div className={`text-2xl font-extrabold ${r.rank === 1 ? 'text-amber-500' : r.rank <= 3 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {r.rank}<span className="text-xs">위</span>
                              </div>
                            ) : (
                              <div className="text-base text-slate-400">-</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-extrabold text-slate-900">{r.eventName}</h4>
                              {r.category && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{r.category}</span>}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.source === 'MANUAL' ? 'bg-slate-100 text-slate-600' : r.source === 'GTOUR_API' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{r.source}</span>
                            </div>
                            <div className="text-xs text-slate-500 mb-1">
                              {new Date(r.eventDate).toLocaleDateString('ko-KR')}
                              {r.score && ` · ${r.score}`}
                              {r.totalRounds && ` · ${r.totalRounds}R`}
                            </div>
                            {r.summary && <p className="text-xs text-slate-600">{r.summary}</p>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(r)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (confirm('정말 삭제하시겠습니까?')) deleteMut.mutate(r.id); }} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 통계 요약 */}
            {results.length > 0 && (
              <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-4 inline-flex items-center gap-4 text-sm">
                <Award className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">총 <strong>{results.length}건</strong></span>
                <span className="text-slate-700">우승 <strong>{results.filter((r: any) => r.rank === 1).length}회</strong></span>
                <span className="text-slate-700">TOP10 <strong>{results.filter((r: any) => r.rank != null && r.rank <= 10).length}회</strong></span>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-amber-800 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-amber-300 rounded-lg p-2"
      />
    </div>
  );
}

/**
 * 관리자: 대회 활성화 / N값 / 카테고리 / 표시 순서 관리
 * SPONPIK 론칭 3-7 — 관리자 세팅 우선 정책
 *  - isActive (운영 토글)
 *  - activeDays (이벤트별 N일, 미설정 시 시스템 기본 14)
 *  - displayOrder (표시 우선순위)
 *  - category (정규투어/시드전/드림투어/점프투어/챔피언스/친선전 등)
 *  - qualifyingDate (예선 일자)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Calendar, Save, Settings, Loader2, Power, ToggleLeft, ToggleRight, ArrowUpDown } from 'lucide-react';

const CATEGORIES = [
  '정규투어',
  '시드전',
  '드림투어',
  '점프투어',
  '챔피언스투어',
  '친선전',
  '이벤트경기',
  '예선전',
];

interface AdminEvent {
  id: string;
  tour: string;
  name: string;
  category: string | null;
  dateStart: string;
  dateEnd: string;
  qualifyingDate: string | null;
  displayOrder: number;
  isActive: boolean;
  activeDays: number | null;
  status: string;
  multiplier: number;
  venue: string | null;
}

export function AdminTournamentActivation() {
  const qc = useQueryClient();
  const [systemDefaultDays, setSystemDefaultDays] = useState<number>(14);
  const [editing, setEditing] = useState<Record<string, Partial<AdminEvent>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tournament-activation'],
    queryFn: async () => {
      const r = await fetch('/api/events/admin/list', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const j = await r.json();
      return (j?.data || []) as AdminEvent[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AdminEvent> }) => {
      const r = await fetch(`/api/events/${id}/activation`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error?.message || '저장 실패');
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournament-activation'] });
    },
  });

  const toggleActive = (e: AdminEvent) => {
    updateMut.mutate({ id: e.id, patch: { isActive: !e.isActive } });
  };

  const saveRow = (e: AdminEvent) => {
    const patch = editing[e.id];
    if (!patch || Object.keys(patch).length === 0) return;
    updateMut.mutate({ id: e.id, patch });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[e.id];
      return next;
    });
  };

  const setEditField = (id: string, field: keyof AdminEvent, value: any) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const events = data || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 inline-flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            대회 활성화 · N값 관리
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            관리자 세팅이 외부 연동 / 시스템 기본값보다 우선합니다. (SPONPIK 3-7)
          </p>
        </div>

        {/* 시스템 기본 N값 (참고) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-900">시스템 기본 활성 일수 (N)</div>
            <div className="text-xs text-amber-800 mt-1">
              이벤트별 <code className="px-1 bg-white rounded">activeDays</code>가 비어있을 때 적용됩니다.
              현재 GET /events/active?days={systemDefaultDays} 쿼리로 사용됩니다.
            </div>
          </div>
          <input
            type="number"
            min={1}
            max={60}
            value={systemDefaultDays}
            onChange={(e) => setSystemDefaultDays(Math.max(1, Math.min(60, Number(e.target.value) || 14)))}
            className="w-24 input"
          />
        </div>

        {/* 대회 목록 */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b text-sm font-bold text-slate-700 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4" /> 대회 목록 ({events.length}개)
          </div>
          {isLoading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /></div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">등록된 대회가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 border-b">
                    <th className="px-3 py-2 text-left">대회명</th>
                    <th className="px-3 py-2 text-left">투어</th>
                    <th className="px-3 py-2 text-left">카테고리</th>
                    <th className="px-3 py-2 text-left">기간</th>
                    <th className="px-3 py-2 text-left">예선일</th>
                    <th className="px-3 py-2 text-center">N일</th>
                    <th className="px-3 py-2 text-center">순서</th>
                    <th className="px-3 py-2 text-center">활성</th>
                    <th className="px-3 py-2 text-center">저장</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const edit = editing[e.id] || {};
                    const isDirty = Object.keys(edit).length > 0;
                    return (
                      <tr key={e.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-900 max-w-xs truncate">{e.name}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{e.tour}</td>
                        <td className="px-3 py-2">
                          <select
                            value={(edit.category ?? e.category) || ''}
                            onChange={(ev) => setEditField(e.id, 'category', ev.target.value || null)}
                            className="text-xs border rounded px-2 py-1 bg-white"
                          >
                            <option value="">(없음)</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {new Date(e.dateStart).toLocaleDateString('ko-KR')} ~ {new Date(e.dateEnd).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={(edit.qualifyingDate ?? (e.qualifyingDate ? e.qualifyingDate.slice(0, 10) : '')) as string}
                            onChange={(ev) => setEditField(e.id, 'qualifyingDate' as any, ev.target.value || null)}
                            className="text-xs border rounded px-2 py-1 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={60}
                            placeholder="기본"
                            value={(edit.activeDays ?? e.activeDays ?? '') as any}
                            onChange={(ev) => {
                              const v = ev.target.value;
                              setEditField(e.id, 'activeDays', v === '' ? null : Math.max(1, Math.min(60, Number(v))));
                            }}
                            className="w-16 text-xs border rounded px-2 py-1 text-center"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              value={(edit.displayOrder ?? e.displayOrder) as any}
                              onChange={(ev) => setEditField(e.id, 'displayOrder', Number(ev.target.value) || 0)}
                              className="w-16 text-xs border rounded px-2 py-1 text-center"
                            />
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => toggleActive(e)}
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${
                              e.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                            }`}
                            disabled={updateMut.isPending}
                          >
                            {e.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            {e.isActive ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => saveRow(e)}
                            disabled={!isDirty || updateMut.isPending}
                            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Save className="w-3 h-3" />
                            저장
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 정책 안내 */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
          <div className="font-bold text-slate-700 inline-flex items-center gap-1"><Power className="w-3 h-3" /> 관리자 세팅 우선 정책</div>
          <div>1순위: <code>Event.activeDays</code> (관리자가 이 화면에서 직접 지정)</div>
          <div>2순위: <code>?days=N</code> 쿼리 파라미터 (외부 연동 / 클라이언트 옵션)</div>
          <div>3순위: 시스템 기본값 14일</div>
          <div className="pt-1">비활성(<code>isActive=false</code>) 대회는 공개 <code>/events/active</code> 응답에서 제외됩니다.</div>
        </div>
      </div>
    </Layout>
  );
}

export default AdminTournamentActivation;

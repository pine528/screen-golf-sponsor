import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Megaphone,
  Building2,
  Calendar,
  Target,
  CheckCircle,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: '기본 정보', icon: Megaphone },
  { id: 2, label: '브랜드 & 이벤트', icon: Building2 },
  { id: 3, label: '기간 & 소스', icon: Calendar },
  { id: 4, label: '확인', icon: CheckCircle },
];

export function AdminCampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    brandId: '',
    eventId: '',
    budget: 0,
    startDate: '',
    endDate: '',
    vodSource: 'YOUTUBE',
    targetSlots: [] as string[],
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands-list'],
    queryFn: () => api.get('/admin/entities/brands', { pageSize: 100 }),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events-list'],
    queryFn: () => api.get('/events'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/campaigns', {
      name: form.name,
      description: form.description,
      brandId: form.brandId,
      eventId: form.eventId || undefined,
      budget: form.budget,
      dateStart: form.startDate,
      dateEnd: form.endDate,
    }),
    onSuccess: () => {
      navigate('/admin/roi/vod');
    },
  });

  const brands = brandsData?.data?.brands || brandsData?.data?.items || brandsData?.data || [];
  const events = eventsData?.data || [];

  const SLOT_OPTIONS = [
    'CAP_FRONT', 'CAP_SIDE_L', 'CAP_SIDE_R', 'CHEST_L', 'CHEST_R',
    'COLLAR_L', 'COLLAR_R', 'SLEEVE_L', 'SLEEVE_R',
  ];

  const SLOT_LABELS: Record<string, string> = {
    CAP_FRONT: '모자 정면', CAP_SIDE_L: '모자 좌측', CAP_SIDE_R: '모자 우측',
    CHEST_L: '상의 좌측', CHEST_R: '상의 우측',
    COLLAR_L: '카라 좌', COLLAR_R: '카라 우',
    SLEEVE_L: '소매 좌', SLEEVE_R: '소매 우',
  };

  const toggleSlot = (slot: string) => {
    setForm(f => ({
      ...f,
      targetSlots: f.targetSlots.includes(slot)
        ? f.targetSlots.filter(s => s !== slot)
        : [...f.targetSlots, slot],
    }));
  };

  const canNext = () => {
    switch (step) {
      case 1: return form.name.trim().length > 0;
      case 2: return form.brandId.length > 0;
      case 3: return form.startDate && form.endDate;
      default: return true;
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ROI 캠페인 설정</h1>
            <p className="text-sm text-slate-500">캠페인 생성 및 ROI 측정 설정</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = s.id < step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-500 text-white'
                    : isActive ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                    : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">기본 정보</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">캠페인 이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input w-full"
                  placeholder="예: 2026 KPGA 시즌 스폰서십"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input w-full h-24 resize-none"
                  placeholder="캠페인 목적, 대상 등 간략 설명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">예산 (원)</label>
                <input
                  type="number"
                  value={form.budget || ''}
                  onChange={(e) => setForm(f => ({ ...f, budget: parseInt(e.target.value) || 0 }))}
                  className="input w-full"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">브랜드 & 이벤트</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">브랜드 *</label>
                <select
                  value={form.brandId}
                  onChange={(e) => setForm(f => ({ ...f, brandId: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">브랜드 선택</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이벤트(대회)</label>
                <select
                  value={form.eventId}
                  onChange={(e) => setForm(f => ({ ...f, eventId: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">선택 안 함</option>
                  {events.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.tour})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">대상 슬롯</label>
                <div className="flex flex-wrap gap-2">
                  {SLOT_OPTIONS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        form.targetSlots.includes(slot)
                          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">기간 & VOD 소스</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">시작일 *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">종료일 *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">VOD 소스</label>
                <select
                  value={form.vodSource}
                  onChange={(e) => setForm(f => ({ ...f, vodSource: e.target.value }))}
                  className="input w-full"
                >
                  <option value="YOUTUBE">YouTube</option>
                  <option value="UPLOAD">직접 업로드</option>
                  <option value="PARTNER">파트너 제공</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">설정 확인</h2>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">캠페인명</span>
                  <span className="text-sm font-medium text-slate-900">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">브랜드</span>
                  <span className="text-sm font-medium text-slate-900">
                    {brands.find((b: any) => b.id === form.brandId)?.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">이벤트</span>
                  <span className="text-sm font-medium text-slate-900">
                    {events.find((e: any) => e.id === form.eventId)?.name || '없음'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">예산</span>
                  <span className="text-sm font-medium text-slate-900">
                    {form.budget > 0 ? `${form.budget.toLocaleString()}원` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">기간</span>
                  <span className="text-sm font-medium text-slate-900">
                    {form.startDate} ~ {form.endDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">대상 슬롯</span>
                  <span className="text-sm font-medium text-slate-900">
                    {form.targetSlots.length > 0
                      ? form.targetSlots.map(s => SLOT_LABELS[s] || s).join(', ')
                      : '전체'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">VOD 소스</span>
                  <span className="text-sm font-medium text-slate-900">{form.vodSource}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step <= 1}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => Math.min(4, s + 1))}
              disabled={!canNext()}
              className="btn btn-primary flex items-center gap-2"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              캠페인 생성
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default AdminCampaignBuilder;

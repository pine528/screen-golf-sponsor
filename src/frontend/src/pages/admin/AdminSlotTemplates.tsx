import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Layers,
  Plus,
  Edit,
  X,
  Loader2,
  Filter,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../utils';

const PHASE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Phase 1', color: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'Phase 2', color: 'bg-purple-100 text-purple-700' },
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  CAP: { label: '모자 (CAP)', color: 'bg-blue-100 text-blue-700' },
  TOP: { label: '상의 (TOP)', color: 'bg-orange-100 text-orange-700' },
  PANTS: { label: '하의 (PANTS)', color: 'bg-pink-100 text-pink-700' },
};

const GRADE_LABELS: Record<string, { label: string; color: string }> = {
  S: { label: 'S등급', color: 'bg-yellow-100 text-yellow-700' },
  A: { label: 'A등급', color: 'bg-slate-100 text-slate-700' },
  B: { label: 'B등급', color: 'bg-amber-100 text-amber-700' },
  C: { label: 'C등급', color: 'bg-stone-100 text-stone-600' },
};

const BODY_PARTS = [
  'CAP_FRONT', 'CAP_BRIM_TOP', 'CAP_SIDE_L', 'CAP_SIDE_R', 'CAP_BACK',
  'CHEST_L', 'CHEST_R', 'COLLAR_L', 'COLLAR_R', 'SLEEVE_L', 'SLEEVE_R',
  'BACK_SHOULDER_L', 'BACK_SHOULDER_R',
  'PANTS_HIP_SIDE_FACING', 'PANTS_THIGH_SIDE_FACING',
];

export function AdminSlotTemplates() {
  const queryClient = useQueryClient();
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['slot-templates'],
    queryFn: () => api.getSlotTemplates(),
  });

  const filteredTemplates = (templates?.data || []).filter((t: any) => {
    if (phaseFilter !== 'all' && t.phase !== parseInt(phaseFilter)) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    return true;
  });

  // Group by phase and category
  const groupedByPhase = filteredTemplates.reduce((acc: any, t: any) => {
    const phase = t.phase || 1;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(t);
    return acc;
  }, {});

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setIsCreateMode(false);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsCreateMode(true);
    setShowModal(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">슬롯 템플릿 관리</h1>
            <p className="text-slate-600 mt-1">
              Phase 1/2 슬롯 위치와 규격을 관리합니다
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            새 템플릿
          </button>
        </div>

        {/* Info Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-800 mb-2">Phase 1 (기본 오픈)</h3>
            <p className="text-sm text-emerald-700">
              CAP(모자) + TOP(상의) 슬롯. 모든 대회에서 기본으로 열립니다.
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-800 mb-2">Phase 2 (조건부 확장)</h3>
            <p className="text-sm text-purple-700">
              PANTS(하의) 슬롯. Phase 1 낙찰 시 또는 특정 조건에서 오픈됩니다.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 Phase</option>
                <option value="1">Phase 1</option>
                <option value="2">Phase 2</option>
              </select>
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 카테고리</option>
                <option value="CAP">CAP (모자)</option>
                <option value="TOP">TOP (상의)</option>
                <option value="PANTS">PANTS (하의)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-slate-600">로딩 중...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="card p-12 text-center">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">슬롯 템플릿이 없습니다</h3>
            <p className="text-slate-600 mb-4">새 템플릿을 추가하거나 시드 데이터를 실행하세요</p>
          </div>
        ) : (
          Object.entries(groupedByPhase).map(([phase, items]: [string, any]) => (
            <div key={phase} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className={cn('badge', PHASE_LABELS[parseInt(phase)]?.color)}>
                  {PHASE_LABELS[parseInt(phase)]?.label || `Phase ${phase}`}
                </span>
                <span className="text-slate-500 text-sm font-normal">
                  ({items.length}개 슬롯)
                </span>
              </h2>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        코드 / 이름
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        카테고리
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        등급
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        규격 (mm)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        기본 시작가
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        상태
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((template: any) => (
                      <tr key={template.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-mono text-sm text-slate-500">{template.code}</p>
                            <p className="font-medium text-slate-900">{template.nameKr || template.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {template.category && (
                            <span className={cn('badge text-xs', CATEGORY_LABELS[template.category]?.color)}>
                              {CATEGORY_LABELS[template.category]?.label || template.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {template.grade && (
                            <span className={cn('badge text-xs', GRADE_LABELS[template.grade]?.color)}>
                              {GRADE_LABELS[template.grade]?.label || template.grade}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {template.sizeMaxWMm} x {template.sizeMaxHMm}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {template.defaultReservePrice?.toLocaleString()}원
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {template.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle className="w-3.5 h-3.5" />
                              활성
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <XCircle className="w-3.5 h-3.5" />
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(template)}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                              title="수정"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <SlotTemplateModal
          template={selectedTemplate}
          isCreate={isCreateMode}
          onClose={() => {
            setShowModal(false);
            setSelectedTemplate(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['slot-templates'] });
            setShowModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </Layout>
  );
}

interface SlotTemplateModalProps {
  template: any;
  isCreate: boolean;
  onClose: () => void;
  onSave: () => void;
}

function SlotTemplateModal({ template, isCreate, onClose, onSave }: SlotTemplateModalProps) {
  const [formData, setFormData] = useState({
    code: template?.code || '',
    name: template?.name || '',
    bodyPart: template?.bodyPart || 'CAP_FRONT',
    sizeMaxWMm: template?.sizeMaxWMm || 60,
    sizeMaxHMm: template?.sizeMaxHMm || 30,
    perimeterMaxMm: template?.perimeterMaxMm || 200,
    phase: template?.phase || 1,
    category: template?.category || 'CAP',
    grade: template?.grade || 'A',
    defaultReservePrice: template?.defaultReservePrice || 1000000,
    nameKr: template?.nameKr || '',
    nameEn: template?.nameEn || '',
    uiHeadline: template?.uiHeadline || '',
    uiCopy: template?.uiCopy || '',
    isActive: template?.isActive !== false,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createSlotTemplate(data),
    onSuccess: () => onSave(),
    onError: (err: any) => setError(err.response?.data?.message || '생성에 실패했습니다'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateSlotTemplate(template.id, data),
    onSuccess: () => onSave(),
    onError: (err: any) => setError(err.response?.data?.message || '수정에 실패했습니다'),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      sizeMaxWMm: Number(formData.sizeMaxWMm),
      sizeMaxHMm: Number(formData.sizeMaxHMm),
      perimeterMaxMm: Number(formData.perimeterMaxMm),
      phase: Number(formData.phase),
      defaultReservePrice: Number(formData.defaultReservePrice),
    };

    if (isCreate) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {isCreate ? '새 슬롯 템플릿' : '슬롯 템플릿 수정'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">코드 (고유)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="input"
                placeholder="CAP_FRONT"
                required
                disabled={!isCreate}
              />
            </div>
            <div>
              <label className="label">위치 (Body Part)</label>
              <select
                value={formData.bodyPart}
                onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })}
                className="input"
                disabled={!isCreate}
              >
                {BODY_PARTS.map((bp) => (
                  <option key={bp} value={bp}>{bp}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">이름 (영문)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Cap Front"
                required
              />
            </div>
            <div>
              <label className="label">이름 (한글)</label>
              <input
                type="text"
                value={formData.nameKr}
                onChange={(e) => setFormData({ ...formData, nameKr: e.target.value })}
                className="input"
                placeholder="모자 정면"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Phase</label>
              <select
                value={formData.phase}
                onChange={(e) => setFormData({ ...formData, phase: parseInt(e.target.value) })}
                className="input"
              >
                <option value={1}>Phase 1 (기본)</option>
                <option value={2}>Phase 2 (확장)</option>
              </select>
            </div>
            <div>
              <label className="label">카테고리</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input"
              >
                <option value="CAP">CAP (모자)</option>
                <option value="TOP">TOP (상의)</option>
                <option value="PANTS">PANTS (하의)</option>
              </select>
            </div>
            <div>
              <label className="label">등급</label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                className="input"
              >
                <option value="S">S (프리미엄)</option>
                <option value="A">A (상위)</option>
                <option value="B">B (중위)</option>
                <option value="C">C (하위)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">최대 너비 (mm)</label>
              <input
                type="number"
                value={formData.sizeMaxWMm}
                onChange={(e) => setFormData({ ...formData, sizeMaxWMm: parseInt(e.target.value) })}
                className="input"
                min={1}
                required
              />
            </div>
            <div>
              <label className="label">최대 높이 (mm)</label>
              <input
                type="number"
                value={formData.sizeMaxHMm}
                onChange={(e) => setFormData({ ...formData, sizeMaxHMm: parseInt(e.target.value) })}
                className="input"
                min={1}
                required
              />
            </div>
            <div>
              <label className="label">최대 둘레 (mm)</label>
              <input
                type="number"
                value={formData.perimeterMaxMm}
                onChange={(e) => setFormData({ ...formData, perimeterMaxMm: parseInt(e.target.value) })}
                className="input"
                min={1}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">기본 시작가 (원)</label>
            <input
              type="number"
              value={formData.defaultReservePrice}
              onChange={(e) => setFormData({ ...formData, defaultReservePrice: parseInt(e.target.value) })}
              className="input"
              min={0}
              step={10000}
            />
          </div>

          <div>
            <label className="label">UI 헤드라인</label>
            <input
              type="text"
              value={formData.uiHeadline}
              onChange={(e) => setFormData({ ...formData, uiHeadline: e.target.value })}
              className="input"
              placeholder="얼굴 프레임 동시노출"
            />
          </div>

          <div>
            <label className="label">UI 설명</label>
            <textarea
              value={formData.uiCopy}
              onChange={(e) => setFormData({ ...formData, uiCopy: e.target.value })}
              className="input min-h-[80px]"
              placeholder="클로즈업에서 가장 자주 보이는 '메인 포지션'."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">활성화</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn btn-secondary flex-1">
              취소
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                isCreate ? '생성' : '수정'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminSlotTemplates;

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Pencil, Trash2, Target } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

const statusConfig: Record<string, { label: string; class: string }> = {
  DRAFT: { label: '초안', class: 'badge-info' },
  ACTIVE: { label: '진행중', class: 'badge-success' },
  PAUSED: { label: '일시정지', class: 'badge-warning' },
  COMPLETED: { label: '완료', class: 'badge-info' },
};

export default function BrandCampaigns() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: '',
    targetCategories: '',
    dateStart: '',
    dateEnd: '',
  });
  const [error, setError] = useState('');

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['myCampaigns'],
    queryFn: () => api.getMyCampaigns(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '캠페인 생성 실패');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '캠페인 수정 실패');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.pauseCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
    },
  });

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormData({
      name: '',
      description: '',
      budget: '',
      targetCategories: '',
      dateStart: '',
      dateEnd: '',
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (campaign: any) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      budget: campaign.budget.toString(),
      targetCategories: campaign.targetCategories?.join(', ') || '',
      dateStart: campaign.dateStart ? campaign.dateStart.split('T')[0] : '',
      dateEnd: campaign.dateEnd ? campaign.dateEnd.split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
    setFormData({
      name: '',
      description: '',
      budget: '',
      targetCategories: '',
      dateStart: '',
      dateEnd: '',
    });
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      budget: parseInt(formData.budget),
      targetCategories: formData.targetCategories
        ? formData.targetCategories.split(',').map((s) => s.trim())
        : undefined,
      dateStart: formData.dateStart || undefined,
      dateEnd: formData.dateEnd || undefined,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const campaigns = campaignsData?.data || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">캠페인 관리</h1>
            <p className="text-slate-600 mt-1">광고 캠페인을 생성하고 관리하세요</p>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            새 캠페인
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">등록된 캠페인이 없습니다</h3>
            <p className="text-slate-500 mb-6">첫 번째 캠페인을 만들어 광고를 시작하세요</p>
            <button onClick={openCreateModal} className="btn btn-primary">
              첫 캠페인 만들기
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {campaigns.map((campaign: any) => (
              <div key={campaign.id} className="card p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{campaign.name}</h3>
                      <span className={cn('badge', statusConfig[campaign.status]?.class || 'badge-info')}>
                        {statusConfig[campaign.status]?.label || campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-slate-600 text-sm mb-4">{campaign.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                      <div>
                        <span className="text-slate-500">예산</span>
                        <p className="font-semibold text-slate-900">{formatCurrency(campaign.budget)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">사용금액</span>
                        <p className="font-semibold text-slate-900">{formatCurrency(campaign.spentAmount)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">잔여예산</span>
                        <p className="font-semibold text-emerald-600">
                          {formatCurrency(campaign.budget - campaign.spentAmount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">진행률</span>
                        <p className="font-semibold text-slate-900">
                          {Math.round((campaign.spentAmount / campaign.budget) * 100)}%
                        </p>
                      </div>
                    </div>
                    {campaign.dateStart && (
                      <p className="text-slate-500 text-xs mt-3">
                        기간: {new Date(campaign.dateStart).toLocaleDateString()} ~{' '}
                        {campaign.dateEnd ? new Date(campaign.dateEnd).toLocaleDateString() : '종료일 미정'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {campaign.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => activateMutation.mutate(campaign.id)}
                          className="btn btn-primary flex items-center gap-1 text-sm"
                        >
                          <Play className="w-4 h-4" />
                          활성화
                        </button>
                        <button
                          onClick={() => openEditModal(campaign)}
                          className="btn btn-secondary flex items-center gap-1 text-sm"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('정말 삭제하시겠습니까?')) {
                              deleteMutation.mutate(campaign.id);
                            }
                          }}
                          className="btn btn-danger flex items-center gap-1 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {campaign.status === 'ACTIVE' && (
                      <button
                        onClick={() => pauseMutation.mutate(campaign.id)}
                        className="btn btn-secondary flex items-center gap-1 text-sm"
                      >
                        <Pause className="w-4 h-4" />
                        일시정지
                      </button>
                    )}
                    {campaign.status === 'PAUSED' && (
                      <button
                        onClick={() => activateMutation.mutate(campaign.id)}
                        className="btn btn-primary flex items-center gap-1 text-sm"
                      >
                        <Play className="w-4 h-4" />
                        재개
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((campaign.spentAmount / campaign.budget) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {editingCampaign ? '캠페인 수정' : '새 캠페인 만들기'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">캠페인명 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="label">예산 (원) *</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="input"
                    required
                    min="0"
                  />
                </div>

                <div>
                  <label className="label">타겟 카테고리 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={formData.targetCategories}
                    onChange={(e) => setFormData({ ...formData, targetCategories: e.target.value })}
                    className="input"
                    placeholder="예: 스포츠, 레저"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">시작일</label>
                    <input
                      type="date"
                      value={formData.dateStart}
                      onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">종료일</label>
                    <input
                      type="date"
                      value={formData.dateEnd}
                      onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary">
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? '저장 중...'
                      : editingCampaign
                      ? '수정'
                      : '생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

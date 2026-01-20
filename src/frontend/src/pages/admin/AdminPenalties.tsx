import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  Loader2,
  X,
  Save,
  CheckCircle2,
  Clock,
  Ban,
  User,
  Building2,
  Calendar,
  RefreshCw,
  ShieldAlert,
  FileX,
  AlertCircle,
  FileWarning,
  Settings,
} from 'lucide-react';
import { cn } from '../../utils';

type PenaltyType =
  | 'ASSET_DEADLINE_MISSED'
  | 'CONTRACT_VIOLATION'
  | 'VERIFICATION_FAILURE'
  | 'INAPPROPRIATE_CONTENT'
  | 'ADMIN_MANUAL';

type PenaltyStatus = 'ACTIVE' | 'EXPIRED' | 'REMOVED';

interface Penalty {
  id: string;
  athleteId?: string;
  brandId?: string;
  userId: string;
  type: PenaltyType;
  status: PenaltyStatus;
  points: number;
  reason: string;
  refType?: string;
  refId?: string;
  expiresAt?: string;
  removedAt?: string;
  removedBy?: string;
  removeReason?: string;
  createdBy: string;
  createdAt: string;
}

interface PenaltyStats {
  totalPenalties: number;
  activePenalties: number;
  expiredPenalties: number;
  removedPenalties: number;
  totalActivePoints: number;
}

const penaltyTypeConfig: Record<PenaltyType, { label: string; icon: React.ElementType; color: string }> = {
  ASSET_DEADLINE_MISSED: { label: '에셋 마감 미준수', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  CONTRACT_VIOLATION: { label: '계약 위반', icon: FileX, color: 'bg-red-100 text-red-700' },
  VERIFICATION_FAILURE: { label: '검수 실패', icon: AlertCircle, color: 'bg-orange-100 text-orange-700' },
  INAPPROPRIATE_CONTENT: { label: '부적절한 콘텐츠', icon: FileWarning, color: 'bg-pink-100 text-pink-700' },
  ADMIN_MANUAL: { label: '관리자 부여', icon: Settings, color: 'bg-slate-100 text-slate-700' },
};

const statusConfig: Record<PenaltyStatus, { label: string; color: string }> = {
  ACTIVE: { label: '유효', color: 'bg-red-100 text-red-700' },
  EXPIRED: { label: '만료', color: 'bg-slate-100 text-slate-600' },
  REMOVED: { label: '제거됨', color: 'bg-emerald-100 text-emerald-700' },
};

const allPenaltyTypes: PenaltyType[] = [
  'ASSET_DEADLINE_MISSED',
  'CONTRACT_VIOLATION',
  'VERIFICATION_FAILURE',
  'INAPPROPRIATE_CONTENT',
  'ADMIN_MANUAL',
];

interface FormData {
  athleteId: string;
  brandId: string;
  userId: string;
  type: PenaltyType;
  points: number;
  reason: string;
  refType: string;
  refId: string;
  expiresAt: string;
}

const initialFormData: FormData = {
  athleteId: '',
  brandId: '',
  userId: '',
  type: 'ADMIN_MANUAL',
  points: 10,
  reason: '',
  refType: '',
  refId: '',
  expiresAt: '',
};

export function AdminPenalties() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PenaltyStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PenaltyType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [targetType, setTargetType] = useState<'athlete' | 'brand'>('brand');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeModalId, setRemoveModalId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  // Fetch penalties
  const { data: penalties, isLoading } = useQuery({
    queryKey: ['adminPenalties', statusFilter, typeFilter, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchQuery) params.q = searchQuery;
      const res = await api.getPenalties(params);
      return res.data || [];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['penaltyStats'],
    queryFn: async () => {
      const res = await api.getPenaltyStats();
      return res.data as PenaltyStats;
    },
  });

  // Create penalty mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createPenalty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPenalties'] });
      queryClient.invalidateQueries({ queryKey: ['penaltyStats'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
      showSuccess('페널티가 부여되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '페널티 부여에 실패했습니다');
    },
  });

  // Remove penalty mutation
  const removeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.removePenalty(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPenalties'] });
      queryClient.invalidateQueries({ queryKey: ['penaltyStats'] });
      setRemoveModalId(null);
      setRemoveReason('');
      showSuccess('페널티가 제거되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '페널티 제거에 실패했습니다');
    },
  });

  // Expire penalties mutation
  const expireMutation = useMutation({
    mutationFn: () => api.expirePenalties(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminPenalties'] });
      queryClient.invalidateQueries({ queryKey: ['penaltyStats'] });
      showSuccess(`${res.data?.expiredCount || 0}건의 페널티가 만료 처리되었습니다`);
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '만료 처리에 실패했습니다');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleOpenModal = () => {
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      userId: formData.userId,
      type: formData.type,
      points: formData.points,
      reason: formData.reason,
    };

    if (targetType === 'athlete' && formData.athleteId) {
      data.athleteId = formData.athleteId;
    } else if (targetType === 'brand' && formData.brandId) {
      data.brandId = formData.brandId;
    }

    if (formData.refType) data.refType = formData.refType;
    if (formData.refId) data.refId = formData.refId;
    if (formData.expiresAt) data.expiresAt = new Date(formData.expiresAt).toISOString();

    createMutation.mutate(data);
  };

  const handleRemove = () => {
    if (removeModalId && removeReason) {
      removeMutation.mutate({ id: removeModalId, reason: removeReason });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSaving = createMutation.isPending;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">페널티 관리</h1>
            <p className="text-slate-600 mt-1">브랜드/선수 페널티를 관리하고 참여 제한을 설정합니다</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => expireMutation.mutate()}
              disabled={expireMutation.isPending}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              {expireMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              만료 처리
            </button>
            <button
              onClick={handleOpenModal}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              페널티 부여
            </button>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">{errorMessage}</span>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">전체</p>
                  <p className="text-lg font-bold text-slate-900">{stats.totalPenalties}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">유효</p>
                  <p className="text-lg font-bold text-red-600">{stats.activePenalties}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">만료</p>
                  <p className="text-lg font-bold text-slate-600">{stats.expiredPenalties}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">제거됨</p>
                  <p className="text-lg font-bold text-emerald-600">{stats.removedPenalties}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">활성 포인트</p>
                  <p className="text-lg font-bold text-amber-600">{stats.totalActivePoints}점</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="label">상태</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PenaltyStatus | '')}
                className="input"
              >
                <option value="">전체</option>
                <option value="ACTIVE">유효</option>
                <option value="EXPIRED">만료</option>
                <option value="REMOVED">제거됨</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="label">유형</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as PenaltyType | '')}
                className="input"
              >
                <option value="">전체</option>
                {allPenaltyTypes.map((type) => (
                  <option key={type} value={type}>
                    {penaltyTypeConfig[type].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[250px]">
              <label className="label">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="사유 검색..."
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Penalty List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : !penalties || penalties.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">페널티가 없습니다</h3>
              <p className="text-slate-500 text-sm">조건에 맞는 페널티가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">대상</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">유형</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">사유</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">포인트</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">상태</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">만료일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">생성일</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(penalties as Penalty[]).map((penalty) => {
                    const typeConfig = penaltyTypeConfig[penalty.type];
                    const TypeIcon = typeConfig.icon;
                    const statusCfg = statusConfig[penalty.status];
                    return (
                      <tr key={penalty.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {penalty.brandId ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="w-4 h-4 text-orange-500" />
                                <span className="text-slate-900">브랜드</span>
                              </div>
                            ) : penalty.athleteId ? (
                              <div className="flex items-center gap-1 text-sm">
                                <User className="w-4 h-4 text-cyan-500" />
                                <span className="text-slate-900">선수</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('badge text-xs inline-flex items-center gap-1', typeConfig.color)}>
                            <TypeIcon className="w-3 h-3" />
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-900 line-clamp-2 max-w-[200px]">{penalty.reason}</p>
                          {penalty.refType && (
                            <p className="text-xs text-slate-500 mt-1">
                              {penalty.refType} / {penalty.refId?.slice(0, 8)}...
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-red-600">{penalty.points}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('badge text-xs', statusCfg.color)}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {penalty.expiresAt ? (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Calendar className="w-3 h-3" />
                              {formatDate(penalty.expiresAt)}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">{formatDate(penalty.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {penalty.status === 'ACTIVE' && (
                              <button
                                onClick={() => setRemoveModalId(penalty.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="제거"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">페널티 부여</h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Target Type */}
                <div>
                  <label className="label">대상 유형 *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType('brand')}
                      className={cn(
                        'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                        targetType === 'brand'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      <Building2 className="w-4 h-4 inline mr-1" />
                      브랜드
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('athlete')}
                      className={cn(
                        'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                        targetType === 'athlete'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      <User className="w-4 h-4 inline mr-1" />
                      선수
                    </button>
                  </div>
                </div>

                {/* Entity ID */}
                {targetType === 'brand' ? (
                  <div>
                    <label className="label">브랜드 ID *</label>
                    <input
                      type="text"
                      value={formData.brandId}
                      onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                      placeholder="브랜드 UUID"
                      className="input"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="label">선수 ID *</label>
                    <input
                      type="text"
                      value={formData.athleteId}
                      onChange={(e) => setFormData({ ...formData, athleteId: e.target.value })}
                      placeholder="선수 UUID"
                      className="input"
                      required
                    />
                  </div>
                )}

                {/* User ID */}
                <div>
                  <label className="label">사용자 ID *</label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    placeholder="사용자 UUID"
                    className="input"
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="label">페널티 유형 *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as PenaltyType })}
                    className="input"
                    required
                  >
                    {allPenaltyTypes.map((type) => (
                      <option key={type} value={type}>
                        {penaltyTypeConfig[type].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Points */}
                <div>
                  <label className="label">페널티 점수 *</label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 10 })}
                    min={1}
                    max={100}
                    className="input"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">30점 이상 누적 시 참여가 제한됩니다</p>
                </div>

                {/* Reason */}
                <div>
                  <label className="label">사유 *</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="페널티 부여 사유를 입력하세요"
                    className="input min-h-[100px] resize-y"
                    required
                    maxLength={1000}
                  />
                </div>

                {/* Reference */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">참조 타입</label>
                    <input
                      type="text"
                      value={formData.refType}
                      onChange={(e) => setFormData({ ...formData, refType: e.target.value })}
                      placeholder="CONTRACT, AUCTION 등"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">참조 ID</label>
                    <input
                      type="text"
                      value={formData.refId}
                      onChange={(e) => setFormData({ ...formData, refId: e.target.value })}
                      placeholder="관련 엔티티 ID"
                      className="input"
                    />
                  </div>
                </div>

                {/* Expires At */}
                <div>
                  <label className="label">만료일 (선택)</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-slate-500 mt-1">미입력 시 90일 후 자동 만료</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn-secondary"
                    disabled={isSaving}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary inline-flex items-center gap-2"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? '부여 중...' : '페널티 부여'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Remove Modal */}
        {removeModalId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">페널티 제거</h2>
                  <button
                    onClick={() => {
                      setRemoveModalId(null);
                      setRemoveReason('');
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  이 페널티를 제거하시겠습니까? 제거 사유를 입력해 주세요.
                </p>
                <div>
                  <label className="label">제거 사유 *</label>
                  <textarea
                    value={removeReason}
                    onChange={(e) => setRemoveReason(e.target.value)}
                    placeholder="페널티 제거 사유를 입력하세요"
                    className="input min-h-[100px] resize-y"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setRemoveModalId(null);
                      setRemoveReason('');
                    }}
                    className="btn btn-secondary"
                    disabled={removeMutation.isPending}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleRemove}
                    className="btn bg-red-500 text-white hover:bg-red-600 inline-flex items-center gap-2"
                    disabled={removeMutation.isPending || !removeReason}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    제거
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminPenalties;

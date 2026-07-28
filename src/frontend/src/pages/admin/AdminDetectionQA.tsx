import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  ScanLine,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Play,
  Loader2,
  Image,
  X,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../utils';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';

export function AdminDetectionQA() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedExposure, setSelectedExposure] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedDuration, setEditedDuration] = useState(0);
  const [reviewNote, setReviewNote] = useState('');

  // 노출 목록 조회
  const { data: exposuresData, isLoading } = useQuery({
    queryKey: ['admin-exposures-qa', page, statusFilter, campaignFilter],
    queryFn: () => api.get('/roi/admin/exposures', {
      page,
      reviewStatus: statusFilter !== 'all' ? statusFilter : undefined,
      campaignId: campaignFilter !== 'all' ? campaignFilter : undefined,
    }),
  });

  // 캠페인 목록 조회
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: () => api.get('/campaigns'),
  });

  // 리뷰 mutation
  const reviewMutation = useMutation({
    mutationFn: (data: { exposureId: string; status: ReviewStatus; duration?: number; note?: string }) =>
      api.put(`/roi/admin/exposures/${data.exposureId}/review`, {
        status: data.status,
        isValid: data.status === 'APPROVED' || data.status === 'MODIFIED',
        notes: data.note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exposures-qa'] });
      setSelectedExposure(null);
      setEditMode(false);
      setReviewNote('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '리뷰 처리에 실패했습니다.');
    },
  });

  // 스크린샷 생성 mutation
  const screenshotMutation = useMutation({
    mutationFn: (exposureId: string) => api.post(`/roi/admin/exposures/${exposureId}/screenshot`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exposures-qa'] });
      alert('스크린샷이 생성되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '스크린샷 생성에 실패했습니다.');
    },
  });

  // 클립 생성 mutation
  const clipMutation = useMutation({
    mutationFn: (exposureId: string) => api.post(`/roi/admin/exposures/${exposureId}/clip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exposures-qa'] });
      alert('클립이 생성되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '클립 생성에 실패했습니다.');
    },
  });

  // 일괄 승인 mutation
  const bulkApproveMutation = useMutation({
    mutationFn: (params: { minConfidence?: number; campaignId?: string }) =>
      api.post('/roi/admin/exposures/bulk-approve', params),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exposures-qa'] });
      alert(data?.data?.message || '일괄 승인되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '일괄 승인에 실패했습니다.');
    },
  });

  const handleBulkApprove = () => {
    const minConf = prompt('최소 신뢰도 (예: 0.7, 빈칸은 전체):', '0.7');
    if (minConf === null) return;

    const params: any = {};
    if (minConf) params.minConfidence = parseFloat(minConf);
    if (campaignFilter !== 'all') params.campaignId = campaignFilter;

    if (confirm(`조건에 맞는 PENDING 상태 노출을 모두 승인하시겠습니까?`)) {
      bulkApproveMutation.mutate(params);
    }
  };

  const exposures = exposuresData?.data?.items || [];
  const pagination = exposuresData?.data?.pagination;
  const campaigns = campaignsData?.data || [];

  const statusStyles: Record<ReviewStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
    MODIFIED: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const statusLabels: Record<ReviewStatus, string> = {
    PENDING: '검토 대기',
    APPROVED: '승인',
    REJECTED: '거부',
    MODIFIED: '수정됨',
  };

  const statusIcons: Record<ReviewStatus, React.ReactNode> = {
    PENDING: <Clock className="w-4 h-4" />,
    APPROVED: <CheckCircle className="w-4 h-4" />,
    REJECTED: <XCircle className="w-4 h-4" />,
    MODIFIED: <Edit3 className="w-4 h-4" />,
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  const formatTimestamp = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleApprove = (exposure: any) => {
    reviewMutation.mutate({
      exposureId: exposure.id,
      status: 'APPROVED',
      note: reviewNote,
    });
  };

  const handleReject = (exposure: any) => {
    reviewMutation.mutate({
      exposureId: exposure.id,
      status: 'REJECTED',
      note: reviewNote,
    });
  };

  const handleModify = (exposure: any) => {
    reviewMutation.mutate({
      exposureId: exposure.id,
      status: 'MODIFIED',
      duration: editedDuration,
      note: reviewNote,
    });
  };

  const openDetailModal = (exposure: any) => {
    setSelectedExposure(exposure);
    setEditedDuration(exposure.duration);
    setReviewNote('');
    setEditMode(false);
  };

  // Stats
  const pendingCount = exposures.filter((e: any) => e.reviewStatus === 'PENDING').length;
  const approvedCount = exposures.filter((e: any) => e.reviewStatus === 'APPROVED').length;
  const rejectedCount = exposures.filter((e: any) => e.reviewStatus === 'REJECTED').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">로고 검출 QA</h1>
            <p className="text-slate-600 mt-1">AI가 검출한 로고 노출을 검토하고 승인/거부합니다</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">검토 대기</p>
                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">승인됨</p>
                <p className="text-2xl font-bold text-slate-900">{approvedCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">거부됨</p>
                <p className="text-2xl font-bold text-slate-900">{rejectedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 상태</option>
                <option value="PENDING">검토 대기</option>
                <option value="APPROVED">승인</option>
                <option value="REJECTED">거부</option>
                <option value="MODIFIED">수정됨</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="input w-60"
              >
                <option value="all">전체 캠페인</option>
                {campaigns.map((campaign: any) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {bulkApproveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              일괄 승인
            </button>
          </div>
        </div>

        {/* Exposures Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : exposures.length === 0 ? (
            <div className="p-12 text-center">
              <ScanLine className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">검출 내역이 없습니다</h3>
              <p className="text-slate-600">현재 조건에 맞는 로고 노출이 없습니다</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      노출 정보
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      브랜드
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      타임코드
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      노출시간
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      신뢰도
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {exposures.map((exposure: any) => (
                    <tr key={exposure.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {exposure.evidence?.[0]?.thumbnailUrl ? (
                            <img
                              src={exposure.evidence[0].thumbnailUrl}
                              alt="Thumbnail"
                              className="w-16 h-10 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Image className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {exposure.slotType || 'Unknown Slot'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {exposure.vod?.title || 'VOD'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {exposure.brand?.logoUrl && (
                            <img
                              src={exposure.brand.logoUrl}
                              alt={exposure.brand.name}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <span className="text-sm text-slate-900">
                            {exposure.brand?.name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-mono">
                          {formatTimestamp(exposure.startTime)} - {formatTimestamp(exposure.endTime)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {formatDuration(exposure.duration)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                exposure.avgConfidence >= 0.8 ? 'bg-emerald-500' :
                                exposure.avgConfidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${exposure.avgConfidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {(exposure.avgConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'badge inline-flex items-center gap-1',
                          statusStyles[exposure.reviewStatus as ReviewStatus] || statusStyles.PENDING
                        )}>
                          {statusIcons[exposure.reviewStatus as ReviewStatus]}
                          {statusLabels[exposure.reviewStatus as ReviewStatus] || '검토 대기'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetailModal(exposure)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="상세 보기"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {exposure.reviewStatus === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  reviewMutation.mutate({
                                    exposureId: exposure.id,
                                    status: 'APPROVED',
                                  });
                                }}
                                disabled={reviewMutation.isPending}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="승인"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  reviewMutation.mutate({
                                    exposureId: exposure.id,
                                    status: 'REJECTED',
                                  });
                                }}
                                disabled={reviewMutation.isPending}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="거부"
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => screenshotMutation.mutate(exposure.id)}
                            disabled={screenshotMutation.isPending}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="스크린샷 생성"
                          >
                            <Image className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => clipMutation.mutate(exposure.id)}
                            disabled={clipMutation.isPending}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="클립 생성"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  총 {pagination?.total || exposures.length}개 노출
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    페이지 {page} / {pagination?.totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={pagination && page >= pagination.totalPages}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedExposure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">노출 상세 정보</h2>
                <button
                  onClick={() => setSelectedExposure(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Preview */}
              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden">
                {selectedExposure.evidence?.[0]?.mediaUrl ? (
                  selectedExposure.evidence[0].mediaType === 'VIDEO' ? (
                    <video
                      src={selectedExposure.evidence[0].mediaUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedExposure.evidence[0].mediaUrl}
                      alt="Evidence"
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Image className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400">증빙 자료 없음</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">브랜드</p>
                  <div className="flex items-center gap-2">
                    {selectedExposure.brand?.logoUrl && (
                      <img
                        src={selectedExposure.brand.logoUrl}
                        alt={selectedExposure.brand.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                    <span className="font-medium text-slate-900">
                      {selectedExposure.brand?.name || '-'}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">슬롯 타입</p>
                  <p className="font-medium text-slate-900">{selectedExposure.slotType || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">타임코드</p>
                  <p className="font-medium text-slate-900 font-mono">
                    {formatTimestamp(selectedExposure.startTime)} - {formatTimestamp(selectedExposure.endTime)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">평균 신뢰도</p>
                  <p className="font-medium text-slate-900">
                    {(selectedExposure.avgConfidence * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Duration Edit */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">노출 시간</p>
                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      수정
                    </button>
                  )}
                </div>
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editedDuration}
                      onChange={(e) => setEditedDuration(parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      className="input w-32 text-sm"
                    />
                    <span className="text-slate-600">초</span>
                    <button
                      onClick={() => setEditMode(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-slate-900">
                    {formatDuration(selectedExposure.duration)}
                  </p>
                )}
              </div>

              {/* Review Note */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  검토 메모 (선택)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="검토 시 참고할 메모를 입력하세요..."
                  rows={3}
                  className="input"
                />
              </div>

              {/* Validity Warning */}
              {!selectedExposure.isValid && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">유효성 검사 미통과</span>
                  </div>
                  <p className="text-sm text-amber-600 mt-1">
                    이 노출은 최소 기준(면적, 시간, 신뢰도)을 충족하지 않습니다.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => setSelectedExposure(null)}
                className="btn btn-secondary"
              >
                닫기
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleReject(selectedExposure)}
                  disabled={reviewMutation.isPending}
                  className="btn bg-red-500 text-white hover:bg-red-600 inline-flex items-center gap-2"
                >
                  <ThumbsDown className="w-4 h-4" />
                  거부
                </button>
                {editMode && editedDuration !== selectedExposure.duration ? (
                  <button
                    onClick={() => handleModify(selectedExposure)}
                    disabled={reviewMutation.isPending}
                    className="btn bg-blue-500 text-white hover:bg-blue-600 inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    수정 후 승인
                  </button>
                ) : (
                  <button
                    onClick={() => handleApprove(selectedExposure)}
                    disabled={reviewMutation.isPending}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    승인
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

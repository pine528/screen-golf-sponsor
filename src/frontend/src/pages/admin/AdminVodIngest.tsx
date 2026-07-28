import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Video,
  Upload,
  Link,
  Search,
  Filter,
  Play,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileVideo,
  Youtube,
  X,
  Zap,
  Image,
  ScanLine,
} from 'lucide-react';
import { cn } from '../../utils';
import { getEventMonthLabel } from '../../utils/eventMonth';

type VodStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export function AdminVodIngest() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [vodTitle, setVodTitle] = useState('');

  // VOD 목록 조회
  const { data: vodsData, isLoading } = useQuery({
    queryKey: ['admin-vods', page, statusFilter],
    queryFn: () => api.get('/roi/admin/vod', {
      page, status: statusFilter !== 'all' ? statusFilter : undefined
    }),
    refetchInterval: 10000, // 10초마다 새로고침 (진행중인 작업 상태 갱신)
  });

  // 이벤트 목록 조회
  const { data: eventsData } = useQuery({
    queryKey: ['events-list'],
    queryFn: () => api.get('/events'),
  });

  // 캠페인 목록 조회
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: () => api.get('/campaigns'),
  });

  // 파일 업로드 mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; eventId?: string; campaignId?: string; title?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.eventId) formData.append('eventId', data.eventId);
      if (data.campaignId) formData.append('campaignId', data.campaignId);
      if (data.title) formData.append('title', data.title);
      return api.post('/roi/admin/vod/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      setShowUploadModal(false);
      resetForm();
      alert('VOD 업로드가 시작되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'VOD 업로드에 실패했습니다.');
    },
  });

  // YouTube 인제스트 mutation
  const youtubeMutation = useMutation({
    mutationFn: (data: { youtubeUrl: string; eventId?: string; campaignId?: string; title?: string }) =>
      api.post('/roi/admin/vod/ingest', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      setShowYoutubeModal(false);
      resetForm();
      alert('YouTube 다운로드가 시작되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'YouTube 인제스트에 실패했습니다.');
    },
  });

  // 프레임 추출 mutation
  const extractFramesMutation = useMutation({
    mutationFn: (vodId: string) => api.post(`/roi/admin/vod/${vodId}/extract-frames`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      alert('프레임 추출이 시작되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '프레임 추출에 실패했습니다.');
    },
  });

  // 로고 검출 mutation
  const detectLogosMutation = useMutation({
    mutationFn: (vodId: string) => api.post(`/roi/admin/vod/${vodId}/detect-logos`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      alert('로고 검출이 백그라운드에서 시작되었습니다.\n처리 완료까지 시간이 걸릴 수 있습니다.\n(페이지가 10초마다 자동 새로고침됩니다)');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '로고 검출에 실패했습니다.');
    },
  });

  // 노출 병합 mutation
  const mergeExposuresMutation = useMutation({
    mutationFn: (vodId: string) => api.post(`/roi/admin/vod/${vodId}/merge-exposures`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      alert('노출 병합이 완료되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '노출 병합에 실패했습니다.');
    },
  });

  // VOD 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: (vodId: string) => api.delete(`/roi/admin/vod/${vodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vods'] });
      alert('VOD가 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'VOD 삭제에 실패했습니다.');
    },
  });

  const resetForm = () => {
    setUploadFile(null);
    setYoutubeUrl('');
    setSelectedEventId('');
    setSelectedCampaignId('');
    setVodTitle('');
  };

  // VOD API returns { items: [...], pagination: {...} }
  // Events API returns [...] directly with pagination at top level
  // Campaigns API returns [...] directly with pagination at top level
  const vods = Array.isArray(vodsData?.data?.items)
    ? vodsData.data.items
    : Array.isArray(vodsData?.data)
      ? vodsData.data
      : [];
  const events = Array.isArray(eventsData?.data) ? eventsData.data : [];
  const campaigns = Array.isArray(campaignsData?.data) ? campaignsData.data : [];

  const filteredVods = vods.filter((vod: any) =>
    vod.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vod.event?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusStyles: Record<VodStatus, string> = {
    PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
    PROCESSING: 'bg-amber-100 text-amber-700 border-amber-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<VodStatus, string> = {
    PENDING: '대기',
    PROCESSING: '처리 중',
    COMPLETED: '완료',
    FAILED: '실패',
  };

  const statusIcons: Record<VodStatus, React.ReactNode> = {
    PENDING: <Clock className="w-4 h-4" />,
    PROCESSING: <Loader2 className="w-4 h-4 animate-spin" />,
    COMPLETED: <CheckCircle className="w-4 h-4" />,
    FAILED: <XCircle className="w-4 h-4" />,
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">VOD 인제스트</h1>
            <p className="text-slate-600 mt-1">ROI 분석을 위한 VOD를 업로드하고 처리합니다</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowYoutubeModal(true)}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <Youtube className="w-4 h-4" />
              YouTube 인제스트
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              파일 업로드
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">전체 VOD</p>
                <p className="text-2xl font-bold text-slate-900">{vods.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">처리 중</p>
                <p className="text-2xl font-bold text-slate-900">
                  {vods.filter((v: any) => v.status === 'PROCESSING').length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">분석 완료</p>
                <p className="text-2xl font-bold text-slate-900">
                  {vods.filter((v: any) => v.status === 'COMPLETED').length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">실패</p>
                <p className="text-2xl font-bold text-slate-900">
                  {vods.filter((v: any) => v.status === 'FAILED').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="VOD 제목 또는 이벤트명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 상태</option>
                <option value="PENDING">대기</option>
                <option value="PROCESSING">처리 중</option>
                <option value="COMPLETED">완료</option>
                <option value="FAILED">실패</option>
              </select>
            </div>
          </div>
        </div>

        {/* VOD Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredVods.length === 0 ? (
            <div className="p-12 text-center">
              <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">VOD가 없습니다</h3>
              <p className="text-slate-600">새 VOD를 업로드하거나 YouTube에서 인제스트하세요</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      VOD
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      이벤트/캠페인
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      정보
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      프레임/검출
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
                  {filteredVods.map((vod: any) => (
                    <tr key={vod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            vod.source === 'YOUTUBE' ? 'bg-red-100' : 'bg-slate-100'
                          )}>
                            {vod.source === 'YOUTUBE' ? (
                              <Youtube className="w-5 h-5 text-red-600" />
                            ) : (
                              <FileVideo className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 max-w-[200px] truncate">
                              {vod.title || 'Untitled'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(vod.createdAt).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          {vod.event && (
                            <p className="text-sm text-slate-900">{getEventMonthLabel(vod.event)}</p>
                          )}
                          {vod.campaign && (
                            <p className="text-xs text-slate-500">{vod.campaign.name}</p>
                          )}
                          {!vod.event && !vod.campaign && (
                            <p className="text-sm text-slate-400">-</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {vod.duration && (
                            <p>{formatDuration(vod.duration)}</p>
                          )}
                          {vod.fileSizeBytes && (
                            <p className="text-xs text-slate-500">{formatFileSize(Number(vod.fileSizeBytes))}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Image className="w-4 h-4" />
                            <span>{vod._count?.frames || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-600">
                            <ScanLine className="w-4 h-4" />
                            <span>{vod._count?.roiExposures || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className={cn(
                            'badge inline-flex items-center gap-1',
                            statusStyles[vod.status as VodStatus] || statusStyles.PENDING
                          )}>
                            {statusIcons[vod.status as VodStatus]}
                            {statusLabels[vod.status as VodStatus] || '대기'}
                          </span>
                          {vod.status === 'FAILED' && vod.errorMessage && (
                            <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={vod.errorMessage}>
                              {vod.errorMessage}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {vod.status === 'COMPLETED' && (
                            <>
                              <button
                                onClick={() => extractFramesMutation.mutate(vod.id)}
                                disabled={extractFramesMutation.isPending}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="프레임 추출"
                              >
                                <Image className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => detectLogosMutation.mutate(vod.id)}
                                disabled={detectLogosMutation.isPending}
                                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="로고 검출"
                              >
                                <ScanLine className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => mergeExposuresMutation.mutate(vod.id)}
                                disabled={mergeExposuresMutation.isPending}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="노출 병합"
                              >
                                <Zap className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {vod.videoUrl && (
                            <a
                              href={vod.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="영상 보기"
                            >
                              <Play className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              if (confirm('정말 이 VOD를 삭제하시겠습니까?')) {
                                deleteMutation.mutate(vod.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">총 {filteredVods.length}개 VOD</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">페이지 {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">VOD 파일 업로드</h2>
                <button
                  onClick={() => { setShowUploadModal(false); resetForm(); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  영상 파일 <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="vod-file-input"
                  />
                  <label htmlFor="vod-file-input" className="cursor-pointer">
                    {uploadFile ? (
                      <div>
                        <FileVideo className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-900">{uploadFile.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(uploadFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600">클릭하여 파일 선택</p>
                        <p className="text-xs text-slate-500 mt-1">MP4, MOV, AVI (최대 2GB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">제목</label>
                <input
                  type="text"
                  value={vodTitle}
                  onChange={(e) => setVodTitle(e.target.value)}
                  placeholder="VOD 제목을 입력하세요"
                  className="input"
                />
              </div>

              {/* Event Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">이벤트</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="input"
                >
                  <option value="">이벤트 선택 (선택사항)</option>
                  {events.map((event: any) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>

              {/* Campaign Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">캠페인</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="input"
                >
                  <option value="">캠페인 선택 (선택사항)</option>
                  {campaigns.map((campaign: any) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowUploadModal(false); resetForm(); }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (uploadFile) {
                    uploadMutation.mutate({
                      file: uploadFile,
                      eventId: selectedEventId || undefined,
                      campaignId: selectedCampaignId || undefined,
                      title: vodTitle || undefined,
                    });
                  }
                }}
                disabled={!uploadFile || uploadMutation.isPending}
                className="btn btn-primary"
              >
                {uploadMutation.isPending ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Ingest Modal */}
      {showYoutubeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">YouTube 인제스트</h2>
                <button
                  onClick={() => { setShowYoutubeModal(false); resetForm(); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  YouTube URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">제목 (선택)</label>
                <input
                  type="text"
                  value={vodTitle}
                  onChange={(e) => setVodTitle(e.target.value)}
                  placeholder="비워두면 YouTube 제목 사용"
                  className="input"
                />
              </div>

              {/* Event Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">이벤트</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="input"
                >
                  <option value="">이벤트 선택 (선택사항)</option>
                  {events.map((event: any) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>

              {/* Campaign Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">캠페인</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="input"
                >
                  <option value="">캠페인 선택 (선택사항)</option>
                  {campaigns.map((campaign: any) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowYoutubeModal(false); resetForm(); }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => {
                  youtubeMutation.mutate({
                    youtubeUrl,
                    eventId: selectedEventId || undefined,
                    campaignId: selectedCampaignId || undefined,
                    title: vodTitle || undefined,
                  });
                }}
                disabled={!youtubeUrl || youtubeMutation.isPending}
                className="btn btn-primary"
              >
                {youtubeMutation.isPending ? '인제스트 중...' : '인제스트 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

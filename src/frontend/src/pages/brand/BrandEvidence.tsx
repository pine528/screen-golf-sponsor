import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  FileImage,
  Video,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image,
  Play,
  Clock,
  CheckCircle,
  Package,
  Eye,
  X,
} from 'lucide-react';
import { cn } from '../../utils';

type EvidenceType = 'SCREENSHOT' | 'CLIP';

export function BrandEvidence() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // 캠페인 정보 조회
  const { data: campaignData } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get(`/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });

  // 증빙 목록 조회
  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['campaign-evidence', campaignId, page, typeFilter],
    queryFn: () => api.get(`/roi/campaigns/${campaignId}/evidence`, {
      page,
      type: typeFilter !== 'all' ? typeFilter : undefined,
    }),
    enabled: !!campaignId,
  });

  // Proof Pack 다운로드 mutation
  const downloadPackMutation = useMutation({
    mutationFn: () => api.get(`/roi/campaigns/${campaignId}/evidence/download`),
    onSuccess: (response: any) => {
      const fileUrl = response?.data?.fileUrl;
      if (fileUrl) {
        // Cloudinary URL로 새 탭에서 다운로드
        window.open(fileUrl, '_blank');
      } else {
        alert('다운로드 URL을 가져오지 못했습니다.');
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || '다운로드에 실패했습니다.');
    },
  });

  const campaign = campaignData?.data;
  const evidence = evidenceData?.data?.items || [];
  const pagination = evidenceData?.data?.pagination;

  const typeStyles: Record<EvidenceType, string> = {
    SCREENSHOT: 'bg-blue-100 text-blue-700 border-blue-200',
    CLIP: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const typeLabels: Record<EvidenceType, string> = {
    SCREENSHOT: '스크린샷',
    CLIP: '영상 클립',
  };

  const typeIcons: Record<EvidenceType, React.ReactNode> = {
    SCREENSHOT: <FileImage className="w-4 h-4" />,
    CLIP: <Video className="w-4 h-4" />,
  };

  // 백엔드 응답 형식에 맞게 변환 (type → evidenceType 등)
  const getEvidenceType = (item: any): EvidenceType => item.type || 'SCREENSHOT';
  const getMediaType = (item: any) => item.type === 'CLIP' ? 'VIDEO' : 'IMAGE';
  const getMediaUrl = (item: any) => item.fileUrl;
  const getExposureDuration = (item: any) =>
    item.exposure?.endTs && item.exposure?.startTs
      ? item.exposure.endTs - item.exposure.startTs
      : 0;

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0초';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  const formatTimestamp = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === evidence.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(evidence.map((e: any) => e.id));
    }
  };

  const handleDownload = () => {
    downloadPackMutation.mutate();
  };

  // Stats (현재 페이지 기준)
  const totalCount = pagination?.total || evidence.length;
  const screenshotCount = evidence.filter((e: any) => e.type === 'SCREENSHOT').length;
  const clipCount = evidence.filter((e: any) => e.type === 'CLIP').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ROI 증빙 자료</h1>
            <p className="text-slate-600 mt-1">
              {campaign?.name || '캠페인'}의 로고 노출 증빙 자료를 확인합니다
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloadPackMutation.isPending}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            {downloadPackMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            전체 Proof Pack 다운로드
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Image className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">전체 증빙</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileImage className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">스크린샷</p>
                <p className="text-2xl font-bold text-slate-900">{screenshotCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">영상 클립</p>
                <p className="text-2xl font-bold text-slate-900">{clipCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input w-40"
                >
                  <option value="all">전체 유형</option>
                  <option value="SCREENSHOT">스크린샷</option>
                  <option value="CLIP">영상 클립</option>
                </select>
              </div>
              <button
                onClick={handleSelectAll}
                className="text-sm text-emerald-600 hover:text-emerald-700"
              >
                {selectedItems.length === evidence.length ? '선택 해제' : '전체 선택'}
              </button>
            </div>
            {selectedItems.length > 0 && (
              <p className="text-sm text-slate-600">{selectedItems.length}개 선택됨</p>
            )}
          </div>
        </div>

        {/* Evidence Grid */}
        {isLoading ? (
          <div className="card p-8 text-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-600">로딩 중...</p>
          </div>
        ) : evidence.length === 0 ? (
          <div className="card p-12 text-center">
            <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">증빙 자료가 없습니다</h3>
            <p className="text-slate-600">아직 생성된 증빙 자료가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evidence.map((item: any) => (
              <div
                key={item.id}
                className={cn(
                  'card overflow-hidden cursor-pointer transition-all',
                  selectedItems.includes(item.id) && 'ring-2 ring-emerald-500'
                )}
              >
                {/* Thumbnail */}
                <div
                  className="aspect-video bg-slate-900 relative group"
                  onClick={() => setSelectedEvidence(item)}
                >
                  {getMediaType(item) === 'IMAGE' && getMediaUrl(item) ? (
                    <img
                      src={getMediaUrl(item)}
                      alt="Evidence thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getMediaType(item) === 'VIDEO' ? (
                        <Video className="w-12 h-12 text-slate-600" />
                      ) : (
                        <Image className="w-12 h-12 text-slate-600" />
                      )}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white" />
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={cn(
                      'badge inline-flex items-center gap-1 text-xs',
                      typeStyles[getEvidenceType(item)]
                    )}>
                      {typeIcons[getEvidenceType(item)]}
                      {typeLabels[getEvidenceType(item)]}
                    </span>
                  </div>

                  {/* Play Icon for Video */}
                  {getMediaType(item) === 'VIDEO' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-slate-900 ml-1" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {item.exposure?.slotType || 'Unknown Slot'}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {item.exposure?.vodAsset?.fileName || 'VOD'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectItem(item.id);
                      }}
                      className={cn(
                        'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                        selectedItems.includes(item.id)
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 hover:border-emerald-500'
                      )}
                    >
                      {selectedItems.includes(item.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(item.exposure?.startTs || 0)}</span>
                    </div>
                    {getExposureDuration(item) > 0 && (
                      <div className="flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        <span>{formatDuration(getExposureDuration(item))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {evidence.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              총 {pagination?.total || evidence.length}개 증빙
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
        )}
      </div>

      {/* Detail Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">증빙 상세</h2>
                <button
                  onClick={() => setSelectedEvidence(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Media */}
              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden">
                {getMediaType(selectedEvidence) === 'VIDEO' ? (
                  <video
                    src={getMediaUrl(selectedEvidence)}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={getMediaUrl(selectedEvidence)}
                    alt="Evidence"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">유형</p>
                  <div className="flex items-center gap-2">
                    {typeIcons[getEvidenceType(selectedEvidence)]}
                    <span className="font-medium text-slate-900">
                      {typeLabels[getEvidenceType(selectedEvidence)]}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">슬롯 타입</p>
                  <p className="font-medium text-slate-900">
                    {selectedEvidence.exposure?.slotType || '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">타임코드</p>
                  <p className="font-medium text-slate-900 font-mono">
                    {formatTimestamp(selectedEvidence.exposure?.startTs || 0)} - {formatTimestamp(selectedEvidence.exposure?.endTs || 0)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">노출 시간</p>
                  <p className="font-medium text-slate-900">
                    {formatDuration(getExposureDuration(selectedEvidence))}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => setSelectedEvidence(null)}
                className="btn btn-secondary"
              >
                닫기
              </button>
              <a
                href={getMediaUrl(selectedEvidence)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                다운로드
              </a>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

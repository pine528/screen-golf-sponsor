import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileImage, Upload, CheckCircle, XCircle, Clock, AlertCircle, Calendar } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatDate, cn } from '../../utils';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  SUBMITTED: { label: '제출됨', color: 'bg-blue-100 text-blue-700', icon: Clock },
  UNDER_REVIEW: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  APPROVED: { label: '승인됨', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '거부됨', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export function BrandCreativeApprovals() {
  const queryClient = useQueryClient();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 내 크리에이티브 승인 요청 목록
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['brand', 'creative-approvals'],
    queryFn: () => api.getMyCreativeApprovals(),
  });

  // 대회 목록
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  // 제출 mutation
  const submitMutation = useMutation({
    mutationFn: (data: { eventId: string; fileUrl: string; fileName?: string }) =>
      api.submitCreativeApproval(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand', 'creative-approvals'] });
      setShowSubmitModal(false);
      setSelectedEventId('');
      setFileUrl('');
      setFileName('');
      setSubmitError(null);
    },
    onError: (error: any) => {
      setSubmitError(error.response?.data?.error || '제출에 실패했습니다.');
    },
  });

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitError(null);
    setIsUploading(true);
    try {
      const result = await api.uploadFile(file, 'asset');
      // result.data.fileUrl (백엔드 응답 구조)
      setFileUrl(result.data.fileUrl);
      setFileName(result.data.fileName || file.name);
    } catch (error: any) {
      console.error('Upload error:', error);
      setSubmitError('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedEventId || !fileUrl) {
      setSubmitError('대회와 파일을 선택해주세요.');
      return;
    }
    submitMutation.mutate({ eventId: selectedEventId, fileUrl, fileName });
  };

  // 이미 제출한 대회 ID 목록
  const submittedEventIds = (approvals?.data || []).map((a: any) => a.eventId);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">크리에이티브 승인</h1>
            <p className="text-slate-600 mt-1">
              대회 참여를 위해 크리에이티브(로고/디자인)를 미리 제출하고 승인받으세요.
            </p>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            새 제출
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">크리에이티브 사전 승인이란?</p>
              <p>일부 대회는 입찰 전에 브랜드 로고/디자인을 미리 검토합니다. 승인받은 후에만 해당 대회의 슬롯에 입찰할 수 있습니다.</p>
            </div>
          </div>
        </div>

        {/* Approvals List */}
        <div className="card">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">내 제출 내역</h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-500">로딩 중...</div>
          ) : !approvals?.data?.length ? (
            <div className="p-12 text-center text-slate-500">
              제출한 크리에이티브가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {approvals.data.map((approval: any) => {
                const statusInfo = STATUS_LABELS[approval.status] || STATUS_LABELS.SUBMITTED;
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={approval.id} className="p-6 flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {approval.fileUrl ? (
                        <img
                          src={approval.fileUrl}
                          alt="크리에이티브"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileImage className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-900 truncate">
                          {approval.event?.name || '대회'}
                        </h3>
                        <span className={cn('badge text-xs flex items-center gap-1', statusInfo.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(approval.createdAt)}
                        </span>
                        {approval.fileName && (
                          <span className="truncate">{approval.fileName}</span>
                        )}
                      </div>
                      {approval.reviewNotes && (
                        <p className={cn(
                          'mt-2 text-sm p-2 rounded',
                          approval.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'
                        )}>
                          {approval.reviewNotes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {approval.status === 'REJECTED' && (
                      <button
                        onClick={() => {
                          setSelectedEventId(approval.eventId);
                          setShowSubmitModal(true);
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        다시 제출
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                크리에이티브 제출
              </h2>

              {/* Event Selection */}
              <div className="mb-4">
                <label className="label">대회 선택</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="input"
                >
                  <option value="">대회를 선택하세요</option>
                  {events?.data?.map((event: any) => (
                    <option
                      key={event.id}
                      value={event.id}
                      disabled={submittedEventIds.includes(event.id)}
                    >
                      {event.name}
                      {submittedEventIds.includes(event.id) ? ' (이미 제출됨)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="mb-4">
                <label className="label">크리에이티브 파일</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  {isUploading ? (
                    <div className="space-y-2 py-4">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-slate-600">업로드 중...</p>
                    </div>
                  ) : fileUrl ? (
                    <div className="space-y-2">
                      <img
                        src={fileUrl}
                        alt="미리보기"
                        className="w-24 h-24 object-cover mx-auto rounded-lg"
                      />
                      <p className="text-sm text-slate-600">{fileName}</p>
                      <button
                        onClick={() => {
                          setFileUrl('');
                          setFileName('');
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <FileImage className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 mb-1">
                        클릭하여 파일 선택
                      </p>
                      <p className="text-xs text-slate-400">
                        PNG, JPG, PDF (최대 10MB)
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSelectedEventId('');
                    setFileUrl('');
                    setFileName('');
                    setSubmitError(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || !selectedEventId || !fileUrl}
                  className="btn btn-primary flex-1"
                >
                  {submitMutation.isPending ? '제출 중...' : '제출하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

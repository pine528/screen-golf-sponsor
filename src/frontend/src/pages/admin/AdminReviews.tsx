import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  FileCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Image,
  Video,
  FileText,
  AlertTriangle,
  User,
  Building2,
} from 'lucide-react';
import { cn } from '../../utils';

type ReviewType = 'asset' | 'verification';

export function AdminReviews() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: reviewsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-pending-reviews'],
    queryFn: () => api.getPendingReviews(),
  });

  const pendingAssets = reviewsData?.data?.assets || [];
  const pendingVerifications = reviewsData?.data?.verifications || [];

  const allReviews = [
    ...pendingAssets.map((a: any) => ({ ...a, reviewType: 'asset' as ReviewType })),
    ...pendingVerifications.map((v: any) => ({ ...v, reviewType: 'verification' as ReviewType })),
  ];

  const filteredReviews = allReviews
    .filter((review) => {
      if (typeFilter === 'assets') return review.reviewType === 'asset';
      if (typeFilter === 'verifications') return review.reviewType === 'verification';
      return true;
    })
    .filter((review) => {
      const name = review.contract?.auction?.slotInstance?.slotTemplate?.name || '';
      const brandName = review.contract?.brand?.name || '';
      return (
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brandName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const handleApprove = async (review: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (review.reviewType === 'asset') {
        await api.approveAsset(review.id, reviewNotes || undefined);
        alert('에셋이 승인되었습니다.');
      } else {
        await api.approveVerification(review.id, reviewNotes || undefined);
        alert('노출 인증이 승인되었습니다.');
      }
      setShowModal(false);
      setSelectedReview(null);
      setReviewNotes('');
      refetch();
    } catch (error: any) {
      console.error('Approve error:', error);
      alert(error.response?.data?.error?.message || '승인 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (review: any) => {
    if (!reviewNotes.trim()) {
      alert('거부 사유를 입력해주세요.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (review.reviewType === 'asset') {
        await api.rejectAsset(review.id, reviewNotes);
        alert('에셋이 반려되었습니다.');
      } else {
        await api.rejectVerification(review.id, reviewNotes);
        alert('노출 인증이 반려되었습니다.');
      }
      setShowModal(false);
      setSelectedReview(null);
      setReviewNotes('');
      refetch();
    } catch (error: any) {
      console.error('Reject error:', error);
      alert(error.response?.data?.error?.message || '반려 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickApprove = async (review: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (review.reviewType === 'asset') {
        await api.approveAsset(review.id);
        alert('에셋이 승인되었습니다.');
      } else {
        await api.approveVerification(review.id);
        alert('노출 인증이 승인되었습니다.');
      }
      refetch();
    } catch (error: any) {
      console.error('Quick approve error:', error);
      alert(error.response?.data?.error?.message || '승인 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'IMAGE':
        return Image;
      case 'VIDEO':
        return Video;
      default:
        return FileText;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">검수 관리</h1>
            <p className="text-slate-600 mt-1">광고 에셋 및 노출 검증을 심사합니다</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                대기중: {allReviews.length}건
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <Image className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">에셋 검수 대기</p>
                <p className="text-2xl font-bold text-slate-900">{pendingAssets.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">노출 검증 대기</p>
                <p className="text-2xl font-bold text-slate-900">{pendingVerifications.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">긴급 처리 필요</p>
                <p className="text-2xl font-bold text-slate-900">
                  {allReviews.filter((r: any) => r.priority === 'HIGH').length}
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
                placeholder="슬롯명 또는 브랜드명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input w-48"
              >
                <option value="all">전체</option>
                <option value="assets">에셋 검수</option>
                <option value="verifications">노출 검증</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">대기중인 검수가 없습니다</h3>
              <p className="text-slate-600">모든 검수 요청이 처리되었습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredReviews.map((review: any) => {
                const IconComponent = review.reviewType === 'asset'
                  ? getAssetIcon(review.fileType || review.type)
                  : FileCheck;

                return (
                  <div
                    key={`${review.reviewType}-${review.id}`}
                    className="p-6 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          review.reviewType === 'asset' ? 'bg-violet-100' : 'bg-emerald-100'
                        )}>
                          <IconComponent className={cn(
                            'w-6 h-6',
                            review.reviewType === 'asset' ? 'text-violet-600' : 'text-emerald-600'
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">
                              {review.contract?.auction?.slotInstance?.slotTemplate?.name || '슬롯'}
                            </h3>
                            <span className={cn(
                              'badge',
                              review.reviewType === 'asset'
                                ? 'bg-violet-100 text-violet-700 border-violet-200'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            )}>
                              {review.reviewType === 'asset' ? '에셋 검수' : '노출 검증'}
                            </span>
                            {review.priority === 'HIGH' && (
                              <span className="badge bg-red-100 text-red-700 border-red-200">
                                긴급
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              <span>{review.contract?.brand?.name || '브랜드'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{review.contract?.athlete?.name || '선수'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>제출일: {formatDate(review.createdAt)}</span>
                            </div>
                          </div>
                          {review.reviewType === 'asset' && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                에셋 타입: {review.fileType === 'IMAGE' || review.type === 'IMAGE' ? '이미지' : review.fileType === 'VIDEO' || review.type === 'VIDEO' ? '비디오' : '기타'}
                              </span>
                              {review.fileName && (
                                <span className="text-xs text-slate-500">
                                  | 파일: {review.fileName}
                                </span>
                              )}
                            </div>
                          )}
                          {review.reviewType === 'verification' && review.photoUrls && (
                            <div className="mt-2 text-xs text-slate-500">
                              첨부 사진: {review.photoUrls.length}장
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedReview(review);
                            setShowModal(true);
                          }}
                          className="btn btn-secondary inline-flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          상세보기
                        </button>
                        <button
                          onClick={() => handleQuickApprove(review)}
                          disabled={isSubmitting}
                          className="btn btn-primary inline-flex items-center gap-2"
                        >
                          {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          승인
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReview(review);
                            setShowModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="거부"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showModal && selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => {
            setShowModal(false);
            setSelectedReview(null);
            setReviewNotes('');
          }}
          onApprove={() => handleApprove(selectedReview)}
          onReject={() => handleReject(selectedReview)}
          notes={reviewNotes}
          setNotes={setReviewNotes}
          isSubmitting={isSubmitting}
        />
      )}
    </Layout>
  );
}

interface ReviewDetailModalProps {
  review: any;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  notes: string;
  setNotes: (notes: string) => void;
  isSubmitting: boolean;
}

function ReviewDetailModal({ review, onClose, onApprove, onReject, notes, setNotes, isSubmitting }: ReviewDetailModalProps) {
  const isAsset = review.reviewType === 'asset';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              isAsset ? 'bg-violet-100' : 'bg-emerald-100'
            )}>
              {isAsset ? (
                <Image className="w-6 h-6 text-violet-600" />
              ) : (
                <FileCheck className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isAsset ? '에셋 검수' : '노출 검증'} 상세
              </h2>
              <p className="text-sm text-slate-600">
                {review.contract?.auction?.slotInstance?.slotTemplate?.name || '슬롯'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Preview */}
          {isAsset && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">에셋 미리보기</h3>
              <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden">
                {(review.fileType === 'IMAGE' || review.type === 'IMAGE') && review.fileUrl ? (
                  <img
                    src={review.fileUrl}
                    alt="Asset preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (review.fileType === 'VIDEO' || review.type === 'VIDEO') ? (
                  <div className="text-center">
                    <Video className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">비디오 파일</p>
                    {review.fileName && (
                      <p className="text-xs text-slate-400 mt-1">{review.fileName}</p>
                    )}
                    {review.fileUrl && (
                      <a href={review.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline mt-2 block">
                        파일 보기
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">파일</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification Evidence */}
          {!isAsset && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">노출 증빙 사진</h3>
              {review.photoUrls && review.photoUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {review.photoUrls.map((url: string, index: number) => (
                    <div key={index} className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={url}
                        alt={`증빙 사진 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                  <div className="text-center">
                    <Image className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">증빙 사진이 없습니다</p>
                  </div>
                </div>
              )}
              {review.notes && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">메모:</span> {review.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Contract Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">계약 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">브랜드</p>
                <p className="text-sm font-medium text-slate-900">
                  {review.contract?.brand?.name || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">선수</p>
                <p className="text-sm font-medium text-slate-900">
                  {review.contract?.athlete?.name || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">이벤트</p>
                <p className="text-sm font-medium text-slate-900">
                  {review.contract?.auction?.slotInstance?.event?.name || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">슬롯</p>
                <p className="text-sm font-medium text-slate-900">
                  {review.contract?.auction?.slotInstance?.slotTemplate?.name || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">검수 가이드라인</h3>
            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <ul className="text-sm text-sky-800 space-y-2">
                {isAsset ? (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>이미지 해상도가 최소 1920x1080 이상인지 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>브랜드 로고 및 텍스트가 선명하게 보이는지 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>부적절한 콘텐츠가 포함되어 있지 않은지 확인</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>사진에 광고가 정상적으로 노출되었는지 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>대회 현장에서 촬영된 것이 맞는지 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>사진이 조작되지 않았는지 확인</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Review Notes */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">검수 의견</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[100px]"
              placeholder="검수 의견을 입력하세요 (거부 시 필수)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button onClick={onClose} className="btn btn-secondary flex-1" disabled={isSubmitting}>
              취소
            </button>
            <button
              onClick={onReject}
              disabled={isSubmitting}
              className="btn btn-danger flex-1 inline-flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              거부
            </button>
            <button
              onClick={onApprove}
              disabled={isSubmitting}
              className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              승인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

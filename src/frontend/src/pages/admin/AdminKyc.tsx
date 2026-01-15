import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  User,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  FileText,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../utils';

export function AdminKyc() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const queryClient = useQueryClient();

  const { data: kycData, isLoading } = useQuery({
    queryKey: ['admin-pending-kyc'],
    queryFn: () => api.getPendingKyc(),
  });

  const reviewBrandMutation = useMutation({
    mutationFn: ({ brandId, status, notes }: { brandId: string; status: string; notes?: string }) =>
      api.reviewBrandKyc(brandId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-kyc'] });
      setShowModal(false);
      setSelectedItem(null);
      setReviewNotes('');
    },
  });

  const reviewAthleteMutation = useMutation({
    mutationFn: ({ athleteId, status, notes }: { athleteId: string; status: string; notes?: string }) =>
      api.reviewAthleteKyc(athleteId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-kyc'] });
      setShowModal(false);
      setSelectedItem(null);
      setReviewNotes('');
    },
  });

  const pendingBrands = kycData?.data?.brands || [];
  const pendingAthletes = kycData?.data?.athletes || [];

  const allItems = [
    ...pendingBrands.map((b: any) => ({ ...b, type: 'brand' })),
    ...pendingAthletes.map((a: any) => ({ ...a, type: 'athlete' })),
  ];

  const filteredItems = allItems
    .filter((item) => {
      if (typeFilter === 'brands') return item.type === 'brand';
      if (typeFilter === 'athletes') return item.type === 'athlete';
      return true;
    })
    .filter((item) => {
      if (!searchTerm) return true; // 검색어 없으면 모두 표시
      const name = item.type === 'brand' ? (item.name || item.companyName || '') : (item.displayName || '');
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

  const handleApprove = (item: any) => {
    if (item.type === 'brand') {
      reviewBrandMutation.mutate({ brandId: item.id, status: 'APPROVED', notes: reviewNotes });
    } else {
      reviewAthleteMutation.mutate({ athleteId: item.id, status: 'APPROVED', notes: reviewNotes });
    }
  };

  const handleReject = (item: any) => {
    if (item.type === 'brand') {
      reviewBrandMutation.mutate({ brandId: item.id, status: 'REJECTED', notes: reviewNotes });
    } else {
      reviewAthleteMutation.mutate({ athleteId: item.id, status: 'REJECTED', notes: reviewNotes });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">KYC 심사</h1>
            <p className="text-slate-600 mt-1">브랜드 및 선수 본인인증 신청을 심사합니다</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                대기중: {allItems.length}건
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">대기중 브랜드</p>
                <p className="text-2xl font-bold text-slate-900">{pendingBrands.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">대기중 선수</p>
                <p className="text-2xl font-bold text-slate-900">{pendingAthletes.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">3일 이상 대기</p>
                <p className="text-2xl font-bold text-slate-900">
                  {allItems.filter((item: any) => {
                    const waitDays = Math.floor(
                      (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return waitDays >= 3;
                  }).length}
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
                placeholder="이름 또는 회사명 검색..."
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
                className="input w-40"
              >
                <option value="all">전체</option>
                <option value="brands">브랜드</option>
                <option value="athletes">선수</option>
              </select>
            </div>
          </div>
        </div>

        {/* KYC List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">대기중인 심사가 없습니다</h3>
              <p className="text-slate-600">모든 KYC 신청이 처리되었습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredItems.map((item: any) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        item.type === 'brand' ? 'bg-sky-100' : 'bg-emerald-100'
                      )}>
                        {item.type === 'brand' ? (
                          <Building2 className="w-6 h-6 text-sky-600" />
                        ) : (
                          <User className="w-6 h-6 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">
                            {item.type === 'brand' ? (item.name || item.companyName || '(이름 없음)') : (item.displayName || '(이름 없음)')}
                          </h3>
                          <span className={cn(
                            'badge',
                            item.type === 'brand'
                              ? 'bg-sky-100 text-sky-700 border-sky-200'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          )}>
                            {item.type === 'brand' ? '브랜드' : '선수'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          {item.user?.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span>{item.user.email}</span>
                            </div>
                          )}
                          {item.user?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              <span>{item.user.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>신청일: {formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                        {item.type === 'brand' && item.businessNumber && (
                          <p className="text-sm text-slate-500 mt-2">
                            사업자번호: {item.businessNumber}
                          </p>
                        )}
                        {item.type === 'athlete' && item.rank && (
                          <p className="text-sm text-slate-500 mt-2">
                            랭킹: {item.rank}위 | 핸디캡: {item.handicap || 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        상세보기
                      </button>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={reviewBrandMutation.isPending || reviewAthleteMutation.isPending}
                        className="btn btn-primary inline-flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        승인
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItem(item);
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showModal && selectedItem && (
        <KycReviewModal
          item={selectedItem}
          onClose={() => {
            setShowModal(false);
            setSelectedItem(null);
            setReviewNotes('');
          }}
          onApprove={() => handleApprove(selectedItem)}
          onReject={() => handleReject(selectedItem)}
          notes={reviewNotes}
          setNotes={setReviewNotes}
          isLoading={reviewBrandMutation.isPending || reviewAthleteMutation.isPending}
        />
      )}
    </Layout>
  );
}

interface KycReviewModalProps {
  item: any;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  notes: string;
  setNotes: (notes: string) => void;
  isLoading: boolean;
}

function KycReviewModal({ item, onClose, onApprove, onReject, notes, setNotes, isLoading }: KycReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              item.type === 'brand' ? 'bg-sky-100' : 'bg-emerald-100'
            )}>
              {item.type === 'brand' ? (
                <Building2 className="w-6 h-6 text-sky-600" />
              ) : (
                <User className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {item.type === 'brand' ? (item.name || item.companyName || '(이름 없음)') : (item.displayName || '(이름 없음)')}
              </h2>
              <p className="text-sm text-slate-600">KYC 심사 상세</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">이메일</p>
                <p className="text-sm font-medium text-slate-900">{item.user?.email || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">연락처</p>
                <p className="text-sm font-medium text-slate-900">{item.contactPhone || 'N/A'}</p>
              </div>
              {item.type === 'brand' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">사업자번호</p>
                    <p className="text-sm font-medium text-slate-900">{item.businessNumber || item.kycDocuments?.businessNumber || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">산업군</p>
                    <p className="text-sm font-medium text-slate-900">{item.category || 'N/A'}</p>
                  </div>
                </>
              )}
              {item.type === 'athlete' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">랭킹</p>
                    <p className="text-sm font-medium text-slate-900">{item.rank || 'N/A'}위</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">핸디캡</p>
                    <p className="text-sm font-medium text-slate-900">{item.handicap || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">팔로워</p>
                    <p className="text-sm font-medium text-slate-900">
                      {item.socialFollowers?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">평균 시청자</p>
                    <p className="text-sm font-medium text-slate-900">
                      {item.averageViewers?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">제출 서류</h3>
            <div className="space-y-2">
              {(item.kycDocuments?.documents || []).length > 0 ? (
                (item.kycDocuments?.documents || []).map((doc: any, index: number) => {
                  const docTypeName = doc.type === 'business_license' ? '사업자등록증' :
                    doc.type === 'id_card' ? '신분증' : doc.type;

                  // Cloudinary URL에서 확장자 추출 또는 기본값
                  const getFileExtension = (url: string) => {
                    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
                    if (match) return match[1];
                    // Cloudinary URL format: /image/upload/... 또는 /raw/upload/...
                    if (url.includes('/image/upload/')) return 'jpg';
                    if (url.includes('.pdf')) return 'pdf';
                    return 'jpg';
                  };

                  const extension = getFileExtension(doc.url);
                  const downloadFileName = `${docTypeName}.${extension}`;

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <span className="text-sm text-slate-700">{docTypeName}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-600 hover:text-emerald-700"
                        >
                          보기
                        </a>
                        <a
                          href={doc.url}
                          download={downloadFileName}
                          className="text-sm text-sky-600 hover:text-sky-700"
                          onClick={(e) => {
                            e.preventDefault();
                            // Fetch and download with proper filename
                            fetch(doc.url)
                              .then(res => res.blob())
                              .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = downloadFileName;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              });
                          }}
                        >
                          다운로드
                        </a>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-500">
                  제출된 서류가 없습니다
                </div>
              )}
            </div>
          </div>

          {/* Review Notes */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">심사 의견</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[100px]"
              placeholder="심사 의견을 입력하세요 (거부 시 필수)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button onClick={onClose} className="btn btn-secondary flex-1">
              취소
            </button>
            <button
              onClick={onReject}
              disabled={isLoading}
              className="btn btn-danger flex-1 inline-flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              거부
            </button>
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              승인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

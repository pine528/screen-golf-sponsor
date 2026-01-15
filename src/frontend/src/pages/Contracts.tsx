import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  FileText,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Upload,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  DollarSign,
  Image,
  Camera,
  X,
} from 'lucide-react';
import { cn } from '../utils';

export function Contracts() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const queryClient = useQueryClient();

  const { data: contractsData, isLoading, refetch } = useQuery({
    queryKey: ['my-contracts', page, statusFilter],
    queryFn: () => api.getMyContracts(),
  });

  const signMutation = useMutation({
    mutationFn: (contractId: string) => api.signContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-contracts'] });
      setShowModal(false);
      setSelectedContract(null);
    },
  });

  const contracts = contractsData?.data || [];

  const filteredContracts = contracts
    .filter((contract: any) => {
      if (statusFilter !== 'all' && contract.status !== statusFilter) return false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          contract.auction?.slotInstance?.slotTemplate?.name?.toLowerCase().includes(searchLower) ||
          contract.athlete?.name?.toLowerCase().includes(searchLower) ||
          contract.auction?.slotInstance?.event?.name?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });

  const statusStyles: Record<string, string> = {
    PENDING_SIGNATURE: 'bg-amber-100 text-amber-700 border-amber-200',
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ASSET_PENDING: 'bg-sky-100 text-sky-700 border-sky-200',
    ASSET_APPROVED: 'bg-violet-100 text-violet-700 border-violet-200',
    VERIFICATION_PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
    VERIFIED: 'bg-teal-100 text-teal-700 border-teal-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    PENDING_SIGNATURE: '서명 대기',
    ACTIVE: '진행중',
    ASSET_PENDING: '에셋 제출 대기',
    ASSET_APPROVED: '에셋 승인됨',
    VERIFICATION_PENDING: '노출 인증 대기',
    VERIFIED: '인증 완료',
    COMPLETED: '완료',
    CANCELLED: '취소',
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Stats
  const stats = {
    pending: contracts.filter((c: any) => c.status === 'PENDING_SIGNATURE').length,
    active: contracts.filter((c: any) => ['ACTIVE', 'ASSET_PENDING', 'ASSET_APPROVED', 'VERIFICATION_PENDING'].includes(c.status)).length,
    completed: contracts.filter((c: any) => ['VERIFIED', 'COMPLETED'].includes(c.status)).length,
    totalValue: contracts.reduce((sum: number, c: any) => sum + (c.priceFinal || 0), 0),
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">계약 관리</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">낙찰된 슬롯의 계약을 관리합니다</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">서명 대기</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">진행중</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600">완료</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.completed}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">총 계약금액</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(stats.totalValue)}</p>
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
                placeholder="슬롯명, 선수명, 이벤트 검색..."
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
                <option value="PENDING_SIGNATURE">서명 대기</option>
                <option value="ASSET_PENDING">에셋 제출 대기</option>
                <option value="ASSET_APPROVED">에셋 승인됨</option>
                <option value="VERIFICATION_PENDING">노출 인증 대기</option>
                <option value="VERIFIED">인증 완료</option>
                <option value="COMPLETED">완료</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contracts List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">계약이 없습니다</h3>
              <p className="text-slate-600">경매에서 슬롯을 낙찰받으면 계약이 생성됩니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredContracts.map((contract: any) => (
                <div
                  key={contract.id}
                  className="p-4 sm:p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedContract(contract);
                    setShowModal(true);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={cn(
                        'w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        contract.status === 'PENDING_SIGNATURE' ? 'bg-amber-100' :
                        ['VERIFIED', 'COMPLETED'].includes(contract.status) ? 'bg-emerald-100' : 'bg-sky-100'
                      )}>
                        <FileText className={cn(
                          'w-5 h-5 sm:w-6 sm:h-6',
                          contract.status === 'PENDING_SIGNATURE' ? 'text-amber-600' :
                          ['VERIFIED', 'COMPLETED'].includes(contract.status) ? 'text-emerald-600' : 'text-sky-600'
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {contract.auction?.slotInstance?.slotTemplate?.name || '슬롯'}
                          </h3>
                          <span className={cn('badge text-xs', statusStyles[contract.status] || 'bg-slate-100 text-slate-700')}>
                            {statusLabels[contract.status] || contract.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="truncate">{contract.athlete?.name || contract.brand?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="truncate">{contract.auction?.slotInstance?.event?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>{formatCurrency(contract.priceFinal || 0)}</span>
                          </div>
                        </div>
                        {contract.status === 'PENDING_SIGNATURE' && (
                          <div className="flex items-center gap-2 mt-2 text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">
                              {contract.brandSignedAt && !contract.athleteSignedAt && '선수 서명 대기중'}
                              {!contract.brandSignedAt && contract.athleteSignedAt && '브랜드 서명 대기중'}
                              {!contract.brandSignedAt && !contract.athleteSignedAt && '양쪽 서명이 필요합니다'}
                            </span>
                          </div>
                        )}
                        {contract.status === 'ASSET_PENDING' && user?.role === 'BRAND' && (
                          <div className="flex items-center gap-2 mt-2 text-sky-600">
                            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">광고 에셋을 제출해주세요</span>
                          </div>
                        )}
                        {(contract.status === 'ASSET_APPROVED' || contract.status === 'VERIFICATION_PENDING') && user?.role === 'ATHLETE' && (
                          <div className="flex items-center gap-2 mt-2 text-orange-600">
                            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">노출 인증 사진을 업로드해주세요</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      {contract.status === 'PENDING_SIGNATURE' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            signMutation.mutate(contract.id);
                          }}
                          className="btn btn-primary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
                        >
                          <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          서명
                        </button>
                      )}
                      {contract.status === 'ASSET_PENDING' && user?.role === 'BRAND' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContract(contract);
                            setShowModal(true);
                          }}
                          className="btn btn-primary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
                        >
                          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          에셋
                        </button>
                      )}
                      {(contract.status === 'ASSET_APPROVED' || contract.status === 'VERIFICATION_PENDING') && user?.role === 'ATHLETE' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContract(contract);
                            setShowModal(true);
                          }}
                          className="btn btn-primary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
                        >
                          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          인증
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContract(contract);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
                      >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        상세
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredContracts.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">총 {filteredContracts.length}개 계약</p>
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
        )}
      </div>

      {/* Contract Detail Modal */}
      {showModal && selectedContract && (
        <ContractDetailModal
          contract={selectedContract}
          userRole={user?.role || 'BRAND'}
          onClose={() => {
            setShowModal(false);
            setSelectedContract(null);
          }}
          onSign={() => signMutation.mutate(selectedContract.id)}
          onRefresh={refetch}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          isSignLoading={signMutation.isPending}
        />
      )}
    </Layout>
  );
}

interface ContractDetailModalProps {
  contract: any;
  userRole: string;
  onClose: () => void;
  onSign: () => void;
  onRefresh: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  isSignLoading: boolean;
}

function ContractDetailModal({
  contract,
  userRole,
  onClose,
  onSign,
  onRefresh,
  formatCurrency,
  formatDate,
  isSignLoading,
}: ContractDetailModalProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetType, setAssetType] = useState('IMAGE');
  const [isUploading, setIsUploading] = useState(false);

  // 선수 노출 인증용 상태
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  // 실제 파일 업로드 후 에셋 등록
  const handleAssetUpload = async () => {
    if (!assetFile) return;

    setIsUploading(true);
    try {
      // 1. 파일 업로드
      const uploadResult = await api.uploadFile(assetFile, 'asset');
      const fileUrl = uploadResult.data?.url || uploadResult.data?.fileUrl;

      if (!fileUrl) {
        throw new Error('파일 업로드 실패: URL을 받지 못했습니다');
      }

      // 2. 에셋 등록
      await api.uploadAsset(contract.id, {
        fileUrl,
        fileName: assetFile.name,
        fileType: assetType,
      });

      alert('에셋이 제출되었습니다!');
      onRefresh();
      onClose();
    } catch (error: any) {
      console.error('Asset upload error:', error);
      alert(error.response?.data?.error?.message || '에셋 제출에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 선수 노출 인증 제출
  const handleVerificationSubmit = async () => {
    if (verificationFiles.length === 0) {
      alert('최소 1장 이상의 인증 사진을 업로드해주세요.');
      return;
    }

    setIsSubmittingVerification(true);
    try {
      // 1. 파일들 업로드
      const uploadResult = await api.uploadFiles(verificationFiles, 'verification');
      const photoUrls = uploadResult.data?.urls || uploadResult.data?.map((f: any) => f.url || f.fileUrl) || [];

      if (photoUrls.length === 0) {
        throw new Error('파일 업로드 실패');
      }

      // 2. 노출 인증 제출
      await api.submitVerification(contract.id, {
        photoUrls,
        angles: ['front', 'side'], // 기본 각도
        notes: verificationNotes,
      });

      alert('노출 인증이 제출되었습니다!');
      onRefresh();
      onClose();
    } catch (error: any) {
      console.error('Verification submit error:', error);
      alert(error.response?.data?.error?.message || '노출 인증 제출에 실패했습니다.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const removeVerificationFile = (index: number) => {
    setVerificationFiles(files => files.filter((_, i) => i !== index));
  };

  const statusStyles: Record<string, string> = {
    PENDING_SIGNATURE: 'bg-amber-100 text-amber-700 border-amber-200',
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ASSET_PENDING: 'bg-sky-100 text-sky-700 border-sky-200',
    ASSET_APPROVED: 'bg-violet-100 text-violet-700 border-violet-200',
    VERIFICATION_PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
    VERIFIED: 'bg-teal-100 text-teal-700 border-teal-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    PENDING_SIGNATURE: '서명 대기',
    ACTIVE: '진행중',
    ASSET_PENDING: '에셋 제출 대기',
    ASSET_APPROVED: '에셋 승인됨',
    VERIFICATION_PENDING: '노출 인증 대기',
    VERIFIED: '인증 완료',
    COMPLETED: '완료',
    CANCELLED: '취소',
  };

  // 탭 목록 (역할에 따라 다르게)
  const tabs = [
    { id: 'details', label: '계약 정보' },
    { id: 'assets', label: '에셋 관리' },
    { id: 'verification', label: '노출 인증' },
    { id: 'timeline', label: '진행 현황' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {contract.auction?.slotInstance?.slotTemplate?.name || '계약 상세'}
              </h2>
              <p className="text-slate-600">{contract.auction?.slotInstance?.event?.name}</p>
            </div>
            <span className={cn('badge', statusStyles[contract.status] || 'bg-slate-100')}>
              {statusLabels[contract.status] || contract.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Contract Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">계약 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">계약 금액</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(contract.priceFinal || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">계약일</p>
                    <p className="font-medium text-slate-900">
                      {formatDate(contract.createdAt)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">이벤트 기간</p>
                    <p className="font-medium text-slate-900">
                      {formatDate(contract.auction?.slotInstance?.event?.dateStart)} ~{' '}
                      {formatDate(contract.auction?.slotInstance?.event?.dateEnd)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">슬롯 위치</p>
                    <p className="font-medium text-slate-900">
                      {contract.auction?.slotInstance?.slotTemplate?.bodyPart || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signature Status - 양쪽 서명 표시 */}
              {contract.status === 'PENDING_SIGNATURE' && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">서명 현황</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      'p-4 rounded-xl border-2',
                      contract.brandSignedAt ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        {contract.brandSignedAt ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600" />
                        )}
                        <span className="font-medium">브랜드 서명</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {contract.brandSignedAt ? formatDate(contract.brandSignedAt) : '대기중'}
                      </p>
                    </div>
                    <div className={cn(
                      'p-4 rounded-xl border-2',
                      contract.athleteSignedAt ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        {contract.athleteSignedAt ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600" />
                        )}
                        <span className="font-medium">선수 서명</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {contract.athleteSignedAt ? formatDate(contract.athleteSignedAt) : '대기중'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Party Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">계약 당사자</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">브랜드</p>
                      <p className="font-semibold text-slate-900">{contract.brand?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">선수</p>
                      <p className="font-semibold text-slate-900">{contract.athlete?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {contract.status === 'PENDING_SIGNATURE' && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={onSign}
                    disabled={isSignLoading}
                    className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
                  >
                    {isSignLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PenTool className="w-4 h-4" />
                    )}
                    전자서명하기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-6">
              {/* 브랜드만 에셋 업로드 가능 */}
              {contract.status === 'ASSET_PENDING' && userRole === 'BRAND' ? (
                <>
                  <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Upload className="w-5 h-5 text-sky-600" />
                      <span className="font-medium text-sky-900">에셋 제출이 필요합니다</span>
                    </div>
                    <p className="text-sm text-sky-700">광고 이미지 또는 비디오를 업로드해주세요</p>
                  </div>

                  <div>
                    <label className="label">에셋 타입</label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className="input"
                    >
                      <option value="IMAGE">이미지</option>
                      <option value="VIDEO">비디오</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">파일 업로드</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors">
                      <input
                        type="file"
                        onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                        accept={assetType === 'IMAGE' ? 'image/*' : 'video/*'}
                        className="hidden"
                        id="asset-upload"
                      />
                      <label htmlFor="asset-upload" className="cursor-pointer">
                        <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">
                          {assetFile ? assetFile.name : '클릭하여 파일을 선택하세요'}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {assetType === 'IMAGE' ? 'PNG, JPG (최대 10MB)' : 'MP4 (최대 50MB)'}
                        </p>
                      </label>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="font-medium text-amber-900 mb-2">에셋 가이드라인</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• 이미지: 최소 1920x1080 해상도</li>
                      <li>• 비디오: 최대 30초</li>
                      <li>• 부적절한 콘텐츠 금지</li>
                      <li>• 경쟁 브랜드 로고 포함 불가</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleAssetUpload}
                    disabled={!assetFile || isUploading}
                    className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        에셋 제출하기
                      </>
                    )}
                  </button>
                </>
              ) : contract.assets && contract.assets.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">제출된 에셋</h3>
                  {contract.assets.map((asset: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                      <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                        {asset.fileUrl ? (
                          <img src={asset.fileUrl} alt="Asset" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{asset.fileName || '에셋 파일'}</p>
                        <p className="text-sm text-slate-500">{asset.fileType || 'IMAGE'}</p>
                      </div>
                      <span className={cn(
                        'badge',
                        asset.status === 'APPROVED' ? 'badge-success' :
                        asset.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'badge-warning'
                      )}>
                        {asset.status === 'APPROVED' ? '승인됨' :
                         asset.status === 'REJECTED' ? '반려됨' : '검토중'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">아직 제출된 에셋이 없습니다</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'verification' && (
            <div className="space-y-6">
              {/* 선수만 노출 인증 제출 가능 */}
              {(contract.status === 'ASSET_APPROVED' || contract.status === 'VERIFICATION_PENDING') && userRole === 'ATHLETE' && !contract.verification ? (
                <>
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-900">노출 인증이 필요합니다</span>
                    </div>
                    <p className="text-sm text-orange-700">대회 중 광고 노출 사진을 업로드해주세요 (최소 1장, 권장 2-3장)</p>
                  </div>

                  <div>
                    <label className="label">인증 사진 업로드</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setVerificationFiles(prev => [...prev, ...files]);
                        }}
                        className="hidden"
                        id="verification-upload"
                      />
                      <label htmlFor="verification-upload" className="cursor-pointer">
                        <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">클릭하여 사진을 선택하세요</p>
                        <p className="text-sm text-slate-400 mt-1">PNG, JPG (최대 10MB/장)</p>
                      </label>
                    </div>

                    {verificationFiles.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {verificationFiles.map((file, index) => (
                          <div key={index} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => removeVerificationFile(index)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">메모 (선택)</label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      className="input min-h-[80px]"
                      placeholder="추가 설명이 있으면 입력해주세요"
                    />
                  </div>

                  <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
                    <h4 className="font-medium text-sky-900 mb-2">인증 가이드라인</h4>
                    <ul className="text-sm text-sky-700 space-y-1">
                      <li>• 광고가 선명하게 보이는 사진을 올려주세요</li>
                      <li>• 정면, 측면 등 다양한 각도 권장</li>
                      <li>• 대회 현장에서 촬영된 사진이어야 합니다</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleVerificationSubmit}
                    disabled={verificationFiles.length === 0 || isSubmittingVerification}
                    className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
                  >
                    {isSubmittingVerification ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        제출 중...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        노출 인증 제출하기
                      </>
                    )}
                  </button>
                </>
              ) : contract.verification ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">제출된 노출 인증</h3>
                    <span className={cn(
                      'badge',
                      contract.verification.status === 'VERIFIED' ? 'badge-success' :
                      contract.verification.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'badge-warning'
                    )}>
                      {contract.verification.status === 'VERIFIED' ? '인증 완료' :
                       contract.verification.status === 'REJECTED' ? '반려됨' : '검토중'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {contract.verification.photoUrls?.map((url: string, index: number) => (
                      <div key={index} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                        <img src={url} alt={`Verification ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  {contract.verification.rejectionReason && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">반려 사유:</span> {contract.verification.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    {contract.status === 'ASSET_PENDING' || contract.status === 'PENDING_SIGNATURE'
                      ? '에셋이 승인되면 노출 인증을 제출할 수 있습니다'
                      : '노출 인증이 제출되지 않았습니다'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">진행 현황</h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                <div className="space-y-6">
                  {[
                    { status: 'completed', title: '경매 낙찰', date: contract.createdAt },
                    {
                      status: contract.signedAt ? 'completed' :
                              contract.brandSignedAt || contract.athleteSignedAt ? 'current' : 'pending',
                      title: '계약 서명',
                      date: contract.signedAt,
                      note: contract.status === 'PENDING_SIGNATURE' && (contract.brandSignedAt || contract.athleteSignedAt)
                        ? `${contract.brandSignedAt ? '브랜드' : '선수'} 서명 완료, ${contract.brandSignedAt ? '선수' : '브랜드'} 대기중`
                        : undefined,
                    },
                    {
                      status: ['PENDING_SIGNATURE'].includes(contract.status) ? 'pending' :
                             ['ASSET_PENDING'].includes(contract.status) ? 'current' : 'completed',
                      title: '에셋 제출',
                      date: contract.assets?.[0]?.createdAt,
                    },
                    {
                      status: ['PENDING_SIGNATURE', 'ASSET_PENDING'].includes(contract.status) ? 'pending' :
                             contract.status === 'ASSET_APPROVED' ? 'completed' :
                             contract.assets?.[0]?.status === 'SUBMITTED' ? 'current' : 'pending',
                      title: '에셋 검수',
                      date: contract.assets?.[0]?.reviewedAt,
                    },
                    {
                      status: ['VERIFIED', 'COMPLETED'].includes(contract.status) ? 'completed' :
                             contract.status === 'VERIFICATION_PENDING' ? 'current' : 'pending',
                      title: '노출 인증',
                      date: contract.verification?.createdAt,
                    },
                    {
                      status: contract.status === 'COMPLETED' ? 'completed' :
                             contract.status === 'VERIFIED' ? 'current' : 'pending',
                      title: '정산 완료',
                      date: contract.settlement?.paidAt,
                    },
                  ].map((step, index) => (
                    <div key={index} className="relative flex gap-4 pl-10">
                      <div
                        className={cn(
                          'absolute left-2.5 w-3 h-3 rounded-full border-2 bg-white',
                          step.status === 'completed' ? 'border-emerald-500 bg-emerald-500' :
                          step.status === 'current' ? 'border-emerald-500' : 'border-slate-300'
                        )}
                      />
                      <div className="flex-1">
                        <p className={cn(
                          'font-medium',
                          step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'
                        )}>
                          {step.title}
                        </p>
                        {step.date && (
                          <p className="text-sm text-slate-500">{formatDate(step.date)}</p>
                        )}
                        {step.note && (
                          <p className="text-xs text-amber-600 mt-1">{step.note}</p>
                        )}
                      </div>
                      {step.status === 'completed' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-secondary w-full">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

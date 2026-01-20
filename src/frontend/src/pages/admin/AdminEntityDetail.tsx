import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Briefcase,
  CreditCard,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  ExternalLink,
  Wallet,
  TrendingUp,
  TrendingDown,
  Ban,
  CheckCircle,
  DollarSign,
  Banknote,
  ArrowUpRight,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

// Helper: format number with comma
const formatNumber = (num: string | number | null | undefined) => {
  if (num === null || num === undefined) return '0';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return n.toLocaleString('ko-KR');
};

// Helper: format date
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper: format short date
const formatShortDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR');
};

export default function AdminEntityDetail() {
  const { type, id } = useParams<{ type: 'athletes' | 'brands'; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'wallet' | 'activity'>('info');

  const isAthlete = type === 'athletes';

  // Fetch entity data
  const { data, isLoading, error } = useQuery({
    queryKey: ['adminEntity', type, id],
    queryFn: () => (isAthlete ? api.getAdminAthlete(id!) : api.getAdminBrand(id!)),
    enabled: !!id && !!type,
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: () => (isAthlete ? api.toggleAthleteActive(id!) : api.toggleBrandActive(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEntity', type, id] });
      queryClient.invalidateQueries({ queryKey: isAthlete ? ['adminAthletes'] : ['adminBrands'] });
    },
  });

  const entity = data?.data;

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
            KYC 승인됨
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
            <Clock className="w-4 h-4" />
            KYC 대기중
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle className="w-4 h-4" />
            KYC 거부됨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
            <AlertCircle className="w-4 h-4" />
            KYC 미제출
          </span>
        );
    }
  };

  const getContractStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: { label: '대기', className: 'bg-slate-100 text-slate-600' },
      SIGNED: { label: '서명됨', className: 'bg-blue-100 text-blue-700' },
      ACTIVE: { label: '진행중', className: 'bg-emerald-100 text-emerald-700' },
      COMPLETED: { label: '완료', className: 'bg-slate-100 text-slate-600' },
      CANCELLED: { label: '취소', className: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getWithdrawalStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      REQUESTED: { label: '요청', className: 'bg-amber-100 text-amber-700' },
      APPROVED: { label: '승인', className: 'bg-blue-100 text-blue-700' },
      REJECTED: { label: '거부', className: 'bg-red-100 text-red-700' },
      PAID: { label: '지급', className: 'bg-emerald-100 text-emerald-700' },
    };
    const config = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getEscrowStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      HELD: { label: 'HELD', className: 'bg-amber-100 text-amber-700' },
      RELEASED: { label: 'RELEASED', className: 'bg-emerald-100 text-emerald-700' },
      REFUNDED: { label: 'REFUNDED', className: 'bg-blue-100 text-blue-700' },
    };
    const config = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getLedgerTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; className: string }> = {
      CREDIT: { label: '입금', className: 'bg-emerald-100 text-emerald-700' },
      DEBIT: { label: '출금', className: 'bg-red-100 text-red-700' },
      HOLD: { label: '동결', className: 'bg-amber-100 text-amber-700' },
      RELEASE: { label: '해제', className: 'bg-blue-100 text-blue-700' },
      ESCROW_HOLD: { label: '에스크로', className: 'bg-purple-100 text-purple-700' },
      ESCROW_RELEASE: { label: '릴리즈', className: 'bg-emerald-100 text-emerald-700' },
      ESCROW_REFUND: { label: '환불', className: 'bg-blue-100 text-blue-700' },
      PAYOUT: { label: '정산', className: 'bg-emerald-100 text-emerald-700' },
      FEE: { label: '수수료', className: 'bg-slate-100 text-slate-600' },
    };
    const config = typeMap[type] || { label: type, className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </Layout>
    );
  }

  if (error || !entity) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {isAthlete ? '선수' : '브랜드'}를 찾을 수 없습니다
          </h2>
          <button onClick={() => navigate('/admin/entities')} className="btn btn-primary mt-4">
            목록으로 돌아가기
          </button>
        </div>
      </Layout>
    );
  }

  // Tabs
  const tabs = [
    { id: 'info', label: '기본정보' },
    { id: 'wallet', label: isAthlete ? '지갑/출금' : '지갑/에스크로' },
    { id: 'activity', label: '최근활동' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/entities')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로
        </button>

        {/* Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {isAthlete ? (
                entity.profileImageUrl ? (
                  <img
                    src={entity.profileImageUrl}
                    alt={entity.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                )
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{entity.name}</h1>
                {isAthlete && entity.realName && (
                  <p className="text-slate-500">{entity.realName}</p>
                )}
                <p className="text-slate-600 flex items-center gap-1 mt-1">
                  <Mail className="w-4 h-4" />
                  {entity.user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {getKycStatusBadge(entity.kycStatus)}
              <button
                onClick={() => toggleActiveMutation.mutate()}
                disabled={toggleActiveMutation.isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  entity.user?.isActive
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {entity.user?.isActive ? (
                  <>
                    <ToggleRight className="w-5 h-5" />
                    활성
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5" />
                    비활성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {isAthlete ? (
            <>
              {/* Athlete KPI Cards */}
              <div className="card p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-medium">계약 수</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {entity.contractStats?.total || entity._count?.contracts || 0}
                </p>
                <p className="text-xs text-slate-500">
                  진행중 {entity.contractStats?.active || 0}건
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <Wallet className="w-5 h-5" />
                  <span className="text-xs font-medium">지갑 잔액</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.wallet?.balance)}
                </p>
                <p className="text-xs text-slate-500">
                  가용: ₩{formatNumber(entity.wallet?.available)}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <Ban className="w-5 h-5" />
                  <span className="text-xs font-medium">동결 금액</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.wallet?.frozenAmount)}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-xs font-medium">출금 대기</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {entity.withdrawalStats?.approved?.count || 0}건
                </p>
                <p className="text-xs text-slate-500">
                  ₩{formatNumber(entity.withdrawalStats?.approved?.amount)}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">누적 출금</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.withdrawalStats?.paid?.amount)}
                </p>
                <p className="text-xs text-slate-500">
                  {entity.withdrawalStats?.paid?.count || 0}건 완료
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">미승인</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {entity.withdrawalStats?.requested?.count || 0}건
                </p>
                <p className="text-xs text-slate-500">
                  ₩{formatNumber(entity.withdrawalStats?.requested?.amount)}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Brand KPI Cards */}
              <div className="card p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-medium">계약 수</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {entity._count?.contracts || 0}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <Wallet className="w-5 h-5" />
                  <span className="text-xs font-medium">지갑 잔액</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.wallet?.balance)}
                </p>
                <p className="text-xs text-slate-500">
                  가용: ₩{formatNumber(entity.wallet?.available)}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-xs font-medium">HELD 합계</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.escrowStats?.held?.totalAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {entity.escrowStats?.held?.count || 0}건
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-medium">RELEASED</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.escrowStats?.released?.totalAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {entity.escrowStats?.released?.count || 0}건
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <TrendingDown className="w-5 h-5" />
                  <span className="text-xs font-medium">REFUNDED</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₩{formatNumber(entity.escrowStats?.refunded?.totalAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {entity.escrowStats?.refunded?.count || 0}건
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 text-purple-600 mb-2">
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs font-medium">입찰 성공</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {entity.bidStats?.won || 0}건
                </p>
                <p className="text-xs text-slate-500">
                  총 {entity.bidStats?.total || 0}건 중
                </p>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="card">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab 1: Basic Info */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">기본 정보</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">가입일:</span>
                      <span className="text-slate-900">{formatShortDate(entity.createdAt)}</span>
                    </div>

                    {isAthlete ? (
                      <>
                        {entity.tour && (
                          <div className="flex items-center gap-3 text-sm">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">투어:</span>
                            <span className="text-slate-900">{entity.tour}</span>
                          </div>
                        )}
                        {entity.bio && (
                          <div className="flex items-start gap-3 text-sm">
                            <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="text-slate-600">소개:</span>
                            <span className="text-slate-900 flex-1">{entity.bio}</span>
                          </div>
                        )}
                        {entity.primarySponsors && entity.primarySponsors.length > 0 && (
                          <div className="flex items-start gap-3 text-sm">
                            <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="text-slate-600">주요 스폰서:</span>
                            <span className="text-slate-900">{entity.primarySponsors.join(', ')}</span>
                          </div>
                        )}
                        {entity.blockedCategories && entity.blockedCategories.length > 0 && (
                          <div className="flex items-start gap-3 text-sm">
                            <Ban className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="text-slate-600">블록 카테고리:</span>
                            <span className="text-slate-900">{entity.blockedCategories.join(', ')}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {entity.category && (
                          <div className="flex items-center gap-3 text-sm">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">카테고리:</span>
                            <span className="text-slate-900">{entity.category}</span>
                          </div>
                        )}
                        {entity.bizNo && (
                          <div className="flex items-center gap-3 text-sm">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">사업자번호:</span>
                            <span className="text-slate-900 font-mono">{entity.bizNo}</span>
                          </div>
                        )}
                        {entity.kycDetail && (
                          <>
                            {entity.kycDetail.businessNumber && (
                              <div className="flex items-center gap-3 text-sm">
                                <ShieldCheck className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">사업자상태:</span>
                                <span className="text-slate-900">{entity.kycDetail.businessStatus || '-'}</span>
                              </div>
                            )}
                            {entity.kycDetail.verifiedAt && (
                              <div className="flex items-center gap-3 text-sm">
                                <CheckCircle className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">인증일:</span>
                                <span className="text-slate-900">{formatShortDate(entity.kycDetail.verifiedAt)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">연락처</h3>
                  <div className="space-y-3">
                    {!isAthlete && (
                      <>
                        {entity.contactName && (
                          <div className="flex items-center gap-3 text-sm">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">담당자:</span>
                            <span className="text-slate-900">{entity.contactName}</span>
                          </div>
                        )}
                        {entity.contactEmail && (
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">담당자 이메일:</span>
                            <span className="text-slate-900">{entity.contactEmail}</span>
                          </div>
                        )}
                        {entity.contactPhone && (
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">연락처:</span>
                            <span className="text-slate-900">{entity.contactPhone}</span>
                          </div>
                        )}
                        {entity.website && (
                          <div className="flex items-center gap-3 text-sm">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">웹사이트:</span>
                            <a
                              href={entity.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {entity.website}
                            </a>
                          </div>
                        )}
                        {entity.address && (
                          <div className="flex items-center gap-3 text-sm">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">주소:</span>
                            <span className="text-slate-900">{entity.address}</span>
                          </div>
                        )}
                        {entity.penaltyScore !== undefined && entity.penaltyScore > 0 && (
                          <div className="flex items-center gap-3 text-sm">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-slate-600">페널티 점수:</span>
                            <span className="text-red-600 font-medium">{entity.penaltyScore}</span>
                          </div>
                        )}
                      </>
                    )}
                    {isAthlete && (
                      <p className="text-sm text-slate-500">연락처 정보가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Wallet / Withdrawal or Escrow */}
            {activeTab === 'wallet' && (
              <div className="space-y-6">
                {/* Wallet Info */}
                {entity.wallet && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">지갑 정보</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">총 잔액</p>
                        <p className="text-lg font-semibold text-slate-900">₩{formatNumber(entity.wallet.balance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">동결 금액</p>
                        <p className="text-lg font-semibold text-amber-600">₩{formatNumber(entity.wallet.frozenAmount)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">가용 금액</p>
                        <p className="text-lg font-semibold text-emerald-600">₩{formatNumber(entity.wallet.available)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      마지막 업데이트: {formatDate(entity.wallet.updatedAt)}
                    </p>
                  </div>
                )}

                {/* Withdrawal Stats (Athlete) */}
                {isAthlete && entity.withdrawalStats && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">출금 통계</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-medium text-slate-600">상태</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">건수</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-4 py-2">{getWithdrawalStatusBadge('REQUESTED')}</td>
                            <td className="px-4 py-2 text-right">{entity.withdrawalStats.requested?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.withdrawalStats.requested?.amount)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">{getWithdrawalStatusBadge('APPROVED')}</td>
                            <td className="px-4 py-2 text-right">{entity.withdrawalStats.approved?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.withdrawalStats.approved?.amount)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">{getWithdrawalStatusBadge('PAID')}</td>
                            <td className="px-4 py-2 text-right">{entity.withdrawalStats.paid?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.withdrawalStats.paid?.amount)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">{getWithdrawalStatusBadge('REJECTED')}</td>
                            <td className="px-4 py-2 text-right">{entity.withdrawalStats.rejected?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.withdrawalStats.rejected?.amount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Escrow Stats (Brand) */}
                {!isAthlete && entity.escrowStats && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">에스크로 통계</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-medium text-slate-600">상태</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">건수</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">총액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-4 py-2">{getEscrowStatusBadge('HELD')}</td>
                            <td className="px-4 py-2 text-right">{entity.escrowStats.held?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.escrowStats.held?.totalAmount)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">{getEscrowStatusBadge('RELEASED')}</td>
                            <td className="px-4 py-2 text-right">{entity.escrowStats.released?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.escrowStats.released?.totalAmount)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">{getEscrowStatusBadge('REFUNDED')}</td>
                            <td className="px-4 py-2 text-right">{entity.escrowStats.refunded?.count || 0}건</td>
                            <td className="px-4 py-2 text-right">₩{formatNumber(entity.escrowStats.refunded?.totalAmount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Withdrawals (Athlete) */}
                {isAthlete && entity.recentWithdrawals && entity.recentWithdrawals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 출금 요청 (10건)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-medium text-slate-600">상태</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">금액</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">계좌</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">요청일</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">지급일</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entity.recentWithdrawals.map((w: any) => (
                            <tr key={w.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">{getWithdrawalStatusBadge(w.status)}</td>
                              <td className="px-4 py-2 text-right font-medium">₩{formatNumber(w.amount)}</td>
                              <td className="px-4 py-2 font-mono text-xs">{w.bankAccountMasked || '-'}</td>
                              <td className="px-4 py-2 text-slate-500">{formatShortDate(w.createdAt)}</td>
                              <td className="px-4 py-2 text-slate-500">{w.paidAt ? formatShortDate(w.paidAt) : '-'}</td>
                              <td className="px-4 py-2">
                                <Link
                                  to={`/admin/finance/withdrawals/${w.id}`}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Escrows (Brand) */}
                {!isAthlete && entity.recentEscrows && entity.recentEscrows.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 에스크로 (10건)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-medium text-slate-600">상태</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">총액</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">선수지급</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">생성일</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">릴리즈일</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entity.recentEscrows.map((e: any) => (
                            <tr key={e.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">{getEscrowStatusBadge(e.status)}</td>
                              <td className="px-4 py-2 text-right font-medium">₩{formatNumber(e.grossAmount)}</td>
                              <td className="px-4 py-2 text-right text-emerald-600">₩{formatNumber(e.athletePayout)}</td>
                              <td className="px-4 py-2 text-slate-500">{formatShortDate(e.createdAt)}</td>
                              <td className="px-4 py-2 text-slate-500">{e.releasedAt ? formatShortDate(e.releasedAt) : '-'}</td>
                              <td className="px-4 py-2">
                                <Link
                                  to={`/admin/finance/escrows/${e.id}`}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Ledger */}
                {entity.recentLedger && entity.recentLedger.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 원장 기록 (10건)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-medium text-slate-600">유형</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">금액</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">잔액</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">참조</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">일시</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entity.recentLedger.map((l: any) => {
                            const amount = parseFloat(l.amount);
                            return (
                              <tr key={l.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2">{getLedgerTypeBadge(l.type)}</td>
                                <td className={`px-4 py-2 text-right font-medium ${amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {amount >= 0 ? '+' : ''}₩{formatNumber(l.amount)}
                                </td>
                                <td className="px-4 py-2 text-right">₩{formatNumber(l.balanceAfter)}</td>
                                <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                                  {l.refType ? `${l.refType}:${l.refId?.slice(0, 8)}` : '-'}
                                </td>
                                <td className="px-4 py-2 text-slate-500">{formatDate(l.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* No wallet message */}
                {!entity.wallet && (
                  <p className="text-slate-500 text-center py-8">지갑 정보가 없습니다.</p>
                )}
              </div>
            )}

            {/* Tab 3: Activity (Existing) */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {/* Recent Contracts */}
                {entity.contracts && entity.contracts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 계약</h3>
                    <div className="space-y-2">
                      {entity.contracts.map((contract: any) => (
                        <div
                          key={contract.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {isAthlete ? contract.brand?.name : contract.athlete?.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatShortDate(contract.createdAt)}
                              </p>
                            </div>
                          </div>
                          {getContractStatusBadge(contract.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Slots (Athletes only) */}
                {isAthlete && entity.slotInstances && entity.slotInstances.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 슬롯</h3>
                    <div className="space-y-2">
                      {entity.slotInstances.map((slot: any) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {slot.slotTemplate?.name || '-'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatShortDate(slot.createdAt)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              slot.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {slot.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Campaigns (Brands only) */}
                {!isAthlete && entity.campaigns && entity.campaigns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 캠페인</h3>
                    <div className="space-y-2">
                      {entity.campaigns.map((campaign: any) => (
                        <div
                          key={campaign.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{campaign.name}</p>
                              <p className="text-xs text-slate-500">
                                {formatShortDate(campaign.createdAt)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              campaign.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No activity message */}
                {(!entity.contracts || entity.contracts.length === 0) &&
                  (!entity.slotInstances || entity.slotInstances.length === 0) &&
                  (!entity.campaigns || entity.campaigns.length === 0) && (
                    <p className="text-slate-500 text-center py-8">최근 활동이 없습니다</p>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">빠른 링크</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/admin/contracts?${isAthlete ? 'athleteId' : 'brandId'}=${id}`}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              계약 목록
              <ExternalLink className="w-3 h-3" />
            </Link>
            {isAthlete && (
              <>
                <Link
                  to={`/admin/slots?athleteId=${id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Briefcase className="w-4 h-4" />
                  슬롯 목록
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  to={`/admin/finance/withdrawals?athleteId=${id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Banknote className="w-4 h-4" />
                  출금 목록
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </>
            )}
            {!isAthlete && (
              <Link
                to={`/admin/finance/escrows?brandId=${id}`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                에스크로 목록
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            <Link
              to="/admin/kyc"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              KYC 심사
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

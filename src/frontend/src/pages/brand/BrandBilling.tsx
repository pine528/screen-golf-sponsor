/**
 * Phase 11-2A: Brand Billing Page
 * 브랜드 청구/명세서/세금계산서
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  FileText,
  Building,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Loader2,
  CheckCircle,
  XCircle,
  FileCheck,
  Clock,
  AlertCircle,
  Send,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

// 탭 타입
type TabType = 'statements' | 'profile' | 'taxInvoice';

// 세금계산서 상태
const TAX_INVOICE_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: { label: '요청됨', color: 'text-blue-600 bg-blue-50', icon: Clock },
  APPROVED: { label: '승인됨', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle },
  ISSUED: { label: '발행완료', color: 'text-green-600 bg-green-50', icon: FileCheck },
  REJECTED: { label: '거부됨', color: 'text-red-600 bg-red-50', icon: XCircle },
};

// 기간 프리셋
type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'custom';

const PERIOD_PRESETS = [
  { value: 'thisMonth', label: '이번 달' },
  { value: 'lastMonth', label: '지난 달' },
  { value: 'last3Months', label: '최근 3개월' },
  { value: 'custom', label: '직접 선택' },
] as const;

// 거래 유형 한글화
const txTypeLabels: Record<string, string> = {
  TOPUP_DEPOSIT: '충전',
  TOPUP_REFUND: '충전 환불',
  ESCROW_HOLD: '에스크로 홀드',
  ESCROW_RELEASE: '에스크로 릴리즈',
  ESCROW_REFUND: '에스크로 환불',
  PLATFORM_FEE: '플랫폼 수수료',
  DIRECT_BUY_RESERVE: '즉시구매 예약',
  DIRECT_BUY_RESERVE_RELEASE: '즉시구매 예약 해제',
  AUCTION_BID_RESERVE: '입찰 예약',
  AUCTION_BID_RESERVE_RELEASE: '입찰 예약 해제',
  ADJUSTMENT: '수동 조정',
  DEPOSIT: '입금',
  WITHDRAW: '출금',
};

// 기간 계산 헬퍼
const getPeriodDates = (preset: PeriodPreset): { from: string; to: string } => {
  const today = new Date();
  let from: Date;
  let to: Date;

  switch (preset) {
    case 'thisMonth':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
      break;
    case 'lastMonth':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'last3Months':
      from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      to = today;
      break;
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
};

export default function BrandBilling() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('statements');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 프로필 폼 상태
  const [profileForm, setProfileForm] = useState({
    businessName: '',
    businessNumber: '',
    representativeName: '',
    businessType: '',
    businessCategory: '',
    billingEmail: '',
    billingPhone: '',
    address: '',
    addressDetail: '',
  });

  // 세금계산서 페이지 상태
  const [taxInvoicePage, setTaxInvoicePage] = useState(1);

  // 기간 계산
  const { from, to } = periodPreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPeriodDates(periodPreset);

  // 청구 프로필 조회
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['billingProfile'],
    queryFn: () => api.getBillingProfile(),
  });

  // 프로필 데이터가 로드되면 폼에 반영
  useEffect(() => {
    if (profileData?.data) {
      setProfileForm({
        businessName: profileData.data.businessName || '',
        businessNumber: profileData.data.businessNumber || '',
        representativeName: profileData.data.representativeName || '',
        businessType: profileData.data.businessType || '',
        businessCategory: profileData.data.businessCategory || '',
        billingEmail: profileData.data.billingEmail || '',
        billingPhone: profileData.data.billingPhone || '',
        address: profileData.data.address || '',
        addressDetail: profileData.data.addressDetail || '',
      });
    }
  }, [profileData]);

  // 요약 조회
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['statementSummary', from, to],
    queryFn: () => api.getStatementSummary(from, to),
    enabled: !!from && !!to && activeTab === 'statements',
  });

  // 거래 내역 조회
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['statementItems', from, to, page],
    queryFn: () => api.getStatementItems(from, to, page, 20),
    enabled: !!from && !!to && activeTab === 'statements',
  });

  // 프로필 생성/수정 뮤테이션
  const profileMutation = useMutation({
    mutationFn: (data: typeof profileForm) => {
      if (profileData?.data) {
        return api.updateBillingProfile(data);
      } else {
        return api.createBillingProfile(data);
      }
    },
    onSuccess: () => {
      setSuccess('청구 정보가 저장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['billingProfile'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '저장 실패');
    },
  });

  // 내 세금계산서 요청 목록
  const { data: taxInvoicesData, isLoading: taxInvoicesLoading } = useQuery({
    queryKey: ['myTaxInvoices', taxInvoicePage],
    queryFn: () => api.getMyTaxInvoices({ page: taxInvoicePage, pageSize: 10 }),
    enabled: activeTab === 'taxInvoice',
  });

  // 세금계산서 발행 요청 뮤테이션
  const taxInvoiceMutation = useMutation({
    mutationFn: (data: { billingProfileId: string; from: string; to: string; idempotencyKey: string }) =>
      api.requestTaxInvoice(data),
    onSuccess: () => {
      setSuccess('세금계산서 발행 요청이 완료되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['myTaxInvoices'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '요청 실패');
    },
  });

  const summary = summaryData?.data;
  const items = itemsData?.data || [];
  const pagination = itemsData?.pagination;
  const profile = profileData?.data;
  const taxInvoices = taxInvoicesData?.data || [];
  const taxInvoicePagination = taxInvoicesData?.pagination;

  // 세금계산서 발행 요청
  const handleRequestTaxInvoice = () => {
    if (!profile?.id) {
      setError('먼저 청구 정보를 등록해주세요.');
      setActiveTab('profile');
      return;
    }

    const idempotencyKey = `tax-invoice-${profile.id}-${from}-${to}-${Date.now()}`;
    taxInvoiceMutation.mutate({
      billingProfileId: profile.id,
      from,
      to,
      idempotencyKey,
    });
  };

  // CSV 다운로드
  const handleDownloadCsv = async () => {
    try {
      const blob = await api.exportStatementCsv(from, to);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement_${from}_${to}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'CSV 다운로드 실패');
    }
  };

  // PDF 다운로드
  const handleDownloadPdf = async () => {
    try {
      const blob = await api.exportStatementPdf(from, to);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement_${from}_${to}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'PDF 다운로드 실패');
    }
  };

  // 프로필 저장
  const handleSaveProfile = () => {
    setError('');
    setSuccess('');

    if (!profileForm.businessName || !profileForm.businessNumber || !profileForm.representativeName ||
        !profileForm.billingEmail || !profileForm.address) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    profileMutation.mutate(profileForm);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            청구/명세서
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            거래 내역을 조회하고 명세서를 다운로드하세요.
          </p>
        </div>

        {/* 알림 메시지 */}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('statements')}
              className={cn(
                'py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === 'statements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              거래명세서
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Building className="w-4 h-4 inline mr-2" />
              청구정보
            </button>
            <button
              onClick={() => setActiveTab('taxInvoice')}
              className={cn(
                'py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === 'taxInvoice'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <FileCheck className="w-4 h-4 inline mr-2" />
              세금계산서
            </button>
          </nav>
        </div>

        {/* Statements Tab */}
        {activeTab === 'statements' && (
          <div className="space-y-6">
            {/* 기간 선택 & 다운로드 */}
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* 기간 프리셋 */}
                <div className="flex flex-wrap items-center gap-2">
                  {PERIOD_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setPeriodPreset(preset.value)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                        periodPreset === preset.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-blue-300'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* 다운로드 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadCsv}
                    className="btn btn-outline flex items-center gap-2"
                    disabled={!from || !to}
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="btn btn-outline flex items-center gap-2"
                    disabled={!from || !to}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>

              {/* 직접 선택 */}
              {periodPreset === 'custom' && (
                <div className="flex items-center gap-3 mt-4">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="input"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              {/* 선택된 기간 표시 */}
              {from && to && (
                <div className="mt-3 text-sm text-slate-500">
                  조회 기간: {from} ~ {to}
                </div>
              )}
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">총 충전</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                {summaryLoading ? (
                  <div className="h-6 bg-slate-100 animate-pulse rounded"></div>
                ) : (
                  <div className="text-xl font-bold text-slate-900">
                    {formatCurrency(summary?.totalTopup || 0)}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">에스크로 홀드</span>
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                </div>
                {summaryLoading ? (
                  <div className="h-6 bg-slate-100 animate-pulse rounded"></div>
                ) : (
                  <div className="text-xl font-bold text-slate-900">
                    {formatCurrency(summary?.totalEscrowHold || 0)}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">총 환불</span>
                  <TrendingDown className="w-4 h-4 text-orange-500" />
                </div>
                {summaryLoading ? (
                  <div className="h-6 bg-slate-100 animate-pulse rounded"></div>
                ) : (
                  <div className="text-xl font-bold text-slate-900">
                    {formatCurrency(summary?.totalRefund || 0)}
                  </div>
                )}
              </div>

              <div className="card p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-600">순 지출</span>
                  <Receipt className="w-4 h-4 text-blue-600" />
                </div>
                {summaryLoading ? (
                  <div className="h-6 bg-blue-100 animate-pulse rounded"></div>
                ) : (
                  <div className="text-xl font-bold text-blue-700">
                    {formatCurrency(summary?.netSpend || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* 거래 내역 테이블 */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                거래 내역 ({pagination?.total || 0}건)
              </h2>

              {itemsLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  로딩 중...
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  해당 기간의 거래 내역이 없습니다.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-2 font-medium text-slate-600">날짜</th>
                          <th className="text-left py-3 px-2 font-medium text-slate-600">유형</th>
                          <th className="text-right py-3 px-2 font-medium text-slate-600">금액</th>
                          <th className="text-right py-3 px-2 font-medium text-slate-600">잔액</th>
                          <th className="text-left py-3 px-2 font-medium text-slate-600 hidden sm:table-cell">설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any) => {
                          const isPositive = item.amount > 0;
                          return (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="py-3 px-2 text-slate-600">
                                {new Date(item.date).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </td>
                              <td className="py-3 px-2 text-slate-900">
                                {txTypeLabels[item.type] || item.typeKorean || item.type}
                              </td>
                              <td className={cn(
                                'py-3 px-2 text-right font-medium',
                                isPositive ? 'text-emerald-600' : 'text-red-600'
                              )}>
                                {isPositive ? '+' : ''}{formatCurrency(item.amount)}
                              </td>
                              <td className="py-3 px-2 text-right text-slate-600">
                                {formatCurrency(item.balanceAfter)}
                              </td>
                              <td className="py-3 px-2 text-slate-500 hidden sm:table-cell">
                                {item.description || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="btn btn-outline btn-sm"
                      >
                        이전
                      </button>
                      <span className="flex items-center px-3 text-sm text-slate-600">
                        {page} / {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                        disabled={page === pagination.totalPages}
                        className="btn btn-outline btn-sm"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-slate-600" />
              청구 정보
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              세금계산서 발행을 위한 사업자 정보를 입력해주세요.
            </p>

            {profileLoading ? (
              <div className="text-center py-8 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                로딩 중...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    상호명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.businessName}
                    onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                    className="input w-full"
                    placeholder="(주)예시회사"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    사업자등록번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.businessNumber}
                    onChange={(e) => setProfileForm({ ...profileForm, businessNumber: e.target.value })}
                    className="input w-full"
                    placeholder="123-45-67890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    대표자명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.representativeName}
                    onChange={(e) => setProfileForm({ ...profileForm, representativeName: e.target.value })}
                    className="input w-full"
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    업태
                  </label>
                  <input
                    type="text"
                    value={profileForm.businessType}
                    onChange={(e) => setProfileForm({ ...profileForm, businessType: e.target.value })}
                    className="input w-full"
                    placeholder="서비스업"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    업종
                  </label>
                  <input
                    type="text"
                    value={profileForm.businessCategory}
                    onChange={(e) => setProfileForm({ ...profileForm, businessCategory: e.target.value })}
                    className="input w-full"
                    placeholder="광고업"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    청구 이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={profileForm.billingEmail}
                    onChange={(e) => setProfileForm({ ...profileForm, billingEmail: e.target.value })}
                    className="input w-full"
                    placeholder="billing@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    청구 연락처
                  </label>
                  <input
                    type="tel"
                    value={profileForm.billingPhone}
                    onChange={(e) => setProfileForm({ ...profileForm, billingPhone: e.target.value })}
                    className="input w-full"
                    placeholder="02-1234-5678"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    주소 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="input w-full"
                    placeholder="서울특별시 강남구 테헤란로 123"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    상세 주소
                  </label>
                  <input
                    type="text"
                    value={profileForm.addressDetail}
                    onChange={(e) => setProfileForm({ ...profileForm, addressDetail: e.target.value })}
                    className="input w-full"
                    placeholder="○○빌딩 5층"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileMutation.isPending}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {profileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {profile ? '수정' : '저장'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tax Invoice Tab */}
        {activeTab === 'taxInvoice' && (
          <div className="space-y-6">
            {/* 발행 요청 카드 */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                세금계산서 발행 요청
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                선택한 기간의 거래 내역에 대한 세금계산서 발행을 요청합니다.
              </p>

              {/* 기간 선택 */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setPeriodPreset(preset.value)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      periodPreset === preset.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {periodPreset === 'custom' && (
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="input"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              {from && to && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <div className="text-sm text-slate-600 mb-2">
                    요청 기간: <span className="font-medium">{from} ~ {to}</span>
                  </div>
                  {summary && (
                    <div className="text-sm text-slate-600">
                      예상 금액: <span className="font-medium text-blue-600">{formatCurrency(Math.abs(summary.netSpend || 0))}</span>
                      <span className="text-xs text-slate-400 ml-2">(VAT 포함)</span>
                    </div>
                  )}
                </div>
              )}

              {!profile && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>세금계산서 발행을 위해 먼저 <button onClick={() => setActiveTab('profile')} className="underline font-medium">청구 정보</button>를 등록해주세요.</span>
                </div>
              )}

              <button
                onClick={handleRequestTaxInvoice}
                disabled={!from || !to || !profile || taxInvoiceMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                {taxInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    요청 중...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    발행 요청
                  </>
                )}
              </button>
            </div>

            {/* 내 요청 목록 */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                내 요청 내역 ({taxInvoicePagination?.total || 0}건)
              </h2>

              {taxInvoicesLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  로딩 중...
                </div>
              ) : taxInvoices.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  세금계산서 발행 요청 내역이 없습니다.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-2 font-medium text-slate-600">요청일</th>
                          <th className="text-left py-3 px-2 font-medium text-slate-600">기간</th>
                          <th className="text-right py-3 px-2 font-medium text-slate-600">금액</th>
                          <th className="text-center py-3 px-2 font-medium text-slate-600">상태</th>
                          <th className="text-left py-3 px-2 font-medium text-slate-600 hidden sm:table-cell">계산서 번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxInvoices.map((invoice: any) => {
                          const statusInfo = TAX_INVOICE_STATUS[invoice.status] || TAX_INVOICE_STATUS.REQUESTED;
                          const StatusIcon = statusInfo.icon;
                          return (
                            <tr key={invoice.id} className="border-b border-slate-100">
                              <td className="py-3 px-2 text-slate-600">
                                {new Date(invoice.requestedAt).toLocaleDateString('ko-KR')}
                              </td>
                              <td className="py-3 px-2 text-slate-600">
                                {new Date(invoice.fromDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                {' ~ '}
                                {new Date(invoice.toDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-3 px-2 text-right font-medium text-slate-900">
                                {formatCurrency(Number(invoice.totalAmount))}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusInfo.color)}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-slate-500 hidden sm:table-cell">
                                {invoice.invoiceNumber || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  {taxInvoicePagination && taxInvoicePagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        onClick={() => setTaxInvoicePage(Math.max(1, taxInvoicePage - 1))}
                        disabled={taxInvoicePage === 1}
                        className="btn btn-outline btn-sm"
                      >
                        이전
                      </button>
                      <span className="flex items-center px-3 text-sm text-slate-600">
                        {taxInvoicePage} / {taxInvoicePagination.totalPages}
                      </span>
                      <button
                        onClick={() => setTaxInvoicePage(Math.min(taxInvoicePagination.totalPages, taxInvoicePage + 1))}
                        disabled={taxInvoicePage === taxInvoicePagination.totalPages}
                        className="btn btn-outline btn-sm"
                      >
                        다음
                      </button>
                    </div>
                  )}

                  {/* 거부된 요청 상세 */}
                  {taxInvoices.some((inv: any) => inv.status === 'REJECTED' && inv.rejectionReason) && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-700 mb-2">거부된 요청 사유</p>
                      {taxInvoices
                        .filter((inv: any) => inv.status === 'REJECTED' && inv.rejectionReason)
                        .map((inv: any) => (
                          <div key={inv.id} className="text-sm text-red-600">
                            <span className="font-medium">{new Date(inv.requestedAt).toLocaleDateString('ko-KR')}</span>: {inv.rejectionReason}
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 안내 사항 */}
        <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg">
          <p className="font-medium text-slate-700 mb-1">안내사항</p>
          <ul className="list-disc list-inside space-y-1">
            <li>거래 명세서는 CSV 또는 PDF로 다운로드할 수 있습니다.</li>
            <li>청구 정보는 세금계산서 발행에 사용됩니다.</li>
            <li>세금계산서 발행 요청 후 관리자 승인을 거쳐 발행됩니다.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

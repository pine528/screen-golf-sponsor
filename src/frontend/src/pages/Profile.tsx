import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  User,
  Building2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Save,
  Key,
  Bell,
  CreditCard,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '../utils';

export function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isBrand = user?.role === 'BRAND';

  const { data: profileData, isLoading } = useQuery({
    queryKey: [isBrand ? 'my-brand' : 'my-athlete'],
    queryFn: () => isBrand ? api.getMyBrand() : api.getMyAthlete(),
  });

  const profile = profileData?.data || {};

  // Brand form state
  const [brandForm, setBrandForm] = useState({
    companyName: '',
    businessNumber: '',
    industry: '',
    website: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });

  // Athlete form state
  const [athleteForm, setAthleteForm] = useState({
    displayName: '',
    realName: '',
    bio: '',
    socialMedia: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailBid: true,
    emailContract: true,
    emailSettlement: true,
    pushEnabled: true,
  });

  useEffect(() => {
    if (profile) {
      if (isBrand) {
        setBrandForm({
          companyName: profile.companyName || '',
          businessNumber: profile.businessNumber || '',
          industry: profile.industry || '',
          website: profile.website || '',
          description: profile.description || '',
          contactName: profile.contactName || '',
          contactEmail: profile.contactEmail || '',
          contactPhone: profile.contactPhone || '',
          address: profile.address || '',
        });
      } else {
        setAthleteForm({
          displayName: profile.displayName || '',
          realName: profile.realName || '',
          bio: profile.bio || '',
          socialMedia: profile.socialMedia || '',
          bankName: profile.bankName || '',
          bankAccount: profile.bankAccount || '',
          bankHolder: profile.bankHolder || '',
        });
      }
    }
  }, [profile, isBrand]);

  const updateBrandMutation = useMutation({
    mutationFn: (data: any) => api.updateMyBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-brand'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const updateAthleteMutation = useMutation({
    mutationFn: (data: any) => api.updateMyAthlete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-athlete'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.error?.message || '비밀번호 변경에 실패했습니다.');
    },
  });

  const handlePasswordChange = async () => {
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  // KYC submission state
  const [kycBusinessLicenseFile, setKycBusinessLicenseFile] = useState<File | null>(null);
  const [kycIdCardFile, setKycIdCardFile] = useState<File | null>(null);
  const [kycBusinessNumber, setKycBusinessNumber] = useState('');
  const [kycUploading, setKycUploading] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycVerificationResult, setKycVerificationResult] = useState<any>(null);

  // 사업자등록번호 형식 검증
  const validateBusinessNumber = (number: string): boolean => {
    const cleaned = number.replace(/-/g, '');
    if (!/^\d{10}$/.test(cleaned)) return false;

    // 체크섬 검증
    const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * weights[i];
    }
    sum += Math.floor((parseInt(cleaned[8]) * 5) / 10);
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(cleaned[9]);
  };

  const handleKycSubmit = async () => {
    if (isBrand) {
      if (!kycBusinessLicenseFile) {
        setKycError('사업자등록증을 업로드해주세요.');
        return;
      }
      if (!kycIdCardFile) {
        setKycError('대표자 신분증을 업로드해주세요.');
        return;
      }
      if (!kycBusinessNumber) {
        setKycError('사업자등록번호를 입력해주세요.');
        return;
      }
      if (!validateBusinessNumber(kycBusinessNumber)) {
        setKycError('유효하지 않은 사업자등록번호입니다. 10자리 숫자를 확인해주세요.');
        return;
      }
    } else {
      if (!kycBusinessLicenseFile || !kycIdCardFile) {
        setKycError('모든 서류를 업로드해주세요.');
        return;
      }
    }

    setKycUploading(true);
    setKycError(null);
    setKycVerificationResult(null);

    try {
      // Upload files separately
      const filesToUpload = [kycBusinessLicenseFile!, kycIdCardFile!];
      const uploadResult = await api.uploadFiles(filesToUpload, 'kyc');
      const documents = [
        { type: 'business_license', url: uploadResult.data.files[0].fileUrl },
        { type: 'id_card', url: uploadResult.data.files[1].fileUrl },
      ];

      // Submit KYC
      let result;
      if (isBrand) {
        result = await api.submitKyc({ documents, businessNumber: kycBusinessNumber });
      } else {
        result = await api.submitAthleteKyc({ documents });
      }

      // Check if auto-approved
      if (result.data?.kycStatus === 'APPROVED') {
        setKycVerificationResult({
          autoApproved: true,
          message: '사업자등록번호가 확인되어 자동 승인되었습니다!',
        });
      }

      queryClient.invalidateQueries({ queryKey: [isBrand ? 'my-brand' : 'my-athlete'] });
      setKycBusinessLicenseFile(null);
      setKycIdCardFile(null);
      setKycBusinessNumber('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      setKycError(error.response?.data?.error?.message || 'KYC 제출에 실패했습니다.');
    } finally {
      setKycUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isBrand) {
        await updateBrandMutation.mutateAsync(brandForm);
      } else {
        await updateAthleteMutation.mutateAsync(athleteForm);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const kycStatus = profile.kycStatus || 'NOT_SUBMITTED';
  const kycStatusStyles: Record<string, { bg: string; text: string; label: string }> = {
    NOT_SUBMITTED: { bg: 'bg-red-100', text: 'text-red-700', label: '미제출' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: '심사 대기' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '인증 완료' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: '반려됨' },
  };

  const tabs = [
    { id: 'profile', label: '프로필', icon: User },
    { id: 'security', label: '보안', icon: Key },
    { id: 'notifications', label: '알림', icon: Bell },
    ...(isBrand ? [] : [{ id: 'payment', label: '정산 정보', icon: CreditCard }]),
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">프로필</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">계정 정보를 관리합니다</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary inline-flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-emerald-700">프로필이 저장되었습니다</span>
          </div>
        )}

        {/* KYC Status Banner */}
        {kycStatus !== 'APPROVED' && (
          <div className={cn(
            'p-4 sm:p-6 rounded-lg sm:rounded-xl border',
            kycStatus === 'PENDING' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          )}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className={cn(
                'w-5 h-5 flex-shrink-0 mt-0.5',
                kycStatus === 'PENDING' ? 'text-amber-600' : 'text-red-600'
              )} />
              <div className="flex-1">
                <p className={cn(
                  'font-medium text-sm sm:text-base',
                  kycStatus === 'PENDING' ? 'text-amber-900' : 'text-red-900'
                )}>
                  {kycStatus === 'PENDING' ? 'KYC 인증 심사 중입니다' : 'KYC 인증이 필요합니다'}
                </p>
                <p className={cn(
                  'text-xs sm:text-sm',
                  kycStatus === 'PENDING' ? 'text-amber-700' : 'text-red-700'
                )}>
                  {kycStatus === 'PENDING'
                    ? '심사가 완료되면 알림을 보내드립니다'
                    : '아래에서 필요한 서류를 업로드해주세요'}
                </p>
              </div>
            </div>

            {/* KYC Document Upload - shown when NOT_SUBMITTED or REJECTED */}
            {(kycStatus === 'NOT_SUBMITTED' || kycStatus === 'REJECTED') && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <h4 className="font-medium text-slate-900 text-sm mb-3">서류 제출</h4>
                {kycError && (
                  <div className="mb-3 p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {kycError}
                  </div>
                )}
                {kycVerificationResult?.autoApproved && (
                  <div className="mb-3 p-3 bg-emerald-100 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {kycVerificationResult.message}
                  </div>
                )}
                <div className="space-y-3">
                  {/* 브랜드인 경우 사업자등록번호 입력 */}
                  {isBrand && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-2">
                        사업자등록번호 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={kycBusinessNumber}
                        onChange={(e) => setKycBusinessNumber(e.target.value)}
                        placeholder="000-00-00000"
                        className="input text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        국세청에서 자동으로 확인됩니다. 유효한 사업자는 즉시 승인됩니다.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-2">
                        {isBrand ? '사업자등록증' : '신분증'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycBusinessLicenseFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                      {kycBusinessLicenseFile && (
                        <div className="mt-2 text-xs text-emerald-600">
                          ✓ {kycBusinessLicenseFile.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-2">
                        {isBrand ? '대표자 신분증' : '선수등록증'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycIdCardFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                      {kycIdCardFile && (
                        <div className="mt-2 text-xs text-emerald-600">
                          ✓ {kycIdCardFile.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleKycSubmit}
                    disabled={kycUploading || !kycBusinessLicenseFile || !kycIdCardFile || (isBrand && !kycBusinessNumber)}
                    className="btn btn-primary text-sm w-full sm:w-auto"
                  >
                    {kycUploading ? '제출 중...' : '서류 제출하기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Profile Card - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:block card p-6 mb-6">
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto">
                    {isBrand ? (
                      <Building2 className="w-12 h-12 text-emerald-600" />
                    ) : (
                      <User className="w-12 h-12 text-emerald-600" />
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 transition-colors">
                    <Camera className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
                <h3 className="font-semibold text-slate-900 mt-4">
                  {isBrand ? brandForm.companyName : athleteForm.displayName}
                </h3>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <div className="mt-3">
                  <span className={cn(
                    'badge',
                    kycStatusStyles[kycStatus].bg,
                    kycStatusStyles[kycStatus].text
                  )}>
                    <Shield className="w-3 h-3 mr-1" />
                    {kycStatusStyles[kycStatus].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation - Horizontal scrollable on mobile */}
            <div className="card p-2">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-2 px-2 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg lg:rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 lg:w-full',
                        activeTab === tab.id
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Icon className={cn(
                        'w-4 h-4 lg:w-5 lg:h-5',
                        activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'
                      )} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="card p-4 sm:p-6">
              {activeTab === 'profile' && (
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                    {isBrand ? '브랜드 정보' : '선수 정보'}
                  </h2>

                  {isBrand ? (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="label text-xs sm:text-sm">회사명</label>
                          <input
                            type="text"
                            value={brandForm.companyName}
                            onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
                            className="input text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <label className="label text-xs sm:text-sm">사업자번호</label>
                          <input
                            type="text"
                            value={brandForm.businessNumber}
                            onChange={(e) => setBrandForm({ ...brandForm, businessNumber: e.target.value })}
                            className="input text-sm sm:text-base"
                            placeholder="000-00-00000"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="label text-xs sm:text-sm">산업군</label>
                          <select
                            value={brandForm.industry}
                            onChange={(e) => setBrandForm({ ...brandForm, industry: e.target.value })}
                            className="input text-sm sm:text-base"
                          >
                            <option value="">선택하세요</option>
                            <option value="SPORTS">스포츠용품</option>
                            <option value="APPAREL">의류/패션</option>
                            <option value="FOOD">식음료</option>
                            <option value="TECH">IT/테크</option>
                            <option value="FINANCE">금융</option>
                            <option value="OTHER">기타</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs sm:text-sm">웹사이트</label>
                          <input
                            type="url"
                            value={brandForm.website}
                            onChange={(e) => setBrandForm({ ...brandForm, website: e.target.value })}
                            className="input text-sm sm:text-base"
                            placeholder="https://"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs sm:text-sm">회사 소개</label>
                        <textarea
                          value={brandForm.description}
                          onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                          className="input min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
                          placeholder="회사에 대한 간단한 소개를 입력하세요"
                        />
                      </div>
                      <div className="pt-3 sm:pt-4 border-t border-slate-200">
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4">담당자 정보</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div>
                            <label className="label text-xs sm:text-sm">담당자명</label>
                            <input
                              type="text"
                              value={brandForm.contactName}
                              onChange={(e) => setBrandForm({ ...brandForm, contactName: e.target.value })}
                              className="input text-sm sm:text-base"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">이메일</label>
                            <input
                              type="email"
                              value={brandForm.contactEmail}
                              onChange={(e) => setBrandForm({ ...brandForm, contactEmail: e.target.value })}
                              className="input text-sm sm:text-base"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">연락처</label>
                            <input
                              type="tel"
                              value={brandForm.contactPhone}
                              onChange={(e) => setBrandForm({ ...brandForm, contactPhone: e.target.value })}
                              className="input text-sm sm:text-base"
                              placeholder="010-0000-0000"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs sm:text-sm">주소</label>
                        <input
                          type="text"
                          value={brandForm.address}
                          onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
                          className="input text-sm sm:text-base"
                          placeholder="회사 주소를 입력하세요"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="label text-xs sm:text-sm">활동명</label>
                          <input
                            type="text"
                            value={athleteForm.displayName}
                            onChange={(e) => setAthleteForm({ ...athleteForm, displayName: e.target.value })}
                            className="input text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <label className="label text-xs sm:text-sm">실명</label>
                          <input
                            type="text"
                            value={athleteForm.realName}
                            onChange={(e) => setAthleteForm({ ...athleteForm, realName: e.target.value })}
                            className="input text-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs sm:text-sm">자기소개</label>
                        <textarea
                          value={athleteForm.bio}
                          onChange={(e) => setAthleteForm({ ...athleteForm, bio: e.target.value })}
                          className="input min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
                          placeholder="선수 소개를 입력하세요"
                        />
                      </div>
                      <div>
                        <label className="label text-xs sm:text-sm">SNS 계정</label>
                        <input
                          type="text"
                          value={athleteForm.socialMedia}
                          onChange={(e) => setAthleteForm({ ...athleteForm, socialMedia: e.target.value })}
                          className="input text-sm sm:text-base"
                          placeholder="인스타그램, 유튜브 등"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">보안 설정</h2>

                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="label text-xs sm:text-sm">이메일</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="input bg-slate-50 text-sm sm:text-base"
                      />
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-1">이메일 변경은 고객센터에 문의해주세요</p>
                    </div>

                    <div className="pt-3 sm:pt-4 border-t border-slate-200">
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4">비밀번호 변경</h3>
                      {passwordError && (
                        <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="mb-3 p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          비밀번호가 성공적으로 변경되었습니다.
                        </div>
                      )}
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <label className="label text-xs sm:text-sm">현재 비밀번호</label>
                          <input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            className="input text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <label className="label text-xs sm:text-sm">새 비밀번호</label>
                          <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className="input text-sm sm:text-base"
                            placeholder="8자 이상"
                          />
                        </div>
                        <div>
                          <label className="label text-xs sm:text-sm">새 비밀번호 확인</label>
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            className="input text-sm sm:text-base"
                          />
                        </div>
                        <button
                          onClick={handlePasswordChange}
                          disabled={changePasswordMutation.isPending}
                          className="btn btn-secondary text-sm sm:text-base"
                        >
                          {changePasswordMutation.isPending ? '변경 중...' : '비밀번호 변경'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 sm:pt-4 border-t border-slate-200">
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4">2단계 인증</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                        <div>
                          <p className="font-medium text-slate-900 text-sm sm:text-base">2단계 인증 활성화</p>
                          <p className="text-xs sm:text-sm text-slate-500">로그인 시 추가 인증을 요구합니다</p>
                        </div>
                        <button className="btn btn-secondary text-sm sm:text-base w-full sm:w-auto">설정하기</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">알림 설정</h2>

                  <div className="space-y-2 sm:space-y-4">
                    {[
                      { key: 'emailBid', label: '입찰 알림', desc: '경매 입찰 관련 알림' },
                      { key: 'emailContract', label: '계약 알림', desc: '계약 진행 상황 알림' },
                      { key: 'emailSettlement', label: '정산 알림', desc: '정산 완료 알림' },
                      { key: 'pushEnabled', label: '푸시 알림', desc: '앱 푸시 알림 수신' },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl"
                      >
                        <div>
                          <p className="font-medium text-slate-900 text-sm sm:text-base">{item.label}</p>
                          <p className="text-xs sm:text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <button
                          onClick={() =>
                            setNotifications({
                              ...notifications,
                              [item.key]: !notifications[item.key as keyof typeof notifications],
                            })
                          }
                          className={cn(
                            'p-1 rounded-full transition-colors flex-shrink-0',
                            notifications[item.key as keyof typeof notifications]
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          )}
                        >
                          {notifications[item.key as keyof typeof notifications] ? (
                            <ToggleRight className="w-8 h-8 sm:w-10 sm:h-10" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 sm:w-10 sm:h-10" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'payment' && !isBrand && (
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">정산 정보</h2>

                  <div className="p-3 sm:p-4 bg-sky-50 rounded-lg sm:rounded-xl border border-sky-200 mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 mb-1 sm:mb-2">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
                      <span className="font-medium text-sky-900 text-sm sm:text-base">정산 계좌 안내</span>
                    </div>
                    <p className="text-xs sm:text-sm text-sky-700">
                      계약 완료 후 D+7 영업일 이내에 등록된 계좌로 정산금이 입금됩니다
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="label text-xs sm:text-sm">은행</label>
                      <select
                        value={athleteForm.bankName}
                        onChange={(e) => setAthleteForm({ ...athleteForm, bankName: e.target.value })}
                        className="input text-sm sm:text-base"
                      >
                        <option value="">선택하세요</option>
                        <option value="KB">국민은행</option>
                        <option value="SHINHAN">신한은행</option>
                        <option value="WOORI">우리은행</option>
                        <option value="HANA">하나은행</option>
                        <option value="NH">농협은행</option>
                        <option value="IBK">기업은행</option>
                        <option value="KAKAO">카카오뱅크</option>
                        <option value="TOSS">토스뱅크</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs sm:text-sm">계좌번호</label>
                      <input
                        type="text"
                        value={athleteForm.bankAccount}
                        onChange={(e) => setAthleteForm({ ...athleteForm, bankAccount: e.target.value })}
                        className="input text-sm sm:text-base"
                        placeholder="- 없이 숫자만 입력"
                      />
                    </div>
                    <div>
                      <label className="label text-xs sm:text-sm">예금주</label>
                      <input
                        type="text"
                        value={athleteForm.bankHolder}
                        onChange={(e) => setAthleteForm({ ...athleteForm, bankHolder: e.target.value })}
                        className="input text-sm sm:text-base"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

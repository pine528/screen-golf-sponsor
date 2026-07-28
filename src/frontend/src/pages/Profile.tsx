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
  const isAgency = user?.role === 'AGENCY';

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

  // Athlete form state (SPONPIK docx 4 권장 데이터 + 기존 필드)
  const [athleteForm, setAthleteForm] = useState({
    displayName: '',
    realName: '',
    bio: '',
    socialMedia: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    // 구조화 필드 (docx 4)
    height: '' as number | '',
    region: '',
    debutYear: '' as number | '',
    affiliation: '',
    education: '',
    awards: '',
    career: '',
    sportType: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailBid: true,
    emailContract: true,
    emailSettlement: true,
    pushEnabled: true,
  });

  useEffect(() => {
    console.log('[Profile] useEffect triggered, profile:', profile, 'isBrand:', isBrand);
    if (profile && Object.keys(profile).length > 0) {
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
        // bankAccount는 JSON 객체: { bankName, accountNumber, accountHolder }
        const bankInfo = profile.bankAccount || {};
        console.log('[Profile] Setting athlete form from profile:', {
          name: profile.name,
          realName: profile.realName,
          bio: profile.bio,
          socialLinks: profile.socialLinks,
          bankAccount: profile.bankAccount,
          bankInfo,
        });
        setAthleteForm({
          displayName: profile.name || profile.displayName || '',
          realName: profile.realName || '',
          bio: profile.bio || '',
          socialMedia: typeof profile.socialLinks === 'object' ? (profile.socialLinks?.instagram || '') : (profile.socialMedia || ''),
          bankName: bankInfo.bankName || '',
          bankAccount: bankInfo.accountNumber || '',
          bankHolder: bankInfo.accountHolder || '',
          // 구조화 필드 (docx 4)
          height: profile.height ?? '',
          region: profile.region || '',
          debutYear: profile.debutYear ?? '',
          affiliation: profile.affiliation || '',
          education: profile.education || '',
          awards: profile.awards || '',
          career: profile.career || '',
          sportType: profile.sportType || '',
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
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || '프로필 업데이트에 실패했습니다.';
      alert(message);
    },
  });

  const updateAthleteMutation = useMutation({
    mutationFn: (data: any) => api.updateMyAthlete(data),
    onSuccess: (response) => {
      console.log('[Profile] Athlete update success:', response);
      queryClient.invalidateQueries({ queryKey: ['my-athlete'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      console.error('[Profile] Athlete update error:', error);
      const message = error.response?.data?.error?.message || error.message || '프로필 업데이트에 실패했습니다.';
      alert(`저장 실패: ${message}`);
    },
  });

  // 프로필 사진 업로드 (선수)
  const [uploadingImage, setUploadingImage] = useState(false);
  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1) /upload/profile 로 파일 업로드 → URL 회수
      const uploadResp = await api.uploadFile(file, 'profile');
      const url = uploadResp?.data?.fileUrl;
      if (!url) throw new Error('업로드 응답에 URL이 없습니다');
      // 2) profileImageUrl 갱신
      const updateFn = isBrand ? api.updateMyBrand : api.updateMyAthlete;
      await updateFn({ profileImageUrl: url } as any);
      return url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [isBrand ? 'my-brand' : 'my-athlete'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (e: any) => {
      alert(e?.response?.data?.error?.message || e?.message || '이미지 업로드에 실패했습니다');
    },
    onSettled: () => setUploadingImage(false),
  });

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 파일 검증 (5MB 이하, image/* 만)
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다 (JPG/PNG/WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하로 업로드해주세요');
      return;
    }
    setUploadingImage(true);
    uploadProfileImageMutation.mutate(file);
    // 같은 파일 재선택 가능하게 input value 리셋
    e.target.value = '';
  };

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
    } else if (isAgency) {
      // 에이전시는 신분증만 필요
      if (!kycBusinessLicenseFile) {
        setKycError('신분증을 업로드해주세요.');
        return;
      }
    } else {
      // 선수는 신분증 + 선수등록증 필요
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
      let documents;
      if (isAgency) {
        // 에이전시는 신분증만 업로드
        const uploadResult = await api.uploadFiles([kycBusinessLicenseFile!], 'kyc');
        documents = [
          { type: 'id_card', url: uploadResult.data.files[0].fileUrl },
        ];
      } else {
        const filesToUpload = [kycBusinessLicenseFile!, kycIdCardFile!];
        const uploadResult = await api.uploadFiles(filesToUpload, 'kyc');
        documents = [
          { type: 'business_license', url: uploadResult.data.files[0].fileUrl },
          { type: 'id_card', url: uploadResult.data.files[1].fileUrl },
        ];
      }

      // Submit KYC
      let result;
      if (isBrand) {
        result = await api.submitKyc({ documents, businessNumber: kycBusinessNumber });
      } else if (isAgency) {
        result = await api.submitAgencyKyc({ documents });
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
        console.log('[Profile] Saving brand form:', brandForm);
        const result = await updateBrandMutation.mutateAsync(brandForm);
        console.log('[Profile] Brand save result:', result);
      } else {
        console.log('[Profile] Saving athlete form:', athleteForm);
        console.log('[Profile] Current profile:', profile);
        const result = await updateAthleteMutation.mutateAsync(athleteForm);
        console.log('[Profile] Athlete save result:', result);
      }
    } catch (error: any) {
      console.error('[Profile] Save error:', error);
      console.error('[Profile] Error response:', error.response?.data);
      // mutation의 onError에서 이미 alert을 표시하므로 여기서는 중복 alert 생략
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
                  {isAgency ? (
                    /* 에이전시는 신분증만 필요 */
                    <div>
                      <label className="block text-xs text-slate-600 mb-2">
                        신분증 <span className="text-red-500">*</span>
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
                      <p className="mt-2 text-xs text-slate-500">
                        에이전시 담당자 신분증만 제출해주세요.
                      </p>
                    </div>
                  ) : (
                    /* 브랜드/선수는 2개 서류 필요 */
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
                  )}
                  <button
                    onClick={handleKycSubmit}
                    disabled={kycUploading || !kycBusinessLicenseFile || (!isAgency && !kycIdCardFile) || (isBrand && !kycBusinessNumber)}
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
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full overflow-hidden flex items-center justify-center mx-auto">
                    {profile?.profileImageUrl ? (
                      <img src={profile.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
                    ) : isBrand ? (
                      <Building2 className="w-12 h-12 text-emerald-600" />
                    ) : (
                      <User className="w-12 h-12 text-emerald-600" />
                    )}
                  </div>
                  {/* SPONPIK — 프로필 사진 업로드 (5MB 이하 JPG/PNG/WebP) */}
                  <label
                    className={`absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-slate-200 transition-colors ${uploadingImage ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}
                    title="프로필 사진 변경 (JPG/PNG/WebP, 5MB 이하)"
                  >
                    {uploadingImage ? (
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-slate-600" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfileImageChange}
                      disabled={uploadingImage}
                    />
                  </label>
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

                      {/* SPONPIK docx 4 권장 데이터 — 구조화 필드 */}
                      <div className="pt-3 sm:pt-4 border-t border-slate-200">
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4">선수 상세 정보 (선택)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label className="label text-xs sm:text-sm">신장 (cm)</label>
                            <input
                              type="number"
                              min={100}
                              max={250}
                              value={athleteForm.height as any}
                              onChange={(e) => setAthleteForm({ ...athleteForm, height: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="input text-sm sm:text-base"
                              placeholder="예: 170"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">데뷔 연도</label>
                            <input
                              type="number"
                              min={1980}
                              max={2030}
                              value={athleteForm.debutYear as any}
                              onChange={(e) => setAthleteForm({ ...athleteForm, debutYear: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="input text-sm sm:text-base"
                              placeholder="예: 2018"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">거주 지역</label>
                            <input
                              type="text"
                              value={athleteForm.region}
                              onChange={(e) => setAthleteForm({ ...athleteForm, region: e.target.value })}
                              className="input text-sm sm:text-base"
                              placeholder="예: 경기도 성남시"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">소속</label>
                            <input
                              type="text"
                              value={athleteForm.affiliation}
                              onChange={(e) => setAthleteForm({ ...athleteForm, affiliation: e.target.value })}
                              className="input text-sm sm:text-base"
                              placeholder="예: SBSGOLF, 르꼬끄 골프"
                            />
                          </div>
                          <div>
                            <label className="label text-xs sm:text-sm">종목</label>
                            <select
                              value={athleteForm.sportType}
                              onChange={(e) => setAthleteForm({ ...athleteForm, sportType: e.target.value })}
                              className="input text-sm sm:text-base"
                            >
                              <option value="">선택</option>
                              <option value="GOLF">🏌️ 골프</option>
                              <option value="SCREEN_GOLF">⛳ 스크린골프</option>
                            </select>
                          </div>
                          {/* 선수 프로필 구조화 — 학력/수상/경력 (' · ' 로 구분 입력) */}
                          <div className="sm:col-span-2">
                            <label className="label text-xs sm:text-sm">학력</label>
                            <textarea
                              value={athleteForm.education}
                              onChange={(e) => setAthleteForm({ ...athleteForm, education: e.target.value })}
                              className="input min-h-[56px] text-sm sm:text-base"
                              placeholder="예: 한국체육대학교 골프전공 · 체육고 골프부 출신"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="label text-xs sm:text-sm">수상</label>
                            <textarea
                              value={athleteForm.awards}
                              onChange={(e) => setAthleteForm({ ...athleteForm, awards: e.target.value })}
                              className="input min-h-[56px] text-sm sm:text-base"
                              placeholder="예: 2024 KLPGA 점프투어 우승 · 챔피언십 준우승"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="label text-xs sm:text-sm">경력</label>
                            <textarea
                              value={athleteForm.career}
                              onChange={(e) => setAthleteForm({ ...athleteForm, career: e.target.value })}
                              className="input min-h-[56px] text-sm sm:text-base"
                              placeholder="예: 현 ◯◯ 소속 · 전 △△ 아카데미 프로"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-2">
                          이 항목들은 선수 둘러보기 카드와 상세 페이지에 표시됩니다. 비워두면 "-"로 표기됩니다.
                        </p>
                      </div>

                      {/* SPONPIK Phase 2 SNS — YouTube 채널 연동 */}
                      <YoutubeChannelSection profile={profile} />

                      {/* SPONPIK Phase 2 SNS 옵션 B — 출연 영상(3rd-party) 큐레이션 */}
                      <AthleteMentionSection profile={profile} />

                      {/* 선수 경기결과 자가등록 (관리자 승인 후 공개) */}
                      <AthleteEventResultsSection />
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

/**
 * YouTube 채널 연동 섹션 (선수 본인 — Phase 2 SNS)
 * - URL/핸들/Channel ID 입력 → 연결 → 즉시 메타+영상 동기화
 * - 연결 후: 채널 정보 + 최근 영상 5개 + 재동기화/해제 버튼
 */
/** 선수 본인 경기결과 자가등록 — 등록 시 PENDING(비공개), 관리자 승인 후 공개 */
function AthleteEventResultsSection() {
  const qc = useQueryClient();
  const empty = { eventName: '', eventDate: '', tour: '', category: '', rank: '' as number | '', score: '', summary: '' };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['my-event-results'],
    queryFn: () => api.getMyEventResults(),
  });
  const results: any[] = resp?.data || [];

  const createMut = useMutation({
    mutationFn: (body: any) => api.createMyEventResult(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-event-results'] }); setForm(empty); setOpen(false); },
    onError: (e: any) => alert(e?.response?.data?.error?.message || '등록 실패'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteMyEventResult(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-event-results'] }),
  });

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">공개</span>;
    if (s === 'REJECTED') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">반려</span>;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">승인 대기</span>;
  };

  const submit = () => {
    if (!form.eventName || !form.eventDate) { alert('대회명과 날짜는 필수입니다'); return; }
    createMut.mutate({ ...form, rank: form.rank === '' ? null : Number(form.rank) });
  };

  return (
    <div className="pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs sm:text-sm font-semibold text-slate-900">경기결과 (입상내역)</h3>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600">
          {open ? '닫기' : '+ 결과 추가'}
        </button>
      </div>
      <p className="text-[10px] sm:text-xs text-slate-500 mb-3">직접 등록한 결과는 <b>관리자 승인 후</b> 공개 페이지에 표시됩니다.</p>

      {open && (
        <div className="mb-3 p-3 bg-slate-50 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className="input text-sm" placeholder="대회명 *" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
          <input className="input text-sm" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
          <input className="input text-sm" placeholder="투어 (예: KLPGA 점프투어)" value={form.tour} onChange={(e) => setForm({ ...form, tour: e.target.value })} />
          <input className="input text-sm" type="number" placeholder="순위 (예: 1)" value={form.rank as any} onChange={(e) => setForm({ ...form, rank: e.target.value === '' ? '' : Number(e.target.value) })} />
          <input className="input text-sm" placeholder="스코어 (예: -7)" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          <input className="input text-sm" placeholder="구분 (예: 점프투어)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input text-sm sm:col-span-2" placeholder="요약 (선택)" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" onClick={submit} disabled={createMut.isPending} className="text-xs font-bold px-4 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
              {createMut.isPending ? '등록 중...' : '등록 (승인 요청)'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-slate-400 py-2">불러오는 중...</div>
      ) : results.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">등록된 경기결과가 없습니다.</div>
      ) : (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-white border border-slate-100 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {statusBadge(r.status)}
                  <span className="font-semibold truncate">{r.eventName}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {r.eventDate ? new Date(r.eventDate).toLocaleDateString('ko-KR') : '-'}
                  {r.tour ? ` · ${r.tour}` : ''}{r.rank != null ? ` · ${r.rank}위` : ''}{r.score ? ` · ${r.score}` : ''}
                </div>
              </div>
              {r.source === 'ATHLETE_SELF' && (
                <button type="button" onClick={() => deleteMut.mutate(r.id)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold shrink-0">삭제</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function YoutubeChannelSection({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const athleteId = profile?.id;

  const { data: ytResp } = useQuery({
    queryKey: ['youtube-athlete', athleteId],
    queryFn: () => api.getYoutubeAthleteAggregate(athleteId),
    enabled: !!athleteId,
  });
  const yt = ytResp?.data;

  const connectMut = useMutation({
    mutationFn: (channelInput: string) => api.connectMyYoutube(channelInput),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['youtube-athlete', athleteId] });
      setInput('');
      alert('YouTube 채널이 연결되었습니다');
    },
    onError: (e: any) => alert(e?.response?.data?.error?.message || '연결 실패'),
  });
  const syncMut = useMutation({
    mutationFn: () => api.syncMyYoutube(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['youtube-athlete', athleteId] }),
    onError: (e: any) => alert(e?.response?.data?.error?.message || '동기화 실패'),
  });
  const disconnectMut = useMutation({
    mutationFn: () => api.disconnectMyYoutube(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['youtube-athlete', athleteId] }),
  });

  return (
    <div className="pt-3 sm:pt-4 border-t border-slate-200">
      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4 inline-flex items-center gap-2">
        🎥 YouTube 채널 연동 <span className="text-[10px] text-slate-400 font-normal">Phase 2 · SNS</span>
      </h3>

      {!yt ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="YouTube URL / @핸들 / 채널 ID (UCxxxx)"
              className="input flex-1 text-sm"
            />
            <button
              onClick={() => input && connectMut.mutate(input)}
              disabled={!input || connectMut.isPending}
              className="btn btn-primary text-sm whitespace-nowrap"
            >
              {connectMut.isPending ? '연결 중...' : '연결'}
            </button>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500">
            예: https://www.youtube.com/@yenisfree · 또는 @yenisfree · 또는 UCxxxxx<br />
            연결 시 구독자/조회수/좋아요 등이 ROI 대시보드 "콘텐츠 반응" 카테고리에 자동 반영됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 채널 카드 */}
          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 flex items-start gap-3">
            {yt.thumbnailUrl ? (
              <img src={yt.thumbnailUrl} alt={yt.title} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 inline-flex items-center justify-center text-xl">🎥</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-sm text-slate-900 truncate">{yt.title}</div>
              <div className="text-[11px] text-slate-500 truncate">{yt.channelHandle || yt.channelId}</div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-500">구독자</div>
                  <div className="font-bold text-slate-900">{yt.subscriberCount?.toLocaleString() ?? '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">총 영상</div>
                  <div className="font-bold text-slate-900">{yt.videoCount?.toLocaleString() ?? '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">총 조회수</div>
                  <div className="font-bold text-slate-900">{yt.totalViews?.toLocaleString() ?? '-'}</div>
                </div>
              </div>
              {yt.syncStatus === 'FAILED' && (
                <div className="mt-2 text-[10px] text-rose-600 bg-rose-50 px-2 py-1 rounded">
                  ⚠ 동기화 실패: {yt.syncError}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="text-[11px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50"
              >
                {syncMut.isPending ? '동기화 중...' : '재동기화'}
              </button>
              <button
                onClick={() => { if (confirm('YouTube 채널 연결을 해제할까요?')) disconnectMut.mutate(); }}
                className="text-[11px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
              >
                해제
              </button>
            </div>
          </div>

          {/* 최근 영상 5개 (있으면) */}
          {yt.recent?.videos?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">최근 영상 (조회수 합계: {yt.recent.viewSum.toLocaleString()})</div>
              <div className="space-y-1.5">
                {yt.recent.videos.map((v: any) => (
                  <a
                    key={v.videoId}
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-12 h-9 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{v.title}</div>
                      <div className="text-[10px] text-slate-500">
                        👁 {v.viewCount.toLocaleString()} · 👍 {v.likeCount.toLocaleString()} · 💬 {v.commentCount.toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {yt.lastSyncedAt && (
            <p className="text-[10px] text-slate-400">
              마지막 동기화: {new Date(yt.lastSyncedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 선수 출연 영상 큐레이션 (Phase 2 SNS — 옵션 B)
 *
 * 흐름:
 * 1. URL 직접 추가 (즉시 APPROVED)
 * 2. "내 이름으로 검색" 클릭 → PENDING 후보 자동 등록
 * 3. PENDING 영상에 ✓ 승인 / ✗ 거절 / 🗑 삭제
 * 4. APPROVED 합계가 RoiDashboard "콘텐츠 반응" 카테고리에 자동 반영
 */
function AthleteMentionSection({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const athleteId = profile?.id;

  const { data: mentionsResp } = useQuery({
    queryKey: ['my-mentions'],
    queryFn: () => api.listMyMentions(),
    enabled: !!athleteId,
  });
  const mentions: any[] = mentionsResp?.data || [];
  const pending = mentions.filter((m) => m.status === 'PENDING');
  const approved = mentions.filter((m) => m.status === 'APPROVED');
  const rejected = mentions.filter((m) => m.status === 'REJECTED');

  const addMut = useMutation({
    mutationFn: (url: string) => api.addMyMention(url),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-mentions'] }); setUrlInput(''); },
    onError: (e: any) => alert(e?.response?.data?.error?.message || '등록 실패'),
  });
  const searchMut = useMutation({
    mutationFn: (q?: string) => api.searchMyMentions(q),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-mentions'] }); setSearchQuery(''); },
    onError: (e: any) => alert(e?.response?.data?.error?.message || '검색 실패 (YOUTUBE_API_KEY 미설정 가능성)'),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveMyMention(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-mentions'] }),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => api.rejectMyMention(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-mentions'] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api.deleteMyMention(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-mentions'] }),
  });

  const totalViews = approved.reduce((s: number, m: any) => s + (m.viewCount || 0), 0);
  const totalLikes = approved.reduce((s: number, m: any) => s + (m.likeCount || 0), 0);

  return (
    <div className="pt-3 sm:pt-4 border-t border-slate-200">
      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-3 sm:mb-4 inline-flex items-center gap-2">
        🎬 출연 영상 (3rd-party 채널) <span className="text-[10px] text-slate-400 font-normal">Phase 2 · 검색+확인</span>
      </h3>

      {/* 1) URL 직접 추가 */}
      <div className="mb-3">
        <label className="text-[11px] font-bold text-slate-500 mb-1 block">출연 영상 URL 직접 추가 (즉시 등록)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=xxx"
            className="input flex-1 text-sm"
          />
          <button
            onClick={() => urlInput && addMut.mutate(urlInput)}
            disabled={!urlInput || addMut.isPending}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            {addMut.isPending ? '등록 중...' : '추가'}
          </button>
        </div>
      </div>

      {/* 2) 자동 검색 */}
      <div className="mb-4 bg-slate-50 rounded-lg p-3">
        <label className="text-[11px] font-bold text-slate-500 mb-1 block">자동 검색 (선택 검토)</label>
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`기본: 내 이름 (${profile?.name || '-'})`}
            className="input flex-1 text-sm"
          />
          <button
            onClick={() => searchMut.mutate(searchQuery || undefined)}
            disabled={searchMut.isPending}
            className="btn btn-secondary text-sm whitespace-nowrap"
          >
            {searchMut.isPending ? '검색 중...' : '🔍 YouTube 검색'}
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          내 이름이 영상 제목/설명에 포함된 영상을 자동으로 검색하여 후보로 등록합니다. 후보는 본인이 ✓ 승인 / ✗ 거절해야 ROI에 반영됩니다.
        </p>
      </div>

      {/* 3) PENDING 후보 (검토 대기) */}
      {pending.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-amber-700 mb-2 flex items-center gap-1">
            ⏳ 검토 대기 ({pending.length}개) — 본인 출연 영상이 맞으면 ✓ 승인
          </div>
          <div className="space-y-1.5">
            {pending.map((m: any) => (
              <MentionRow
                key={m.id}
                m={m}
                actions={[
                  { label: '✓ 승인', cls: 'bg-emerald-500 text-white hover:bg-emerald-600', onClick: () => approveMut.mutate(m.id) },
                  { label: '✗ 거절', cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200', onClick: () => rejectMut.mutate(m.id) },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4) APPROVED (ROI 반영 중) */}
      {approved.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-emerald-700">
              ✅ ROI 반영 중 ({approved.length}개)
            </div>
            <div className="text-[10px] text-slate-600">
              합계: 👁 {totalViews.toLocaleString()} · 👍 {totalLikes.toLocaleString()}
            </div>
          </div>
          <div className="space-y-1.5">
            {approved.map((m: any) => (
              <MentionRow
                key={m.id}
                m={m}
                actions={[
                  { label: '🗑', cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200', onClick: () => { if (confirm('이 영상을 ROI에서 제외할까요?')) removeMut.mutate(m.id); } },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5) REJECTED (참고용) */}
      {rejected.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">거절된 영상 ({rejected.length}개)</summary>
          <div className="mt-2 space-y-1">
            {rejected.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 text-[11px] text-slate-400 py-1">
                <span className="line-through truncate flex-1">{m.videoTitle}</span>
                <button onClick={() => approveMut.mutate(m.id)} className="text-emerald-600 hover:underline">복원</button>
                <button onClick={() => removeMut.mutate(m.id)} className="text-rose-500 hover:underline">완전 삭제</button>
              </div>
            ))}
          </div>
        </details>
      )}

      {mentions.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-3">
          아직 등록된 출연 영상이 없습니다. URL 추가 또는 자동 검색으로 시작하세요.
        </p>
      )}
    </div>
  );
}

function MentionRow({ m, actions }: { m: any; actions: Array<{ label: string; cls: string; onClick: () => void }> }) {
  return (
    <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg">
      {m.videoThumbnail ? (
        <img src={m.videoThumbnail} alt="" className="w-16 h-12 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-12 rounded bg-slate-100 inline-flex items-center justify-center text-lg flex-shrink-0">🎥</div>
      )}
      <div className="flex-1 min-w-0">
        <a href={`https://www.youtube.com/watch?v=${m.videoId}`} target="_blank" rel="noreferrer"
          className="text-xs font-semibold text-slate-900 truncate block hover:text-emerald-600">
          {m.videoTitle}
        </a>
        <div className="text-[10px] text-slate-500 truncate">
          {m.channelTitle && <span>{m.channelTitle} · </span>}
          👁 {(m.viewCount || 0).toLocaleString()} · 👍 {(m.likeCount || 0).toLocaleString()} · 💬 {(m.commentCount || 0).toLocaleString()}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className={`text-[11px] font-bold px-2 py-1 rounded ${a.cls}`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

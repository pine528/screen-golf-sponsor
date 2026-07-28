import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Shield,
  CreditCard,
  FileText,
  BarChart3,
  Package,
  Edit3,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Upload,
  DollarSign,
  Plus,
  X,
  Eye,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { getEventMonthLabel } from '../../utils/eventMonth';

interface AthleteDetail {
  id: string;
  name: string;
  realName?: string;
  tour: string;
  bio?: string;
  profileImageUrl?: string;
  socialLinks?: any;
  blockedCategories?: string[];
  kycStatus: string;
  kycDocuments?: any;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  user: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
  };
  _count: {
    slotInstances: number;
    contracts: number;
    withdrawalRequests: number;
  };
}

interface Performance {
  slots: { total: number; sold: number; open: number };
  contracts: { total: number; active: number; completed: number };
  earnings: { total: number; pending: number; withdrawn: number };
}

interface Slot {
  id: string;
  status: string;
  enableAuction: boolean;
  enableDirectBuy: boolean;
  directBuyPrice?: number;
  auctionMinBid?: number;
  auctionEndAt?: string;
  event?: { id: string; name: string; dateStart: string };
  slotTemplate?: { id: string; code: string; name: string; bodyPart: string };
  auction?: { isFeatured?: boolean };
}

interface Contract {
  id: string;
  status: string;
  priceFinal: number;
  createdAt: string;
  brand: { id: string; name: string };
  auction?: {
    slotInstance: {
      event?: { name: string };
      slotTemplate?: { name: string };
    };
  };
}

interface EventOption {
  id: string;
  name: string;
  dateStart: string;
  status: string;
}

interface TemplateOption {
  id: string;
  code: string;
  name: string;
  bodyPart: string;
}

const TABS = [
  { id: 'profile', label: '프로필', icon: User },
  { id: 'kyc', label: 'KYC', icon: Shield },
  { id: 'bank', label: '정산 정보', icon: CreditCard },
  { id: 'slots', label: '슬롯', icon: Package },
  { id: 'contracts', label: '계약', icon: FileText },
  { id: 'performance', label: '성과', icon: BarChart3 },
];

const KYC_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_SUBMITTED: { label: 'KYC 미제출', color: 'bg-slate-100 text-slate-700' },
  PENDING: { label: 'KYC 심사중', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'KYC 승인', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'KYC 반려', color: 'bg-red-100 text-red-700' },
};

export function AgencyAthleteDetail() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const [activeTab, setActiveTab] = useState('profile');
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    realName: '',
    bio: '',
    profileImageUrl: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Bank account edit state
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // KYC upload state
  const [kycIdCardFile, setKycIdCardFile] = useState<File | null>(null);
  const [kycAthleteRegFile, setKycAthleteRegFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  // Slot creation state
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [creatingSlots, setCreatingSlots] = useState(false);

  // Slot settings edit state
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [slotSettingsForm, setSlotSettingsForm] = useState({
    enableAuction: true,
    enableDirectBuy: false,
    directBuyPrice: '',
    auctionMinBid: '',
    auctionEndAt: '',
    isPublic: false,
  });
  const [savingSlotSettings, setSavingSlotSettings] = useState(false);

  useEffect(() => {
    if (athleteId) {
      fetchAthleteDetail();
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteId && activeTab === 'performance' && !performance) {
      fetchPerformance();
    }
    if (athleteId && activeTab === 'slots' && slots.length === 0) {
      fetchSlots();
    }
    if (athleteId && activeTab === 'contracts' && contracts.length === 0) {
      fetchContracts();
    }
  }, [athleteId, activeTab]);

  const fetchAthleteDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getAgencyAthleteDetail(athleteId!);
      setAthlete(res.data);
      setProfileForm({
        name: res.data.name || '',
        realName: res.data.realName || '',
        bio: res.data.bio || '',
        profileImageUrl: res.data.profileImageUrl || '',
      });
      setBankForm({
        bankName: res.data.bankAccount?.bankName || '',
        accountNumber: res.data.bankAccount?.accountNumber || '',
        accountHolder: res.data.bankAccount?.accountHolder || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '선수 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    try {
      const res = await api.getAgencyAthletePerformance(athleteId!);
      setPerformance(res.data);
    } catch (err: any) {
      console.error('Performance fetch error:', err);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await api.getAgencyAthleteSlots(athleteId!);
      setSlots(res.data || []);
    } catch (err: any) {
      console.error('Slots fetch error:', err);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await api.getAgencyAthleteContracts(athleteId!);
      setContracts(res.data?.contracts || []);
    } catch (err: any) {
      console.error('Contracts fetch error:', err);
    }
  };

  const fetchEventsAndTemplates = async () => {
    try {
      const [eventsRes, templatesRes] = await Promise.all([
        api.get('/events', { status: 'UPCOMING' }),
        api.get('/slots/templates'),
      ]);
      setEvents(eventsRes.data || []);
      setTemplates(templatesRes.data || []);
    } catch (err: any) {
      console.error('Events/Templates fetch error:', err);
    }
  };

  const handleOpenSlotModal = () => {
    fetchEventsAndTemplates();
    setSelectedEventId('');
    setSelectedTemplateIds([]);
    setShowSlotModal(true);
  };

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleCreateSlots = async () => {
    if (!selectedEventId || selectedTemplateIds.length === 0) {
      setError('이벤트와 슬롯 템플릿을 선택해주세요');
      return;
    }

    try {
      setCreatingSlots(true);
      await api.bulkCreateAgencyAthleteSlots(athleteId!, {
        eventId: selectedEventId,
        templateIds: selectedTemplateIds,
      });
      setSuccessMessage(`${selectedTemplateIds.length}개의 슬롯이 생성되었습니다`);
      setShowSlotModal(false);
      fetchSlots();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '슬롯 생성에 실패했습니다');
    } finally {
      setCreatingSlots(false);
    }
  };

  const handleOpenSlotSettings = (slot: Slot) => {
    setEditingSlot(slot);
    setSlotSettingsForm({
      enableAuction: slot.enableAuction,
      enableDirectBuy: slot.enableDirectBuy,
      directBuyPrice: slot.directBuyPrice?.toString() || '',
      auctionMinBid: slot.auctionMinBid?.toString() || '',
      auctionEndAt: slot.auctionEndAt ? new Date(slot.auctionEndAt).toISOString().slice(0, 16) : '',
      isPublic: slot.auction?.isFeatured ?? false,
    });
  };

  const handleSaveSlotSettings = async () => {
    if (!editingSlot) return;

    // 최소 하나는 활성화되어야 함
    if (!slotSettingsForm.enableAuction && !slotSettingsForm.enableDirectBuy) {
      setError('경매 또는 바로 구매 중 하나는 활성화해야 합니다');
      return;
    }

    // 경매 활성화 시 마감일 필수
    if (slotSettingsForm.enableAuction) {
      if (!slotSettingsForm.auctionMinBid || Number(slotSettingsForm.auctionMinBid) <= 0) {
        setError('최소 입찰가를 입력해주세요');
        return;
      }
      if (!slotSettingsForm.auctionEndAt) {
        setError('경매 마감일을 설정해주세요');
        return;
      }
      if (new Date(slotSettingsForm.auctionEndAt) <= new Date()) {
        setError('경매 마감일은 현재 시간 이후여야 합니다');
        return;
      }
    }

    try {
      setSavingSlotSettings(true);
      await api.updateAgencyAthleteSlotSaleMode(athleteId!, editingSlot.id, {
        enableAuction: slotSettingsForm.enableAuction,
        enableDirectBuy: slotSettingsForm.enableDirectBuy,
        directBuyPrice: slotSettingsForm.directBuyPrice ? Number(slotSettingsForm.directBuyPrice) : undefined,
        auctionMinBid: slotSettingsForm.auctionMinBid ? Number(slotSettingsForm.auctionMinBid) : undefined,
        auctionEndAt: slotSettingsForm.auctionEndAt || undefined,
        isPublic: slotSettingsForm.enableAuction ? slotSettingsForm.isPublic : undefined,
      });
      setSuccessMessage('슬롯 설정이 저장되었습니다');
      setEditingSlot(null);
      fetchSlots();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '슬롯 설정 저장에 실패했습니다');
    } finally {
      setSavingSlotSettings(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await api.updateAgencyAthleteProfile(athleteId!, profileForm);
      setSuccessMessage('프로필이 저장되었습니다');
      setIsEditingProfile(false);
      fetchAthleteDetail();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '프로필 저장에 실패했습니다');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBank = async () => {
    try {
      setSavingBank(true);
      await api.updateAgencyAthleteBankAccount(athleteId!, bankForm);
      setSuccessMessage('정산 정보가 저장되었습니다');
      setIsEditingBank(false);
      fetchAthleteDetail();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '정산 정보 저장에 실패했습니다');
    } finally {
      setSavingBank(false);
    }
  };

  const handleSubmitKyc = async () => {
    if (!kycIdCardFile || !kycAthleteRegFile) {
      setError('모든 서류를 업로드해주세요');
      return;
    }

    try {
      setUploadingKyc(true);
      const uploadResult = await api.uploadFiles([kycIdCardFile, kycAthleteRegFile], 'kyc');
      const documents = [
        { type: 'id_card', url: uploadResult.data.files[0].fileUrl },
        { type: 'athlete_registration', url: uploadResult.data.files[1].fileUrl },
      ];

      await api.submitAgencyAthleteKyc(athleteId!, documents);
      setSuccessMessage('KYC 서류가 제출되었습니다');
      setKycIdCardFile(null);
      setKycAthleteRegFile(null);
      fetchAthleteDetail();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'KYC 제출에 실패했습니다');
    } finally {
      setUploadingKyc(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error && !athlete) {
    return (
      <Layout>
        <div className="p-6 bg-red-50 rounded-xl text-red-600 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </Layout>
    );
  }

  if (!athlete) {
    return (
      <Layout>
        <div className="text-center py-12 text-slate-500">선수를 찾을 수 없습니다</div>
      </Layout>
    );
  }

  const kycConfig = KYC_STATUS_CONFIG[athlete.kycStatus] || KYC_STATUS_CONFIG.NOT_SUBMITTED;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/agency/athletes"
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden">
                {athlete.profileImageUrl ? (
                  <img
                    src={athlete.profileImageUrl}
                    alt={athlete.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{athlete.name}</h1>
                <p className="text-slate-600">{athlete.user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">{athlete.tour}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${kycConfig.color}`}>
                    {kycConfig.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">&times;</button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="card p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">프로필 정보</h2>
                {!isEditingProfile ? (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="btn btn-secondary text-sm inline-flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="btn btn-secondary text-sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="btn btn-primary text-sm inline-flex items-center gap-2"
                    >
                      {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      저장
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">활동명</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div>
                  <label className="label">실명</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.realName}
                    onChange={(e) => setProfileForm({ ...profileForm, realName: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">소개</label>
                  <textarea
                    className="input min-h-[100px]"
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">프로필 이미지 URL</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.profileImageUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, profileImageUrl: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">계정 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">이메일:</span>
                    <span className="ml-2 text-slate-900">{athlete.user.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">가입일:</span>
                    <span className="ml-2 text-slate-900">{formatDate(athlete.user.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">투어:</span>
                    <span className="ml-2 text-slate-900">{athlete.tour}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KYC Tab */}
          {activeTab === 'kyc' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">KYC 인증</h2>

              <div className={`p-4 rounded-xl ${kycConfig.color.replace('text-', 'border-').replace('bg-', 'bg-')}`}>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">현재 상태: {kycConfig.label}</span>
                </div>
              </div>

              {(athlete.kycStatus === 'NOT_SUBMITTED' || athlete.kycStatus === 'REJECTED') && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    선수 대신 KYC 서류를 제출할 수 있습니다. 신분증과 선수등록증을 업로드해주세요.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">신분증</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycIdCardFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                      {kycIdCardFile && (
                        <p className="mt-1 text-xs text-emerald-600">✓ {kycIdCardFile.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">선수등록증</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycAthleteRegFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                      {kycAthleteRegFile && (
                        <p className="mt-1 text-xs text-emerald-600">✓ {kycAthleteRegFile.name}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleSubmitKyc}
                    disabled={uploadingKyc || !kycIdCardFile || !kycAthleteRegFile}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    {uploadingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    KYC 서류 제출
                  </button>
                </div>
              )}

              {athlete.kycStatus === 'PENDING' && (
                <p className="text-sm text-amber-600">
                  KYC 서류가 심사 중입니다. 승인까지 1-2 영업일이 소요될 수 있습니다.
                </p>
              )}

              {athlete.kycStatus === 'APPROVED' && (
                <p className="text-sm text-emerald-600">
                  KYC 인증이 완료되었습니다. 모든 기능을 이용할 수 있습니다.
                </p>
              )}
            </div>
          )}

          {/* Bank Account Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">정산 계좌 정보</h2>
                {!isEditingBank ? (
                  <button
                    onClick={() => setIsEditingBank(true)}
                    className="btn btn-secondary text-sm inline-flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingBank(false)} className="btn btn-secondary text-sm">
                      취소
                    </button>
                    <button
                      onClick={handleSaveBank}
                      disabled={savingBank}
                      className="btn btn-primary text-sm inline-flex items-center gap-2"
                    >
                      {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      저장
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">은행</label>
                  <select
                    className="input"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    disabled={!isEditingBank}
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
                  <label className="label">계좌번호</label>
                  <input
                    type="text"
                    className="input"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    disabled={!isEditingBank}
                    placeholder="- 없이 숫자만"
                  />
                </div>
                <div>
                  <label className="label">예금주</label>
                  <input
                    type="text"
                    className="input"
                    value={bankForm.accountHolder}
                    onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                    disabled={!isEditingBank}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                정산 계좌는 계약 완료 후 수익금이 입금되는 계좌입니다. 반드시 선수 본인 명의의 계좌를 등록해주세요.
              </p>
            </div>
          )}

          {/* Slots Tab */}
          {activeTab === 'slots' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  슬롯 관리 ({slots.length}개)
                </h2>
                <button
                  onClick={handleOpenSlotModal}
                  className="btn btn-primary text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  슬롯 추가
                </button>
              </div>

              {slots.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {slots.map((slot) => (
                    <div key={slot.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {(slot.slotTemplate as any)?.nameKr || slot.slotTemplate?.name || slot.slotTemplate?.code}
                          </p>
                          <p className="text-sm text-slate-500">
                            {getEventMonthLabel(slot.event)} · {slot.slotTemplate?.code}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            {slot.enableAuction && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                                경매 {slot.auctionMinBid ? `(최소 ${formatCurrency(slot.auctionMinBid)})` : ''}
                              </span>
                            )}
                            {slot.enableDirectBuy && (
                              <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded">
                                바로 구매 {slot.directBuyPrice ? formatCurrency(slot.directBuyPrice) : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              slot.status === 'SOLD'
                                ? 'bg-purple-100 text-purple-700'
                                : slot.status === 'IN_AUCTION'
                                ? 'bg-amber-100 text-amber-700'
                                : (slot.enableDirectBuy && slot.directBuyPrice) || (slot.enableAuction && slot.auctionMinBid)
                                ? 'bg-emerald-100 text-emerald-700'
                                : slot.enableDirectBuy || slot.enableAuction
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {slot.status === 'SOLD'
                              ? '판매됨'
                              : slot.status === 'IN_AUCTION'
                              ? '경매중'
                              : (slot.enableDirectBuy && slot.directBuyPrice) || (slot.enableAuction && slot.auctionMinBid)
                              ? '판매중'
                              : slot.enableDirectBuy || slot.enableAuction
                              ? '설정중'
                              : '미등록'}
                          </span>
                          {(slot.status === 'OPEN' || slot.status === 'IN_AUCTION') && (
                            <button
                              onClick={() => handleOpenSlotSettings(slot)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
                              title="판매 설정"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>등록된 슬롯이 없습니다</p>
                </div>
              )}
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">
                계약 내역 ({contracts.length}건)
              </h2>

              {contracts.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{contract.brand.name}</p>
                          <p className="text-sm text-slate-500">
                            {getEventMonthLabel(contract.auction?.slotInstance?.event)} -{' '}
                            {contract.auction?.slotInstance?.slotTemplate?.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(contract.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(contract.priceFinal)}
                          </p>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              contract.status === 'ACTIVE' || contract.status === 'COMPLETED' || contract.status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : contract.status === 'PENDING_SIGNATURE'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {contract.status === 'ACTIVE' ? '진행중' :
                             contract.status === 'COMPLETED' ? '완료' :
                             contract.status === 'VERIFIED' ? '검증됨' :
                             contract.status === 'PENDING_SIGNATURE' ? '서명대기' : contract.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>계약 내역이 없습니다</p>
                </div>
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">성과 통계</h2>

              {performance ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Slots Stats */}
                  <div className="card bg-purple-50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Package className="w-6 h-6 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">슬롯</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-purple-700">전체</span>
                        <span className="font-semibold text-purple-900">{performance.slots.total}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">판매중</span>
                        <span className="font-semibold text-purple-900">{performance.slots.open}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">판매완료</span>
                        <span className="font-semibold text-purple-900">{performance.slots.sold}개</span>
                      </div>
                    </div>
                  </div>

                  {/* Contracts Stats */}
                  <div className="card bg-emerald-50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="w-6 h-6 text-emerald-600" />
                      <h3 className="font-semibold text-emerald-900">계약</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-emerald-700">전체</span>
                        <span className="font-semibold text-emerald-900">{performance.contracts.total}건</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700">진행중</span>
                        <span className="font-semibold text-emerald-900">{performance.contracts.active}건</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700">완료</span>
                        <span className="font-semibold text-emerald-900">{performance.contracts.completed}건</span>
                      </div>
                    </div>
                  </div>

                  {/* Earnings Stats */}
                  <div className="card bg-amber-50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <DollarSign className="w-6 h-6 text-amber-600" />
                      <h3 className="font-semibold text-amber-900">수익</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-amber-700">총 수익</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(performance.earnings.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-700">정산 대기</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(performance.earnings.pending)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-700">출금 완료</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(performance.earnings.withdrawn)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slot Creation Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">슬롯 추가</h3>
              <button
                onClick={() => setShowSlotModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Selection */}
              <div>
                <label className="label">이벤트 선택</label>
                <select
                  className="input"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                >
                  <option value="">이벤트를 선택하세요</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {getEventMonthLabel(event)} ({new Date(event.dateStart).toLocaleDateString('ko-KR')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection */}
              <div>
                <label className="label">슬롯 템플릿 선택 (복수 선택 가능)</label>
                <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {templates.length > 0 ? (
                    templates.map((template) => (
                      <label
                        key={template.id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplateIds.includes(template.id)}
                          onChange={() => handleToggleTemplate(template.id)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{template.name}</p>
                          <p className="text-xs text-slate-500">
                            {template.code}
                            {(template as any).category && ` · ${(template as any).category}`}
                          </p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-slate-500 text-center">
                      슬롯 템플릿이 없습니다
                    </p>
                  )}
                </div>
                {selectedTemplateIds.length > 0 && (
                  <p className="mt-2 text-sm text-purple-600">
                    {selectedTemplateIds.length}개 선택됨
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSlotModal(false)}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={handleCreateSlots}
                disabled={creatingSlots || !selectedEventId || selectedTemplateIds.length === 0}
                className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {creatingSlots ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    슬롯 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Settings Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">슬롯 판매 설정</h3>
              <button
                onClick={() => setEditingSlot(null)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <p className="font-medium">{editingSlot.slotTemplate?.name}</p>
                <p className="text-xs text-slate-500">{getEventMonthLabel(editingSlot.event)}</p>
              </div>

              {/* Auction Toggle */}
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">경매 허용</p>
                  <p className="text-xs text-slate-500">입찰을 통해 판매</p>
                </div>
                <input
                  type="checkbox"
                  checked={slotSettingsForm.enableAuction}
                  onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, enableAuction: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
              </label>

              {slotSettingsForm.enableAuction && (
                <div className="space-y-3">
                  <div>
                    <label className="label">최소 입찰가 (원)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="최소 입찰가"
                      value={slotSettingsForm.auctionMinBid}
                      onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, auctionMinBid: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">경매 마감일</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={slotSettingsForm.auctionEndAt}
                      onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, auctionEndAt: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">경매 마감일을 설정해야 경매가 시작됩니다</p>
                  </div>
                  {/* 공개/비공개 토글 */}
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-slate-900">공개 경매</p>
                        <p className="text-xs text-slate-500">모든 브랜드에게 노출</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={slotSettingsForm.isPublic}
                      onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, isPublic: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                  </label>
                </div>
              )}

              {/* Direct Buy Toggle */}
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">바로 구매 허용</p>
                  <p className="text-xs text-slate-500">정해진 가격으로 바로 구매</p>
                </div>
                <input
                  type="checkbox"
                  checked={slotSettingsForm.enableDirectBuy}
                  onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, enableDirectBuy: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
              </label>

              {slotSettingsForm.enableDirectBuy && (
                <div>
                  <label className="label">바로 구매 가격 (원)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="바로 구매 가격"
                    value={slotSettingsForm.directBuyPrice}
                    onChange={(e) => setSlotSettingsForm({ ...slotSettingsForm, directBuyPrice: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingSlot(null)}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={handleSaveSlotSettings}
                disabled={savingSlotSettings}
                className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {savingSlotSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

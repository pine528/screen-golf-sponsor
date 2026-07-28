import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import {
  Settings,
  Save,
  Bell,
  Mail,
  Shield,
  Clock,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { cn } from '../../utils';
import { api } from '../../services/api';

type SystemSettings = Record<string, { value: string; description: string | null }>;

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System Settings from API
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});

  // General Settings (local state for UI that's not yet connected to backend)
  const [generalSettings, setGeneralSettings] = useState({
    platformName: 'SPONPIK',
    supportEmail: 'support@sponpik.com',
    maintenanceMode: false,
    allowNewRegistrations: true,
  });

  // Auction Settings
  const [auctionSettings, setAuctionSettings] = useState({
    defaultDuration: 48,
    minimumBidIncrement: 10000,
    sniperProtectionMinutes: 5,
    maxExtensions: 3,
    extensionDuration: 10,
    autoStartAuctions: true,
  });

  // Fee Settings
  const [feeSettings, setFeeSettings] = useState({
    platformFeePercent: 10,
    athleteFeePercent: 5,
    paymentProcessingFee: 3,
    settlementDays: 7,
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailOnNewBid: true,
    emailOnAuctionEnd: true,
    emailOnContractSigned: true,
    emailOnKycPending: true,
    slackWebhook: '',
    slackEnabled: false,
  });

  // Load settings from API
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.getAdminSettings();
      if (response.success && response.data) {
        setSystemSettings(response.data);

        // Update fee settings from system settings
        if (response.data.PLATFORM_FEE_RATE) {
          const feeRate = parseFloat(response.data.PLATFORM_FEE_RATE.value);
          setFeeSettings(prev => ({
            ...prev,
            platformFeePercent: feeRate * 100,
          }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update a single setting
  const updateSetting = async (key: string, value: string) => {
    try {
      setIsSaving(true);
      await api.updateAdminSetting(key, value);
      setSystemSettings(prev => ({
        ...prev,
        [key]: { ...prev[key], value },
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle boolean setting
  const toggleBooleanSetting = async (key: string) => {
    const currentValue = systemSettings[key]?.value === 'true';
    await updateSetting(key, (!currentValue).toString());
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call for local settings
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const tabs = [
    { id: 'general', label: '일반', icon: Settings },
    { id: 'auction', label: '경매', icon: Clock },
    { id: 'fees', label: '수수료', icon: DollarSign },
    { id: 'notifications', label: '알림', icon: Bell },
  ];

  const kycAutoApproveEnabled = systemSettings.KYC_AUTO_APPROVE_ENABLED?.value === 'true';

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">설정</h1>
            <p className="text-slate-600 mt-1">플랫폼 설정을 관리합니다</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary inline-flex items-center gap-2"
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
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">설정이 저장되었습니다</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-1">
            <div className="card p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Icon className={cn(
                        'w-5 h-5',
                        activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'
                      )} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <div className="card p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">일반 설정</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="label">플랫폼 이름</label>
                      <input
                        type="text"
                        value={generalSettings.platformName}
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, platformName: e.target.value })
                        }
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="label">고객지원 이메일</label>
                      <input
                        type="email"
                        value={generalSettings.supportEmail}
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })
                        }
                        className="input"
                      />
                    </div>

                    {/* KYC Auto Approve Toggle - Connected to API */}
                    <div className="flex items-center justify-between p-4 bg-sky-50 rounded-xl border border-sky-200">
                      <div className="flex items-start gap-3">
                        <UserCheck className="w-5 h-5 text-sky-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sky-900">KYC 자동 승인</p>
                          <p className="text-sm text-sky-700 mt-1">
                            사업자등록번호가 유효한 계속사업자인 경우 KYC를 자동으로 승인합니다.
                            <br />
                            <span className="text-xs">비활성화 시 모든 KYC 요청은 관리자 수동 검토가 필요합니다.</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleBooleanSetting('KYC_AUTO_APPROVE_ENABLED')}
                        disabled={isSaving}
                        className={cn(
                          'p-1 rounded-full transition-colors',
                          kycAutoApproveEnabled ? 'text-sky-600' : 'text-slate-400'
                        )}
                      >
                        {kycAutoApproveEnabled ? (
                          <ToggleRight className="w-10 h-10" />
                        ) : (
                          <ToggleLeft className="w-10 h-10" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-medium text-slate-900">신규 회원가입 허용</p>
                        <p className="text-sm text-slate-500">새로운 사용자의 회원가입을 허용합니다</p>
                      </div>
                      <button
                        onClick={() =>
                          setGeneralSettings({
                            ...generalSettings,
                            allowNewRegistrations: !generalSettings.allowNewRegistrations,
                          })
                        }
                        className={cn(
                          'p-1 rounded-full transition-colors',
                          generalSettings.allowNewRegistrations
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        )}
                      >
                        {generalSettings.allowNewRegistrations ? (
                          <ToggleRight className="w-10 h-10" />
                        ) : (
                          <ToggleLeft className="w-10 h-10" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                          <p className="font-medium text-amber-900">유지보수 모드</p>
                        </div>
                        <p className="text-sm text-amber-700 mt-1">
                          활성화 시 관리자 외 모든 사용자의 접근이 제한됩니다
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setGeneralSettings({
                            ...generalSettings,
                            maintenanceMode: !generalSettings.maintenanceMode,
                          })
                        }
                        className={cn(
                          'p-1 rounded-full transition-colors',
                          generalSettings.maintenanceMode ? 'text-amber-600' : 'text-slate-400'
                        )}
                      >
                        {generalSettings.maintenanceMode ? (
                          <ToggleRight className="w-10 h-10" />
                        ) : (
                          <ToggleLeft className="w-10 h-10" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Auction Settings */}
              {activeTab === 'auction' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">경매 설정</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">기본 경매 기간 (시간)</label>
                        <input
                          type="number"
                          value={auctionSettings.defaultDuration}
                          onChange={(e) =>
                            setAuctionSettings({
                              ...auctionSettings,
                              defaultDuration: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">최소 입찰 증분 (원)</label>
                        <input
                          type="number"
                          value={auctionSettings.minimumBidIncrement}
                          onChange={(e) =>
                            setAuctionSettings({
                              ...auctionSettings,
                              minimumBidIncrement: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-slate-600" />
                        스나이핑 방지 설정
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="label">보호 시작 (분 전)</label>
                          <input
                            type="number"
                            value={auctionSettings.sniperProtectionMinutes}
                            onChange={(e) =>
                              setAuctionSettings({
                                ...auctionSettings,
                                sniperProtectionMinutes: parseInt(e.target.value),
                              })
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="label">최대 연장 횟수</label>
                          <input
                            type="number"
                            value={auctionSettings.maxExtensions}
                            onChange={(e) =>
                              setAuctionSettings({
                                ...auctionSettings,
                                maxExtensions: parseInt(e.target.value),
                              })
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="label">연장 시간 (분)</label>
                          <input
                            type="number"
                            value={auctionSettings.extensionDuration}
                            onChange={(e) =>
                              setAuctionSettings({
                                ...auctionSettings,
                                extensionDuration: parseInt(e.target.value),
                              })
                            }
                            className="input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-medium text-slate-900">자동 경매 시작</p>
                        <p className="text-sm text-slate-500">
                          예정 시간에 맞춰 자동으로 경매를 시작합니다
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setAuctionSettings({
                            ...auctionSettings,
                            autoStartAuctions: !auctionSettings.autoStartAuctions,
                          })
                        }
                        className={cn(
                          'p-1 rounded-full transition-colors',
                          auctionSettings.autoStartAuctions
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        )}
                      >
                        {auctionSettings.autoStartAuctions ? (
                          <ToggleRight className="w-10 h-10" />
                        ) : (
                          <ToggleLeft className="w-10 h-10" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fee Settings */}
              {activeTab === 'fees' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">수수료 설정</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          플랫폼 수수료 (%)
                        </label>
                        <input
                          type="number"
                          value={feeSettings.platformFeePercent}
                          onChange={(e) =>
                            setFeeSettings({
                              ...feeSettings,
                              platformFeePercent: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          낙찰가에서 플랫폼이 받는 수수료
                        </p>
                      </div>
                      <div>
                        <label className="label flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          선수 수수료 (%)
                        </label>
                        <input
                          type="number"
                          value={feeSettings.athleteFeePercent}
                          onChange={(e) =>
                            setFeeSettings({
                              ...feeSettings,
                              athleteFeePercent: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          선수 정산금에서 차감되는 수수료
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          결제 수수료 (%)
                        </label>
                        <input
                          type="number"
                          value={feeSettings.paymentProcessingFee}
                          onChange={(e) =>
                            setFeeSettings({
                              ...feeSettings,
                              paymentProcessingFee: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">PG사 결제 수수료</p>
                      </div>
                      <div>
                        <label className="label flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          정산 기간 (영업일)
                        </label>
                        <input
                          type="number"
                          value={feeSettings.settlementDays}
                          onChange={(e) =>
                            setFeeSettings({
                              ...feeSettings,
                              settlementDays: parseInt(e.target.value),
                            })
                          }
                          className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          계약 완료 후 정산까지 걸리는 기간
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
                      <h3 className="font-medium text-sky-900 mb-2">수수료 계산 예시</h3>
                      <p className="text-sm text-sky-700">
                        낙찰가 1,000,000원 기준:
                      </p>
                      <ul className="text-sm text-sky-700 mt-2 space-y-1">
                        <li>• 플랫폼 수수료: {(1000000 * feeSettings.platformFeePercent / 100).toLocaleString()}원</li>
                        <li>• 선수 수수료: {(1000000 * feeSettings.athleteFeePercent / 100).toLocaleString()}원</li>
                        <li>• 선수 정산액: {(1000000 * (100 - feeSettings.platformFeePercent - feeSettings.athleteFeePercent) / 100).toLocaleString()}원</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">알림 설정</h2>

                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-700 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      이메일 알림
                    </h3>

                    {[
                      { key: 'emailOnNewBid', label: '새 입찰 시 알림', desc: '경매에 새로운 입찰이 들어왔을 때' },
                      { key: 'emailOnAuctionEnd', label: '경매 종료 알림', desc: '경매가 종료되었을 때' },
                      { key: 'emailOnContractSigned', label: '계약 체결 알림', desc: '계약이 체결되었을 때' },
                      { key: 'emailOnKycPending', label: 'KYC 대기 알림', desc: '새로운 KYC 심사 요청이 있을 때' },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{item.label}</p>
                          <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <button
                          onClick={() =>
                            setNotificationSettings({
                              ...notificationSettings,
                              [item.key]: !notificationSettings[item.key as keyof typeof notificationSettings],
                            })
                          }
                          className={cn(
                            'p-1 rounded-full transition-colors',
                            notificationSettings[item.key as keyof typeof notificationSettings]
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          )}
                        >
                          {notificationSettings[item.key as keyof typeof notificationSettings] ? (
                            <ToggleRight className="w-10 h-10" />
                          ) : (
                            <ToggleLeft className="w-10 h-10" />
                          )}
                        </button>
                      </div>
                    ))}

                    <div className="pt-4 border-t border-slate-200">
                      <h3 className="font-medium text-slate-700 flex items-center gap-2 mb-4">
                        <Bell className="w-5 h-5" />
                        Slack 연동
                      </h3>

                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
                        <div>
                          <p className="font-medium text-slate-900">Slack 알림 활성화</p>
                          <p className="text-sm text-slate-500">중요 알림을 Slack으로 전송합니다</p>
                        </div>
                        <button
                          onClick={() =>
                            setNotificationSettings({
                              ...notificationSettings,
                              slackEnabled: !notificationSettings.slackEnabled,
                            })
                          }
                          className={cn(
                            'p-1 rounded-full transition-colors',
                            notificationSettings.slackEnabled
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          )}
                        >
                          {notificationSettings.slackEnabled ? (
                            <ToggleRight className="w-10 h-10" />
                          ) : (
                            <ToggleLeft className="w-10 h-10" />
                          )}
                        </button>
                      </div>

                      {notificationSettings.slackEnabled && (
                        <div>
                          <label className="label">Slack Webhook URL</label>
                          <input
                            type="text"
                            value={notificationSettings.slackWebhook}
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                slackWebhook: e.target.value,
                              })
                            }
                            className="input"
                            placeholder="https://hooks.slack.com/services/..."
                          />
                        </div>
                      )}
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

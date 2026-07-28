import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
  XCircle,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

interface Agency {
  id: string;
  name: string;
  kycStatus: string;
  contactEmail: string;
  bizNo?: string;
  athletes: Array<{
    id: string;
    name: string;
    tour: string;
    kycStatus: string;
    profileImageUrl?: string;
  }>;
}

interface Stats {
  totalAthletes: number;
  activeSlots: number;
  pendingContracts: number;
  totalContractValue: number;
}

interface PendingSignature {
  id: string;
  athlete: { id: string; name: string };
  brand: { id: string; name: string };
  priceFinal: number;
  remainingSeconds: number | null;
  isUrgent: boolean;
  isExpired: boolean;
}

export function AgencyDashboard() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingSignatures, setPendingSignatures] = useState<PendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agencyRes, statsRes, signaturesRes] = await Promise.all([
        api.get('/agencies/me'),
        api.get('/agencies/stats'),
        api.get('/agencies/pending-signatures'),
      ]);
      setAgency(agencyRes.data);
      setStats(statsRes.data);
      setPendingSignatures(signaturesRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return '만료됨';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
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

  if (error) {
    return (
      <Layout>
        <div className="p-6 bg-red-50 rounded-xl text-red-600 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </Layout>
    );
  }

  const isKycPending = agency?.kycStatus === 'PENDING';
  const isKycApproved = agency?.kycStatus === 'APPROVED';
  const isKycNotSubmitted = agency?.kycStatus === 'NOT_SUBMITTED';

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">에이전시 대시보드</h1>
          <p className="text-slate-600 mt-1">{agency?.name}</p>
        </div>
        {isKycApproved && (
          <Link
            to="/agency/athletes/register"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            선수 등록
          </Link>
        )}
      </div>

      {/* KYC Status Alert */}
      {isKycNotSubmitted && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">KYC 인증이 필요합니다</p>
            <p className="text-sm text-amber-700 mt-1">
              선수를 등록하고 관리하려면 먼저 KYC 인증을 완료해야 합니다.
            </p>
            <Link
              to="/agency/kyc"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 mt-2"
            >
              KYC 인증하기
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {isKycPending && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">KYC 심사 중</p>
            <p className="text-sm text-blue-700 mt-1">
              제출하신 서류를 검토 중입니다. 승인까지 1~2 영업일이 소요될 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">소속 선수</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalAthletes}명</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">활성 슬롯</p>
                <p className="text-xl font-bold text-slate-900">{stats.activeSlots}개</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">서명 대기</p>
                <p className="text-xl font-bold text-slate-900">{stats.pendingContracts}건</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">총 계약금액</p>
                <p className="text-xl font-bold text-slate-900">
                  {stats.totalContractValue.toLocaleString()}원
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Signatures */}
      {pendingSignatures.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">서명 대기 계약</h2>
            <Link
              to="/agency/pending-signatures"
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              전체보기
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingSignatures.slice(0, 5).map((contract) => (
              <div
                key={contract.id}
                className={`p-4 flex items-center justify-between ${
                  contract.isUrgent ? 'bg-red-50' : contract.isExpired ? 'bg-slate-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      contract.isExpired
                        ? 'bg-slate-200'
                        : contract.isUrgent
                        ? 'bg-red-100'
                        : 'bg-amber-100'
                    }`}
                  >
                    {contract.isExpired ? (
                      <XCircle className="w-5 h-5 text-slate-500" />
                    ) : contract.isUrgent ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{contract.athlete.name}</p>
                    <p className="text-sm text-slate-500">
                      {contract.brand.name} · {contract.priceFinal.toLocaleString()}원
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-sm font-medium ${
                      contract.isExpired
                        ? 'text-slate-500'
                        : contract.isUrgent
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {formatTime(contract.remainingSeconds)}
                  </span>
                  {!contract.isExpired && (
                    <Link
                      to={`/agency/athletes/${contract.athlete.id}/contracts/${contract.id}/sign`}
                      className="btn btn-sm btn-primary"
                    >
                      서명하기
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Athletes List */}
      <div className="card">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">소속 선수</h2>
          <Link
            to="/agency/athletes"
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            전체보기
          </Link>
        </div>
        {agency?.athletes && agency.athletes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {agency.athletes.slice(0, 5).map((athlete) => (
              <Link
                key={athlete.id}
                to={`/agency/athletes/${athlete.id}`}
                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl overflow-hidden">
                    {athlete.profileImageUrl ? (
                      <img
                        src={athlete.profileImageUrl}
                        alt={athlete.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{athlete.name}</p>
                    <p className="text-sm text-slate-500">{athlete.tour}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      athlete.kycStatus === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : athlete.kycStatus === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {athlete.kycStatus === 'APPROVED'
                      ? 'KYC 승인'
                      : athlete.kycStatus === 'PENDING'
                      ? 'KYC 심사중'
                      : 'KYC 미제출'}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>등록된 선수가 없습니다</p>
            {isKycApproved && (
              <Link
                to="/agency/athletes/register"
                className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                첫 선수 등록하기
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
}

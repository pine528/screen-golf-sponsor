import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, ChevronRight, Search, AlertCircle, Link2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

interface Athlete {
  id: string;
  name: string;
  tour: string;
  kycStatus: string;
  profileImageUrl?: string;
  user: {
    email: string;
    isActive: boolean;
  };
  _count: {
    slotInstances: number;
    contracts: number;
  };
}

export function AgencyAthletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/agencies/athletes');
      setAthletes(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const filteredAthletes = athletes.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">소속 선수</h1>
          <p className="text-slate-600 mt-1">에이전시에서 관리하는 선수 목록입니다</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/agency/athletes/search" className="btn btn-secondary inline-flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            기존 선수 연결
          </Link>
          <Link to="/agency/athletes/register" className="btn btn-primary inline-flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            새 선수 등록
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="선수명 또는 이메일로 검색"
          className="input pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Athletes List */}
      {filteredAthletes.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {filteredAthletes.map((athlete) => (
            <Link
              key={athlete.id}
              to={`/agency/athletes/${athlete.id}`}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-200 rounded-xl overflow-hidden">
                  {athlete.profileImageUrl ? (
                    <img
                      src={athlete.profileImageUrl}
                      alt={athlete.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-7 h-7 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{athlete.name}</p>
                  <p className="text-sm text-slate-500">{athlete.user.email}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {athlete.tour} · 슬롯 {athlete._count.slotInstances}개 · 계약 {athlete._count.contracts}건
                  </p>
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
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-600 mb-4">
            {searchTerm ? '검색 결과가 없습니다' : '등록된 선수가 없습니다'}
          </p>
          {!searchTerm && (
            <Link
              to="/agency/athletes/register"
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              첫 선수 등록하기
            </Link>
          )}
        </div>
      )}
    </div>
    </Layout>
  );
}

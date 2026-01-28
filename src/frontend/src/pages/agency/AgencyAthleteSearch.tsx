import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Send, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

interface Athlete {
  id: string;
  name: string;
  tour: string;
  profileImageUrl?: string;
  kycStatus: string;
  email: string;
  hasAgency: boolean;
  hasPendingRequest: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function AgencyAthleteSearch() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTour, setSelectedTour] = useState('');
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [showMessageModal, setShowMessageModal] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAthletes = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.searchAvailableAthletes({
        q: searchTerm || undefined,
        tour: selectedTour || undefined,
        page,
        limit: 20,
      });
      setAthletes(res.data?.athletes || []);
      setPagination(res.data?.pagination || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '선수 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAthletes();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAthletes(1);
  };

  const handleSendRequest = async (athleteId: string) => {
    try {
      setSendingRequest(athleteId);
      await api.sendConnectionRequest(athleteId, requestMessage || undefined);
      setSuccessMessage('연결 요청을 보냈습니다');
      setShowMessageModal(null);
      setRequestMessage('');
      // 목록 새로고침
      fetchAthletes(pagination?.page || 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '요청 전송에 실패했습니다');
    } finally {
      setSendingRequest(null);
    }
  };

  const openRequestModal = (athleteId: string) => {
    setShowMessageModal(athleteId);
    setRequestMessage('');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/agency/athletes"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              소속 선수 목록
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">선수 검색 및 연결 요청</h1>
            <p className="text-slate-600 mt-1">
              에이전시가 없는 선수를 검색하여 연결 요청을 보낼 수 있습니다
            </p>
          </div>
          <Link
            to="/agency/requests"
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            보낸 요청 관리
          </Link>
        </div>

        {/* Success/Error Messages */}
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
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              &times;
            </button>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="선수명 또는 이메일로 검색"
                className="input pl-12 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="input w-full md:w-48"
              value={selectedTour}
              onChange={(e) => setSelectedTour(e.target.value)}
            >
              <option value="">전체 투어</option>
              <option value="GTOUR">GTOUR</option>
              <option value="WGTOUR">WGTOUR</option>
              <option value="OTHER">기타</option>
            </select>
            <button type="submit" className="btn btn-primary">
              검색
            </button>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : athletes.length > 0 ? (
          <>
            <div className="card divide-y divide-slate-100">
              {athletes.map((athlete) => (
                <div
                  key={athlete.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0">
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
                      <p className="text-sm text-slate-500">{athlete.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {athlete.tour}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            athlete.kycStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {athlete.kycStatus === 'APPROVED' ? 'KYC 승인' : 'KYC 미승인'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {athlete.hasPendingRequest ? (
                      <span className="px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg">
                        요청 대기중
                      </span>
                    ) : (
                      <button
                        onClick={() => openRequestModal(athlete.id)}
                        className="btn btn-primary text-sm"
                        disabled={sendingRequest === athlete.id}
                      >
                        {sendingRequest === athlete.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            연결 요청
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => fetchAthletes(page)}
                    className={`px-3 py-1 rounded ${
                      page === pagination.page
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">
              {searchTerm || selectedTour
                ? '검색 조건에 맞는 선수가 없습니다'
                : '연결 가능한 선수가 없습니다'}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              에이전시 소속이 없고 KYC 승인된 선수만 표시됩니다
            </p>
          </div>
        )}
      </div>

      {/* Request Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">연결 요청 보내기</h3>
            <div className="mb-4">
              <label className="label">메시지 (선택)</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="선수에게 전달할 메시지를 입력하세요"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMessageModal(null);
                  setRequestMessage('');
                }}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={() => handleSendRequest(showMessageModal)}
                className="btn btn-primary flex-1"
                disabled={sendingRequest === showMessageModal}
              >
                {sendingRequest === showMessageModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '요청 보내기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

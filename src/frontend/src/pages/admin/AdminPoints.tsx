import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { Coins, Search, Gift, User, Loader2 } from 'lucide-react';

interface FanUser {
  id: string;
  email: string;
  fan?: {
    nickname: string;
  };
  pointWallet?: {
    balance: number | string;
  };
}

export default function AdminPoints() {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<FanUser | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [showModal, setShowModal] = useState(false);

  // 팬 사용자 검색
  const { data: searchResult, isLoading: searching, refetch: searchUsers } = useQuery({
    queryKey: ['adminSearchFans', searchEmail],
    queryFn: async () => {
      if (!searchEmail.trim()) return [];
      const res = await api.getAdminFans({ email: searchEmail });
      return res.data || [];
    },
    enabled: false,
  });

  // 포인트 지급
  const grantMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: number; reasonText?: string }) => {
      return api.adminGrantPoints(data);
    },
    onSuccess: () => {
      alert('포인트가 지급되었습니다.');
      setShowModal(false);
      setAmount('');
      setReason('');
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['adminSearchFans'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || '포인트 지급 실패');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEmail.trim()) {
      searchUsers();
    }
  };

  const openGrantModal = (user: FanUser) => {
    setSelectedUser(user);
    setAmount('');
    setReason('');
    setShowModal(true);
  };

  const handleGrant = () => {
    if (!selectedUser || !amount) return;
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('올바른 금액을 입력하세요.');
      return;
    }
    grantMutation.mutate({
      userId: selectedUser.id,
      amount: amountNum,
      reasonText: reason || undefined,
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">포인트 관리</h1>
              <p className="text-sm text-slate-500">팬 사용자에게 포인트를 지급합니다</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">사용자 검색</h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="이메일로 검색..."
                className="input pl-10"
              />
            </div>
            <button type="submit" disabled={searching} className="btn btn-primary">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
            </button>
          </form>
        </div>

        {/* Search Results */}
        {searchResult && searchResult.length > 0 && (
          <div className="card overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    사용자
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    닉네임
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    현재 포인트
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {searchResult.map((user: FanUser) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-sm text-slate-900">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.fan?.nickname || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-amber-600">
                        {Number(user.pointWallet?.balance || 0).toLocaleString()}P
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openGrantModal(user)}
                        className="btn btn-ghost text-emerald-600 hover:text-emerald-700 p-2"
                        title="포인트 지급"
                      >
                        <Gift className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {searchResult && searchResult.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-slate-500">검색 결과가 없습니다.</p>
          </div>
        )}

        {/* Grant Modal */}
        {showModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-md animate-slide-up">
              <h2 className="text-xl font-bold text-slate-900 mb-4">포인트 지급</h2>

              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500">대상 사용자</p>
                <p className="font-medium text-slate-900">{selectedUser.email}</p>
                {selectedUser.fan?.nickname && (
                  <p className="text-sm text-slate-600">({selectedUser.fan.nickname})</p>
                )}
                <p className="text-sm text-amber-600 mt-1">
                  현재: {Number(selectedUser.pointWallet?.balance || 0).toLocaleString()}P
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">지급 금액 (P) *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                    placeholder="예: 100"
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">사유 (선택)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input"
                    placeholder="예: 이벤트 보상"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleGrant}
                  disabled={grantMutation.isPending || !amount}
                  className="btn btn-primary"
                >
                  {grantMutation.isPending ? '처리 중...' : '지급'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

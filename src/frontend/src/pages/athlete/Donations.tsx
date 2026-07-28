import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Heart,
  User,
  EyeOff,
  Loader2,
  MessageCircle,
  Calendar,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Donation {
  id: string;
  amount: string;
  platformFee: string;
  netAmount: string;
  message?: string;
  isAnonymous: boolean;
  createdAt: string;
  donor: {
    nickname: string;
    avatarUrl?: string;
  };
}

interface DonationsResponse {
  donations: Donation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalAmount: string;
    totalCount: number;
  };
}

export default function AthleteDonations() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery<{ success: boolean; data: DonationsResponse }>({
    queryKey: ['receivedDonations', page],
    queryFn: () => api.getReceivedDonations({ page, limit }),
  });

  const donationsData = data?.data;
  const donations = donationsData?.donations || [];
  const pagination = donationsData?.pagination;
  const summary = donationsData?.summary;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatAmount = (amount: string | number) => {
    return Number(amount).toLocaleString();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-7 h-7 text-pink-500" />
            <h1 className="text-2xl font-bold">받은 후원</h1>
          </div>
          <p className="text-gray-600">
            팬들이 보내주신 후원 내역을 확인하세요
          </p>
        </div>

        {/* Summary Card */}
        {summary && (
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <TrendingUp className="w-6 h-6 text-pink-500" />
              </div>
              <div>
                <div className="text-sm text-gray-600">총 후원 받은 금액</div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatAmount(summary.totalAmount)}P
                </div>
                <div className="text-sm text-gray-500">
                  총 {summary.totalCount}회 후원
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500">
            후원 내역을 불러오는데 실패했습니다.
          </div>
        ) : donations.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">아직 받은 후원이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">
              팬들의 응원을 기다려주세요!
            </p>
          </div>
        ) : (
          <>
            {/* Donations List */}
            <div className="space-y-3">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {donation.isAnonymous ? (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <EyeOff className="w-6 h-6 text-gray-400" />
                        </div>
                      ) : donation.donor.avatarUrl ? (
                        <img
                          src={donation.donor.avatarUrl}
                          alt={donation.donor.nickname}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                          <User className="w-6 h-6 text-green-600" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {donation.isAnonymous ? '익명' : donation.donor.nickname}
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          +{formatAmount(donation.netAmount)}P
                        </span>
                      </div>

                      {donation.message && (
                        <div className="flex items-start gap-2 text-gray-600 text-sm bg-gray-50 rounded-lg p-2 mb-2">
                          <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{donation.message}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(donation.createdAt)}</span>
                        </div>
                        <span>
                          총액: {formatAmount(donation.amount)}P (수수료: {formatAmount(donation.platformFee)}P)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

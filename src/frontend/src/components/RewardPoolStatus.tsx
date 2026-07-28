import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface RewardPoolData {
  balanceEp: string;
  reservedEp: string;
  availableTodayEp: string;
  multiplierM: number;
  availableEp: string;
  effectiveMicroReward: number;
  updatedAt: string;
}

interface RewardPoolStatusProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export default function RewardPoolStatus({ compact = false, showDetails = true, className = '' }: RewardPoolStatusProps) {
  const [pool, setPool] = useState<RewardPoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoolStatus = async () => {
      try {
        const response = await api.getRewardPoolStatus();
        if (response.success && response.data) {
          setPool(response.data);
        }
      } catch (err) {
        setError('리워드풀 상태를 불러오지 못했습니다');
        console.error('Failed to fetch reward pool status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPoolStatus();
    // 30초마다 갱신
    const interval = setInterval(fetchPoolStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (value: string | number) => {
    return Number(value).toLocaleString();
  };

  const getMultiplierColor = (m: number) => {
    if (m >= 0.8) return 'text-green-600 bg-green-100';
    if (m >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${compact ? 'p-2' : 'p-4'} bg-gray-100 rounded-lg ${className}`}>
        <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-16"></div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-red-50 text-red-600 rounded-lg ${className}`}>
        {error || '데이터 없음'}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 ${className}`}>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">배수</span>
          <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${getMultiplierColor(pool.multiplierM)}`}>
            x{pool.multiplierM.toFixed(2)}
          </span>
        </div>
        <div className="border-l border-purple-200 pl-3">
          <span className="text-xs text-gray-500">참여 보상</span>
          <span className="ml-1 font-semibold text-purple-700">{pool.effectiveMicroReward} EP</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl border border-purple-200 shadow-sm ${className}`}>
      <div className="p-4 border-b border-purple-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          리워드풀 상태
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 배수 & 참여 보상 */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100">
          <div>
            <span className="text-sm text-gray-500 block">현재 배수</span>
            <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${getMultiplierColor(pool.multiplierM)}`}>
              x{pool.multiplierM.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 block">참여 시 보상</span>
            <span className="text-2xl font-bold text-purple-700">
              {pool.effectiveMicroReward} <span className="text-sm">EP</span>
            </span>
          </div>
        </div>

        {showDetails && (
          <>
            {/* 잔액 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <span className="text-xs text-gray-500 block">총 잔액</span>
                <span className="text-lg font-semibold text-gray-800">
                  {formatNumber(pool.balanceEp)} EP
                </span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <span className="text-xs text-gray-500 block">예약됨</span>
                <span className="text-lg font-semibold text-orange-600">
                  {formatNumber(pool.reservedEp)} EP
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <span className="text-xs text-gray-500 block">가용 잔액</span>
                <span className="text-lg font-semibold text-green-600">
                  {formatNumber(pool.availableEp)} EP
                </span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <span className="text-xs text-gray-500 block">오늘 가용</span>
                <span className="text-lg font-semibold text-blue-600">
                  {formatNumber(pool.availableTodayEp)} EP
                </span>
              </div>
            </div>

            {/* 설명 */}
            <div className="text-xs text-gray-500 bg-white/50 rounded p-2">
              <p className="flex items-start gap-1">
                <span className="text-purple-500">*</span>
                투표에 참여하면 즉시 <strong>{pool.effectiveMicroReward} EP</strong>를 받습니다.
              </p>
              <p className="flex items-start gap-1 mt-1">
                <span className="text-purple-500">*</span>
                정답 시 1/n 균등 분배 (최대 50,000 EP)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

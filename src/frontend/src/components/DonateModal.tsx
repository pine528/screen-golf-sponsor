import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  X,
  Heart,
  Loader2,
  AlertCircle,
  Info,
  User,
  EyeOff,
} from 'lucide-react';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: {
    id: string;
    name: string;
    tour?: string;
    profileImageUrl?: string;
  };
}

const PLATFORM_FEE_RATE = 0.02; // 2%
const MIN_DONATION = 100;

export function DonateModal({ isOpen, onClose, athlete }: DonateModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(1000);
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // 수수료 계산
  const feeBreakdown = useMemo(() => {
    const platformFee = Math.floor(amount * PLATFORM_FEE_RATE);
    const netAmount = amount - platformFee;
    return { platformFee, netAmount };
  }, [amount]);

  const donateMutation = useMutation({
    mutationFn: async () => {
      return await api.createDonation({
        athleteId: athlete.id,
        amount,
        message: message.trim() || undefined,
        isAnonymous,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDonations'] });
      queryClient.invalidateQueries({ queryKey: ['pointBalance'] });
      onClose();
      // 성공 알림은 부모 컴포넌트에서 처리
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < MIN_DONATION) return;
    donateMutation.mutate();
  };

  const presetAmounts = [1000, 5000, 10000, 50000, 100000];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-semibold">선수 후원하기</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 선수 정보 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {athlete.profileImageUrl ? (
              <img
                src={athlete.profileImageUrl}
                alt={athlete.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <div className="font-medium">{athlete.name}</div>
              {athlete.tour && (
                <div className="text-sm text-gray-500">{athlete.tour}</div>
              )}
            </div>
          </div>

          {/* 금액 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              후원 금액
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    amount === preset
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.toLocaleString()}P
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={MIN_DONATION}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="직접 입력"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                P
              </span>
            </div>
            {amount < MIN_DONATION && (
              <p className="mt-1 text-sm text-red-500">
                최소 {MIN_DONATION.toLocaleString()}P 이상 입력해주세요
              </p>
            )}
          </div>

          {/* 수수료 안내 */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <div className="text-blue-800 font-medium mb-1">수수료 안내</div>
                <div className="text-blue-700 space-y-0.5">
                  <div className="flex justify-between">
                    <span>후원 금액</span>
                    <span>{amount.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between">
                    <span>플랫폼 수수료 (2%)</span>
                    <span>-{feeBreakdown.platformFee.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t border-blue-200">
                    <span>선수 수령액</span>
                    <span className="text-green-600">
                      {feeBreakdown.netAmount.toLocaleString()}P
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 응원 메시지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              응원 메시지 (선택)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              placeholder="선수에게 응원 메시지를 남겨보세요"
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {message.length}/200
            </div>
          </div>

          {/* 익명 옵션 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <EyeOff className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">익명으로 후원하기</span>
          </label>

          {/* 에러 메시지 */}
          {donateMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span className="text-sm">
                {(donateMutation.error as any)?.response?.data?.message ||
                  '후원 처리 중 오류가 발생했습니다.'}
              </span>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={amount < MIN_DONATION || donateMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {donateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  {amount.toLocaleString()}P 후원하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

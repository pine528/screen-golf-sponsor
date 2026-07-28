import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Vote,
  Loader2,
  AlertCircle,
  Info,
  Coins,
  Image,
  Link as LinkIcon,
  MessageSquare,
} from 'lucide-react';

export default function BrandVoteCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 기본 투표 정보
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [entryFeePoints, setEntryFeePoints] = useState(0);
  const [winnersCount, setWinnersCount] = useState(1);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // 스폰서 정보
  const [sponsorContribution, setSponsorContribution] = useState(0);
  const [sponsorBannerUrl, setSponsorBannerUrl] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [sponsorLinkUrl, setSponsorLinkUrl] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const filteredOptions = options.filter((o) => o.trim() !== '');
      return await api.createBrandVote({
        title,
        question,
        options: filteredOptions,
        entryFeePoints,
        winnersCount,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        sponsorContribution: sponsorContribution || undefined,
        sponsorBannerUrl: sponsorBannerUrl || undefined,
        sponsorLogoUrl: sponsorLogoUrl || undefined,
        sponsorMessage: sponsorMessage || undefined,
        sponsorLinkUrl: sponsorLinkUrl || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandCreatedVotes'] });
      navigate('/brand/votes');
    },
  });

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const isValid =
    title.trim() &&
    question.trim() &&
    options.filter((o) => o.trim()).length >= 2 &&
    startsAt &&
    endsAt &&
    new Date(startsAt) < new Date(endsAt);

  const totalPrizePool = sponsorContribution;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/brand/votes')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>내 투표 목록</span>
        </button>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
              <Vote className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">브랜드 투표 만들기</h1>
              <p className="text-sm text-slate-500">팬들과 함께하는 브랜드 마케팅 투표를 만들어보세요</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-sky-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-500 mt-0.5" />
              <div className="text-sm text-sky-700">
                <p className="font-medium mb-1">브랜드 투표 특징</p>
                <ul className="list-disc list-inside space-y-1 text-sky-600">
                  <li>투표 생성 시 스폰서 기여금이 상금 풀에 자동 추가됩니다</li>
                  <li>배너, 로고, 메시지로 브랜드를 노출할 수 있습니다</li>
                  <li>관리자 승인 후 투표가 시작됩니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                투표 제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input w-full"
                placeholder="예: OOO 제품은 어디서 판매되고 있을까요?"
                maxLength={200}
              />
            </div>

            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                질문 *
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="input w-full min-h-[80px]"
                placeholder="참여자들에게 물어볼 질문을 입력하세요"
                maxLength={500}
              />
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                선택지 * (2~6개)
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="input flex-1"
                      placeholder={`옵션 ${index + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
                >
                  <Plus className="w-4 h-4" />
                  옵션 추가
                </button>
              )}
            </div>

            {/* Entry Fee & Winners */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  참가비 (P)
                </label>
                <input
                  type="number"
                  value={entryFeePoints}
                  onChange={(e) => setEntryFeePoints(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input w-full"
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">0 = 무료 참가</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  당첨자 수
                </label>
                <input
                  type="number"
                  value={winnersCount}
                  onChange={(e) => setWinnersCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input w-full"
                  min={1}
                />
                <p className="text-xs text-slate-500 mt-1">정답자 중 랜덤 추첨</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  시작 시간 *
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  종료 시간 *
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            {/* Sponsor Section */}
            <div className="border-t border-slate-200 pt-5 mt-5">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                스폰서 설정
              </h3>

              {/* Sponsor Contribution */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  스폰서 기여금 (P)
                </label>
                <input
                  type="number"
                  value={sponsorContribution}
                  onChange={(e) => setSponsorContribution(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input w-full"
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">
                  이 금액이 상금 풀에 추가됩니다 (내 포인트에서 차감)
                </p>
              </div>

              {totalPrizePool > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-700">
                    <span className="font-medium">예상 상금 풀:</span>{' '}
                    <span className="text-amber-600 font-bold">{totalPrizePool.toLocaleString()}P</span>
                    <span className="text-amber-600"> (참가비 수익 별도)</span>
                  </p>
                </div>
              )}

              {/* Sponsor Banner */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Image className="w-4 h-4 inline mr-1" />
                  배너 이미지 URL
                </label>
                <input
                  type="url"
                  value={sponsorBannerUrl}
                  onChange={(e) => setSponsorBannerUrl(e.target.value)}
                  className="input w-full"
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              {/* Sponsor Logo */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Image className="w-4 h-4 inline mr-1" />
                  로고 이미지 URL
                </label>
                <input
                  type="url"
                  value={sponsorLogoUrl}
                  onChange={(e) => setSponsorLogoUrl(e.target.value)}
                  className="input w-full"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              {/* Sponsor Message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  스폰서 메시지
                </label>
                <input
                  type="text"
                  value={sponsorMessage}
                  onChange={(e) => setSponsorMessage(e.target.value)}
                  className="input w-full"
                  placeholder="브랜드를 소개하는 짧은 메시지"
                  maxLength={200}
                />
              </div>

              {/* Sponsor Link */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  링크 URL
                </label>
                <input
                  type="url"
                  value={sponsorLinkUrl}
                  onChange={(e) => setSponsorLinkUrl(e.target.value)}
                  className="input w-full"
                  placeholder="https://yourbrand.com"
                />
              </div>
            </div>

            {/* Error Message */}
            {createMutation.isError && (
              <div className="bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">투표 생성에 실패했습니다</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  {(createMutation.error as any)?.response?.data?.message ||
                    '다시 시도해주세요'}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={() => createMutation.mutate()}
              disabled={!isValid || createMutation.isPending}
              className="btn btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  생성 중...
                </>
              ) : (
                <>
                  <Vote className="w-4 h-4 mr-2" />
                  브랜드 투표 만들기
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              생성 후 "제출"을 해야 관리자 승인을 받을 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

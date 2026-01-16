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
} from 'lucide-react';

export default function FanVoteCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [entryFeePoints, setEntryFeePoints] = useState(0);
  const [winnersCount, setWinnersCount] = useState(1);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const filteredOptions = options.filter((o) => o.trim() !== '');
      return await api.createFanVote({
        title,
        question,
        options: filteredOptions,
        entryFeePoints,
        winnersCount,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCreatedFanVotes'] });
      navigate('/fan-votes/my');
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/fan-votes/my')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>내 투표 목록</span>
        </button>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Vote className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">투표 만들기</h1>
              <p className="text-sm text-slate-500">팬들과 함께 즐길 투표를 만들어보세요</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">투표 진행 방식</p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>투표 생성 후 "제출"하면 관리자 승인 대기 상태가 됩니다</li>
                  <li>승인되면 자동으로 시작 시간에 투표가 오픈됩니다</li>
                  <li>종료 후 관리자가 정답을 선택하면 당첨자에게 포인트가 지급됩니다</li>
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
                placeholder="예: 이번 주 우승자는?"
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
                  className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
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
                  투표 만들기
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Layout } from '../../components/Layout';

interface Template {
  code: string;
  name: string;
  baseBudget: number;
  difficulty: number;
}

interface VoteLimits {
  minSeedEp: number;
  maxSeedEp: number;
  maxDailyCreates: number;
}

interface Option {
  id: string;
  label: string;
}

export default function VoteCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [limits, setLimits] = useState<VoteLimits | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);

  // Form state
  const [templateCode, setTemplateCode] = useState<string>('T1-YesNo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<Option[]>([
    { id: '1', label: '' },
    { id: '2', label: '' },
  ]);
  const [seedAmountEp, setSeedAmountEp] = useState<number>(10000);
  const [closeAt, setCloseAt] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [templatesRes, limitsRes, balanceRes] = await Promise.all([
        api.getVoteTemplates(),
        api.getUserVoteLimits(),
        api.getMyPointBalance(),
      ]);

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
      }
      if (limitsRes.success && limitsRes.data) {
        setLimits(limitsRes.data);
        setSeedAmountEp(limitsRes.data.minSeedEp);
      }
      if (balanceRes.success) {
        setUserBalance(Number(balanceRes.data.balance));
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, { id: String(options.length + 1), label: '' }]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, label: string) => {
    const newOptions = [...options];
    newOptions[index].label = label;
    setOptions(newOptions);
  };

  const getMinCloseAt = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('제목을 입력해주세요');
      return;
    }

    if (!closeAt) {
      alert('마감일을 선택해주세요');
      return;
    }

    if (templateCode !== 'T1-YesNo') {
      const filledOptions = options.filter(o => o.label.trim());
      if (filledOptions.length < 2) {
        alert('최소 2개 이상의 선택지를 입력해주세요');
        return;
      }
    }

    if (seedAmountEp > userBalance) {
      alert('포인트 잔액이 부족합니다');
      return;
    }

    setLoading(true);
    try {
      const response = await api.createUserVote({
        templateCode,
        title: title.trim(),
        description: description.trim() || undefined,
        options: templateCode === 'T1-YesNo'
          ? [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]
          : options.filter(o => o.label.trim()),
        closeAt: new Date(closeAt).toISOString(),
        seedAmountEp,
      });

      if (response.success) {
        alert('투표가 생성되었습니다!');
        navigate(`/votes/${response.data.id}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '투표 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">투표 만들기</h1>
        <p className="text-gray-600 mb-6">
          본인 포인트로 투표를 만들고, 정답자에게 보상을 나눠주세요!
        </p>

        {/* 잔액 표시 */}
        <div className="bg-purple-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">내 포인트 잔액</span>
            <span className="text-xl font-bold text-purple-600">
              {userBalance.toLocaleString()} EP
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 템플릿 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              투표 유형
            </label>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.code}
                  type="button"
                  onClick={() => setTemplateCode(template.code)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    templateCode === template.code
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-medium text-gray-800">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    난이도 x{template.difficulty}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 오늘 경기 승자는?"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              maxLength={100}
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="투표에 대한 추가 설명을 입력하세요"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* 선택지 (T1-YesNo 제외) */}
          {templateCode !== 'T1-YesNo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                선택지 *
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={option.id} className="flex gap-2">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`선택지 ${index + 1}`}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={50}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-300 hover:text-purple-500"
                  >
                    + 선택지 추가
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 마감일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              마감일 *
            </label>
            <input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              min={getMinCloseAt()}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              최소 1시간 이후로 설정해주세요
            </p>
          </div>

          {/* 시드머니 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시드머니 (보상금) *
            </label>
            <div className="relative">
              <input
                type="number"
                value={seedAmountEp}
                onChange={(e) => setSeedAmountEp(Number(e.target.value))}
                min={limits?.minSeedEp || 10000}
                max={Math.min(limits?.maxSeedEp || 500000, userBalance)}
                step={1000}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                EP
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>최소 {limits?.minSeedEp?.toLocaleString() || '10,000'} EP</span>
              <span>최대 {Math.min(limits?.maxSeedEp || 500000, userBalance).toLocaleString()} EP</span>
            </div>
          </div>

          {/* 예상 보상 안내 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium text-gray-800 mb-2">보상 규칙</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>- 정답자 전원에게 1/N 균등 분배</li>
              <li>- 1인당 최대 50,000 EP까지 수령 가능</li>
              <li>- 정답자가 없으면 시드머니 전액 반환</li>
              <li>- 참여자가 없을 경우 취소 가능 (전액 환불)</li>
            </ul>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || seedAmountEp > userBalance}
            className="w-full py-4 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '생성 중...' : `${seedAmountEp.toLocaleString()} EP로 투표 만들기`}
          </button>

          {seedAmountEp > userBalance && (
            <p className="text-center text-red-500 text-sm">
              포인트 잔액이 부족합니다
            </p>
          )}
        </form>
      </div>
    </Layout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Square, Award, Trash2, Vote } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { cn } from '../../utils';

const statusConfig: Record<string, { label: string; class: string }> = {
  DRAFT: { label: '초안', class: 'badge-info' },
  ACTIVE: { label: '진행중', class: 'badge-success' },
  CLOSED: { label: '마감', class: 'badge-warning' },
  SETTLED: { label: '정산완료', class: 'badge-info' },
};

const questionTypeLabels: Record<string, string> = {
  PREDICTION: '경기 예측',
  QUIZ: '퀴즈',
  POLL: '여론조사',
};

export default function AdminVoteEvents() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedCorrectOption, setSelectedCorrectOption] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questionType: 'PREDICTION' as 'PREDICTION' | 'QUIZ' | 'POLL',
    question: '',
    options: [
      { id: 'opt1', label: '' },
      { id: 'opt2', label: '' },
    ],
    pointsPerCorrect: '100',
    startAt: '',
    endAt: '',
  });
  const [error, setError] = useState('');

  const { data: voteEventsData, isLoading } = useQuery({
    queryKey: ['voteEvents'],
    queryFn: () => api.getVoteEvents(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createVoteEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvents'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '생성 실패');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateVoteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvents'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.closeVoteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvents'] });
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, correctOptionId }: { id: string; correctOptionId: string }) =>
      api.settleVoteEvent(id, correctOptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvents'] });
      setShowSettleModal(false);
      setSelectedEvent(null);
      setSelectedCorrectOption('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || '정산 실패');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteVoteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteEvents'] });
    },
  });

  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      questionType: 'PREDICTION',
      question: '',
      options: [
        { id: 'opt1', label: '' },
        { id: 'opt2', label: '' },
      ],
      pointsPerCorrect: '100',
      startAt: '',
      endAt: '',
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      questionType: 'PREDICTION',
      question: '',
      options: [
        { id: 'opt1', label: '' },
        { id: 'opt2', label: '' },
      ],
      pointsPerCorrect: '100',
      startAt: '',
      endAt: '',
    });
    setError('');
  };

  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData({
        ...formData,
        options: [...formData.options, { id: `opt${formData.options.length + 1}`, label: '' }],
      });
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData({ ...formData, options: newOptions });
    }
  };

  const updateOption = (index: number, label: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], label };
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title: formData.title,
      description: formData.description || undefined,
      questionType: formData.questionType,
      question: formData.question,
      options: formData.options.filter((o) => o.label.trim()),
      pointsPerCorrect: parseInt(formData.pointsPerCorrect),
      startAt: formData.startAt,
      endAt: formData.endAt,
    };

    createMutation.mutate(data);
  };

  const openSettleModal = (event: any) => {
    setSelectedEvent(event);
    setSelectedCorrectOption('');
    setShowSettleModal(true);
  };

  const handleSettle = () => {
    if (!selectedCorrectOption) {
      alert('정답을 선택해주세요.');
      return;
    }
    settleMutation.mutate({
      id: selectedEvent.id,
      correctOptionId: selectedCorrectOption,
    });
  };

  const voteEvents = voteEventsData?.data || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">투표 이벤트 관리</h1>
            <p className="text-slate-600 mt-1">투표 이벤트를 생성하고 관리하세요</p>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            새 투표 이벤트
          </button>
        </div>

        {voteEvents.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Vote className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">등록된 투표 이벤트가 없습니다</h3>
            <p className="text-slate-500 mb-6">첫 번째 투표 이벤트를 만들어보세요</p>
            <button onClick={openCreateModal} className="btn btn-primary">
              첫 투표 이벤트 만들기
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    참여자
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    기간
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {voteEvents.map((event: any) => (
                  <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{event.title}</p>
                        <p className="text-sm text-slate-500 truncate max-w-xs">{event.question}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {questionTypeLabels[event.questionType] || event.questionType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {event._count?.votes || 0}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>
                        <p>{new Date(event.startAt).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-400">~ {new Date(event.endAt).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('badge', statusConfig[event.status]?.class || 'badge-info')}>
                        {statusConfig[event.status]?.label || event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {event.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => activateMutation.mutate(event.id)}
                              className="btn btn-ghost text-emerald-600 hover:text-emerald-700 p-2"
                              title="활성화"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('정말 삭제하시겠습니까?')) {
                                  deleteMutation.mutate(event.id);
                                }
                              }}
                              className="btn btn-ghost text-red-600 hover:text-red-700 p-2"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {event.status === 'ACTIVE' && (
                          <button
                            onClick={() => closeMutation.mutate(event.id)}
                            className="btn btn-ghost text-amber-600 hover:text-amber-700 p-2"
                            title="마감"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                        {event.status === 'CLOSED' && (
                          <button
                            onClick={() => openSettleModal(event)}
                            className="btn btn-ghost text-sky-600 hover:text-sky-700 p-2"
                            title="정산"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
              <h2 className="text-xl font-bold text-slate-900 mb-4">새 투표 이벤트</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">제목 *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="label">유형 *</label>
                  <select
                    value={formData.questionType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        questionType: e.target.value as 'PREDICTION' | 'QUIZ' | 'POLL',
                      })
                    }
                    className="input"
                  >
                    <option value="PREDICTION">경기 예측</option>
                    <option value="QUIZ">퀴즈</option>
                    <option value="POLL">여론조사</option>
                  </select>
                </div>

                <div>
                  <label className="label">질문 *</label>
                  <input
                    type="text"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="input"
                    required
                    placeholder="예: 이번 대회 우승자는?"
                  />
                </div>

                <div>
                  <label className="label">선택지 *</label>
                  {formData.options.map((option, index) => (
                    <div key={option.id} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="input flex-1"
                        placeholder={`선택지 ${index + 1}`}
                        required
                      />
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="btn btn-ghost text-red-600 px-3"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {formData.options.length < 6 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-emerald-600 text-sm hover:underline"
                    >
                      + 선택지 추가
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">정답 포인트 *</label>
                  <input
                    type="number"
                    value={formData.pointsPerCorrect}
                    onChange={(e) => setFormData({ ...formData, pointsPerCorrect: e.target.value })}
                    className="input"
                    required
                    min="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">시작 시간 *</label>
                    <input
                      type="datetime-local"
                      value={formData.startAt}
                      onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">종료 시간 *</label>
                    <input
                      type="datetime-local"
                      value={formData.endAt}
                      onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary">
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createMutation.isPending ? '생성 중...' : '생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settle Modal */}
        {showSettleModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-md animate-slide-up">
              <h2 className="text-xl font-bold text-slate-900 mb-4">정산하기</h2>
              <p className="text-slate-600 mb-4">정답을 선택하고 포인트를 지급합니다.</p>
              <p className="font-medium text-slate-900 mb-4">{selectedEvent.question}</p>

              <div className="space-y-2 mb-6">
                {(selectedEvent.options as { id: string; label: string }[]).map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex items-center p-4 border rounded-xl cursor-pointer transition-all',
                      selectedCorrectOption === option.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      value={option.id}
                      checked={selectedCorrectOption === option.id}
                      onChange={(e) => setSelectedCorrectOption(e.target.value)}
                      className="mr-3 accent-emerald-500"
                    />
                    <span className="text-slate-900">{option.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSettleModal(false);
                    setSelectedEvent(null);
                    setSelectedCorrectOption('');
                  }}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleSettle}
                  disabled={settleMutation.isPending}
                  className="btn btn-primary"
                >
                  {settleMutation.isPending ? '처리 중...' : '정산 완료'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

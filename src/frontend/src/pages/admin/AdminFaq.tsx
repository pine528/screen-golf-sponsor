import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  HelpCircle,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  Save,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  User,
  Gavel,
  FileText,
  CreditCard,
  Coins,
  ShoppingBag,
  Users,
  Building2,
  GripVertical,
} from 'lucide-react';
import { cn } from '../../utils';

type FaqCategory =
  | 'GENERAL'
  | 'ACCOUNT'
  | 'BIDDING'
  | 'CONTRACT'
  | 'PAYMENT'
  | 'POINTS'
  | 'SHOP'
  | 'ATHLETE'
  | 'BRAND';

interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  orderIndex: number;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const categoryConfig: Record<FaqCategory, { label: string; icon: React.ElementType; color: string }> = {
  GENERAL: { label: '일반', icon: BookOpen, color: 'bg-slate-100 text-slate-600' },
  ACCOUNT: { label: '계정', icon: User, color: 'bg-blue-100 text-blue-600' },
  BIDDING: { label: '입찰', icon: Gavel, color: 'bg-violet-100 text-violet-600' },
  CONTRACT: { label: '계약', icon: FileText, color: 'bg-emerald-100 text-emerald-600' },
  PAYMENT: { label: '결제', icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
  POINTS: { label: '포인트', icon: Coins, color: 'bg-yellow-100 text-yellow-600' },
  SHOP: { label: '포인트샵', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
  ATHLETE: { label: '선수', icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  BRAND: { label: '브랜드', icon: Building2, color: 'bg-orange-100 text-orange-600' },
};

const allCategories: FaqCategory[] = [
  'GENERAL',
  'ACCOUNT',
  'BIDDING',
  'CONTRACT',
  'PAYMENT',
  'POINTS',
  'SHOP',
  'ATHLETE',
  'BRAND',
];

interface FormData {
  category: FaqCategory;
  question: string;
  answer: string;
  isPublished: boolean;
}

const initialFormData: FormData = {
  category: 'GENERAL',
  question: '',
  answer: '',
  isPublished: true,
};

export function AdminFaq() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory | ''>('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch FAQs
  const { data: faqs, isLoading } = useQuery({
    queryKey: ['adminFaqs', selectedCategory, publishedFilter, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (selectedCategory) params.category = selectedCategory;
      if (publishedFilter !== 'all') params.isPublished = publishedFilter === 'published';
      if (searchQuery) params.q = searchQuery;
      const res = await api.getAdminFaqs(params);
      return res.data || [];
    },
  });

  // Create FAQ mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.createFaq(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFaqs'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
      showSuccess('FAQ가 생성되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || 'FAQ 생성에 실패했습니다');
    },
  });

  // Update FAQ mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) => api.updateFaq(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFaqs'] });
      setIsModalOpen(false);
      setEditingFaq(null);
      setFormData(initialFormData);
      showSuccess('FAQ가 수정되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || 'FAQ 수정에 실패했습니다');
    },
  });

  // Delete FAQ mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFaq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFaqs'] });
      showSuccess('FAQ가 삭제되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || 'FAQ 삭제에 실패했습니다');
    },
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: (id: string) => api.toggleFaqPublish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFaqs'] });
      showSuccess('발행 상태가 변경되었습니다');
    },
    onError: (err: any) => {
      showError(err.response?.data?.message || '상태 변경에 실패했습니다');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleOpenModal = (faq?: FaqItem) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        isPublished: faq.isPublished,
      });
    } else {
      setEditingFaq(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFaq(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('정말로 이 FAQ를 삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">FAQ 관리</h1>
            <p className="text-slate-600 mt-1">자주 묻는 질문을 관리합니다</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            FAQ 추가
          </button>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">{errorMessage}</span>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="label">카테고리</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as FaqCategory | '')}
                className="input"
              >
                <option value="">전체</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryConfig[cat].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Published Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="label">발행 상태</label>
              <select
                value={publishedFilter}
                onChange={(e) => setPublishedFilter(e.target.value as 'all' | 'published' | 'unpublished')}
                className="input"
              >
                <option value="all">전체</option>
                <option value="published">발행됨</option>
                <option value="unpublished">미발행</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <label className="label">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="질문 또는 답변 검색..."
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FAQ List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : !faqs || faqs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">등록된 FAQ가 없습니다</h3>
              <p className="text-slate-500 text-sm mb-4">새로운 FAQ를 추가해보세요</p>
              <button
                onClick={() => handleOpenModal()}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                FAQ 추가
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-8 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">카테고리</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">질문</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">조회수</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">상태</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(faqs as FaqItem[]).map((faq) => {
                    const config = categoryConfig[faq.category];
                    const Icon = config.icon;
                    return (
                      <tr key={faq.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('badge text-xs inline-flex items-center gap-1', config.color)}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 line-clamp-1">{faq.question}</p>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-1">{faq.answer}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-slate-600">{faq.viewCount.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => togglePublishMutation.mutate(faq.id)}
                            disabled={togglePublishMutation.isPending}
                            className={cn(
                              'badge text-xs cursor-pointer hover:opacity-80 transition-opacity',
                              faq.isPublished
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {faq.isPublished ? (
                              <>
                                <Eye className="w-3 h-3 mr-1" />
                                발행됨
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" />
                                미발행
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(faq)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(faq.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {editingFaq ? 'FAQ 수정' : 'FAQ 추가'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Category */}
                <div>
                  <label className="label">카테고리 *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as FaqCategory })}
                    className="input"
                    required
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryConfig[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question */}
                <div>
                  <label className="label">질문 *</label>
                  <input
                    type="text"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="자주 묻는 질문을 입력하세요"
                    className="input"
                    required
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1">{formData.question.length}/500</p>
                </div>

                {/* Answer */}
                <div>
                  <label className="label">답변 *</label>
                  <textarea
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    placeholder="질문에 대한 답변을 입력하세요"
                    className="input min-h-[200px] resize-y"
                    required
                    maxLength={10000}
                  />
                  <p className="text-xs text-slate-500 mt-1">{formData.answer.length}/10000</p>
                </div>

                {/* Published */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isPublished" className="text-sm text-slate-700 cursor-pointer">
                    바로 발행 (체크 해제 시 미발행 상태로 저장됩니다)
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn-secondary"
                    disabled={isSaving}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary inline-flex items-center gap-2"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? '저장 중...' : editingFaq ? '수정' : '추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminFaq;

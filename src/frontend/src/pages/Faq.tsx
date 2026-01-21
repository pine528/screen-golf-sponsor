import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
  User,
  Gavel,
  FileText,
  CreditCard,
  Coins,
  ShoppingBag,
  Users,
  Building2,
  X,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '../utils';

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
  viewCount: number;
}

interface CategoryInfo {
  category: FaqCategory;
  count: number;
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

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const config = categoryConfig[faq.category];
  const Icon = config.icon;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn('badge text-xs mb-2', config.color)}>
            {config.label}
          </span>
          <h3 className="font-medium text-slate-900 pr-8">{faq.question}</h3>
        </div>
        <div className="flex-shrink-0 mt-1">
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-14 pl-4 border-l-2 border-emerald-200">
            <p className="text-slate-600 whitespace-pre-wrap">{faq.answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Faq() {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['faqCategories'],
    queryFn: async () => {
      const res = await api.getFaqCategories();
      return res.data || [];
    },
  });

  // Fetch FAQs
  const { data: faqs, isLoading } = useQuery({
    queryKey: ['faqs', selectedCategory, debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery && debouncedQuery.length >= 2) {
        const res = await api.searchFaqs(debouncedQuery);
        return res.data || [];
      }
      const res = await api.getFaqs(selectedCategory || undefined);
      return res.data || [];
    },
  });

  const categories = categoriesData as CategoryInfo[] || [];
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const handleCategoryClick = (category: FaqCategory | null) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setOpenFaqId(null);
  };

  const handleToggle = (faqId: string) => {
    setOpenFaqId(openFaqId === faqId ? null : faqId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">자주 묻는 질문</h1>
              <p className="text-sm text-slate-500">궁금한 점을 빠르게 찾아보세요</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="질문을 검색하세요..."
              className="input pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        {!debouncedQuery && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleCategoryClick(null)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCategory === null
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              전체
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {totalCount}
              </span>
            </button>
            {categories.map((cat) => {
              const config = categoryConfig[cat.category];
              return (
                <button
                  key={cat.category}
                  onClick={() => handleCategoryClick(cat.category)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    selectedCategory === cat.category
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {config.label}
                  <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search Results Header */}
        {debouncedQuery && (
          <div className="mb-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">"{debouncedQuery}"</span> 검색 결과 {faqs?.length || 0}건
            </p>
          </div>
        )}

        {/* FAQ List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : !faqs || faqs.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {debouncedQuery ? '검색 결과가 없습니다' : '등록된 FAQ가 없습니다'}
            </h3>
            <p className="text-slate-500 text-sm">
              {debouncedQuery
                ? '다른 검색어로 시도해 보세요'
                : '곧 유용한 FAQ가 추가될 예정입니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq: FaqItem) => (
              <AccordionItem
                key={faq.id}
                faq={faq}
                isOpen={openFaqId === faq.id}
                onToggle={() => handleToggle(faq.id)}
              />
            ))}
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-8 card p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">원하시는 답변을 찾지 못하셨나요?</h3>
              <p className="text-sm text-slate-600 mb-3">
                고객센터로 문의해 주시면 빠르게 답변해 드리겠습니다.
              </p>
              <a
                href="mailto:support@sponsorgolf.com"
                className="btn btn-primary inline-flex items-center gap-2 text-sm"
              >
                문의하기
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Faq;

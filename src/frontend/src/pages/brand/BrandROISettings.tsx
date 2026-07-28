import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  Settings,
  Loader2,
  Plus,
  Trash2,
  Tag,
  ShieldBan,
  Building2,
  Save,
} from 'lucide-react';

export function BrandROISettings() {
  useAuth();
  const queryClient = useQueryClient();

  // 브랜드 정보 (키워드/경쟁사 등)
  const { data: brandData, isLoading } = useQuery({
    queryKey: ['my-brand-detail'],
    queryFn: () => api.get('/brands/me'),
  });

  const brand = brandData?.data;

  // 로컬 상태 (편집용)
  const [keywords, setKeywords] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newBlocked, setNewBlocked] = useState('');
  const [initialized, setInitialized] = useState(false);

  // 브랜드 데이터 로드 시 초기화
  if (brand && !initialized) {
    setKeywords(brand.keywords || []);
    setCompetitors(brand.competitors || []);
    setBlockedCategories(brand.blockedCategories || []);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put('/brands/me/roi-settings', {
      keywords,
      competitors,
      blockedCategories,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-brand-detail'] });
    },
  });

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword('');
    }
  };

  const addCompetitor = () => {
    const trimmed = newCompetitor.trim();
    if (trimmed && !competitors.includes(trimmed)) {
      setCompetitors([...competitors, trimmed]);
      setNewCompetitor('');
    }
  };

  const addBlocked = () => {
    const trimmed = newBlocked.trim();
    if (trimmed && !blockedCategories.includes(trimmed)) {
      setBlockedCategories([...blockedCategories, trimmed]);
      setNewBlocked('');
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ROI 설정</h1>
              <p className="text-sm text-slate-500">키워드, 경쟁사, 금지 업종 설정</p>
            </div>
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>

        {saveMutation.isSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
            설정이 저장되었습니다.
          </div>
        )}

        {/* Keywords */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">검색 키워드</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            뉴스/유튜브 멘션 수집 시 사용할 키워드입니다. 브랜드명은 기본 포함됩니다.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {keywords.map((kw, i) => (
              <span key={i} className="badge bg-blue-100 text-blue-700 flex items-center gap-1 pr-1">
                {kw}
                <button
                  onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}
                  className="p-0.5 hover:bg-blue-200 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {keywords.length === 0 && (
              <span className="text-sm text-slate-400">키워드를 추가하세요</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              className="input flex-1"
              placeholder="키워드 입력 후 Enter"
            />
            <button onClick={addKeyword} className="btn btn-secondary flex items-center gap-1">
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>
        </div>

        {/* Competitors */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">경쟁사</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            경쟁사 브랜드명입니다. 동일 슬롯에서 경쟁사 노출 감지 시 알림을 받을 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {competitors.map((comp, i) => (
              <span key={i} className="badge bg-amber-100 text-amber-700 flex items-center gap-1 pr-1">
                {comp}
                <button
                  onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))}
                  className="p-0.5 hover:bg-amber-200 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {competitors.length === 0 && (
              <span className="text-sm text-slate-400">경쟁사를 추가하세요</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
              className="input flex-1"
              placeholder="경쟁사명 입력 후 Enter"
            />
            <button onClick={addCompetitor} className="btn btn-secondary flex items-center gap-1">
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>
        </div>

        {/* Blocked Categories */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldBan className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900">금지 업종</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            동일 슬롯/이벤트에서 함께 노출되면 안 되는 업종 카테고리입니다.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {blockedCategories.map((cat, i) => (
              <span key={i} className="badge bg-red-100 text-red-700 flex items-center gap-1 pr-1">
                {cat}
                <button
                  onClick={() => setBlockedCategories(blockedCategories.filter((_, j) => j !== i))}
                  className="p-0.5 hover:bg-red-200 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {blockedCategories.length === 0 && (
              <span className="text-sm text-slate-400">금지 업종을 추가하세요</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBlocked}
              onChange={(e) => setNewBlocked(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBlocked()}
              className="input flex-1"
              placeholder="업종 카테고리 입력 후 Enter"
            />
            <button onClick={addBlocked} className="btn btn-secondary flex items-center gap-1">
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default BrandROISettings;

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Image,
  Upload,
  Trash2,
  Plus,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils';

interface LogoTemplate {
  id: string;
  name: string;
  fileKey: string;
  fileUrl?: string;
  variant?: string;
  isActive: boolean;
  createdAt: string;
}

export function BrandLogoTemplates() {
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateVariant, setTemplateVariant] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 내 브랜드 정보 조회
  const { data: brandData, isLoading: isBrandLoading } = useQuery({
    queryKey: ['brand', 'me'],
    queryFn: () => api.get('/brands/me'),
  });

  const brandId = brandData?.data?.id;

  // 로고 템플릿 목록 조회
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['logo-templates', brandId],
    queryFn: () => api.get(`/roi/brands/${brandId}/logo-templates`),
    enabled: !!brandId,
  });

  // 로고 템플릿 등록 mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { name: string; file: File; variant?: string }) => {
      // 파일과 데이터를 함께 전송 (백엔드에서 직접 업로드 처리)
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.name);
      if (data.variant) {
        formData.append('variant', data.variant);
      }

      return api.post(`/roi/brands/${brandId}/logo-templates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logo-templates', brandId] });
      setShowUploadModal(false);
      resetForm();
      alert('로고 템플릿이 등록되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '로고 템플릿 등록에 실패했습니다.');
    },
  });

  // 로고 템플릿 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.delete(`/roi/brands/${brandId}/logo-templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logo-templates', brandId] });
      alert('로고 템플릿이 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '로고 템플릿 삭제에 실패했습니다.');
    },
  });

  const resetForm = () => {
    setUploadFile(null);
    setTemplateName('');
    setTemplateVariant('');
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // 미리보기 URL 생성
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = () => {
    if (!uploadFile || !templateName.trim()) {
      alert('파일과 템플릿 이름을 입력해주세요.');
      return;
    }
    uploadMutation.mutate({
      name: templateName.trim(),
      file: uploadFile,
      variant: templateVariant.trim() || undefined,
    });
  };

  const templates: LogoTemplate[] = templatesData?.data || [];

  const variantLabels: Record<string, string> = {
    color: '컬러',
    mono: '모노',
    reversed: '반전',
    primary: '메인',
    secondary: '서브',
  };

  if (isBrandLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </Layout>
    );
  }

  if (!brandId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-600">브랜드 계정으로 로그인해주세요.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">로고 템플릿 관리</h1>
            <p className="text-slate-600 mt-1">
              ROI 분석에 사용할 브랜드 로고를 등록하세요
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            로고 등록
          </button>
        </div>

        {/* Info Card */}
        <div className="card p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">로고 템플릿이란?</p>
              <p>
                VOD 분석 시 브랜드 로고 노출을 검출하기 위해 사용됩니다.
                다양한 버전(컬러, 모노, 반전 등)을 등록하면 검출 정확도가 높아집니다.
              </p>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="card p-8 text-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-600">로딩 중...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="card p-12 text-center">
            <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              등록된 로고 템플릿이 없습니다
            </h3>
            <p className="text-slate-600 mb-4">
              ROI 분석을 위해 브랜드 로고를 등록해주세요
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              첫 로고 등록하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="card overflow-hidden">
                {/* Logo Preview */}
                <div className="aspect-video bg-slate-100 flex items-center justify-center p-4">
                  {template.fileUrl ? (
                    <img
                      src={template.fileUrl}
                      alt={template.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Image className="w-16 h-16 text-slate-300" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{template.name}</h3>
                      {template.variant && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                          {variantLabels[template.variant] || template.variant}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {template.isActive ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          활성
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">비활성</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(template.createdAt).toLocaleDateString('ko-KR')} 등록
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        if (confirm('이 로고 템플릿을 삭제하시겠습니까?')) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">로고 템플릿 등록</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  로고 이미지 <span className="text-red-500">*</span>
                </label>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center transition-colors',
                    previewUrl
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-300 hover:border-emerald-400'
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="logo-file-input"
                  />
                  <label htmlFor="logo-file-input" className="cursor-pointer">
                    {previewUrl ? (
                      <div>
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-32 mx-auto mb-2"
                        />
                        <p className="text-sm text-emerald-600">{uploadFile?.name}</p>
                        <p className="text-xs text-slate-500 mt-1">클릭하여 다른 파일 선택</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600">클릭하여 파일 선택</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG (권장: 500x500px 이상)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  템플릿 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="예: 메인 로고, 화이트 버전"
                  className="input"
                />
              </div>

              {/* Variant */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  버전 (선택)
                </label>
                <select
                  value={templateVariant}
                  onChange={(e) => setTemplateVariant(e.target.value)}
                  className="input"
                >
                  <option value="">버전 선택</option>
                  <option value="primary">메인 (Primary)</option>
                  <option value="secondary">서브 (Secondary)</option>
                  <option value="color">컬러 (Color)</option>
                  <option value="mono">모노 (Mono)</option>
                  <option value="reversed">반전 (Reversed)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  같은 로고의 다른 버전을 구분하기 위해 사용됩니다
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!uploadFile || !templateName.trim() || uploadMutation.isPending}
                className="btn btn-primary"
              >
                {uploadMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Send,
} from 'lucide-react';
import { cn } from '../../utils';

const brandRegistrationSchema = z.object({
  brandName: z.string().min(2, '브랜드명은 최소 2자 이상이어야 합니다').max(100),
  contactEmail: z.string().email('유효한 이메일을 입력하세요'),
  contactPhone: z.string().optional(),
  website: z.string().url('유효한 URL을 입력하세요').optional().or(z.literal('')),
  note: z.string().max(1000, '메모는 최대 1000자까지 입력 가능합니다').optional(),
});

type BrandRegistrationForm = z.infer<typeof brandRegistrationSchema>;

interface BrandRegistrationRequest {
  id: string;
  brandName: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  note?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export default function BrandRegister() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['myBrandRegistrations'],
    queryFn: async () => {
      const res = await api.getMyBrandRegistrations();
      return (res.data || []) as BrandRegistrationRequest[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: BrandRegistrationForm) => api.submitBrandRegistration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBrandRegistrations'] });
      setShowForm(false);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandRegistrationForm>({
    resolver: zodResolver(brandRegistrationSchema),
  });

  const onSubmit = (data: BrandRegistrationForm) => {
    submitMutation.mutate(data);
  };

  const hasPendingRequest = requests?.some((r) => r.status === 'SUBMITTED');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            대기중
          </span>
        );
      case 'APPROVED':
        return (
          <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            승인됨
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            반려됨
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">브랜드 등록 신청</h1>
          <p className="text-slate-500">
            브랜드로 활동하고 싶으시다면 등록을 신청해주세요
          </p>
        </div>

        {/* Info Banner */}
        <div className="card p-4 mb-6 bg-sky-50 border-sky-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-800">
              <p className="font-medium mb-1">브랜드 등록 안내</p>
              <ul className="list-disc list-inside space-y-1 text-sky-700">
                <li>신청 후 관리자 검토를 거쳐 승인됩니다</li>
                <li>승인되면 팬 계정이 브랜드 계정으로 전환됩니다</li>
                <li>브랜드 계정으로 스폰서십 경매에 참여할 수 있습니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Application History */}
        <div className="card mb-6">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">신청 내역</h2>
            {!hasPendingRequest && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                새 신청
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : requests?.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 mb-4">아직 신청 내역이 없습니다</p>
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                브랜드 등록 신청하기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests?.map((request) => (
                <div key={request.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{request.brandName}</h3>
                      <p className="text-sm text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString('ko-KR')} 신청
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {request.contactEmail}
                    </div>
                    {request.contactPhone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {request.contactPhone}
                      </div>
                    )}
                    {request.website && (
                      <div className="flex items-center gap-2 text-slate-600 col-span-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <a
                          href={request.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline"
                        >
                          {request.website}
                        </a>
                      </div>
                    )}
                  </div>
                  {request.adminNote && (
                    <div
                      className={cn(
                        'mt-3 p-3 rounded-lg text-sm',
                        request.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      )}
                    >
                      <p className="font-medium mb-1">관리자 메모</p>
                      <p>{request.adminNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Application Form */}
        {showForm && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">브랜드 등록 신청서</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">
                  <Building2 className="w-4 h-4" />
                  브랜드명 *
                </label>
                <input
                  type="text"
                  {...register('brandName')}
                  className={cn('input', errors.brandName && 'border-red-300')}
                  placeholder="브랜드 이름을 입력하세요"
                />
                {errors.brandName && (
                  <p className="text-sm text-red-500 mt-1">{errors.brandName.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  <Mail className="w-4 h-4" />
                  담당자 이메일 *
                </label>
                <input
                  type="email"
                  {...register('contactEmail')}
                  className={cn('input', errors.contactEmail && 'border-red-300')}
                  placeholder="example@company.com"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500 mt-1">{errors.contactEmail.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  <Phone className="w-4 h-4" />
                  담당자 연락처 (선택)
                </label>
                <input
                  type="tel"
                  {...register('contactPhone')}
                  className="input"
                  placeholder="010-0000-0000"
                />
              </div>

              <div>
                <label className="label">
                  <Globe className="w-4 h-4" />
                  웹사이트 (선택)
                </label>
                <input
                  type="url"
                  {...register('website')}
                  className={cn('input', errors.website && 'border-red-300')}
                  placeholder="https://www.company.com"
                />
                {errors.website && (
                  <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  <FileText className="w-4 h-4" />
                  추가 메모 (선택)
                </label>
                <textarea
                  {...register('note')}
                  className={cn('input min-h-[100px] resize-none', errors.note && 'border-red-300')}
                  placeholder="브랜드 소개 또는 추가 정보를 입력하세요"
                />
                {errors.note && (
                  <p className="text-sm text-red-500 mt-1">{errors.note.message}</p>
                )}
              </div>

              {submitMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {(submitMutation.error as any)?.response?.data?.error?.message ||
                    '신청 중 오류가 발생했습니다'}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      신청 중...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      신청하기
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}

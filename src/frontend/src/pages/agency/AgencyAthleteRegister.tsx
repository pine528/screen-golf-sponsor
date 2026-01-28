import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, UserPlus } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';

const athleteSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  confirmPassword: z.string(),
  name: z.string().min(2, '선수명은 2자 이상이어야 합니다'),
  realName: z.string().optional(),
  tour: z.string().min(1, '소속 투어를 선택하세요'),
  bio: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

type AthleteForm = z.infer<typeof athleteSchema>;

export function AgencyAthleteRegister() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AthleteForm>({
    resolver: zodResolver(athleteSchema),
  });

  const onSubmit = async (data: AthleteForm) => {
    try {
      setError(null);
      await api.post('/agencies/athletes', {
        email: data.email,
        password: data.password,
        name: data.name,
        realName: data.realName,
        tour: data.tour,
        bio: data.bio,
      });
      setSuccess(true);
      setTimeout(() => navigate('/agency/athletes'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '선수 등록에 실패했습니다');
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">선수 등록 완료</h2>
            <p className="text-slate-600">
              선수 계정이 성공적으로 생성되었습니다.
            </p>
            <p className="text-sm text-slate-500 mt-4">
              잠시 후 선수 목록으로 이동합니다...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/agency"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">선수 등록</h1>
        <p className="text-slate-600 mt-1">
          에이전시 소속 선수를 등록합니다. 선수 계정이 자동으로 생성됩니다.
        </p>
      </div>

      {/* Form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="label">선수명 (활동명)</label>
            <input
              type="text"
              className="input"
              placeholder="예: 김민수"
              {...register('name')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="label">실명 (선택)</label>
            <input
              type="text"
              className="input"
              placeholder="계약서에 기재될 실명"
              {...register('realName')}
            />
          </div>

          <div>
            <label className="label">소속 투어</label>
            <select className="input" {...register('tour')}>
              <option value="">선택하세요</option>
              <option value="GTOUR">GTOUR</option>
              <option value="WGTOUR">WGTOUR</option>
              <option value="OTHER">기타</option>
            </select>
            {errors.tour && (
              <p className="mt-1 text-sm text-red-500">{errors.tour.message}</p>
            )}
          </div>

          <div>
            <label className="label">소개 (선택)</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="선수 소개글"
              {...register('bio')}
            />
          </div>

          <hr className="border-slate-200" />

          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm font-medium text-slate-700 mb-3">선수 로그인 정보</p>
            <div className="space-y-4">
              <div>
                <label className="label">이메일 (로그인 ID)</label>
                <input
                  type="email"
                  className="input"
                  placeholder="athlete@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="label">초기 비밀번호</label>
                <input
                  type="password"
                  className="input"
                  placeholder="8자 이상"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="label">비밀번호 확인</label>
                <input
                  type="password"
                  className="input"
                  placeholder="비밀번호 재입력"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full py-3"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                등록 중...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                선수 등록
              </>
            )}
          </button>
        </form>
      </div>
    </div>
    </Layout>
  );
}

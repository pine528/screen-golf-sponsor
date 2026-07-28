import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, AlertCircle, Vote, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  passwordConfirm: z.string().min(1, '비밀번호 확인을 입력하세요'),
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다').max(20, '닉네임은 최대 20자까지 가능합니다').optional().or(z.literal('')),
}).refine((data) => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function FanRegister() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      const result = await api.fanRegister({
        email: data.email,
        password: data.password,
        nickname: data.nickname || undefined,
      });
      if (result.success && result.data) {
        localStorage.setItem('accessToken', result.data.accessToken);
        localStorage.setItem('refreshToken', result.data.refreshToken);
        await checkAuth(); // 인증 상태 갱신
        navigate('/fan');
      } else {
        setError(result.error?.message || '회원가입에 실패했습니다');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '회원가입에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Vote className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">팬 회원가입</h2>
          <p className="mt-2 text-slate-600">가입하고 투표에 참여하세요</p>
        </div>

        {/* Register Form */}
        <div className="card p-8">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="p-4 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="email@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="nickname" className="label">
                닉네임 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id="nickname"
                type="text"
                className="input"
                placeholder="닉네임을 입력하세요"
                {...register('nickname')}
              />
              {errors.nickname && (
                <p className="mt-2 text-sm text-red-500">{errors.nickname.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">최소 8자 이상</p>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="label">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="••••••••"
                {...register('passwordConfirm')}
              />
              {errors.passwordConfirm && (
                <p className="mt-2 text-sm text-red-500">{errors.passwordConfirm.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full py-3 inline-flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  가입 중...
                </>
              ) : (
                <>
                  회원가입
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-3">가입하면 이런 혜택이!</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>투표 참여 및 포인트 획득</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>경기 결과 예측 이벤트</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>선수 랭킹 확인</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              이미 계정이 있으신가요?{' '}
              <Link to="/fan/login" className="text-emerald-600 hover:text-emerald-500 font-medium transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* Other options */}
        <div className="text-center">
          <Link to="/register" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            브랜드/선수 회원가입 →
          </Link>
        </div>
      </div>
    </div>
  );
}

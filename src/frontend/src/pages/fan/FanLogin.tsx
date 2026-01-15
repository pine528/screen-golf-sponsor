import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, AlertCircle, Vote } from 'lucide-react';
import { api } from '../../services/api';

const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function FanLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      const result = await api.fanLogin(data.email, data.password);
      if (result.success && result.data) {
        localStorage.setItem('accessToken', result.data.accessToken);
        localStorage.setItem('refreshToken', result.data.refreshToken);
        navigate('/fan');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '로그인에 실패했습니다');
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
          <h2 className="text-3xl font-bold text-slate-900">팬 로그인</h2>
          <p className="mt-2 text-slate-600">투표하고 포인트를 획득하세요</p>
        </div>

        {/* Login Form */}
        <div className="card p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="p-4 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                이메일
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
              <label htmlFor="password" className="label">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
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
                  로그인 중...
                </>
              ) : (
                <>
                  로그인
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              계정이 없으신가요?{' '}
              <Link to="/fan/register" className="text-emerald-600 hover:text-emerald-500 font-medium transition-colors">
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* Other login options */}
        <div className="text-center space-y-2">
          <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700 transition-colors block">
            브랜드/선수 로그인 →
          </Link>
        </div>
      </div>
    </div>
  );
}

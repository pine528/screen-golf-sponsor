import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Hexagon, ArrowRight, AlertCircle, Target, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const registerSchema = z
  .object({
    email: z.string().email('유효한 이메일을 입력하세요'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
    confirmPassword: z.string(),
    role: z.enum(['BRAND', 'ATHLETE']),
    name: z.string().min(1, '이름을 입력하세요'),
    tour: z.string().optional(),
    category: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'BRAND',
    },
  });

  const role = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      await registerUser({
        email: data.email,
        password: data.password,
        role: data.role,
        name: data.name,
        tour: data.tour,
        category: data.category,
      });
      navigate('/dashboard');
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
          <Link to="/" className="inline-flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Hexagon className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </Link>
          <h2 className="text-3xl font-bold text-slate-900">회원가입</h2>
          <p className="mt-2 text-slate-600">스폰서 마켓플레이스에 참여하세요</p>
        </div>

        {/* Register Form */}
        <div className="card p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="p-4 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="label">가입 유형</label>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all ${
                    role === 'BRAND'
                      ? 'bg-gradient-to-br from-sky-500/10 to-blue-500/10 border-2 border-sky-500/50'
                      : 'bg-slate-100 border-2 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    value="BRAND"
                    className="sr-only"
                    {...register('role')}
                  />
                  <div className="text-center">
                    <Target className={`w-6 h-6 mx-auto mb-2 ${role === 'BRAND' ? 'text-sky-500' : 'text-slate-400'}`} />
                    <div className={`font-semibold ${role === 'BRAND' ? 'text-slate-900' : 'text-slate-500'}`}>브랜드</div>
                    <div className="text-xs text-slate-500 mt-1">광고주로 참여</div>
                  </div>
                </label>
                <label
                  className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all ${
                    role === 'ATHLETE'
                      ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/50'
                      : 'bg-slate-100 border-2 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    value="ATHLETE"
                    className="sr-only"
                    {...register('role')}
                  />
                  <div className="text-center">
                    <Users className={`w-6 h-6 mx-auto mb-2 ${role === 'ATHLETE' ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <div className={`font-semibold ${role === 'ATHLETE' ? 'text-slate-900' : 'text-slate-500'}`}>선수</div>
                    <div className="text-xs text-slate-500 mt-1">프로선수로 참여</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="label">
                {role === 'BRAND' ? '회사/브랜드명' : '선수명'}
              </label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder={role === 'BRAND' ? '회사명을 입력하세요' : '선수명을 입력하세요'}
                {...register('name')}
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {role === 'ATHLETE' && (
              <div>
                <label htmlFor="tour" className="label">
                  소속 투어
                </label>
                <select id="tour" className="input" {...register('tour')}>
                  <option value="">선택하세요</option>
                  <option value="GTOUR">GTOUR</option>
                  <option value="WGTOUR">WGTOUR</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
            )}

            {role === 'BRAND' && (
              <div>
                <label htmlFor="category" className="label">
                  업종 카테고리
                </label>
                <select id="category" className="input" {...register('category')}>
                  <option value="">선택하세요</option>
                  <option value="GOLF_EQUIPMENT">골프용품</option>
                  <option value="SPORTS_APPAREL">스포츠의류</option>
                  <option value="FINANCE">금융/보험</option>
                  <option value="FOOD_BEVERAGE">식음료</option>
                  <option value="TECH">IT/전자</option>
                  <option value="OTHER">기타</option>
                </select>
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
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-500">{errors.confirmPassword.message}</p>
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

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-medium transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

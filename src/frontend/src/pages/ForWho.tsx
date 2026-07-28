import { Link } from 'react-router-dom';
import {
  Hexagon,
  ArrowRight,
  Target,
  Trophy,
  CheckCircle2,
  Building2,
  Users,
  TrendingUp,
  Wallet,
  BarChart3,
  Shield,
  Clock,
  Star,
} from 'lucide-react';

export function ForWho() {
  const brandBenefits = [
    {
      icon: Target,
      title: '정밀한 타겟팅',
      description: '스크린골프 시청자층에 직접 도달하는 효과적인 광고',
    },
    {
      icon: BarChart3,
      title: '성과 측정',
      description: '실시간 노출 분석과 ROI 리포트로 효과 확인',
    },
    {
      icon: Wallet,
      title: '유연한 예산',
      description: '원하는 예산 내에서 자동 입찰로 효율적 집행',
    },
    {
      icon: Shield,
      title: '안전한 거래',
      description: 'KYC 검증과 에스크로로 보호되는 안전한 결제',
    },
  ];

  const athleteBenefits = [
    {
      icon: TrendingUp,
      title: '추가 수익',
      description: '경기 외 시간에도 스폰서십으로 수익 창출',
    },
    {
      icon: Clock,
      title: '간편한 관리',
      description: '슬롯 설정만 하면 경매와 정산이 자동 처리',
    },
    {
      icon: Shield,
      title: '충돌 방지',
      description: '경쟁 브랜드 자동 필터링으로 기존 스폰서 보호',
    },
    {
      icon: Wallet,
      title: '빠른 정산',
      description: 'D+7 영업일 내 자동 정산으로 안정적 수익',
    },
  ];

  const brandUseCases = [
    '골프용품 브랜드의 프로선수 후원',
    '스포츠 의류 브랜드의 슬롯 광고',
    '금융/보험사의 타겟 마케팅',
    '식음료 브랜드의 스포츠 마케팅',
    'IT/전자 기업의 브랜드 노출',
    '지역 비즈니스의 로컬 마케팅',
  ];

  const athleteUseCases = [
    'GTOUR/WGTOUR 정규 투어 프로',
    '시니어 투어 참가 선수',
    '아마추어 대회 우승 경력 선수',
    '레슨 프로 및 인플루언서',
    '선수 매니지먼트 에이전시',
    '팀 및 단체 스폰서십',
  ];

  // SPONPIK 론칭 docx 2-1 — 하드코딩 제거. 실 후기 시스템 도입 전까지 비공개.
  const testimonials: Array<{ role: string; name: string; company: string; content: string }> = [];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Hexagon className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold text-slate-900">SPONPIK</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">기능</Link>
              <Link to="/how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">이용방법</Link>
              <Link to="/for-who" className="text-sm text-emerald-600 font-medium">대상</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-medium transition-colors">
                로그인
              </Link>
              <Link to="/register" className="btn btn-primary">
                시작하기
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6 border border-emerald-200">
            FOR WHO
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            누구를 위한 <span className="gradient-text">서비스</span>인가요?
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            브랜드와 선수 모두를 위한 스폰서십 플랫폼
          </p>
        </div>
      </section>

      {/* Two Cards Section */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Brand Card */}
            <div className="card p-8 border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">브랜드 · 광고주</h2>
                  <p className="text-sky-600 text-sm font-medium">For Brands</p>
                </div>
              </div>
              <p className="text-slate-600 mb-6 leading-relaxed">
                스크린골프 방송을 시청하는 핵심 타겟층에게 효과적으로 브랜드를 노출하세요.
                프록시 경매 시스템으로 원하는 예산 내에서 최적의 스폰서십을 확보할 수 있습니다.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-500 transition-all"
              >
                브랜드로 시작하기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Athlete Card */}
            <div className="card p-8 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">선수 · 매니지먼트</h2>
                  <p className="text-emerald-600 text-sm font-medium">For Athletes</p>
                </div>
              </div>
              <p className="text-slate-600 mb-6 leading-relaxed">
                경기력에 집중하면서 추가 수익을 창출하세요.
                슬롯만 등록해두면 경매, 계약, 정산까지 모든 과정이 자동으로 처리됩니다.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition-all"
              >
                선수로 시작하기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Benefits */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-sky-100 text-sky-700 text-sm font-medium mb-6 border border-sky-200">
                BRANDS
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                브랜드를 위한 <span className="text-sky-600">혜택</span>
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                스크린골프 시청자층은 구매력이 높은 30-50대 남성이 주를 이룹니다.
                정밀한 타겟팅과 측정 가능한 성과로 마케팅 효율을 극대화하세요.
              </p>
              <div className="space-y-4">
                {brandBenefits.map((benefit, i) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200">
                      <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">{benefit.title}</h3>
                        <p className="text-sm text-slate-600">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">이런 분들에게 추천합니다</h3>
              <div className="grid grid-cols-2 gap-4">
                {brandUseCases.map((useCase, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{useCase}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Athlete Benefits */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="lg:order-2">
              <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6 border border-emerald-200">
                ATHLETES
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                선수를 위한 <span className="text-emerald-600">혜택</span>
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                경기력에만 집중하세요. 스폰서십 관리는 저희가 알아서 합니다.
                슬롯 등록만 해두면 경매부터 정산까지 모든 과정이 자동화됩니다.
              </p>
              <div className="space-y-4">
                {athleteBenefits.map((benefit, i) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">{benefit.title}</h3>
                        <p className="text-sm text-slate-600">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:order-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">이런 분들에게 추천합니다</h3>
              <div className="grid grid-cols-2 gap-4">
                {athleteUseCases.map((useCase, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{useCase}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials (docx 2-1: 하드코딩 제거 — 실 후기 시스템 도입 전까지 비공개) */}
      {testimonials.length > 0 && (
        <section className="py-24 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">사용자 후기</h2>
              <p className="text-slate-600">실제 이용자들의 경험을 들어보세요</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((testimonial, i) => (
                <div
                  key={i}
                  className={`card p-8 ${testimonial.role === 'brand' ? 'border-sky-200' : 'border-emerald-200'}`}
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-5 h-5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      testimonial.role === 'brand' ? 'bg-sky-100' : 'bg-emerald-100'
                    }`}>
                      {testimonial.role === 'brand' ? (
                        <Building2 className="w-6 h-6 text-sky-600" />
                      ) : (
                        <Trophy className="w-6 h-6 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-500">{testimonial.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-3xl blur-3xl" />
            <div className="relative card p-12 text-center bg-gradient-to-br from-emerald-500 to-teal-500 border-0">
              <Users className="w-12 h-12 text-white/80 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-4">
                지금 커뮤니티에 참여하세요
              </h2>
              <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
                1,000명 이상의 브랜드와 선수가 함께하고 있습니다
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-all shadow-lg hover:-translate-y-0.5"
                >
                  무료로 시작하기
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                >
                  이용방법 보기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Hexagon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-slate-900">SPONPIK</span>
            </div>
            <p className="text-sm text-slate-500">&copy; 2026 SPONPIK. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Hexagon,
  Zap,
  Shield,
  ArrowRight,
  Trophy,
  Target,
  BarChart3,
  Clock,
  CheckCircle2,
  Activity,
  Sparkles,
  Play,
  ChevronDown,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

// Live auction data
const liveAuctions = [
  { id: 1, slot: 'SG-01', player: '김태훈', price: 450000, change: '+12%', hot: true },
  { id: 2, slot: 'SG-05', player: '이수진', price: 320000, change: '+8%', hot: false },
  { id: 3, slot: 'SG-02', player: '박민석', price: 380000, change: '+15%', hot: true },
  { id: 4, slot: 'SG-03', player: '최유리', price: 280000, change: '+5%', hot: false },
];

export function Home() {
  const { isAuthenticated } = useAuth();
  const [currentAuction, setCurrentAuction] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const stats = [
    { label: '등록 선수', value: useCounter(1250), suffix: '+' },
    { label: '성사된 계약', value: useCounter(3400), suffix: '+' },
    { label: '파트너 브랜드', value: useCounter(180), suffix: '+' },
    { label: '월 거래액', value: useCounter(25), suffix: '억+' },
  ];

  const features = [
    {
      icon: Zap,
      title: '실시간 경매',
      description: '프록시 입찰 시스템으로 공정하고 투명한 경매를 경험하세요',
      color: 'emerald',
    },
    {
      icon: Shield,
      title: '안전한 계약',
      description: '에스크로 시스템과 KYC 검증으로 안전한 거래를 보장합니다',
      color: 'sky',
    },
    {
      icon: Clock,
      title: '스나이핑 방지',
      description: '자동 연장 시스템으로 마지막 순간 입찰도 공정하게',
      color: 'violet',
    },
    {
      icon: BarChart3,
      title: '데이터 분석',
      description: '상세한 노출 분석과 ROI 측정으로 효과를 극대화하세요',
      color: 'amber',
    },
  ];

  const howItWorks = [
    { step: '01', title: '슬롯 탐색', desc: '원하는 선수와 이벤트의 광고 슬롯을 탐색' },
    { step: '02', title: '입찰 참여', desc: '최대 금액 입력으로 자동 경쟁 시스템' },
    { step: '03', title: '계약 체결', desc: '낙찰 후 전자서명으로 계약 완료' },
    { step: '04', title: '소재 등록', desc: '광고 소재 업로드 및 검수 진행' },
  ];

  useEffect(() => {
    const auctionInterval = setInterval(() => {
      setCurrentAuction((prev) => (prev + 1) % liveAuctions.length);
    }, 3000);

    const featureInterval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => {
      clearInterval(auctionInterval);
      clearInterval(featureInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/3 to-teal-500/3 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="relative">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-all">
                  <Hexagon className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <span className="text-lg sm:text-xl font-bold text-slate-900">SponsorGolf</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">기능</Link>
              <Link to="/how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">이용방법</Link>
              <Link to="/for-who" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">대상</Link>
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden sm:flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  대시보드
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    로그인
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary"
                  >
                    시작하기
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden pt-4 pb-2 border-t border-slate-200 mt-3">
              <div className="flex flex-col gap-2">
                <Link
                  to="/features"
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  기능
                </Link>
                <Link
                  to="/how-it-works"
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  이용방법
                </Link>
                <Link
                  to="/for-who"
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  대상
                </Link>
                <div className="border-t border-slate-200 mt-2 pt-2 flex gap-2">
                  {isAuthenticated ? (
                    <Link
                      to="/dashboard"
                      className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      대시보드
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        className="btn btn-secondary flex-1"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        로그인
                      </Link>
                      <Link
                        to="/register"
                        className="btn btn-primary flex-1"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        시작하기
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center lg:min-h-[70vh]">
            {/* Left Content */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-100 text-emerald-700 text-xs sm:text-sm font-medium mb-6 sm:mb-8 border border-emerald-200">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>GTOUR · WGTOUR 공식 파트너</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black leading-[1.1] mb-4 sm:mb-6">
                <span className="text-slate-900">프로선수</span>
                <br />
                <span className="gradient-text">스폰서십의</span>
                <br />
                <span className="text-slate-900">새로운 방식</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6 sm:mb-10 max-w-lg">
                실시간 경매 시스템으로 스크린골프 프로선수의 광고 슬롯을
                투명하고 공정하게 거래하세요
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="btn btn-primary text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center justify-center gap-2 group"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    대시보드로 이동
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="btn btn-primary text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center justify-center gap-2 group"
                  >
                    지금 시작하기
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
                <button className="btn btn-secondary text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  서비스 소개
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 sm:gap-10 mt-8 sm:mt-14 pt-6 sm:pt-10 border-t border-slate-200">
                {stats.slice(0, 3).map((stat, i) => (
                  <div key={i}>
                    <div className="text-xl sm:text-3xl font-bold text-slate-900">
                      {stat.value.toLocaleString()}{stat.suffix}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Content - Live Auction Card */}
            <div className="relative mt-8 lg:mt-0">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-2xl" />
              <div className="relative card p-4 sm:p-8">
                <div className="flex items-center justify-between mb-4 sm:mb-8">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-slate-900 font-semibold text-sm sm:text-base">실시간 경매</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">LIVE</span>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {liveAuctions.map((auction, i) => (
                    <div
                      key={auction.id}
                      className={`relative p-3 sm:p-4 rounded-xl transition-all duration-500 ${
                        i === currentAuction
                          ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/30'
                          : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                            i === currentAuction
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                              : 'bg-slate-200'
                          }`}>
                            <span className={`text-[10px] sm:text-xs font-bold ${i === currentAuction ? 'text-white' : 'text-slate-600'}`}>{auction.slot}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm sm:text-base">{auction.player} 프로</p>
                            <p className="text-xs sm:text-sm text-slate-500">상의 슬롯</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 text-sm sm:text-base">₩{auction.price.toLocaleString()}</p>
                          <p className={`text-xs sm:text-sm font-medium ${auction.hot ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {auction.change}
                          </p>
                        </div>
                      </div>
                      {auction.hot && i === currentAuction && (
                        <div className="absolute -top-1 -right-1">
                          <span className="flex h-4 w-4 sm:h-5 sm:w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 sm:h-5 sm:w-5 bg-emerald-500 items-center justify-center">
                              <Zap className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 text-xs sm:text-sm">다음 마감까지</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg sm:text-xl font-bold text-slate-900">02:34:15</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="hidden sm:flex justify-center mt-10">
            <a href="#features" className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
              <span className="text-xs">스크롤</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-slate-200 text-slate-600 text-sm font-medium mb-4 sm:mb-6">
              FEATURES
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">
              왜 <span className="gradient-text">SponsorGolf</span>인가요?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              스크린골프 스폰서십 시장을 혁신하는 핵심 기능들
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const bgColorMap: Record<string, string> = {
                emerald: 'bg-emerald-100 text-emerald-600',
                sky: 'bg-sky-100 text-sky-600',
                violet: 'bg-violet-100 text-violet-600',
                amber: 'bg-amber-100 text-amber-600',
              };

              return (
                <div
                  key={i}
                  className={`card p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 ${
                    activeFeature === i ? 'ring-2 ring-emerald-500/50' : ''
                  }`}
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${bgColorMap[feature.color]} flex items-center justify-center mb-4 sm:mb-5`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-slate-200 text-slate-600 text-sm font-medium mb-4 sm:mb-6">
              HOW IT WORKS
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">
              간단한 <span className="gradient-text">4단계</span> 프로세스
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              누구나 쉽게 시작할 수 있습니다
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent -translate-y-1/2" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
              {howItWorks.map((item, i) => (
                <div key={i} className="relative text-center group">
                  <div className="relative inline-flex mb-4 sm:mb-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                      <span className="text-xl sm:text-2xl font-black gradient-text">{item.step}</span>
                    </div>
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">{item.title}</h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Slots Section */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-slate-200 text-slate-600 text-sm font-medium mb-4 sm:mb-6">
              AD SLOTS
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">
              <span className="gradient-text">Top 6</span> 프리미엄 슬롯
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              방송 노출이 가장 높은 프리미엄 광고 위치
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[
              { code: 'SG-01', name: '가슴 좌측', part: 'Chest Left', price: '300K~', hot: true },
              { code: 'SG-02', name: '가슴 우측', part: 'Chest Right', price: '300K~', hot: true },
              { code: 'SG-03', name: '소매 우측', part: 'Sleeve Right', price: '200K~', hot: false },
              { code: 'SG-04', name: '소매 좌측', part: 'Sleeve Left', price: '200K~', hot: false },
              { code: 'SG-05', name: '모자 측면', part: 'Cap Side', price: '250K~', hot: true },
              { code: 'SG-06', name: '모자 후면', part: 'Cap Back', price: '150K~', hot: false },
            ].map((slot) => (
              <div
                key={slot.code}
                className="group card p-4 sm:p-6 hover:border-emerald-500/30 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                    <span className="text-xs sm:text-sm font-bold text-emerald-600">{slot.code}</span>
                  </div>
                  {slot.hot && (
                    <span className="badge badge-warning text-[10px] sm:text-xs">
                      <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                      인기
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-1">{slot.name}</h3>
                <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4">{slot.part}</p>
                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-200">
                  <span className="text-[10px] sm:text-xs text-slate-500">시작가</span>
                  <span className="font-bold text-emerald-600 text-sm sm:text-base">₩{slot.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Who Section */}
      <section id="for-who" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-4">
              누구를 위한 서비스인가요?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
            {/* For Brands */}
            <div className="card p-5 sm:p-8">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 sm:w-7 sm:h-7 text-sky-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">브랜드 · 광고주</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 leading-relaxed">
                스크린골프 방송 시청자에게 효과적으로 브랜드를 노출하세요
              </p>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {[
                  '원하는 예산 내 자동 입찰',
                  '실시간 경쟁 모니터링',
                  '성과 리포트 제공',
                  '다중 슬롯 동시 입찰',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="btn btn-secondary inline-flex items-center gap-2 text-sm sm:text-base">
                브랜드로 시작
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* For Athletes */}
            <div className="card p-5 sm:p-8">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">선수 · 매니지먼트</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 leading-relaxed">
                추가 수익을 창출하고 팬들에게 더 가까이 다가가세요
              </p>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {[
                  '슬롯별 가용성 직접 설정',
                  '계약 조건 검토 및 승인',
                  'D+7 영업일 내 정산',
                  '충돌 브랜드 자동 필터',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="btn btn-primary inline-flex items-center gap-2 text-sm sm:text-base">
                선수로 시작
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-3xl blur-3xl" />
            <div className="relative card p-8 sm:p-12 text-center bg-gradient-to-br from-emerald-500 to-teal-500 border-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                스폰서십의 새로운 기준
              </h2>
              <p className="text-emerald-100 text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
                스크린골프 프로선수와 함께하는 마이크로 스폰서십
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-all shadow-lg hover:-translate-y-0.5"
                  >
                    <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
                    대시보드로 이동
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-all shadow-lg hover:-translate-y-0.5"
                    >
                      지금 시작하기
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                    >
                      로그인
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Hexagon className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-base sm:text-lg font-bold text-slate-900">SponsorGolf</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                스크린골프 프로선수 마이크로 스폰서 마켓플레이스
              </p>
            </div>
            <div>
              <h4 className="text-slate-900 font-semibold mb-3 sm:mb-4 text-sm sm:text-base">서비스</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500">
                <li><a href="#" className="hover:text-slate-900 transition-colors">경매 참여</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">슬롯 탐색</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">계약 관리</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-slate-900 font-semibold mb-3 sm:mb-4 text-sm sm:text-base">지원</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500">
                <li><a href="#" className="hover:text-slate-900 transition-colors">이용가이드</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">자주 묻는 질문</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">고객센터</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-slate-900 font-semibold mb-3 sm:mb-4 text-sm sm:text-base">법적 고지</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500">
                <li><a href="#" className="hover:text-slate-900 transition-colors">이용약관</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">개인정보처리방침</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-slate-200 text-center text-slate-500 text-xs sm:text-sm">
            <p>&copy; 2026 SponsorGolf. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

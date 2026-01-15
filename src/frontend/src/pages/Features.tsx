import { Link } from 'react-router-dom';
import {
  Hexagon,
  Zap,
  Shield,
  Clock,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Lock,
  Bell,
  Eye,
  FileCheck,
  RefreshCw,
  Users,
  Gavel,
  DollarSign,
  Timer,
  PieChart,
} from 'lucide-react';

// SVG Illustrations for each feature
function AuctionIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="absolute top-4 left-4 w-20 h-20 bg-emerald-200/50 rounded-full blur-xl" />
      <div className="absolute bottom-8 right-8 w-16 h-16 bg-teal-200/50 rounded-full blur-xl" />

      {/* Main content */}
      <div className="relative w-full max-w-xs">
        {/* Price chart */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">실시간 입찰</span>
            <span className="text-xs text-emerald-600 font-bold">LIVE</span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Bid card */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Gavel className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500">현재 최고가</p>
              <p className="text-lg font-bold text-slate-900">₩450,000</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-600 font-medium">+12%</span>
            </div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
          자동입찰
        </div>
      </div>
    </div>
  );
}

function EscrowIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="absolute top-8 right-4 w-24 h-24 bg-sky-200/50 rounded-full blur-xl" />
      <div className="absolute bottom-4 left-8 w-16 h-16 bg-blue-200/50 rounded-full blur-xl" />

      {/* Main content */}
      <div className="relative">
        {/* Shield with lock */}
        <div className="relative">
          <div className="w-32 h-40 bg-gradient-to-b from-sky-100 to-sky-50 rounded-t-full rounded-b-3xl border-4 border-sky-200 flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center">
              <Lock className="w-8 h-8 text-sky-600" />
            </div>
          </div>

          {/* Check badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Side cards */}
        <div className="absolute -left-16 top-8 bg-white rounded-lg shadow-lg p-3 text-center">
          <DollarSign className="w-5 h-5 text-sky-600 mx-auto mb-1" />
          <span className="text-xs font-medium text-slate-600">에스크로</span>
        </div>

        <div className="absolute -right-16 top-8 bg-white rounded-lg shadow-lg p-3 text-center">
          <Users className="w-5 h-5 text-sky-600 mx-auto mb-1" />
          <span className="text-xs font-medium text-slate-600">KYC 인증</span>
        </div>
      </div>
    </div>
  );
}

function AntiSnipingIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="absolute top-4 left-8 w-20 h-20 bg-violet-200/50 rounded-full blur-xl" />
      <div className="absolute bottom-8 right-4 w-24 h-24 bg-purple-200/50 rounded-full blur-xl" />

      {/* Main content */}
      <div className="relative">
        {/* Clock */}
        <div className="w-36 h-36 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-violet-100">
          <div className="relative w-28 h-28">
            {/* Clock face */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-50 to-purple-50" />
            {/* Hour marks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <div
                key={deg}
                className="absolute w-1 h-2 bg-violet-300 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-12px)`,
                }}
              />
            ))}
            {/* Clock hands */}
            <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-violet-600 rounded-full origin-bottom" style={{ transform: 'translate(-50%, -100%) rotate(-30deg)' }} />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-10 bg-violet-400 rounded-full origin-bottom" style={{ transform: 'translate(-50%, -100%) rotate(60deg)' }} />
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-violet-600 rounded-full" style={{ transform: 'translate(-50%, -50%)' }} />
          </div>
        </div>

        {/* Extension badge */}
        <div className="absolute -top-2 -right-2 bg-violet-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg flex items-center gap-1">
          <Timer className="w-3 h-3" />
          +5분
        </div>

        {/* Info cards */}
        <div className="absolute -left-12 bottom-0 bg-white rounded-lg shadow-lg px-3 py-2">
          <span className="text-xs font-medium text-violet-600">자동 연장</span>
        </div>

        <div className="absolute -right-12 bottom-0 bg-white rounded-lg shadow-lg px-3 py-2">
          <span className="text-xs font-medium text-violet-600">공정 경쟁</span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="absolute top-8 right-8 w-20 h-20 bg-amber-200/50 rounded-full blur-xl" />
      <div className="absolute bottom-4 left-4 w-16 h-16 bg-orange-200/50 rounded-full blur-xl" />

      {/* Main content - Dashboard */}
      <div className="relative w-full max-w-xs">
        {/* Main chart card */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">노출 분석</span>
            <span className="text-xs text-amber-600 font-bold">+24%</span>
          </div>
          {/* Area chart simulation */}
          <svg viewBox="0 0 200 60" className="w-full h-12">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,50 Q20,45 40,40 T80,35 T120,25 T160,30 T200,15 V60 H0 Z"
              fill="url(#areaGradient)"
            />
            <path
              d="M0,50 Q20,45 40,40 T80,35 T120,25 T160,30 T200,15"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-500">노출수</span>
            </div>
            <p className="text-sm font-bold text-slate-900">125,430</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <PieChart className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-500">ROI</span>
            </div>
            <p className="text-sm font-bold text-slate-900">342%</p>
          </div>
        </div>

        {/* Floating badge */}
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
          실시간
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const mainFeatures = [
    {
      icon: Zap,
      title: '실시간 프록시 경매',
      description: '최대 입찰가를 설정하면 시스템이 자동으로 최소 증분 단위로 경쟁합니다. 경매 현장에 없어도 공정한 가격으로 낙찰받을 수 있습니다.',
      color: 'emerald',
      illustration: AuctionIllustration,
      benefits: [
        '24시간 자동 입찰 시스템',
        '최소 증분 단위 자동 경쟁',
        '실시간 입찰 현황 알림',
        '다중 경매 동시 참여 가능',
      ],
    },
    {
      icon: Shield,
      title: '안전한 에스크로 결제',
      description: 'KYC 검증된 사용자만 참여하고, 결제금은 에스크로 계좌에서 안전하게 보관됩니다. 계약 완료 후에만 정산이 진행됩니다.',
      color: 'sky',
      illustration: EscrowIllustration,
      benefits: [
        '본인인증 필수 (KYC)',
        '에스크로 보호 시스템',
        '분쟁 조정 지원',
        '안전한 전자계약',
      ],
    },
    {
      icon: Clock,
      title: '스나이핑 방지 시스템',
      description: '경매 종료 직전 입찰 시 자동으로 시간이 연장됩니다. 마지막 순간의 급습 입찰도 공정하게 경쟁할 수 있습니다.',
      color: 'violet',
      illustration: AntiSnipingIllustration,
      benefits: [
        '종료 5분 전 입찰 시 자동 연장',
        '최대 3회 연장 가능',
        '공정한 경쟁 환경 보장',
        '실시간 연장 알림',
      ],
    },
    {
      icon: BarChart3,
      title: '상세 성과 분석',
      description: '광고 노출 효과를 정량적으로 측정합니다. 방송 시청자 수, 노출 시간, ROI 등 다양한 지표를 실시간으로 확인하세요.',
      color: 'amber',
      illustration: AnalyticsIllustration,
      benefits: [
        '실시간 노출 트래킹',
        '시청자 도달 분석',
        'ROI 자동 계산',
        '성과 리포트 다운로드',
      ],
    },
  ];

  const additionalFeatures = [
    { icon: Bell, title: '실시간 알림', desc: '입찰, 낙찰, 계약 진행 상황을 즉시 알려드립니다' },
    { icon: Lock, title: '충돌 방지', desc: '경쟁 브랜드 자동 필터링으로 독점성 보장' },
    { icon: Eye, title: '투명한 이력', desc: '모든 입찰 및 거래 이력 조회 가능' },
    { icon: FileCheck, title: '전자계약', desc: '온라인으로 간편하게 계약 체결' },
    { icon: RefreshCw, title: '자동 정산', desc: 'D+7 영업일 내 자동 정산 처리' },
    { icon: Users, title: '멀티 슬롯', desc: '여러 슬롯을 한 번에 관리하고 입찰' },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-200' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  };

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
              <span className="text-xl font-bold text-slate-900">SponsorGolf</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-sm text-emerald-600 font-medium">기능</Link>
              <Link to="/how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">이용방법</Link>
              <Link to="/for-who" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">대상</Link>
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
            FEATURES
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            <span className="gradient-text">SponsorGolf</span>의 핵심 기능
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            스크린골프 스폰서십 시장을 혁신하는 강력한 기능들을 만나보세요
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-24">
            {mainFeatures.map((feature, i) => {
              const Icon = feature.icon;
              const Illustration = feature.illustration;
              const colors = colorMap[feature.color];
              const isReversed = i % 2 === 1;

              return (
                <div
                  key={i}
                  className={`grid lg:grid-cols-2 gap-12 items-center ${isReversed ? 'lg:flex-row-reverse' : ''}`}
                >
                  <div className={isReversed ? 'lg:order-2' : ''}>
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${colors.bg} mb-6`}>
                      <Icon className={`w-8 h-8 ${colors.text}`} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">{feature.title}</h2>
                    <p className="text-lg text-slate-600 leading-relaxed mb-8">{feature.description}</p>
                    <ul className="space-y-4">
                      {feature.benefits.map((benefit, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={isReversed ? 'lg:order-1' : ''}>
                    <div className={`relative p-4 rounded-3xl ${colors.bg} border ${colors.border}`}>
                      <div className="aspect-video bg-white/80 rounded-2xl shadow-lg overflow-hidden">
                        <Illustration />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">더 많은 기능</h2>
            <p className="text-slate-600">편리한 스폰서십 관리를 위한 추가 기능들</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="card p-6 hover:-translate-y-1 transition-all">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-sm">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-3xl blur-3xl" />
            <div className="relative card p-12 text-center bg-gradient-to-br from-emerald-500 to-teal-500 border-0">
              <TrendingUp className="w-12 h-12 text-white/80 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-4">
                지금 바로 시작하세요
              </h2>
              <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
                강력한 기능들로 스폰서십 관리를 더 쉽고 효율적으로
              </p>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-all shadow-lg hover:-translate-y-0.5"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5" />
              </Link>
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
              <span className="font-semibold text-slate-900">SponsorGolf</span>
            </div>
            <p className="text-sm text-slate-500">&copy; 2026 SponsorGolf. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

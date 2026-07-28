import { Link } from 'react-router-dom';
import {
  Hexagon,
  ArrowRight,
  Search,
  Gavel,
  FileSignature,
  Upload,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';

export function HowItWorks() {
  const brandSteps = [
    {
      step: '01',
      icon: Search,
      title: '슬롯 탐색',
      description: '원하는 이벤트, 선수, 슬롯 위치를 검색하고 필터링하세요',
      details: [
        '이벤트별/선수별 슬롯 탐색',
        '슬롯 위치 및 크기 확인',
        '예상 노출 효과 미리보기',
        '가격 이력 및 시장가 참고',
      ],
    },
    {
      step: '02',
      icon: Gavel,
      title: '입찰 참여',
      description: '최대 입찰가를 설정하고 프록시 경매에 참여하세요',
      details: [
        '최대 입찰가 설정',
        '자동 경쟁 시스템 활성화',
        '실시간 입찰 현황 모니터링',
        '알림으로 경쟁 상황 파악',
      ],
    },
    {
      step: '03',
      icon: FileSignature,
      title: '계약 체결',
      description: '낙찰 후 전자서명으로 간편하게 계약을 완료하세요',
      details: [
        '낙찰 알림 수신',
        '계약 조건 확인',
        '전자서명으로 계약 체결',
        '결제 진행 (에스크로)',
      ],
    },
    {
      step: '04',
      icon: Upload,
      title: '소재 등록',
      description: '광고 소재를 업로드하고 검수를 받으세요',
      details: [
        '광고 소재 파일 업로드',
        '가이드라인 준수 확인',
        '관리자 검수 진행',
        '승인 후 노출 시작',
      ],
    },
  ];

  const athleteSteps = [
    {
      step: '01',
      icon: Search,
      title: '슬롯 등록',
      description: '판매할 광고 슬롯의 가용성을 설정하세요',
      details: [
        '참여 이벤트 선택',
        '슬롯 위치 및 가격 설정',
        '충돌 브랜드 설정',
        '가용 기간 지정',
      ],
    },
    {
      step: '02',
      icon: Gavel,
      title: '경매 진행',
      description: '경매가 자동으로 진행되고 입찰 현황을 확인하세요',
      details: [
        '경매 시작 알림',
        '실시간 입찰 현황',
        '경매 종료 알림',
        '낙찰 결과 확인',
      ],
    },
    {
      step: '03',
      icon: FileSignature,
      title: '계약 승인',
      description: '낙찰된 계약을 검토하고 승인하세요',
      details: [
        '계약 조건 확인',
        '브랜드 정보 검토',
        '계약 승인/거절',
        '전자서명 완료',
      ],
    },
    {
      step: '04',
      icon: CheckCircle2,
      title: '정산 수령',
      description: '이벤트 종료 후 D+7 영업일 내 정산받으세요',
      details: [
        '광고 노출 완료',
        '정산 금액 확인',
        'D+7 자동 정산',
        '정산 내역 조회',
      ],
    },
  ];

  const faqs = [
    {
      q: '경매에 참여하려면 어떤 조건이 필요한가요?',
      a: '회원가입 후 KYC 인증을 완료하면 경매에 참여할 수 있습니다. 브랜드는 사업자등록증, 선수는 본인인증이 필요합니다.',
    },
    {
      q: '프록시 입찰은 어떻게 작동하나요?',
      a: '최대 입찰가를 설정하면 시스템이 자동으로 최소 증분 단위로 경쟁합니다. 다른 입찰자가 있을 때만 가격이 올라갑니다.',
    },
    {
      q: '결제는 언제 진행되나요?',
      a: '낙찰 후 계약 체결 시 결제가 진행됩니다. 결제금은 에스크로 계좌에 보관되며, 광고 노출 완료 후 정산됩니다.',
    },
    {
      q: '광고 소재 검수 기준은 무엇인가요?',
      a: '가이드라인에 맞는 크기, 해상도, 파일 형식이어야 하며, 부적절한 내용이 없어야 합니다. 상세 가이드는 소재 등록 시 제공됩니다.',
    },
  ];

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
              <Link to="/how-it-works" className="text-sm text-emerald-600 font-medium">이용방법</Link>
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
            HOW IT WORKS
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            간단한 <span className="gradient-text">4단계</span> 프로세스
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            누구나 쉽게 시작할 수 있는 스폰서십 거래 플랫폼
          </p>
        </div>
      </section>

      {/* Key Points */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: '빠른 시작', desc: '가입 후 5분이면 첫 입찰 가능' },
              { icon: Shield, title: '안전한 거래', desc: 'KYC 인증 및 에스크로 보호' },
              { icon: Clock, title: '자동 처리', desc: '경매부터 정산까지 자동화' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Brand Process */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky-100 text-sky-700 text-sm font-medium mb-4 border border-sky-200">
              FOR BRANDS
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">브랜드 이용 방법</h2>
            <p className="text-slate-600">광고주로서 스폰서십을 확보하는 과정</p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-24 left-1/2 -translate-x-1/2 w-3/4 h-px bg-slate-200" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {brandSteps.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="relative">
                    <div className="card p-6 h-full">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center">
                          <Icon className="w-7 h-7 text-sky-600" />
                        </div>
                        <span className="text-3xl font-black text-sky-500/30">{item.step}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                      <p className="text-slate-600 text-sm mb-6">{item.description}</p>
                      <ul className="space-y-2">
                        {item.details.map((detail, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {i < brandSteps.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-24 z-10">
                        <ArrowRight className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Athlete Process */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4 border border-emerald-200">
              FOR ATHLETES
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">선수 이용 방법</h2>
            <p className="text-slate-600">선수로서 스폰서십을 판매하는 과정</p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-24 left-1/2 -translate-x-1/2 w-3/4 h-px bg-slate-300" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {athleteSteps.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="relative">
                    <div className="card p-6 h-full">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                          <Icon className="w-7 h-7 text-emerald-600" />
                        </div>
                        <span className="text-3xl font-black text-emerald-500/30">{item.step}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                      <p className="text-slate-600 text-sm mb-6">{item.description}</p>
                      <ul className="space-y-2">
                        {item.details.map((detail, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {i < athleteSteps.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-24 z-10">
                        <ArrowRight className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">자주 묻는 질문</h2>
            <p className="text-slate-600">이용 방법에 대한 궁금증을 해결하세요</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="card p-6">
                <h3 className="font-semibold text-slate-900 mb-3">{faq.q}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            지금 바로 시작해보세요
          </h2>
          <p className="text-slate-600 mb-8">
            5분이면 첫 경매에 참여할 수 있습니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="btn btn-primary text-base px-8 py-4 inline-flex items-center justify-center gap-2"
            >
              무료로 시작하기
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/features"
              className="btn btn-secondary text-base px-8 py-4 inline-flex items-center justify-center gap-2"
            >
              기능 살펴보기
            </Link>
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

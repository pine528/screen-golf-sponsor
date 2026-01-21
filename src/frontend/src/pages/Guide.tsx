import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users, Gavel, FileText, Wallet, Vote, Gift } from 'lucide-react';

export default function Guide() {
  const sections = [
    {
      icon: Users,
      title: '회원 유형',
      content: [
        '브랜드: 선수 스폰서십을 통해 마케팅 효과를 얻고자 하는 기업',
        '선수: 스폰서십 슬롯을 제공하는 프로 골퍼',
        '팬: 투표 참여 및 포인트 활동을 하는 일반 사용자',
      ],
    },
    {
      icon: Gavel,
      title: '경매 참여 방법',
      content: [
        '1. 브랜드 계정으로 로그인합니다',
        '2. 인벤토리에서 원하는 슬롯을 찾습니다',
        '3. 경매 또는 즉시구매로 슬롯을 확보합니다',
        '4. 선수가 계약에 서명하면 스폰서십이 시작됩니다',
      ],
    },
    {
      icon: FileText,
      title: '계약 프로세스',
      content: [
        '브랜드 입찰/즉시구매 → 계약 생성',
        '선수 서명 대기 (24시간 내)',
        '에스크로 결제 홀드',
        '소재 제출 및 검수',
        '인증 완료 후 정산',
      ],
    },
    {
      icon: Wallet,
      title: '결제 및 정산',
      content: [
        '브랜드: 지갑 충전 후 입찰/구매 가능',
        '에스크로 시스템으로 안전한 거래 보장',
        '선수: 인증 완료 후 정산금 출금 가능',
        '플랫폼 수수료: 거래 금액의 10%',
      ],
    },
    {
      icon: Vote,
      title: '팬 투표 시스템',
      content: [
        '포인트를 사용하여 투표에 참여',
        '정답 시 당첨금 배분',
        '투표 생성도 가능 (관리자 승인 필요)',
        '시즌 리더보드에서 순위 경쟁',
      ],
    },
    {
      icon: Gift,
      title: '포인트샵',
      content: [
        '포인트로 다양한 상품 교환 가능',
        '굿즈, 이용권, 경험 상품 등 제공',
        '주문 취소 시 포인트 환불',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-10 h-10 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-900">이용가이드</h1>
        </div>

        <p className="text-lg text-slate-600 mb-12">
          SponsorGolf 플랫폼 이용 방법을 안내해 드립니다.
        </p>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              </div>
              <ul className="space-y-2 text-slate-600">
                {section.content.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-slate-500">
          <p>더 궁금한 점이 있으시면 <Link to="/contact" className="text-emerald-600 hover:underline">고객센터</Link>로 문의해 주세요.</p>
        </div>
      </div>
    </div>
  );
}

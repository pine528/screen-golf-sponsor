import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones, Mail, Phone, Clock, MessageCircle } from 'lucide-react';

export default function Contact() {
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
          <Headphones className="w-10 h-10 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-900">고객센터</h1>
        </div>

        <p className="text-lg text-slate-600 mb-12">
          SponsorGolf 이용 중 궁금한 점이나 문제가 있으시면 언제든 문의해 주세요.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">이메일 문의</h2>
            <p className="text-slate-600 mb-4">
              상세한 문의사항은 이메일로 보내주세요.
            </p>
            <a
              href="mailto:support@sponsorgolf.com"
              className="text-emerald-600 font-semibold hover:underline"
            >
              support@sponsorgolf.com
            </a>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">전화 문의</h2>
            <p className="text-slate-600 mb-4">
              급한 문의는 전화로 연락해 주세요.
            </p>
            <a
              href="tel:1588-0000"
              className="text-emerald-600 font-semibold hover:underline"
            >
              1588-0000
            </a>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">운영 시간</h2>
            <p className="text-slate-600">
              평일: 09:00 - 18:00<br />
              토요일: 09:00 - 13:00<br />
              일요일/공휴일: 휴무
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">카카오톡 상담</h2>
            <p className="text-slate-600 mb-4">
              카카오톡 채널에서 빠르게 상담받으세요.
            </p>
            <span className="text-emerald-600 font-semibold">
              @SponsorGolf
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                Q. 브랜드 등록은 어떻게 하나요?
              </h3>
              <p className="text-slate-600">
                A. 팬 계정으로 로그인 후 '브랜드 등록' 메뉴에서 사업자 정보를 입력하고 신청하시면 됩니다.
                관리자 승인 후 브랜드 계정으로 전환됩니다.
              </p>
            </div>
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                Q. 포인트 충전은 어떻게 하나요?
              </h3>
              <p className="text-slate-600">
                A. 팬 포인트는 관리자 지급 또는 투표 당첨으로 획득할 수 있습니다.
                브랜드 지갑은 결제를 통해 충전할 수 있습니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Q. 계약 취소는 가능한가요?
              </h3>
              <p className="text-slate-600">
                A. 선수 서명 전까지는 취소가 가능합니다. 서명 후에는 양측 합의 또는 관리자 중재가 필요합니다.
              </p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/faq"
              className="text-emerald-600 font-semibold hover:underline"
            >
              더 많은 FAQ 보기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
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
          <Shield className="w-10 h-10 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-900">개인정보처리방침</h1>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm prose prose-slate max-w-none">
          <p className="text-slate-500 mb-8">시행일: 2026년 1월 1일</p>

          <p>
            SponsorGolf(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며,
            「개인정보 보호법」을 준수하고 있습니다.
          </p>

          <h2>1. 수집하는 개인정보 항목</h2>
          <h3>필수 항목</h3>
          <ul>
            <li>이메일, 비밀번호, 이름</li>
            <li>휴대폰 번호 (본인인증 시)</li>
          </ul>
          <h3>선수 추가 항목</h3>
          <ul>
            <li>소속, 프로필 사진, 경력 정보</li>
            <li>은행 계좌 정보 (정산용)</li>
          </ul>
          <h3>브랜드 추가 항목</h3>
          <ul>
            <li>사업자등록번호, 회사명, 대표자명</li>
            <li>사업자등록증 사본</li>
          </ul>

          <h2>2. 개인정보 수집 및 이용 목적</h2>
          <ul>
            <li>회원 가입 및 관리</li>
            <li>서비스 제공 및 계약 이행</li>
            <li>결제 및 정산</li>
            <li>고객 상담 및 민원 처리</li>
            <li>서비스 개선 및 신규 서비스 개발</li>
            <li>마케팅 및 광고 (동의 시)</li>
          </ul>

          <h2>3. 개인정보 보유 및 이용 기간</h2>
          <p>
            회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
            단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
          <ul>
            <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
            <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
            <li>웹사이트 방문기록: 3개월</li>
          </ul>

          <h2>4. 개인정보의 제3자 제공</h2>
          <p>
            회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 다음의 경우에는 예외로 합니다.
          </p>
          <ul>
            <li>이용자가 사전에 동의한 경우</li>
            <li>스폰서십 계약 이행을 위해 필요한 경우 (계약 당사자 간)</li>
            <li>법령의 규정에 따르거나, 수사 목적으로 법령에 따른 절차와 방법에 따라 요청받은 경우</li>
          </ul>

          <h2>5. 개인정보 처리 위탁</h2>
          <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
          <table className="w-full border-collapse border border-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 p-2">수탁업체</th>
                <th className="border border-slate-200 p-2">위탁업무</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 p-2">토스페이먼츠</td>
                <td className="border border-slate-200 p-2">결제 처리</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-2">AWS</td>
                <td className="border border-slate-200 p-2">클라우드 서버 운영</td>
              </tr>
            </tbody>
          </table>

          <h2>6. 개인정보의 파기</h2>
          <p>
            회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
            지체 없이 해당 개인정보를 파기합니다.
          </p>
          <ul>
            <li>전자적 파일: 복구 불가능한 방법으로 영구 삭제</li>
            <li>종이 문서: 분쇄기로 분쇄 또는 소각</li>
          </ul>

          <h2>7. 이용자의 권리</h2>
          <p>이용자는 다음과 같은 권리를 행사할 수 있습니다.</p>
          <ul>
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리 정지 요구</li>
          </ul>
          <p>
            위 권리 행사는 서비스 내 설정 또는 개인정보보호책임자에게 서면, 전화,
            이메일로 연락하여 요청할 수 있습니다.
          </p>

          <h2>8. 개인정보 보호책임자</h2>
          <ul>
            <li>성명: 홍길동</li>
            <li>직위: 개인정보보호책임자</li>
            <li>이메일: privacy@sponsorgolf.com</li>
            <li>전화: 1588-0000</li>
          </ul>

          <h2>9. 개인정보 안전성 확보 조치</h2>
          <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul>
            <li>개인정보 암호화 (AES-256)</li>
            <li>해킹 등에 대비한 기술적 대책</li>
            <li>개인정보 접근 권한 관리</li>
            <li>개인정보 취급 직원 교육</li>
          </ul>

          <h2>10. 방침 변경에 관한 사항</h2>
          <p>
            이 개인정보처리방침은 2026년 1월 1일부터 적용됩니다.
            변경이 있을 경우 시행 7일 전부터 공지사항을 통해 고지합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

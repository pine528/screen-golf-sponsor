/**
 * SPONPIK 서비스 오픈 안내 모달
 *
 * - 홈 진입 시 자동 표시
 * - "오늘 하루 보지 않기" 체크 시 24시간 동안 미표시 (localStorage)
 * - "확인" / "닫기" 클릭 시 즉시 닫기 (다음 방문에 다시 표시)
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// 공지 내용 변경 시 키 버전을 올려, 이전에 '오늘 하루 보지 않기'로 닫은 사용자도 새 공지를 보게 함
const STORAGE_KEY = 'sponpik-announcement-hidden-until-sep';

export function ServiceAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    // 오늘 하루 보지 않기 적용 여부 확인
    const hiddenUntil = localStorage.getItem(STORAGE_KEY);
    if (hiddenUntil) {
      const ts = Number(hiddenUntil);
      if (!isNaN(ts) && Date.now() < ts) {
        return; // 아직 숨김 기간
      }
    }
    // 약간 지연 후 표시 (페이지 로딩 후 자연스럽게)
    const t = setTimeout(() => setIsOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    if (hideToday) {
      // 24시간 후까지 숨김
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, String(tomorrow));
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(15, 42, 30, 0.55)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-auto overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 pt-7 pb-2 text-center">
          {/* X 닫기 (우상단) */}
          <button
            onClick={close}
            aria-label="닫기"
            className="absolute top-4 right-4 w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          {/* 로고 */}
          <img
            src="/logo-120.png"
            alt="SPONPIK"
            className="inline-block w-14 h-14 rounded-2xl shadow-md shadow-emerald-500/30 mb-4"
          />

          {/* 제목 */}
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">SPONPIK 공식 오픈 일정 변경 안내</h2>

          {/* 상태 뱃지 */}
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
            9월 공식 오픈 예정
          </span>
        </div>

        {/* 본문 */}
        <div className="px-7 py-5 text-center text-sm text-slate-700 leading-relaxed space-y-4 break-keep">
          <p>
            SPONPIK은 보다 안정적인 자동화 시스템과 완성도 높은 서비스 제공을 위해<br />
            공식 오픈 일정을 <span className="font-semibold text-emerald-700">9월</span>로 조정했습니다.
          </p>
          <p>
            <span className="font-semibold text-emerald-700">8월 대회</span>까지 수동·반자동 매칭을 운영하며<br />
            후원 슬롯 개설, 경매, AR 기반 패치 확인, 계약·검증, 정산, ROI 리포트 등<br />
            <span className="sm:whitespace-nowrap">핵심 기능을 실제 운영 환경에서 최종 점검하겠습니다.</span>
          </p>
          <p>
            오픈을 기다려주신 분들께 송구한 말씀을 드리며,<br />
            늦어진 만큼 더욱 안정적이고 신뢰할 수 있는 서비스로 찾아뵙겠습니다.
          </p>
          <p className="font-semibold text-slate-900">
            9월, SPONPIK이 스포츠 후원 거래시장을 공식 오픈합니다.
          </p>
        </div>

        {/* 확인 버튼 */}
        <div className="px-6 pb-3">
          <button
            onClick={close}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
          >
            확인
          </button>
        </div>

        {/* 하단 옵션 */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={hideToday}
              onChange={(e) => setHideToday(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>오늘 하루 보지 않기</span>
          </label>
          <button
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceAnnouncementModal;

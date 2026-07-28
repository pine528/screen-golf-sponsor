import { useState } from 'react';

/**
 * 카카오톡 상담하기 — 전역 플로팅 버튼 + 팝업
 *
 * 카카오톡 채널(스폰픽 비즈니스)로 1:1 상담 연결.
 * - 채널 공개 ID만 있으면 JS SDK 없이 채팅 URL로 바로 연결됨.
 * - 운영자 설정: 프론트엔드 .env 에  VITE_KAKAO_CHANNEL_ID=_xxxxx  (카카오 채널 관리자홈 > 채널 URL의 _뒤 값)
 *   예) 채널 URL이 http://pf.kakao.com/_AbCdE 이면  VITE_KAKAO_CHANNEL_ID=_AbCdE
 * - 미설정 시 이메일(support@sponpik.com) 문의로 폴백.
 */
const KAKAO_CHANNEL_ID = (import.meta.env.VITE_KAKAO_CHANNEL_ID as string) || '_xmpxknX';
const FALLBACK_EMAIL = 'support@sponpik.com';

const channelChatUrl = KAKAO_CHANNEL_ID ? `https://pf.kakao.com/${KAKAO_CHANNEL_ID}/chat` : '';
const channelHomeUrl = KAKAO_CHANNEL_ID ? `https://pf.kakao.com/${KAKAO_CHANNEL_ID}` : '';

export default function BrandInquiryButton() {
  const [open, setOpen] = useState(false);

  const openKakaoChat = () => {
    if (channelChatUrl) {
      window.open(channelChatUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent('[브랜드] 선수 후원 문의')}`;
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(true)}
        aria-label="카카오톡 상담하기"
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 hover:shadow-xl sm:px-5"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.6-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
        </svg>
        <span className="text-sm font-bold whitespace-nowrap">카카오톡 상담하기</span>
      </button>

      {/* 팝업 */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="relative bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 py-6 text-white">
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="absolute right-4 top-4 text-white/80 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
              <h2 className="text-lg font-extrabold">카카오톡 상담하기</h2>
              <p className="mt-1 text-sm text-emerald-50">
                관심 있는 선수의 슬롯 후원·제휴를 1:1로 상담해 드립니다.
              </p>
            </div>

            {/* 본문 */}
            <div className="px-6 py-5">
              <ul className="mb-5 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">●</span> 원하는 선수·노출 슬롯 추천
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">●</span> 후원 단가·계약 절차 안내
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">●</span> ROI 리포트·노출 성과 측정 상담
                </li>
              </ul>

              {/* 카카오톡 상담 버튼 */}
              <button
                onClick={openKakaoChat}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3.5 font-bold text-[#3C1E1E] transition hover:brightness-95"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.6-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
                </svg>
                카카오톡으로 1:1 문의
              </button>

              {channelHomeUrl && (
                <a
                  href={channelHomeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-center text-xs text-slate-400 hover:text-slate-600"
                >
                  스폰픽 카카오 채널 추가하기
                </a>
              )}

              {!channelChatUrl && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  카카오 채널 준비 중 — 현재는 {FALLBACK_EMAIL} 으로 연결됩니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

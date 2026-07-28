/**
 * 후원상품 권리관계 고정 안내문 (개편 LEG-04/05 · 핸드오프 §17.4)
 * - 상품 상세(선수 상세 슬롯 섹션), 경매 상세, 주문·계약 확인 화면에 고정 노출
 * - 특정 대회 공식 스폰서십으로 오인되는 것을 방지하는 법적 문구
 */
export default function LegalNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] leading-relaxed text-slate-500 break-keep ${className}`}>
      본 상품은 선수 개인이 제공하는 착장, 초상, SNS 및 브랜드 활동에 관한 후원상품입니다.
      대회 주최사·운영사·방송사의 공식 스폰서십, 경기장 광고권 또는 중계권을 포함하지 않습니다.
      스폰픽은 해당 대회의 공식 후원사 또는 운영 파트너가 아닙니다.
    </div>
  );
}

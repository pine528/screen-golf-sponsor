/**
 * 이벤트 객체에서 월 라벨을 추출합니다.
 * 대회명 대신 "7월", "8월" 등 월별로 표시합니다.
 */
export function getEventMonthLabel(event: any): string {
  if (!event) return '대회';
  const d = event.dateStart || event.date_start || event.startDate;
  if (!d) return '대회';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '대회';
  return `${dt.getMonth() + 1}월`;
}

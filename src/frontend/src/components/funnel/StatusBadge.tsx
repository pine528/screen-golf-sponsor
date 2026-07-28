/**
 * StatusBadge - 통일된 상태 배지 (Active / Paused / Refunded 등)
 *
 * Refs: wireframe_spec.docx > 3. 공통 구성 요소 > Status Badge
 */

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const COLOR_MAP: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ATTRIBUTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SETTLED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  READY: 'bg-emerald-100 text-emerald-700 border-emerald-200',

  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  HIDDEN: 'bg-slate-100 text-slate-600 border-slate-200',

  PAUSED: 'bg-amber-100 text-amber-700 border-amber-200',
  PARTIAL_REFUND: 'bg-amber-100 text-amber-700 border-amber-200',
  OVERUSED: 'bg-amber-100 text-amber-700 border-amber-200',

  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  DISABLED: 'bg-slate-200 text-slate-600 border-slate-300',
  MISSING: 'bg-rose-50 text-rose-600 border-rose-200',

  REFUNDED: 'bg-rose-100 text-rose-700 border-rose-200',
  CANCELLED: 'bg-rose-100 text-rose-700 border-rose-200',
  FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  UNATTRIBUTED: 'bg-rose-100 text-rose-700 border-rose-200',
};

const LABEL_MAP: Record<string, string> = {
  ACTIVE: '활성',
  PUBLISHED: '게시',
  DRAFT: '초안',
  HIDDEN: '비게시',
  PAUSED: '일시중지',
  EXPIRED: '만료',
  DISABLED: '비활성',
  PAID: '결제완료',
  REFUNDED: '환불',
  CANCELLED: '취소',
  PARTIAL_REFUND: '부분환불',
  PENDING: '대기',
  ATTRIBUTED: '귀속완료',
  UNATTRIBUTED: '미귀속',
  SETTLED: '정산완료',
  FAILED: '실패',
  OVERUSED: '한도초과',
  READY: '준비됨',
  MISSING: '미발급',
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const upper = status.toUpperCase();
  const cls = COLOR_MAP[upper] || 'bg-slate-100 text-slate-600 border-slate-200';
  const label = LABEL_MAP[upper] || status;
  const sizeCls = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold border rounded-full ${sizeCls} ${cls}`}>
      {label}
    </span>
  );
}

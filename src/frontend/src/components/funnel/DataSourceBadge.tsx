/**
 * DataSourceBadge - "실측 / 연동 / 추정" 데이터 출처 배지
 *
 * Refs: wireframe_spec.docx > 5. 협업 메모: 리포트 수치는 실측/연동/추정 배지를 공통 규칙으로 사용
 */

import { Activity, Link2, Lightbulb } from 'lucide-react';

export type DataSourceType = 'measured' | 'integrated' | 'estimated';

interface Props {
  type: DataSourceType;
  size?: 'sm' | 'md';
}

const META: Record<DataSourceType, { label: string; cls: string; Icon: any }> = {
  measured: {
    label: '실측',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: Activity,
  },
  integrated: {
    label: '연동',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
    Icon: Link2,
  },
  estimated: {
    label: '추정',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Lightbulb,
  },
};

export function DataSourceBadge({ type, size = 'sm' }: Props) {
  const { label, cls, Icon } = META[type];
  const sizeCls = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold border rounded ${sizeCls} ${cls}`}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {label}
    </span>
  );
}

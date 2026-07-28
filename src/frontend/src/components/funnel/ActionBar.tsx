/**
 * ActionBar - 복사/다운로드/재발급/미리보기 등 액션 버튼 그룹
 *
 * Refs: wireframe_spec.docx > 3. 공통 구성 요소 > Action Bar
 */

import { useState } from 'react';
import { Copy, Download, RefreshCw, Eye, Check, ExternalLink } from 'lucide-react';

interface ActionItem {
  type: 'copy' | 'download' | 'reissue' | 'preview' | 'external';
  label?: string;
  value?: string;          // copy/preview/external 시 사용
  onClick?: () => void;    // download/reissue 시 사용
  loading?: boolean;
}

interface Props {
  actions: ActionItem[];
  align?: 'left' | 'right';
}

export function ActionBar({ actions, align = 'left' }: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
      {actions.map((a, i) => (
        <ActionButton key={i} {...a} />
      ))}
    </div>
  );
}

function ActionButton({ type, label, value, onClick, loading }: ActionItem) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (type === 'copy' && value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    }
    if (type === 'preview' && value) {
      window.open(value, '_blank');
      return;
    }
    if (type === 'external' && value) {
      window.open(value, '_blank');
      return;
    }
    onClick?.();
  };

  const Icon = copied ? Check : type === 'copy' ? Copy
    : type === 'download' ? Download
    : type === 'reissue' ? RefreshCw
    : type === 'preview' ? Eye
    : ExternalLink;

  const defaultLabels = {
    copy: copied ? '복사됨' : '복사',
    download: '다운로드',
    reissue: '재발급',
    preview: '미리보기',
    external: '열기',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        copied
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {label || defaultLabels[type]}
    </button>
  );
}

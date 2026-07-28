/**
 * DetailTable - 정렬+페이지네이션 테이블 (가벼운 헤드리스)
 *
 * Refs: wireframe_spec.docx > 3. 공통 구성 요소 > Detail Table
 */

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DetailTable<T extends Record<string, any>>({
  data, columns, emptyMessage = '데이터가 없습니다',
  pageSize = 10, onRowClick,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const onHeaderClick = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('desc');
    }
  };

  if (data.length === 0) {
    return <div className="text-center py-12 text-sm text-slate-400 bg-slate-50 rounded-lg">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-hidden border border-slate-200 rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onHeaderClick(col)}
                  className={`px-4 py-2.5 font-semibold text-slate-600 text-${col.align || 'left'} ${col.sortable ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                  style={{ width: col.width }}
                >
                  <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-emerald-50/30' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 text-${col.align || 'left'} text-slate-700`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          <span>총 {sorted.length}개</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

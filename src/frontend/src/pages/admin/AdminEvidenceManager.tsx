import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Image,
  Loader2,
  Filter,
  Trash2,
  FileImage,
  Video,
  Download,
  AlertTriangle,
} from 'lucide-react';

export function AdminEvidenceManager() {
  const queryClient = useQueryClient();
  const [campaignFilter, setCampaignFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: campaignsData } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => api.get('/campaigns'),
  });

  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['admin-evidence', campaignFilter, typeFilter, page],
    queryFn: () => api.get('/roi/admin/evidence', {
      campaignId: campaignFilter || undefined,
      type: typeFilter || undefined,
      page,
      limit: 20,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roi/admin/evidence/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-evidence'] });
      setDeleteTarget(null);
    },
  });

  const campaigns = campaignsData?.data || [];
  const evidence = evidenceData?.data?.items || [];
  const pagination = evidenceData?.data?.pagination;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <Image className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">증빙 관리</h1>
            <p className="text-sm text-slate-500">캠페인 증빙 자료 조회/삭제/관리</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={campaignFilter}
              onChange={(e) => { setCampaignFilter(e.target.value); setPage(1); }}
              className="input w-64"
            >
              <option value="">전체 캠페인</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="input w-40"
            >
              <option value="">전체 유형</option>
              <option value="SCREENSHOT">스크린샷</option>
              <option value="CLIP">클립</option>
            </select>
            <div className="ml-auto text-sm text-slate-500">
              총 {pagination?.total || 0}건
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : evidence.length === 0 ? (
          <div className="card p-12 text-center">
            <Image className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">증빙 자료가 없습니다</h3>
            <p className="text-slate-500">검출 검수 후 증빙이 생성되면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">유형</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">슬롯</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-600">VOD</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">파일 크기</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">생성일</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidence.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {item.type === 'SCREENSHOT' ? (
                          <FileImage className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Video className="w-4 h-4 text-purple-500" />
                        )}
                        <span className={`badge text-xs ${
                          item.type === 'SCREENSHOT'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.type === 'SCREENSHOT' ? '스크린샷' : '클립'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-700">
                      {item.exposure?.slotType || '미분류'}
                    </td>
                    <td className="p-4 text-sm text-slate-500 truncate max-w-[200px]">
                      {item.exposure?.vodAsset?.fileName || '-'}
                    </td>
                    <td className="p-4 text-right text-sm text-slate-500">
                      {formatSize(item.fileSizeBytes)}
                    </td>
                    <td className="p-4 text-right text-sm text-slate-500">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setDeleteTarget(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  {pagination.total}건 중 {(page - 1) * 20 + 1}~{Math.min(page * 20, pagination.total)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-secondary text-sm"
                  >이전</button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="btn btn-secondary text-sm"
                  >다음</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">증빙 삭제</h3>
              </div>
              <p className="text-slate-600 mb-6">
                이 증빙 자료를 삭제하시겠습니까? 스토리지의 파일도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="btn btn-secondary"
                >취소</button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget)}
                  disabled={deleteMutation.isPending}
                  className="btn bg-red-500 text-white hover:bg-red-600"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminEvidenceManager;

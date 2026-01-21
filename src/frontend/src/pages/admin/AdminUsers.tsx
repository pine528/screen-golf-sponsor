/**
 * Phase 11-1: Admin Users Management Page
 * 관리자 계정 관리 (RBAC)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Shield,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Check,
  X,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import { cn } from '../../utils';

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  ADMIN: { label: 'ADMIN', color: 'bg-red-100 text-red-700', description: '전체 권한' },
  FINANCE: { label: 'FINANCE', color: 'bg-purple-100 text-purple-700', description: '재무/환불/정산' },
  SUPPORT: { label: 'SUPPORT', color: 'bg-blue-100 text-blue-700', description: '고객지원 (읽기 전용)' },
  AUDITOR: { label: 'AUDITOR', color: 'bg-green-100 text-green-700', description: '감사 (읽기 전용)' },
};

const ADMIN_ROLES = ['ADMIN', 'FINANCE', 'SUPPORT', 'AUDITOR'];

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Role change modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['admins', page, pageSize],
    queryFn: () => api.getAdmins({ page, limit: pageSize }),
  });

  // Mutation
  const changeRoleMutation = useMutation({
    mutationFn: (data: { adminId: string; role: string; confirmText: string; reason: string }) =>
      api.changeAdminRole(data.adminId, {
        role: data.role,
        confirmText: data.confirmText,
        reason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      closeRoleModal();
      alert('역할이 변경되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '역할 변경에 실패했습니다.');
    },
  });

  const admins = data?.data || [];
  const pagination = data?.pagination;

  const openRoleModal = (admin: any) => {
    setSelectedAdmin(admin);
    setNewRole(admin.role);
    setConfirmText('');
    setReason('');
    setRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setRoleModalOpen(false);
    setSelectedAdmin(null);
    setNewRole('');
    setConfirmText('');
    setReason('');
  };

  const handleRoleChange = () => {
    if (!selectedAdmin || !newRole) return;

    const expectedConfirmText = `CHANGE_ROLE_${selectedAdmin.email}`;
    if (confirmText !== expectedConfirmText) {
      alert(`확인 텍스트를 정확히 입력해주세요: ${expectedConfirmText}`);
      return;
    }

    if (reason.length < 10) {
      alert('사유는 최소 10자 이상 입력해주세요.');
      return;
    }

    changeRoleMutation.mutate({
      adminId: selectedAdmin.admin?.id,
      role: newRole,
      confirmText,
      reason,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserCog className="w-7 h-7 text-slate-600" />
              관리자 관리
            </h1>
            <p className="text-slate-500">관리자 계정의 역할과 권한을 관리합니다</p>
          </div>
        </div>

        {/* Role Legend */}
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">역할 설명</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(ROLE_CONFIG).map(([role, config]) => (
              <div key={role} className="flex items-start gap-2">
                <span className={cn('badge text-xs', config.color)}>{config.label}</span>
                <span className="text-sm text-slate-600">{config.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : admins.length === 0 ? (
          <div className="card p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">등록된 관리자가 없습니다</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">이메일</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">이름</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">역할</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">상태</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">생성일</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {admins.map((admin: any) => {
                  const roleConfig = ROLE_CONFIG[admin.role] || {
                    label: admin.role,
                    color: 'bg-slate-100 text-slate-600',
                  };

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{admin.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {admin.admin?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs', roleConfig.color)}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {admin.isActive ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <Check className="w-4 h-4" />
                            활성
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <X className="w-4 h-4" />
                            비활성
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(admin.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openRoleModal(admin)}
                          className="btn btn-secondary text-xs"
                          disabled={!admin.admin?.id}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          역할 변경
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary px-3 py-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-600">
              {page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="btn btn-secondary px-3 py-2 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Role Change Modal */}
        {roleModalOpen && selectedAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <h2 className="text-lg font-semibold">역할 변경 (Danger Zone)</h2>
              </div>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-medium mb-1">주의: 이 작업은 되돌릴 수 없습니다.</p>
                <p>역할 변경 시 해당 관리자의 접근 권한이 즉시 변경됩니다.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    대상 관리자
                  </label>
                  <p className="text-slate-900">{selectedAdmin.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    현재 역할
                  </label>
                  <span
                    className={cn(
                      'badge text-xs',
                      ROLE_CONFIG[selectedAdmin.role]?.color || 'bg-slate-100'
                    )}
                  >
                    {selectedAdmin.role}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    새 역할
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="input w-full"
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role} - {ROLE_CONFIG[role]?.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    확인 텍스트 입력
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    다음 텍스트를 정확히 입력하세요:{' '}
                    <code className="bg-slate-100 px-1 rounded">
                      CHANGE_ROLE_{selectedAdmin.email}
                    </code>
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="input w-full"
                    placeholder="확인 텍스트 입력..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    변경 사유 (최소 10자)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="역할 변경 사유를 입력하세요..."
                  />
                  <p className="text-xs text-slate-500 mt-1">{reason.length}/10자 이상</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={closeRoleModal} className="btn btn-secondary">
                  취소
                </button>
                <button
                  onClick={handleRoleChange}
                  disabled={
                    changeRoleMutation.isPending ||
                    newRole === selectedAdmin.role ||
                    confirmText !== `CHANGE_ROLE_${selectedAdmin.email}` ||
                    reason.length < 10
                  }
                  className="btn btn-primary disabled:opacity-50"
                >
                  {changeRoleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  역할 변경
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

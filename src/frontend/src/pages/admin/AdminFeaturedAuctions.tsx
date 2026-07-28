import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Star,
  Plus,
  X,
  Loader2,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils';
import { getEventMonthLabel } from '../../utils/eventMonth';

export function AdminFeaturedAuctions() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    athleteId: '',
    eventId: '',
    slotTemplateId: '',
    startAt: '',
    endAt: '',
    reservePrice: 100000,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Featured auctions list
  const { data: featuredData, isLoading } = useQuery({
    queryKey: ['admin-featured-auctions'],
    queryFn: () => api.getAdminFeaturedAuctions(),
  });

  // Athletes list for selection
  const { data: athletesData } = useQuery({
    queryKey: ['admin-athletes-list'],
    queryFn: () => api.getAdminAthletes({ page: 1, pageSize: 100 }),
    enabled: showCreateModal,
  });

  // Events list for selection
  const { data: eventsData } = useQuery({
    queryKey: ['events-list'],
    queryFn: () => api.getEvents({ status: 'UPCOMING' }),
    enabled: showCreateModal,
  });

  // Slot templates list for selection
  const { data: templatesData } = useQuery({
    queryKey: ['slot-templates-list'],
    queryFn: () => api.getSlotTemplates(),
    enabled: showCreateModal,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createFeaturedAuction({
      athleteId: createForm.athleteId,
      eventId: createForm.eventId,
      slotTemplateId: createForm.slotTemplateId,
      startAt: new Date(createForm.startAt).toISOString(),
      endAt: new Date(createForm.endAt).toISOString(),
      reservePrice: createForm.reservePrice,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-featured-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      setCreateError(error.response?.data?.error?.message || '추천 경매 등록에 실패했습니다.');
    },
  });

  const resetForm = () => {
    setCreateForm({
      athleteId: '',
      eventId: '',
      slotTemplateId: '',
      startAt: '',
      endAt: '',
      reservePrice: 100000,
    });
    setCreateError(null);
  };

  const featuredAuctions = featuredData?.data || [];
  const athletes = athletesData?.data?.athletes || [];
  const events = eventsData?.data || [];
  const templates = templatesData?.data || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const statusStyles: Record<string, string> = {
    LIVE: 'bg-emerald-100 text-emerald-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    ENDED: 'bg-slate-100 text-slate-600',
    CANCELLED: 'bg-red-100 text-red-700',
    UNSOLD: 'bg-amber-100 text-amber-700',
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-7 h-7 text-amber-500" />
              추천 경매 관리
            </h1>
            <p className="text-slate-500">유명 선수의 특별 공개 경매를 설정합니다</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            추천 경매 등록
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-slate-500 mb-1">진행중</div>
            <div className="text-2xl font-bold text-emerald-600">
              {featuredAuctions.filter((a: any) => a.status === 'LIVE').length}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-slate-500 mb-1">예정</div>
            <div className="text-2xl font-bold text-blue-600">
              {featuredAuctions.filter((a: any) => a.status === 'SCHEDULED').length}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-slate-500 mb-1">전체</div>
            <div className="text-2xl font-bold text-slate-700">
              {featuredAuctions.length}
            </div>
          </div>
        </div>

        {/* Featured Auctions List */}
        <div className="card">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">추천 경매 목록</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : featuredAuctions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>등록된 추천 경매가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {featuredAuctions.map((auction: any) => (
                <div key={auction.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('badge text-xs', statusStyles[auction.status])}>
                          {auction.status === 'LIVE' ? '진행중' :
                           auction.status === 'SCHEDULED' ? '예정' :
                           auction.status === 'ENDED' ? '종료' :
                           auction.status === 'CANCELLED' ? '취소' : '미낙찰'}
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {auction.slotInstance?.athlete?.name}
                        </span>
                        <span className="text-sm text-slate-400">-</span>
                        <span className="text-sm text-slate-600">
                          {auction.slotInstance?.slotTemplate?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {getEventMonthLabel(auction.slotInstance?.event)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(auction.startAt)} ~ {formatDate(auction.endAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {auction._count?.bids || 0}명 입찰
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        {formatCurrency(auction.currentPrice)}
                      </div>
                      <div className="text-sm text-slate-500">현재 경매가</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">추천 경매 등록</h3>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {createError}
                  </div>
                )}

                {/* Athlete Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    선수 선택 *
                  </label>
                  <select
                    value={createForm.athleteId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, athleteId: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">선수를 선택하세요</option>
                    {athletes.map((athlete: any) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athlete.name} ({athlete.tour})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    이벤트 선택 *
                  </label>
                  <select
                    value={createForm.eventId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, eventId: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">이벤트를 선택하세요</option>
                    {events.map((event: any) => (
                      <option key={event.id} value={event.id}>
                        {getEventMonthLabel(event)} ({event.tour})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slot Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    슬롯 템플릿 *
                  </label>
                  <select
                    value={createForm.slotTemplateId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, slotTemplateId: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">슬롯 템플릿을 선택하세요</option>
                    {templates.map((template: any) => (
                      <option key={template.id} value={template.id}>
                        {template.nameKr || template.name} ({template.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reserve Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    시작가 (원)
                  </label>
                  <input
                    type="number"
                    value={createForm.reservePrice}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, reservePrice: Number(e.target.value) }))}
                    className="input w-full"
                    min="0"
                    step="10000"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    경매 시작 시간 *
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.startAt}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, startAt: e.target.value }))}
                    className="input w-full"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    경매 종료 시간 *
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.endAt}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, endAt: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending ||
                    !createForm.athleteId ||
                    !createForm.eventId ||
                    !createForm.slotTemplateId ||
                    !createForm.startAt ||
                    !createForm.endAt
                  }
                  className="btn btn-primary"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      등록하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

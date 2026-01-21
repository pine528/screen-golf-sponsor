import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  MapPin,
  Users,
  Clock,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '../../utils';

export function AdminEvents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: eventsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-events', page, statusFilter],
    queryFn: () => api.getEvents({ page, status: statusFilter !== 'all' ? statusFilter : undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId),
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || '이벤트 삭제에 실패했습니다');
    },
  });

  const handleDelete = (event: any) => {
    if (window.confirm(`"${event.name}" 이벤트를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(event.id);
    }
  };

  const events = eventsData?.data || [];

  const filteredEvents = events.filter((event: any) =>
    event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.venue?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusStyles: Record<string, string> = {
    UPCOMING: 'bg-sky-100 text-sky-700 border-sky-200',
    ONGOING: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    UPCOMING: '예정',
    ONGOING: '진행중',
    COMPLETED: '완료',
    CANCELLED: '취소',
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '날짜 미정';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '날짜 미정';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">이벤트 관리</h1>
            <p className="text-slate-600 mt-1">스크린골프 대회 및 이벤트를 관리합니다</p>
          </div>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setShowModal(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            새 이벤트
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="이벤트명 또는 장소 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">전체 상태</option>
                <option value="UPCOMING">예정</option>
                <option value="ONGOING">진행중</option>
                <option value="COMPLETED">완료</option>
                <option value="CANCELLED">취소</option>
              </select>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-600">로딩 중...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">이벤트가 없습니다</h3>
              <p className="text-slate-600 mb-4">새 이벤트를 등록하여 시작하세요</p>
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                새 이벤트 등록
              </button>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      이벤트
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      기간
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      장소
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      참가자
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEvents.map((event: any) => (
                    <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{event.name}</p>
                            <p className="text-sm text-slate-500">{event.type || '일반 대회'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(event.dateStart || event.startDate)} - {formatDate(event.dateEnd || event.endDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="w-4 h-4" />
                          <span>{event.venue || '미정'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          <span>{event.participantCount || 0}명</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'badge',
                          statusStyles[event.status] || statusStyles.UPCOMING
                        )}>
                          {statusLabels[event.status] || '예정'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="보기"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(event)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  총 {filteredEvents.length}개 이벤트
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    페이지 {page}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <EventModal
          event={selectedEvent}
          onClose={() => {
            setShowModal(false);
            setSelectedEvent(null);
          }}
          onSave={() => {
            refetch();
            setShowModal(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </Layout>
  );
}

interface EventModalProps {
  event: any;
  onClose: () => void;
  onSave: () => void;
}

function EventModal({ event, onClose, onSave }: EventModalProps) {
  // Default dates for new events: start = today, end = 7 days later
  const getDefaultStartDate = () => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  };
  const getDefaultEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    name: event?.name || '',
    tour: event?.tour || 'KPGA',
    venue: event?.venue || '',
    startDate: event?.startDate?.split('T')[0] || event?.dateStart?.split('T')[0] || getDefaultStartDate(),
    endDate: event?.endDate?.split('T')[0] || event?.dateEnd?.split('T')[0] || getDefaultEndDate(),
    description: event?.description || '',
    broadcastEpisode: event?.broadcastEpisode || '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createEvent(data),
    onSuccess: () => onSave(),
    onError: (err: any) => setError(err.response?.data?.message || '이벤트 생성에 실패했습니다'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateEvent(event.id, data),
    onSuccess: () => onSave(),
    onError: (err: any) => setError(err.response?.data?.message || '이벤트 수정에 실패했습니다'),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate dates
    if (!formData.startDate || !formData.endDate) {
      setError('시작일과 종료일을 모두 입력해주세요');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (endDate < startDate) {
      setError('종료일은 시작일보다 같거나 늦어야 합니다');
      return;
    }

    // 날짜를 ISO datetime 형식으로 변환
    const payload = {
      name: formData.name,
      tour: formData.tour,
      venue: formData.venue || undefined,
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString(),
      description: formData.description || undefined,
      broadcastEpisode: formData.broadcastEpisode || undefined,
    };

    if (event) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {event ? '이벤트 수정' : '새 이벤트 등록'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">이벤트명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="2024 스크린골프 챔피언십"
              required
            />
          </div>
          <div>
            <label className="label">투어</label>
            <select
              value={formData.tour}
              onChange={(e) => setFormData({ ...formData, tour: e.target.value })}
              className="input"
              required
            >
              <option value="KPGA">KPGA</option>
              <option value="KLPGA">KLPGA</option>
              <option value="KGTOUR">KG투어</option>
              <option value="OTHER">기타</option>
            </select>
          </div>
          <div>
            <label className="label">장소</label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              className="input"
              placeholder="골프존 파크 강남점"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">시작일</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">종료일</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">방송 회차 (선택)</label>
            <input
              type="text"
              value={formData.broadcastEpisode}
              onChange={(e) => setFormData({ ...formData, broadcastEpisode: e.target.value })}
              className="input"
              placeholder="예: EP01, 1회차"
            />
          </div>
          <div>
            <label className="label">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[100px]"
              placeholder="이벤트에 대한 상세 설명을 입력하세요"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn btn-secondary flex-1">
              취소
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                event ? '수정' : '등록'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

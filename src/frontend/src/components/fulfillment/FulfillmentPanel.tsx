import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { FulfillmentTimeline, FulfillmentTimelineVertical } from './FulfillmentTimeline';
import { FulfillmentStatusBadge } from './FulfillmentStatusBadge';
import { ShippingInfoForm } from './ShippingInfoForm';
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  FileText,
  History,
  Check,
  Package,
} from 'lucide-react';
import { cn } from '../../utils';

type FulfillmentStatus =
  | 'NOT_STARTED'
  | 'DESIGNING'
  | 'PRODUCING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'ATTACHED';

interface FulfillmentPanelProps {
  contractId: string;
  userRole: 'BRAND' | 'ATHLETE' | 'ADMIN';
  className?: string;
}

export function FulfillmentPanel({ contractId, userRole, className }: FulfillmentPanelProps) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');

  const { data: fulfillmentData, isLoading, error } = useQuery({
    queryKey: ['fulfillment', contractId],
    queryFn: () => api.getContractFulfillment(contractId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: FulfillmentStatus; notes?: string }) =>
      api.updateFulfillmentStatus(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment', contractId] });
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: (data: { carrier: string; trackingNumber: string }) =>
      api.updateFulfillmentShipping(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment', contractId] });
    },
  });

  const markDeliveredMutation = useMutation({
    mutationFn: () => api.markFulfillmentDelivered(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment', contractId] });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: (data: { photoUrls: string[]; notes?: string }) =>
      api.addFulfillmentAttachment(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment', contractId] });
      setShowAddPhoto(false);
      setPhotoUrl('');
      setPhotoNotes('');
    },
  });

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200 p-6', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200 p-6', className)}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>이행 정보를 불러오는데 실패했습니다.</span>
        </div>
      </div>
    );
  }

  const fulfillment = fulfillmentData?.data;
  if (!fulfillment) return null;

  const currentStatus = fulfillment.status as FulfillmentStatus;
  const canUpdateStatus = userRole === 'BRAND' || userRole === 'ADMIN';
  const canAddShipping = (userRole === 'BRAND' || userRole === 'ADMIN') &&
    ['NOT_STARTED', 'DESIGNING', 'PRODUCING'].includes(currentStatus);
  const canMarkDelivered = (userRole === 'ATHLETE' || userRole === 'ADMIN') && currentStatus === 'SHIPPING';
  const canAddAttachment = (userRole === 'ATHLETE' || userRole === 'ADMIN') &&
    ['DELIVERED', 'ATTACHED'].includes(currentStatus);

  const handleStatusChange = (newStatus: FulfillmentStatus) => {
    updateStatusMutation.mutate({ status: newStatus });
  };

  const handleAddPhoto = () => {
    if (!photoUrl.trim()) return;
    addAttachmentMutation.mutate({
      photoUrls: [photoUrl],
      notes: photoNotes || undefined,
    });
  };

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200', className)}>
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">이행 추적</h3>
              <p className="text-sm text-slate-500">광고물 제작 및 부착 현황</p>
            </div>
          </div>
          <FulfillmentStatusBadge status={currentStatus} size="lg" />
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 border-b border-slate-200">
        <FulfillmentTimeline currentStatus={currentStatus} />
      </div>

      {/* Actions */}
      <div className="p-6 space-y-6">
        {/* Brand: Status Update Buttons */}
        {canUpdateStatus && currentStatus !== 'ATTACHED' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">상태 업데이트</p>
            <div className="flex flex-wrap gap-2">
              {currentStatus === 'NOT_STARTED' && (
                <button
                  onClick={() => handleStatusChange('DESIGNING')}
                  disabled={updateStatusMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                >
                  디자인 시작
                </button>
              )}
              {currentStatus === 'DESIGNING' && (
                <button
                  onClick={() => handleStatusChange('PRODUCING')}
                  disabled={updateStatusMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                >
                  제작 시작
                </button>
              )}
              {currentStatus === 'PRODUCING' && (
                <button
                  onClick={() => handleStatusChange('SHIPPING')}
                  disabled={updateStatusMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                >
                  배송 시작
                </button>
              )}
            </div>
          </div>
        )}

        {/* Shipping Info */}
        {canAddShipping && (
          <ShippingInfoForm
            onSubmit={async (data) => {
              await updateShippingMutation.mutateAsync(data);
            }}
            isLoading={updateShippingMutation.isPending}
          />
        )}

        {/* Show shipping info if exists */}
        {fulfillment.carrier && fulfillment.trackingNumber && (
          <ShippingInfoForm
            initialCarrier={fulfillment.carrier}
            initialTrackingNumber={fulfillment.trackingNumber}
            onSubmit={async () => {}}
            readOnly
          />
        )}

        {/* Athlete: Mark Delivered */}
        {canMarkDelivered && (
          <button
            onClick={() => markDeliveredMutation.mutate()}
            disabled={markDeliveredMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {markDeliveredMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            배송 수령 확인
          </button>
        )}

        {/* Athlete: Add Attachment Photos */}
        {canAddAttachment && (
          <div className="space-y-3">
            <button
              onClick={() => setShowAddPhoto(!showAddPhoto)}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              <Camera className="w-4 h-4" />
              부착 사진 등록
              {showAddPhoto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAddPhoto && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    사진 URL
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    메모 (선택)
                  </label>
                  <textarea
                    value={photoNotes}
                    onChange={(e) => setPhotoNotes(e.target.value)}
                    placeholder="부착 위치, 상태 등"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={handleAddPhoto}
                  disabled={!photoUrl || addAttachmentMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {addAttachmentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  사진 등록
                </button>
              </div>
            )}
          </div>
        )}

        {/* Attachment Photos */}
        {fulfillment.attachmentPhotoUrls && fulfillment.attachmentPhotoUrls.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">부착 사진</p>
            <div className="grid grid-cols-2 gap-3">
              {fulfillment.attachmentPhotoUrls.map((url: string, index: number) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={url}
                    alt={`부착 사진 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
        >
          <History className="w-4 h-4" />
          이력 보기
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* History */}
        {showHistory && fulfillment.history && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <FulfillmentTimelineVertical
              currentStatus={currentStatus}
              history={fulfillment.history}
            />
          </div>
        )}

        {/* Notes */}
        {fulfillment.notes && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <FileText className="w-4 h-4" />
              메모
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{fulfillment.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

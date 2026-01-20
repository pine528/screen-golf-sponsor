import { cn } from '../../utils';
import {
  CircleDot,
  Palette,
  Factory,
  Truck,
  PackageCheck,
  CheckCircle2,
  Check,
} from 'lucide-react';

type FulfillmentStatus =
  | 'NOT_STARTED'
  | 'DESIGNING'
  | 'PRODUCING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'ATTACHED';

const statusSteps: {
  status: FulfillmentStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { status: 'NOT_STARTED', label: '시작', icon: CircleDot },
  { status: 'DESIGNING', label: '디자인', icon: Palette },
  { status: 'PRODUCING', label: '제작', icon: Factory },
  { status: 'SHIPPING', label: '배송', icon: Truck },
  { status: 'DELIVERED', label: '수령', icon: PackageCheck },
  { status: 'ATTACHED', label: '부착', icon: CheckCircle2 },
];

function getStatusIndex(status: FulfillmentStatus): number {
  return statusSteps.findIndex((s) => s.status === status);
}

interface FulfillmentTimelineProps {
  currentStatus: FulfillmentStatus;
  className?: string;
}

export function FulfillmentTimeline({
  currentStatus,
  className,
}: FulfillmentTimelineProps) {
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {statusSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.status} className="flex flex-col items-center flex-1">
              {/* Step indicator */}
              <div className="relative flex items-center w-full">
                {/* Line before */}
                {index > 0 && (
                  <div
                    className={cn(
                      'absolute left-0 right-1/2 h-0.5 -translate-y-1/2 top-1/2',
                      isCompleted || isCurrent ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                  />
                )}

                {/* Line after */}
                {index < statusSteps.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-1/2 right-0 h-0.5 -translate-y-1/2 top-1/2',
                      isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                  />
                )}

                {/* Circle */}
                <div
                  className={cn(
                    'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-emerald-500 bg-white text-emerald-500 ring-4 ring-emerald-100',
                    isPending && 'border-slate-200 bg-white text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-xs font-medium',
                  isCompleted && 'text-emerald-600',
                  isCurrent && 'text-emerald-600',
                  isPending && 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FulfillmentTimelineVertical({
  currentStatus,
  history,
  className,
}: {
  currentStatus: FulfillmentStatus;
  history?: Array<{
    id: string;
    fromStatus: FulfillmentStatus | null;
    toStatus: FulfillmentStatus;
    changedBy: string;
    notes: string | null;
    createdAt: string;
  }>;
  className?: string;
}) {
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className={cn('space-y-4', className)}>
      {statusSteps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;
        const Icon = step.icon;

        // Find history entry for this status
        const historyEntry = history?.find((h) => h.toStatus === step.status);

        return (
          <div key={step.status} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2',
                  isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                  isCurrent && 'border-emerald-500 bg-white text-emerald-500',
                  isPending && 'border-slate-200 bg-white text-slate-300'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              {index < statusSteps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[24px]',
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-medium',
                    isCompleted && 'text-emerald-700',
                    isCurrent && 'text-emerald-700',
                    isPending && 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                    현재
                  </span>
                )}
              </div>
              {historyEntry && (
                <div className="mt-1 text-sm text-slate-500">
                  {new Date(historyEntry.createdAt).toLocaleString('ko-KR')}
                  {historyEntry.notes && (
                    <p className="mt-1 text-slate-600">{historyEntry.notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

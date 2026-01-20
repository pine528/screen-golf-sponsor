import { cn } from '../../utils';
import {
  CircleDot,
  Palette,
  Factory,
  Truck,
  PackageCheck,
  CheckCircle2,
} from 'lucide-react';

type FulfillmentStatus =
  | 'NOT_STARTED'
  | 'DESIGNING'
  | 'PRODUCING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'ATTACHED';

const statusConfig: Record<
  FulfillmentStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  NOT_STARTED: {
    label: '시작 전',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    icon: CircleDot,
  },
  DESIGNING: {
    label: '디자인 중',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: Palette,
  },
  PRODUCING: {
    label: '제작 중',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    icon: Factory,
  },
  SHIPPING: {
    label: '배송 중',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Truck,
  },
  DELIVERED: {
    label: '배송 완료',
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    icon: PackageCheck,
  },
  ATTACHED: {
    label: '부착 완료',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    icon: CheckCircle2,
  },
};

interface FulfillmentStatusBadgeProps {
  status: FulfillmentStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function FulfillmentStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: FulfillmentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.NOT_STARTED;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: FulfillmentStatus): string {
  return statusConfig[status]?.label || status;
}

export function getStatusColor(status: FulfillmentStatus): string {
  return statusConfig[status]?.color || 'text-slate-600';
}

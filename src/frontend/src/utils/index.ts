import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return format(parseISO(dateString), 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return '-';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return format(parseISO(dateString), 'yyyy년 M월 d일 HH:mm', { locale: ko });
  } catch {
    return '-';
  }
}

export function formatTimeRemaining(endAt: string | null | undefined): string {
  if (!endAt) return '-';
  try {
    const end = parseISO(endAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return '종료됨';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}일 ${hours % 24}시간`;
    }

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }

    if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    }

    return `${seconds}초`;
  } catch {
    return '-';
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true, locale: ko });
  } catch {
    return '-';
  }
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // KYC Status
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    // Event Status
    UPCOMING: 'info',
    LIVE: 'success',
    COMPLETED: 'default',
    CANCELLED: 'danger',
    // Slot Status
    OPEN: 'success',
    IN_AUCTION: 'warning',
    SOLD: 'info',
    CLOSED: 'default',
    // Auction Status
    SCHEDULED: 'info',
    ENDED: 'default',
    UNSOLD: 'warning',
    // Contract Status
    PENDING_SIGNATURE: 'warning',
    ACTIVE: 'success',
    ASSET_PENDING: 'warning',
    ASSET_APPROVED: 'info',
    VERIFICATION_PENDING: 'warning',
    VERIFIED: 'success',
    // Settlement Status
    PROCESSING: 'warning',
    PAID: 'success',
    FAILED: 'danger',
    REFUNDED: 'info',
  };
  return colors[status] || 'default';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // KYC
    PENDING: '심사 대기',
    APPROVED: '승인됨',
    REJECTED: '거절됨',
    // Event
    UPCOMING: '예정',
    LIVE: '진행 중',
    COMPLETED: '완료',
    CANCELLED: '취소',
    // Slot
    OPEN: '오픈',
    IN_AUCTION: '경매 중',
    SOLD: '판매됨',
    CLOSED: '종료',
    // Auction
    SCHEDULED: '예정',
    ENDED: '종료',
    UNSOLD: '유찰',
    // Contract
    PENDING_SIGNATURE: '서명 대기',
    ACTIVE: '진행 중',
    ASSET_PENDING: '소재 대기',
    ASSET_APPROVED: '소재 승인',
    VERIFICATION_PENDING: '인증 대기',
    VERIFIED: '인증 완료',
    // Settlement
    PROCESSING: '처리 중',
    PAID: '지급 완료',
    FAILED: '실패',
    REFUNDED: '환불',
  };
  return labels[status] || status;
}

export function getBodyPartLabel(bodyPart: string): string {
  const labels: Record<string, string> = {
    SHIRT_CHEST_LEFT: '상의 좌측',
    SHIRT_CHEST_RIGHT: '상의 우측',
    SHIRT_SLEEVE_LEFT: '상의 소매 좌측',
    SHIRT_SLEEVE_RIGHT: '상의 소매 우측',
    CAP_SIDE_LEFT: '모자 측면',
    CAP_BACK: '모자 후면',
    PANTS_BELT: '하의 벨트',
    SHIRT_BACK: '상의 후면',
  };
  return labels[bodyPart] || bodyPart;
}

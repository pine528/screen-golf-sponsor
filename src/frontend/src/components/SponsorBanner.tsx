import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { cn } from '../utils';

interface SponsorBannerProps {
  eventId: string;
  bannerUrl?: string;
  logoUrl?: string;
  message?: string;
  linkUrl?: string;
  brandName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SponsorBanner({
  eventId,
  bannerUrl,
  logoUrl,
  message,
  linkUrl,
  brandName,
  size = 'md',
  className,
}: SponsorBannerProps) {
  // Track banner impression on mount
  useEffect(() => {
    api.trackSponsorEngagement(eventId, 'banner_impression').catch(() => {});
  }, [eventId]);

  const handleBannerClick = () => {
    api.trackSponsorEngagement(eventId, 'banner_click').catch(() => {});
  };

  const handleLinkClick = () => {
    api.trackSponsorEngagement(eventId, 'link_click').catch(() => {});
  };

  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const logoSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  // If we have a banner image
  if (bannerUrl) {
    const bannerContent = (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-50 to-slate-100',
          className
        )}
        onClick={handleBannerClick}
      >
        <img
          src={bannerUrl}
          alt={brandName ? `${brandName} 스폰서 배너` : '스폰서 배너'}
          className="w-full h-auto object-cover"
        />
        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded">
          AD
        </div>
      </div>
    );

    if (linkUrl) {
      return (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
        >
          {bannerContent}
        </a>
      );
    }

    return bannerContent;
  }

  // If we only have logo/message (compact sponsor badge)
  if (logoUrl || message || brandName) {
    const content = (
      <div
        className={cn(
          'flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg',
          sizeClasses[size],
          className
        )}
        onClick={handleBannerClick}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt={brandName || '스폰서'}
            className={cn('rounded object-contain', logoSizeClasses[size])}
          />
        )}
        <div className="flex-1 min-w-0">
          {brandName && (
            <p className="text-xs font-medium text-amber-800 truncate">
              {brandName} 후원
            </p>
          )}
          {message && (
            <p className="text-xs text-amber-700 truncate">{message}</p>
          )}
        </div>
        {linkUrl && (
          <ExternalLink className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        )}
        <span className="px-1 py-0.5 bg-amber-200 text-amber-800 text-[9px] rounded flex-shrink-0">
          AD
        </span>
      </div>
    );

    if (linkUrl) {
      return (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
        >
          {content}
        </a>
      );
    }

    return content;
  }

  return null;
}

// Compact sponsor badge for cards
export function SponsorBadge({
  brandName,
  className,
}: {
  brandName?: string;
  className?: string;
}) {
  if (!brandName) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded',
        className
      )}
    >
      <span>🏷️</span>
      {brandName} 후원
    </span>
  );
}

import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  Gavel,
  FileText,
  User,
  LogOut,
  Settings,
  LayoutDashboard,
  Hexagon,
  Wallet,
  ChevronRight,
  Menu,
  X,
  Megaphone,
  Vote,
  CreditCard,
  BarChart3,
  Bell,
  CheckCheck,
  Users,
  Trophy,
  Star,
  Heart,
  Building2,
  Gift,
  ShoppingBag,
  HelpCircle,
  AlertTriangle,
  Flag,
  Eye,
  Wrench,
  TrendingUp,
  PenLine,
  Banknote,
  Award,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../utils';
import { api } from '../services/api';

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  payload?: {
    link?: string;
  };
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await api.getNotifications({ limit: 10 });
      if (response.success && response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  // Fetch unread count only (lighter polling)
  const fetchUnreadCount = async () => {
    try {
      const response = await api.getUnreadNotificationCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll for unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    const isFan = user?.role === 'FAN';
    logout();
    navigate(isFan ? '/fan/login' : '/login');
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await api.markNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    if (notification.payload?.link) {
      navigate(notification.payload.link);
      setIsNotificationOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const brandNavItems = [
    { path: '/dashboard', label: '대시보드', icon: Home },
    { path: '/inventory', label: '인벤토리', icon: Calendar },
    { path: '/auctions', label: '경매', icon: Gavel },
    { path: '/contracts', label: '계약 관리', icon: FileText },
    { path: '/brand/wallet', label: '지갑', icon: Wallet },
    { path: '/campaigns', label: '캠페인', icon: Megaphone },
    { path: '/brand/sponsored-votes', label: '후원 투표', icon: Heart },
    { path: '/brand/reports/roi', label: 'ROI 리포트', icon: TrendingUp },
    { path: '/votes', label: '투표', icon: Vote },
    { path: '/profile', label: '프로필', icon: User },
  ];

  const athleteNavItems = [
    { path: '/dashboard', label: '대시보드', icon: Home },
    { path: '/my-slots', label: '슬롯 관리', icon: Calendar },
    { path: '/contracts', label: '계약/오퍼', icon: FileText },
    { path: '/athlete/pending-signatures', label: '서명 대기', icon: PenLine },
    { path: '/settlements', label: '정산', icon: Wallet },
    { path: '/athlete/withdrawals', label: '출금 관리', icon: Banknote },
    { path: '/votes', label: '투표', icon: Vote },
    { path: '/profile', label: '프로필', icon: User },
  ];

  const adminNavItems = [
    { path: '/admin', label: '대시보드', icon: LayoutDashboard },
    { path: '/admin/events', label: '이벤트 관리', icon: Calendar },
    { path: '/admin/auctions', label: '경매 모니터링', icon: Gavel },
    { path: '/admin/entities', label: '등록 회원', icon: Users },
    { path: '/admin/kyc', label: 'KYC 심사', icon: User },
    { path: '/admin/brand-registrations', label: '브랜드 신청', icon: Building2 },
    { path: '/admin/reviews', label: '검수 관리', icon: FileText },
    { path: '/admin/votes', label: '투표 이벤트', icon: Vote },
    { path: '/admin/payments', label: '결제 관리', icon: CreditCard },
    { path: '/admin/finance', label: '재무 콘솔', icon: Wallet },
    { path: '/admin/faq', label: 'FAQ 관리', icon: HelpCircle },
    { path: '/admin/penalties', label: '페널티', icon: AlertTriangle },
    { path: '/admin/disputes', label: '분쟁 관리', icon: Flag },
    { path: '/admin/seasons', label: '시즌 관리', icon: Trophy },
    { path: '/admin/exposure', label: '노출 관리', icon: Eye },
    { path: '/admin/ops', label: '운영 도구', icon: Wrench },
    { path: '/admin/reports', label: '통합 리포트', icon: BarChart3 },
    { path: '/admin/settings', label: '설정', icon: Settings },
  ];

  const fanNavItems = [
    { path: '/fan', label: '홈', icon: Home },
    { path: '/votes', label: '투표', icon: Vote },
    { path: '/fan-votes/my', label: '내 투표', icon: ListChecks },
    { path: '/fan/badges', label: '내 뱃지', icon: Award },
    { path: '/points', label: '내 포인트', icon: Trophy },
    { path: '/shop', label: '포인트샵', icon: Gift },
    { path: '/orders', label: '교환내역', icon: ShoppingBag },
    { path: '/ranking', label: '랭킹', icon: Star },
    { path: '/favorites', label: '즐겨찾기', icon: Heart },
    { path: '/brand-register', label: '브랜드 등록', icon: Building2 },
  ];

  const navItems =
    user?.role === 'ADMIN'
      ? adminNavItems
      : user?.role === 'ATHLETE'
      ? athleteNavItems
      : user?.role === 'FAN'
      ? fanNavItems
      : brandNavItems;

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'ADMIN': return '관리자';
      case 'ATHLETE': return '선수';
      case 'FAN': return '팬';
      default: return '브랜드';
    }
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case 'ADMIN': return 'text-violet-600';
      case 'ATHLETE': return 'text-emerald-600';
      case 'FAN': return 'text-amber-600';
      default: return 'text-sky-600';
    }
  };

  const roleLabel = getRoleLabel();
  const roleColor = getRoleColor();

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-300">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <Link to={user?.role === 'FAN' ? '/fan' : '/dashboard'} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Hexagon className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">SPONSOR</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Mobile Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => {
                setIsNotificationOpen(!isNotificationOpen);
                if (!isNotificationOpen) fetchNotifications();
              }}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - Desktop fixed, Mobile slide-in */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 w-64 h-screen bg-white border-r border-slate-200 transition-transform duration-300',
          'lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 lg:h-16 px-4 lg:px-6 border-b border-slate-200">
            <Link to={user?.role === 'FAN' ? '/fan' : '/dashboard'} className="flex items-center gap-3" onClick={closeMobileMenu}>
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Hexagon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <span className="font-bold text-slate-900 tracking-tight">SPONSOR</span>
            </Link>
            <button
              onClick={closeMobileMenu}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMobileMenu}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-slate-900 border border-emerald-500/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600')} />
                  {item.label}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-emerald-600" />}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-slate-200">
            {/* Desktop Notification Bell */}
            <div className="mb-4 relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  if (!isNotificationOpen) fetchNotifications();
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              >
                <div className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                알림
                {unreadCount > 0 && (
                  <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {unreadCount}개 새 알림
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 max-h-96 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">알림</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        모두 읽음 처리
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-sm">
                        알림이 없습니다
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0',
                            !notification.isRead && 'bg-emerald-50/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {!notification.isRead && (
                              <span className="w-2 h-2 mt-2 bg-emerald-500 rounded-full flex-shrink-0" />
                            )}
                            <div className={cn('flex-1 min-w-0', notification.isRead && 'ml-5')}>
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatTimeAgo(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-100">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center border border-slate-200">
                <User className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                <p className={cn('text-xs font-medium', roleColor)}>{roleLabel}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

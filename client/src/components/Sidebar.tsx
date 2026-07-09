'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { chatApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Briefcase,
  Lightbulb,
  Calendar,
  Settings,
  LogOut,
  X,
  Globe,
  MessageSquare,
  Archive,
  StickyNote,
  Sun,
  Moon,
  Film,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  { href: '/dashboard',          labelKey: 'nav.dashboard',     icon: LayoutDashboard, allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/tasks',    labelKey: 'nav.allTasks',      icon: CheckSquare,     allowedRoles: ['owner', 'team_leader', 'member', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/content',  labelKey: 'nav.content',       icon: Film,            allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/reminders', labelKey: 'nav.reminders',     icon: StickyNote,      allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/chat',     labelKey: 'nav.globalChat',    icon: MessageSquare,   allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/client-chat', labelKey: 'nav.clientChat',  icon: MessageSquare,   allowedRoles: ['owner', 'team_leader', 'account_manager'] },
  { href: '/dashboard/team',     labelKey: 'nav.team',          icon: Users,           allowedRoles: ['owner'] },
  { href: '/dashboard/finance',  labelKey: 'nav.finance',       icon: Briefcase,       allowedRoles: ['owner'] },
  { href: '/dashboard/clients',  labelKey: 'nav.clients',       icon: Users,           allowedRoles: ['owner', 'team_leader', 'account_manager'] },
  { href: '/dashboard/closed-clients', labelKey: 'nav.closedClients', icon: Archive, allowedRoles: ['owner', 'team_leader', 'account_manager', 'moderation', 'content_creator'] },
  { href: '/dashboard/ideas',    labelKey: 'nav.contentIdeas',  icon: Lightbulb,       allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/calendar', labelKey: 'nav.calendar',      icon: Calendar,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/settings', labelKey: 'nav.settings',      icon: Settings,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager', 'content_creator'] },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    if (pathname === '/dashboard/chat') {
      localStorage.setItem('last_read_chat_time', new Date().toISOString());
      setHasNewMessage(false);
      return;
    }

    const checkNewMessages = async () => {
      try {
        const data = await chatApi.list();
        const messages = data.messages || [];
        if (messages.length === 0) return;

        const latestMessage = messages[messages.length - 1];
        if (latestMessage.user_id === user?.id) {
          return;
        }

        const lastRead = localStorage.getItem('last_read_chat_time');
        if (!lastRead || new Date(latestMessage.created_at) > new Date(lastRead)) {
          setHasNewMessage(true);
        }
      } catch (err) {
        console.error('Error checking new chat messages in sidebar:', err);
      }
    };

    checkNewMessages();

    const interval = setInterval(checkNewMessages, 10000);
    return () => clearInterval(interval);
  }, [pathname, user?.id]);

  const visibleItems = navItems.filter(item => {
    if (item.allowedRoles && (!user || !item.allowedRoles.includes(user.role))) return false;
    return true;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const toggleLocale = () => setLocale(locale === 'en' ? 'ar' : 'en');

  return (
    <aside className={cn('sidebar bg-white border-r border-[#E2E8F0] text-slate-800 shadow-sm', isOpen && 'open')}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Sawaqly Marketing Agency" className="size-full object-contain" />
          </div>
          <div>
            <div className="text-base font-extrabold text-[#1D61E7] tracking-tight lowercase leading-none">sawaqly</div>
            <div className="text-[8px] text-[#FFD200] font-extrabold uppercase tracking-widest font-mono mt-0.5">Marketing Agency</div>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-8 text-slate-400 hover:text-slate-800 hover:bg-slate-50"
            onClick={onClose}
            title={t('common.close')}
          >
            <X className="size-5" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 pb-2 font-mono">
          {t('nav.navigation')}
        </span>
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-all relative',
                isActive
                  ? 'bg-[#0F172A] text-white font-semibold rounded-full shadow-xs'
                  : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] rounded-full'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.href === '/dashboard/chat' && hasNewMessage && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 size-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-[#E2E8F0]" />

      {/* Controls: Language Toggle */}
      <div className="px-3 py-2 flex bg-white">
        <button
          onClick={toggleLocale}
          className="lang-toggle w-full justify-center bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#F1F5F9] text-slate-700 rounded-full transition-colors font-medium shadow-xs"
          title={t('lang.switch')}
        >
          <Globe className="lang-icon size-4" />
          {locale === 'en' ? t('lang.ar') : t('lang.en')}
        </button>
      </div>

      <Separator className="bg-[#E2E8F0]" />

      {/* Footer */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
          <Avatar className="size-8 shrink-0">
            {user?.avatar_url && (
              <AvatarImage src={user.avatar_url} alt={user.name} className="object-cover animate-fade-in" />
            )}
            <AvatarFallback className="bg-[#1D61E7] text-white text-[11px] font-bold">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-[#0F172A] truncate">{user?.name || 'User'}</div>
            <div className="text-[10px] text-slate-500 capitalize font-mono leading-none">{user?.role ? t(`role.${user.role}`) : t('role.member')}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md shrink-0"
            onClick={() => {
              if (onClose) onClose();
              logout();
            }}
            title={t('common.signOut')}
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}


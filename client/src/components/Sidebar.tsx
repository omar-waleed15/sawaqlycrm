'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { chatApi, remindersApi, tasksApi, clientChatApi } from '@/lib/api';
import { playNotificationSound } from '@/lib/notificationSound';
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
  CalendarDays,
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
  FileText,
  Megaphone,
  Shield,
  Wallet,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  { href: '/dashboard',          labelKey: 'nav.dashboard',     icon: LayoutDashboard, allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/tasks',    labelKey: 'nav.allTasks',      icon: CheckSquare,     allowedRoles: ['owner', 'team_leader', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/content',  labelKey: 'nav.content',       icon: Film,            allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/reminders', labelKey: 'nav.reminders',     icon: StickyNote,      allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/chat',     labelKey: 'nav.globalChat',    icon: MessageSquare,   allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/client-chat', labelKey: 'nav.clientChat',  icon: MessageSquare,   allowedRoles: ['owner', 'team_leader', 'account_manager'] },
  { href: '/dashboard/team',     labelKey: 'nav.team',          icon: Users,           allowedRoles: ['owner'] },
  { href: '/dashboard/finance',  labelKey: 'nav.finance',       icon: Briefcase,       allowedRoles: ['owner'] },
  { href: '/dashboard/my-salary', labelKey: 'nav.mySalary',     icon: Wallet,          allowedRoles: ['team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/clients',  labelKey: 'nav.clients',       icon: Users,           allowedRoles: ['owner', 'team_leader'] },
  { href: '/dashboard/closed-clients', labelKey: 'nav.closedClients', icon: Archive, allowedRoles: ['owner', 'team_leader', 'account_manager', 'moderation', 'content_creator'] },
  { href: '/dashboard/ideas',    labelKey: 'nav.contentIdeas',  icon: Lightbulb,       allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/calendar', labelKey: 'nav.calendar',      icon: Calendar,        allowedRoles: ['owner', 'team_leader', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/sales-calendar', labelKey: 'nav.salesCalendar', icon: CalendarDays, allowedRoles: ['sales'] },
  { href: '/dashboard/campaigns', labelKey: 'nav.campaigns',   icon: Megaphone,       allowedRoles: ['owner'] },
  { href: '/dashboard/notes',    labelKey: 'nav.notes',         icon: FileText,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/roles',   labelKey: 'nav.roles',         icon: Shield,          allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
  { href: '/dashboard/settings', labelKey: 'nav.settings',      icon: Settings,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'developer', 'graphic_designer', 'video_editor', 'reel_maker', 'moderation', 'account_manager', 'content_creator'] },
];

export default function Sidebar({ isOpen, onClose, onUnreadChange }: { isOpen?: boolean; onClose?: () => void; onUnreadChange?: (hasUnread: boolean) => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [hasNewClientChatMessage, setHasNewClientChatMessage] = useState(false);
  const [hasNewReminder, setHasNewReminder] = useState(false);
  const [hasNewTask, setHasNewTask] = useState(false);

  // Track previous unread flags to play chime on new incoming items
  const prevUnreadRef = useRef({
    reminder: false,
    task: false,
    chat: false,
    clientChat: false,
  });

  // Clear unread on route entry
  useEffect(() => {
    if (pathname.startsWith('/dashboard/chat')) {
      localStorage.setItem('last_read_chat_time', new Date().toISOString());
      setHasNewMessage(false);
    }
    if (pathname.startsWith('/dashboard/client-chat')) {
      localStorage.setItem('last_read_client_chat_time', new Date().toISOString());
      setHasNewClientChatMessage(false);
    }
    if (pathname.startsWith('/dashboard/reminders')) {
      localStorage.setItem('last_read_reminders_time', new Date().toISOString());
      setHasNewReminder(false);
    }
    if (pathname.startsWith('/dashboard/tasks')) {
      localStorage.setItem('last_read_tasks_time', new Date().toISOString());
      setHasNewTask(false);
    }
  }, [pathname]);

  // Background unread polling loop
  useEffect(() => {
    if (!user) return;

    const checkUnreads = async () => {
      if (!user) return;
      try {
        // 1. Check Reminders
        if (!pathname.startsWith('/dashboard/reminders')) {
          const remindersRes = await remindersApi.list().catch(() => ({ reminders: [] }));
          const inboxReminders = (remindersRes.reminders || []).filter((r: any) => r.receiver_id === user.id);
          const hasUnreadR = inboxReminders.some((r: any) => !r.read_at);
          if (hasUnreadR && !prevUnreadRef.current.reminder) {
            playNotificationSound('reminder');
          }
          prevUnreadRef.current.reminder = hasUnreadR;
          setHasNewReminder(hasUnreadR);
        }

        // 2. Check Tasks
        if (!pathname.startsWith('/dashboard/tasks')) {
          const tasksRes = await tasksApi.list({ assignee_id: user.id }).catch(() => ({ tasks: [] }));
          const userTasks = tasksRes.tasks || [];
          const lastReadTasks = localStorage.getItem('last_read_tasks_time');
          const hasUnreadT = userTasks.some((t: any) => {
            if (t.status === 'completed') return false;
            if (!lastReadTasks) return true;
            return new Date(t.created_at) > new Date(lastReadTasks);
          });
          if (hasUnreadT && !prevUnreadRef.current.task) {
            playNotificationSound('task');
          }
          prevUnreadRef.current.task = hasUnreadT;
          setHasNewTask(hasUnreadT);
        }

        // 3. Check Global Chat
        if (!pathname.startsWith('/dashboard/chat')) {
          const chatRes = await chatApi.list().catch(() => ({ messages: [] }));
          const messages = chatRes.messages || [];
          if (messages.length > 0) {
            const latestMessage = messages[messages.length - 1];
            if (latestMessage.user_id !== user.id) {
              const lastReadChat = localStorage.getItem('last_read_chat_time');
              const isNewMsg = !lastReadChat || new Date(latestMessage.created_at) > new Date(lastReadChat);
              if (isNewMsg && !prevUnreadRef.current.chat) {
                playNotificationSound('message');
              }
              prevUnreadRef.current.chat = isNewMsg;
              setHasNewMessage(isNewMsg);
            }
          }
        }

        // 4. Check Client Chat
        if (!pathname.startsWith('/dashboard/client-chat') && (user.role === 'owner' || user.role === 'team_leader' || user.role === 'account_manager')) {
          const clientChatRes = await clientChatApi.listRooms().catch(() => ({ rooms: [] }));
          const rooms = clientChatRes.rooms || [];
          const lastReadClientChat = localStorage.getItem('last_read_client_chat_time');
          const hasUnreadCC = rooms.some((r: any) => {
            if (r.unread_count > 0) return true;
            if (!r.last_message) return false;
            if (r.last_message.sender_type === 'user' && r.last_message.sender_id === user.id) return false;
            if (!lastReadClientChat) return true;
            return new Date(r.last_message.created_at) > new Date(lastReadClientChat);
          });
          if (hasUnreadCC && !prevUnreadRef.current.clientChat) {
            playNotificationSound('message');
          }
          prevUnreadRef.current.clientChat = hasUnreadCC;
          setHasNewClientChatMessage(hasUnreadCC);
        }
      } catch {
        // Silently swallow errors during server restart
      }
    };

    checkUnreads();
    const interval = setInterval(checkUnreads, 10000);
    return () => clearInterval(interval);
  }, [pathname, user]);

  const hasAnyUnread = hasNewMessage || hasNewClientChatMessage || hasNewReminder || hasNewTask;

  useEffect(() => {
    if (onUnreadChange) {
      onUnreadChange(hasAnyUnread);
    }
  }, [hasAnyUnread, onUnreadChange]);

  const visibleItems = navItems.filter(item => {
    if (item.allowedRoles && (!user || !item.allowedRoles.includes(user.role))) return false;
    return true;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const toggleLocale = () => setLocale(locale === 'en' ? 'ar' : 'en');

  return (
    <aside
      className={cn(
        'sidebar bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 shadow-xl',
        isOpen && 'open sidebar-open'
      )}
    >
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
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
              )}
              {item.href === '/dashboard/client-chat' && hasNewClientChatMessage && (
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
              )}
              {item.href === '/dashboard/reminders' && hasNewReminder && (
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
              )}
              {item.href === '/dashboard/tasks' && hasNewTask && (
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
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


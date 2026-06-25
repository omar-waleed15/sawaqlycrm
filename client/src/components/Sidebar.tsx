'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  { href: '/dashboard',          labelKey: 'nav.dashboard',     icon: LayoutDashboard, allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/tasks',    labelKey: 'nav.allTasks',      icon: CheckSquare,     allowedRoles: ['owner', 'team_leader', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/chat',     labelKey: 'nav.globalChat',    icon: MessageSquare,   allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/team',     labelKey: 'nav.team',          icon: Users,           allowedRoles: ['owner'] },
  { href: '/dashboard/finance',  labelKey: 'nav.finance',       icon: Briefcase,       allowedRoles: ['owner'] },
  { href: '/dashboard/clients',  labelKey: 'nav.clients',       icon: Users,           allowedRoles: ['owner', 'team_leader', 'account_manager'] },
  { href: '/dashboard/ideas',    labelKey: 'nav.contentIdeas',  icon: Lightbulb,       allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager'] },
  { href: '/dashboard/calendar', labelKey: 'nav.calendar',      icon: Calendar,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/settings', labelKey: 'nav.settings',      icon: Settings,        allowedRoles: ['owner', 'team_leader'] },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLanguage();

  const visibleItems = navItems.filter(item => {
    if (item.allowedRoles && (!user || !item.allowedRoles.includes(user.role))) return false;
    return true;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const toggleLocale = () => setLocale(locale === 'en' ? 'ar' : 'en');

  return (
    <aside className={cn('sidebar', isOpen && 'open')}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            S
          </div>
          <div>
            <div className="text-sm font-bold text-foreground tracking-tight">{t('common.appName')}</div>
            <div className="text-[11px] text-muted-foreground">{t('common.marketingAgency')}</div>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            title={t('common.close')}
          >
            <X className="size-5" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2">
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
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Language Toggle */}
      <div className="px-3 py-2">
        <button
          onClick={toggleLocale}
          className="lang-toggle w-full justify-center"
          title={t('lang.switch')}
        >
          <Globe className="lang-icon size-4" />
          {locale === 'en' ? t('lang.ar') : t('lang.en')}
        </button>
      </div>

      <Separator />

      {/* Footer */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted transition-colors">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[11px] font-bold">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-foreground truncate">{user?.name || 'User'}</div>
            <div className="text-[11px] text-muted-foreground capitalize">{user?.role ? t(`role.${user.role}`) : t('role.member')}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 shrink-0"
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


'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
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
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard, allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/tasks',    label: 'All Tasks',        icon: CheckSquare,     allowedRoles: ['owner', 'team_leader', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/team',     label: 'Team',             icon: Users,           allowedRoles: ['owner'] },
  { href: '/dashboard/finance',  label: 'Finance',          icon: Briefcase,       allowedRoles: ['owner'] },
  { href: '/dashboard/clients',  label: 'Clients',          icon: Users,           allowedRoles: ['owner', 'team_leader', 'account_manager'] },
  { href: '/dashboard/ideas',    label: 'Content Ideas',    icon: Lightbulb,       allowedRoles: ['owner', 'team_leader', 'moderation', 'account_manager'] },
  { href: '/dashboard/calendar', label: 'Calendar',         icon: Calendar,        allowedRoles: ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'] },
  { href: '/dashboard/settings', label: 'Settings',         icon: Settings,        allowedRoles: ['owner', 'team_leader'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = navItems.filter(item => {
    if (item.allowedRoles && (!user || !item.allowedRoles.includes(user.role))) return false;
    return true;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            S
          </div>
          <div>
            <div className="text-sm font-bold text-foreground tracking-tight">Sawaqly CRM</div>
            <div className="text-[11px] text-muted-foreground">Marketing Agency</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2">
          Navigation
        </span>
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

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
            <div className="text-[11px] text-muted-foreground capitalize">{user?.role || 'member'}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 shrink-0"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Loader2, LogOut, LayoutDashboard, Calendar, FileText, HelpCircle, User, Settings, Globe, MessageSquare, Menu } from 'lucide-react';

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/login' || pathname === '/client/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/login');
    }
  }, [user, loading, isLoginPage, router]);

  // If loading user state on authenticated pages, show minimal loading screen
  if (loading && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050506] text-[#8f8f9e]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-white" />
          <span className="text-[10px] tracking-widest uppercase font-mono">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // If login page, just render the login view directly
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Safeguard: if logged in but not a client role, block access
  if (user && user.role !== 'client') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050506] text-[#f4f4f5] p-4 text-center select-none font-sans">
        <h1 className="text-sm font-bold uppercase tracking-widest mb-2 text-white">Access Denied</h1>
        <p className="text-xs text-[#8f8f9e] mb-6 max-w-sm font-medium leading-relaxed">This portal is specifically for client accounts. Please sign out and log in to the agency dashboard.</p>
        <button
          onClick={logout}
          className="h-10 px-6 border border-[#2d2d34] bg-[#0c0c0e] hover:bg-[#121214] text-white font-semibold uppercase tracking-widest text-[10px] transition-colors font-mono"
        >
          <LogOut className="size-3.5 mr-2 inline" /> Sign Out
        </button>
      </div>
    );
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleLocale = () => setLocale(locale === 'en' ? 'ar' : 'en');

  const navLinks = [
    { label: t('portal.overview'), href: '/client', icon: LayoutDashboard },
    { label: t('portal.chat') || 'Chat', href: '/client/chat', icon: MessageSquare },
    { label: t('portal.contentPlan'), href: '/client/content', icon: FileText },
    { label: t('portal.calendar'), href: '/client/calendar', icon: Calendar },
    { label: t('portal.faq'), href: '/client/faq', icon: HelpCircle },
    { label: t('portal.settings'), href: '/client/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row font-sans select-none overflow-hidden" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-[#E2E8F0] shrink-0 z-30">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="size-6 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Sawaqly" className="size-full object-contain" />
          </div>
          <span className="text-sm font-extrabold text-[#1D61E7] tracking-tight lowercase">sawaqly</span>
        </div>

        <button
          onClick={toggleLocale}
          className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md"
        >
          {locale === 'en' ? 'AR' : 'EN'}
        </button>
      </header>

      {/* Mobile Navigation Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left/Right Sidebar based on locale */}
      <aside
        className={`fixed md:static inset-y-0 z-50 w-60 border-[#E2E8F0] bg-white text-slate-800 flex flex-col justify-between shrink-0 shadow-sm transition-transform duration-200 ${
          locale === 'ar' ? 'right-0 border-l' : 'left-0 border-r'
        } ${mobileMenuOpen ? 'translate-x-0' : (locale === 'ar' ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')}`}
      >
        <div className="flex flex-col">
          <div className="h-16 px-6 border-b border-[#E2E8F0] flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="size-8 flex items-center justify-center overflow-hidden shrink-0">
                <img src="/logo.png" alt="Sawaqly Marketing Agency" className="size-full object-contain" />
              </div>
              <div className="flex flex-col text-start">
                <span className="text-base font-extrabold text-[#1D61E7] tracking-tight lowercase leading-none">sawaqly</span>
                <span className="text-[8px] text-[#FFD200] uppercase tracking-widest font-mono mt-0.5 font-bold">{t('portal.marketingAgency')}</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <LogOut className="size-4 rotate-180" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 p-4">
            {navLinks.map(link => {
              const isActive = pathname === link.href || (link.href === '/client' && pathname === '/');
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2 transition-all text-[10px] uppercase font-mono tracking-wider font-extrabold ${
                    isActive 
                      ? 'bg-[#0F172A] text-white rounded-full shadow-xs' 
                      : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] rounded-full'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="flex flex-col">
          {/* Language Toggle */}
          <div className="px-4 py-2 border-t border-[#E2E8F0] flex bg-white">
            <button
              onClick={toggleLocale}
              className="lang-toggle w-full flex items-center justify-center gap-2 h-9 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-slate-700 rounded-full transition-colors text-xs font-semibold shadow-xs"
              title={t('lang.switch')}
            >
              <Globe className="size-4 shrink-0" />
              {locale === 'en' ? t('lang.ar') : t('lang.en')}
            </button>
          </div>

          {/* User profile and logout */}
          <div className="p-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-3 p-3 border border-[#E2E8F0] bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-6 rounded-full bg-slate-200 flex items-center justify-center border border-[#E2E8F0] overflow-hidden shrink-0">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="size-full object-cover" />
                  ) : (
                    <User className="size-3.5 text-slate-500" />
                  )}
                </div>
                <span className="text-[10px] font-bold font-mono text-[#0F172A] truncate uppercase tracking-wider">{user?.name}</span>
              </div>

              <button
                onClick={logout}
                className="size-7 flex items-center justify-center border border-[#E2E8F0] bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                title={t('portal.signOut')}
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
        <main className="flex-1 px-4 py-4 md:px-8 md:py-8 flex flex-col min-h-0 text-start min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

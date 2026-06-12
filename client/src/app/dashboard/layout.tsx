'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { Menu } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="app-layout">
      {/* Mobile Topbar */}
      <header className="mobile-topbar md:hidden flex items-center justify-between px-4 border-b border-border bg-background fixed top-0 left-0 right-0 z-40 h-[68px]">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Open Menu"
        >
          <Menu className="size-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shrink-0">
            S
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">Sawaqly CRM</span>
        </div>
        <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
          {user?.name ? getInitials(user.name) : '?'}
        </div>
      </header>

      {/* Backdrop Overlay for mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

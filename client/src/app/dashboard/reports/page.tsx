'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileBarChart,
  CalendarCheck,
  TrendingUp,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import DailyReportsView from '@/components/reports/DailyReportsView';
import MonthlyReportsView from '@/components/reports/MonthlyReportsView';

export default function ReportsHubPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();

  // Tab State: 'daily' | 'monthly'
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Role Protection: owner, team_leader, and account_manager only
  const isAuthorized = user && ['owner', 'team_leader', 'account_manager'].includes(user.role);

  if (!isAuthorized) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-rose-500/20 bg-rose-500/5 text-center p-8 rounded-2xl shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 pt-4">
            <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="size-8" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This section is reserved exclusively for Administrators and Account Managers to oversee daily client updates and monthly performance reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container fade-in pb-16">
      {/* ── Page Header matching CRM design system ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('reports.title')}</h1>
          <p className="page-header-subtitle">
            {t('reports.subtitle')}
          </p>
        </div>
      </div>

      {/* ── Tabs matching CRM design system ── */}
      <div className="flex gap-1 border-b border-border mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'daily'
              ? 'border-[#1D61E7] text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarCheck className="size-4" />
          {t('reports.dailyReports')}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'monthly'
              ? 'border-[#1D61E7] text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="size-4" />
          {t('reports.monthlyReports')}
        </button>
      </div>

      {/* ── Active Tab View ── */}
      <div className="animate-in fade-in duration-150">
        {activeTab === 'daily' ? <DailyReportsView /> : <MonthlyReportsView />}
      </div>
    </div>
  );
}

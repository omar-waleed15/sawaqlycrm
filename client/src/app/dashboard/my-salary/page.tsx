'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { salariesApi } from '@/lib/api';
import { Salary } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Wallet, AlertTriangle, HandCoins, CheckCircle2, Clock, Calendar as CalendarIcon, FileSpreadsheet } from 'lucide-react';

export default function MySalaryPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const loadSalaryData = useCallback(async (monthStr: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await salariesApi.getMySalary({ month: monthStr });
      setSalary(data.salary || null);
      if (data.availableMonths && data.availableMonths.length > 0) {
        setAvailableMonths(data.availableMonths);
      }
    } catch (err: any) {
      console.error('Failed to load personal salary data:', err);
      setErrorMsg(err.message || 'Failed to load salary statement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSalaryData(selectedMonth);
  }, [selectedMonth, loadSalaryData]);

  // Derived Calculations
  const baseSalary = salary ? Number(salary.amount) : 0;
  const penaltyTotal = salary?.penalties
    ? salary.penalties.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;
  const advanceTotal = salary?.advances
    ? salary.advances.reduce((sum, a) => sum + Number(a.amount), 0)
    : 0;
  const totalDeductions = penaltyTotal + advanceTotal;
  const netSalary = Math.max(0, baseSalary - totalDeductions);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="size-7 text-primary" />
            {t('mySalary.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('mySalary.subtitle')}
          </p>
        </div>

        {/* Month Filter Picker */}
        <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border shadow-xs w-full sm:w-auto">
          <CalendarIcon className="size-4 text-muted-foreground ml-2 shrink-0" />
          <input
            type="month"
            className="bg-transparent text-sm font-semibold text-foreground focus:outline-none cursor-pointer py-1 px-2 w-full sm:w-40"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900/50 p-4 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{t('clients.savingProgress')}</span>
        </div>
      ) : !salary ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileSpreadsheet className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{t('mySalary.noRecord')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            There is no salary record registered for your account for <span className="font-semibold text-foreground">{selectedMonth}</span>. Contact management if you believe this is an error.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 4 Core Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Base Salary */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('mySalary.baseSalary')}
                </span>
                <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                  <Wallet className="size-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {formatCurrency(baseSalary, locale)}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
                  {salary.is_recurring ? `🔄 ${t('finance.recurring')} (${salary.recurrence || 'monthly'})` : '💳 ' + t('finance.oneTime')}
                </span>
              </div>
            </div>

            {/* Card 2: Penalties / Deductions */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('mySalary.deductions')}
                </span>
                <div className="size-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="size-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  -{formatCurrency(penaltyTotal, locale)}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
                  {salary.penalties?.length || 0} logged penalties
                </span>
              </div>
            </div>

            {/* Card 3: Salary Advances */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('mySalary.advances')}
                </span>
                <div className="size-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
                  <HandCoins className="size-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                  -{formatCurrency(advanceTotal, locale)}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
                  {salary.advances?.length || 0} logged advances
                </span>
              </div>
            </div>

            {/* Card 4: Net Payable Salary */}
            <div className="bg-card border-2 border-primary/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {t('mySalary.netSalary')}
                </span>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${salary.paid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'}`}>
                  {salary.paid ? (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      {t('finance.paid')}
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5" />
                      {t('finance.unpaid')}
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-primary">
                  {formatCurrency(netSalary, locale)}
                </div>
                <span className="text-[11px] text-muted-foreground font-semibold mt-1 block">
                  {salary.paid && salary.paid_date ? `Paid on ${formatDate(salary.paid_date, locale)}` : 'End of month payout'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Penalties Log */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-500" />
                  {t('mySalary.deductionsHistory')}
                </span>
                <span className="text-xs font-extrabold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900/40">
                  -{formatCurrency(penaltyTotal, locale)}
                </span>
              </h3>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {salary.penalties && salary.penalties.length > 0 ? (
                  salary.penalties.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground">
                          {p.notes || 'Deduction'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.created_at ? formatDate(p.created_at.substring(0, 10), locale) : '—'}
                        </div>
                      </div>
                      <span className="font-extrabold text-rose-600 text-sm shrink-0">
                        -{formatCurrency(Number(p.amount), locale)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground italic">
                    No deductions logged for this month.
                  </div>
                )}
              </div>
            </div>

            {/* Advances Log */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HandCoins className="size-4 text-sky-500" />
                  {t('mySalary.advancesHistory')}
                </span>
                <span className="text-xs font-extrabold text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-900/40">
                  -{formatCurrency(advanceTotal, locale)}
                </span>
              </h3>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {salary.advances && salary.advances.length > 0 ? (
                  salary.advances.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground">
                          {a.notes || 'Salary Advance'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {a.date ? formatDate(a.date, locale) : (a.created_at ? formatDate(a.created_at.substring(0, 10), locale) : '—')}
                        </div>
                      </div>
                      <span className="font-extrabold text-sky-600 text-sm shrink-0">
                        -{formatCurrency(Number(a.amount), locale)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground italic">
                    No advances logged for this month.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Note if exists */}
          {salary.note && (
            <div className="bg-muted/30 border border-border p-4 rounded-xl text-xs space-y-1 text-start">
              <span className="font-bold text-foreground block">Salary Note:</span>
              <p className="text-muted-foreground leading-relaxed italic">{salary.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

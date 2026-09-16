'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Salary } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { salariesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Gift,
  AlertTriangle,
  HandCoins,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import FinancialActionModal from './FinancialActionModal';

interface ProfileFinancialsTabProps {
  member: User;
  currentUser?: User;
  canManage: boolean;
}

export default function ProfileFinancialsTab({
  member,
  currentUser,
  canManage,
}: ProfileFinancialsTabProps) {
  const { t, locale } = useLanguage();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Financial Action Modal
  const [modalType, setModalType] = useState<'advance' | 'penalty' | 'bonus' | null>(null);

  const isSelf = currentUser ? currentUser.id === member.id : !canManage;

  const loadSalary = useCallback(async () => {
    try {
      setLoading(true);
      if (isSelf) {
        // Self-service: fetch logged-in user's salary via /my-salary (works for all roles)
        const res = await salariesApi.getMySalary({ month: selectedMonth });
        setSalary(res.salary || null);
      } else if (canManage) {
        // Manager viewing another team member
        const res = await salariesApi.list({ month: selectedMonth });
        const found = (res.salaries || []).find(s => s.user_id === member.id);
        setSalary(found || null);
      } else {
        setSalary(null);
      }
    } catch (err) {
      console.error('Failed to load salary record:', err);
      setSalary(null);
    } finally {
      setLoading(false);
    }
  }, [member.id, selectedMonth, canManage, isSelf]);

  useEffect(() => {
    loadSalary();
  }, [loadSalary]);

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!salary) return;
    if (!window.confirm(t('profile.deleteConfirm') || 'Delete this advance record?')) return;
    try {
      await salariesApi.deleteAdvance(salary.id, advanceId);
      loadSalary();
    } catch (err) {
      console.error('Failed to delete advance:', err);
    }
  };

  const handleDeletePenalty = async (penaltyId: string) => {
    if (!salary) return;
    if (!window.confirm(t('profile.deleteConfirm') || 'Delete this penalty/deduction?')) return;
    try {
      await salariesApi.deletePenalty(salary.id, penaltyId);
      loadSalary();
    } catch (err) {
      console.error('Failed to delete penalty:', err);
    }
  };

  const handleDeleteBonus = async (bonusId: string) => {
    if (!salary) return;
    if (!window.confirm(t('profile.deleteConfirm') || 'Delete this bonus record?')) return;
    try {
      await salariesApi.deleteBonus(salary.id, bonusId);
      loadSalary();
    } catch (err) {
      console.error('Failed to delete bonus:', err);
    }
  };

  // Calculations
  const baseSalary = salary ? Number(salary.amount) : 0;
  const bonusTotal = salary?.bonuses
    ? salary.bonuses.reduce((sum, b) => sum + Number(b.amount), 0)
    : 0;
  const penaltyTotal = salary?.penalties
    ? salary.penalties.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;
  const advanceTotal = salary?.advances
    ? salary.advances.reduce((sum, a) => sum + Number(a.amount), 0)
    : 0;
  const totalDeductions = penaltyTotal + advanceTotal;
  const netSalary = Math.max(0, baseSalary + bonusTotal - totalDeductions);

  return (
    <div className="space-y-6 text-start">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary shrink-0" />
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer py-1 px-2 border border-border rounded-lg"
          />
        </div>

        {canManage && salary && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setModalType('advance')}
              className="h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs"
            >
              <HandCoins className="size-3.5" />
              {t('profile.addAdvance')}
            </Button>
            <Button
              size="sm"
              onClick={() => setModalType('penalty')}
              className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-xs"
            >
              <AlertTriangle className="size-3.5" />
              {t('profile.addDeduction')}
            </Button>
            <Button
              size="sm"
              onClick={() => setModalType('bonus')}
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <Gift className="size-3.5" />
              {t('profile.addBonus')}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground animate-pulse">
          {t('common.loading')}
        </div>
      ) : !salary ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileSpreadsheet className="size-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">{t('mySalary.noRecord')}</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            No salary record registered for <span className="font-semibold text-foreground">{selectedMonth}</span>.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1: Base Salary */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('mySalary.baseSalary')}
                  </span>
                  <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                    <Wallet className="size-4" />
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-foreground">
                    {formatCurrency(baseSalary, locale)}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                    {salary.is_recurring ? `🔄 ${salary.recurrence || 'monthly'}` : '💳 One-time'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2: Bonuses */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('mySalary.bonuses')}
                  </span>
                  <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <Gift className="size-4" />
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(bonusTotal, locale)}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                    {salary.bonuses?.length || 0} bonuses
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 3: Deductions */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('mySalary.deductions')}
                  </span>
                  <div className="size-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="size-4" />
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                    -{formatCurrency(penaltyTotal, locale)}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                    {salary.penalties?.length || 0} deductions
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 4: Advances */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('mySalary.advances')}
                  </span>
                  <div className="size-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
                    <HandCoins className="size-4" />
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-sky-600 dark:text-sky-400">
                    -{formatCurrency(advanceTotal, locale)}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                    {salary.advances?.length || 0} advances
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 5: Net Payable */}
            <Card className="border-2 border-primary/40 shadow-xs bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    {t('mySalary.netSalary')}
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      salary.paid
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {salary.paid ? (
                      <>
                        <CheckCircle2 className="size-3" />
                        {t('finance.paid')}
                      </>
                    ) : (
                      <>
                        <Clock className="size-3" />
                        {t('finance.unpaid')}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-primary">
                    {formatCurrency(netSalary, locale)}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold block mt-0.5">
                    {salary.paid && salary.paid_date ? `Paid on ${formatDate(salary.paid_date, locale)}` : 'Pending payout'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advances and Deductions Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Advances Log */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <HandCoins className="size-4 text-sky-500" />
                  {t('profile.advancesTaken')}
                </CardTitle>
                <span className="text-xs font-bold text-sky-600">
                  -{formatCurrency(advanceTotal, locale)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                {!salary.advances || salary.advances.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {t('profile.noAdvances')}
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {salary.advances.map(adv => (
                      <div
                        key={adv.id}
                        className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground">
                            {adv.notes || 'Salary Advance'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {adv.date ? formatDate(adv.date, locale) : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sky-600 text-sm">
                            -{formatCurrency(Number(adv.amount), locale)}
                          </span>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAdvance(adv.id)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deductions & Penalties Log */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-500" />
                  {t('profile.deductionsTaken')}
                </CardTitle>
                <span className="text-xs font-bold text-rose-600">
                  -{formatCurrency(penaltyTotal, locale)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                {!salary.penalties || salary.penalties.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {t('profile.noDeductions')}
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {salary.penalties.map(pen => (
                      <div
                        key={pen.id}
                        className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground">
                            {pen.notes || 'Deduction / Penalty'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {pen.created_at ? formatDate(pen.created_at.substring(0, 10), locale) : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-rose-600 text-sm">
                            -{formatCurrency(Number(pen.amount), locale)}
                          </span>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePenalty(pen.id)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bonuses Section */}
          {salary.bonuses && salary.bonuses.length > 0 && (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Gift className="size-4 text-emerald-500" />
                  {t('profile.bonusesEarned')}
                </CardTitle>
                <span className="text-xs font-bold text-emerald-600">
                  +{formatCurrency(bonusTotal, locale)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {salary.bonuses.map(bon => (
                    <div
                      key={bon.id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground">
                          {bon.notes || 'Incentive / Bonus'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {bon.created_at ? formatDate(bon.created_at.substring(0, 10), locale) : '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-emerald-600 text-sm">
                          +{formatCurrency(Number(bon.amount), locale)}
                        </span>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBonus(bon.id)}
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Action Modal */}
      {modalType && salary && (
        <FinancialActionModal
          isOpen={!!modalType}
          onClose={() => setModalType(null)}
          salaryId={salary.id}
          type={modalType}
          memberName={member.name}
          onSaved={loadSalary}
        />
      )}
    </div>
  );
}

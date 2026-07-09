'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, contractsApi } from '@/lib/api';
import { DashboardStats, Task, FinanceStats } from '@/types';
import TaskCard from '@/components/TaskCard';
import SalesDashboard from '@/components/SalesDashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getCairoTodayString, formatCairoDate, getCairoDateParts } from '@/lib/dateUtils';
import {
  Plus,
  ArrowRight,
  ClipboardList,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  Clock,
  TrendingDown,
} from 'lucide-react';

function formatCurrency(amount: number, locale: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}

// PIPELINE_STAGES removed

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  
  const isOwner = user?.role === 'owner';
  const isTeamLeader = user?.role === 'team_leader';
  const isSales = user?.role === 'sales';
  const isMember = user?.role === 'member';
  const isModerator = user?.role === 'moderation';
  const isAccountManager = user?.role === 'account_manager';
  const isContentCreator = user?.role === 'content_creator';

  const showFinanceAndClients = isOwner || isSales;
  const showTasks = isOwner || isTeamLeader || isMember || isModerator || isAccountManager || isContentCreator;
  const isTaskAdmin = isOwner || isTeamLeader || isModerator || isAccountManager;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Load task data
  const loadDashboardTasks = () => {
    if (!showTasks) { setLoading(false); return; }
    Promise.all([
      tasksApi.stats(),
      tasksApi.list(),
    ]).then(([statsData, tasksData]) => {
      setStats(statsData.stats);
      setAllTasks(tasksData.tasks);
      setRecentTasks(tasksData.tasks.slice(0, 6));
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboardTasks();
  }, [showTasks]);

  // Load owner/sales analytics data
  useEffect(() => {
    if (!showFinanceAndClients) { setAnalyticsLoading(false); return; }
    contractsApi.stats().then((financeData) => {
      setFinanceStats(financeData.stats);
    }).catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [showFinanceAndClients]);

  // Personal workload calculation
  const myTasks = allTasks.filter(task => 
    task.task_assignees?.some(a => a.user_id === user?.id)
  );

  const myActiveTasks = myTasks.filter(task => {
    const myAssignee = task.task_assignees?.find(a => a.user_id === user?.id);
    return myAssignee?.status !== 'completed';
  });

  const myInProgressCount = myTasks.filter(task => {
    const myAssignee = task.task_assignees?.find(a => a.user_id === user?.id);
    return myAssignee?.status === 'in_progress';
  }).length;

  const myCompletedCount = myTasks.filter(task => {
    const myAssignee = task.task_assignees?.find(a => a.user_id === user?.id);
    return myAssignee?.status === 'completed';
  }).length;

  const todayStr = getCairoTodayString();
  const myOverdueCount = myTasks.filter(task => {
    const myAssignee = task.task_assignees?.find(a => a.user_id === user?.id);
    return task.due_date && task.due_date < todayStr && myAssignee?.status !== 'completed';
  }).length;

  const today = formatCairoDate(new Date(), locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const getGreetingKey = () => {
    const hr = getCairoDateParts().hour;
    if (hr < 12) return 'dashboard.greeting.morning';
    if (hr < 17) return 'dashboard.greeting.afternoon';
    return 'dashboard.greeting.evening';
  };

  if (isSales) {
    return (
      <div className="page-container fade-in pb-12">
        <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="page-header-left">
            <h1 className="page-header-title">
              {t(getGreetingKey())}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="page-header-subtitle">{t('dashboard.salesWorkspaceSubtitle', { date: today })}</p>
          </div>
        </div>
        <SalesDashboard />
      </div>
    );
  }

  return (
    <div className="page-container fade-in pb-12">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="page-header-left">
          <h1 className="page-header-title">
            {t(getGreetingKey())}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-header-subtitle">{today}</p>
        </div>
        {isTaskAdmin && (
          <Link href="/dashboard/tasks/create" className={cn(buttonVariants({ variant: "default" }), "gap-1 shrink-0")}>
            <Plus className="size-4" /> {t('tasks.createTask')}
          </Link>
        )}
      </div>

      {/* Renewal Alert Ribbon removed */}

      {/* SKELETON LOADERS */}
      {((showFinanceAndClients && (loading || analyticsLoading)) || (!showFinanceAndClients && loading)) ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="animate-pulse h-[300px]">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-1/3" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-10 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI ROW: Task Overview */}
          {showTasks && stats && (
            <div className="space-y-6">
              {isTaskAdmin && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-[-8px]">
                  👥 {locale === 'ar' ? 'إحصائيات الفريق' : 'Team Workload Overview'}
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Tasks */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('dashboard.totalTasks')}</span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold">{stats.total}</div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                      {t('dashboard.allAssignedObjectives')}
                    </p>
                  </CardContent>
                </Card>

                {/* In Progress */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('dashboard.inProgress')}</span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold">{stats.inProgress}</div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                      {t('dashboard.activeWorkCurrentlyActive')}
                    </p>
                  </CardContent>
                </Card>

                {/* Completed */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('status.completed')}</span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-violet-600">{stats.completed}</div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                      {t('dashboard.tasksSuccessfullyDelivered')}
                    </p>
                  </CardContent>
                </Card>

                {/* Overdue */}
                <Card className={`hover:shadow-md transition-all duration-200 ${
                  stats.overdue > 0 ? 'border-rose-200 bg-rose-50/20 dark:bg-rose-950/5' : ''
                }`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('dashboard.overdueTasks')}</span>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-extrabold ${stats.overdue > 0 ? 'text-rose-600' : ''}`}>
                      {stats.overdue}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                      {t('dashboard.incompletePastDeadline')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Personal Workload Overview (Management only) */}
              {isTaskAdmin && (
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-[-8px]">
                    👤 {locale === 'ar' ? 'إحصائياتي الشخصية' : 'My Workload Overview'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* My Active Tasks */}
                    <Card className="hover:shadow-md transition-shadow border-[#1D61E7]/15 bg-[#1D61E7]/5 dark:bg-[#1D61E7]/5">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-medium text-muted-foreground">{locale === 'ar' ? 'مهامي النشطة' : 'My Active Tasks'}</span>
                        <ClipboardList className="size-4 text-[#1D61E7]" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-extrabold text-[#1D61E7]">{myActiveTasks.length}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                          {locale === 'ar' ? 'المهام المسندة إلي وغير المنتهية' : 'Pending tasks assigned to me'}
                        </p>
                      </CardContent>
                    </Card>

                    {/* My In Progress */}
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-medium text-muted-foreground">{locale === 'ar' ? 'مهامي قيد التنفيذ' : 'My In Progress'}</span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{myInProgressCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                          {locale === 'ar' ? 'المهام التي أعمل عليها حالياً' : 'Tasks I am currently working on'}
                        </p>
                      </CardContent>
                    </Card>

                    {/* My Completed */}
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-medium text-muted-foreground">{locale === 'ar' ? 'مهامي المكتملة' : 'My Completed'}</span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-extrabold text-green-600 dark:text-green-400">{myCompletedCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                          {locale === 'ar' ? 'المهام التي أنجزتها بنجاح' : 'Tasks I have successfully completed'}
                        </p>
                      </CardContent>
                    </Card>

                    {/* My Overdue */}
                    <Card className={`hover:shadow-md transition-all duration-200 ${
                      myOverdueCount > 0 ? 'border-rose-200 bg-rose-50/20 dark:bg-rose-950/5' : ''
                    }`}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-medium text-muted-foreground">{locale === 'ar' ? 'مهامي المتأخرة' : 'My Overdue'}</span>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-extrabold ${myOverdueCount > 0 ? 'text-rose-600' : ''}`}>{myOverdueCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                          {locale === 'ar' ? 'مهام متأخرة تجاوزت الموعد المحدد' : 'Incomplete tasks past deadline'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DETAILS SECTION */}
          {showFinanceAndClients ? (
            <div className="w-full">
              
              {/* Column: Finance Analytics */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="size-4 text-[#1D61E7]" /> {t('dashboard.revenueBilling')}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{t('dashboard.revenueBillingDesc')}</CardDescription>
                  </div>
                  <Link href="/dashboard/finance" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-semibold gap-1 text-[#1D61E7] hover:text-[#1553c7]")}>
                    {t('dashboard.viewAll')} <ArrowRight className="size-3.5" />
                  </Link>
                </CardHeader>

                <CardContent className="pt-5 flex flex-col gap-6">
                  {financeStats ? (
                    <>
                      {/* MRR Hero */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 border border-border text-foreground rounded-xl p-5 shadow-sm relative overflow-hidden">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('dashboard.monthlyRevenue')}</span>
                        <div className="text-3xl font-extrabold tracking-tight mt-1">
                          {formatCurrency(financeStats.monthlyRevenue, locale)}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3.5 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 shrink-0">
                            <Briefcase className="size-4" />
                          </div>
                          <div>
                            <div className="text-lg font-extrabold">{financeStats.activeProjects}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t('dashboard.activeProjects')}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3.5 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            financeStats.upcomingRenewalsCount > 0
                              ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400'
                              : 'bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400'
                          }`}>
                            {financeStats.upcomingRenewalsCount > 0 ? <Clock className="size-4 animate-spin-slow" /> : <CheckCircle2 className="size-4" />}
                          </div>
                          <div>
                            <div className="text-lg font-extrabold">{financeStats.upcomingRenewalsCount}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t('dashboard.renewals30d')}</div>
                          </div>
                        </div>
                      </div>

                      {/* Renewal details status */}
                      {financeStats.upcomingRenewalsCount > 0 ? (
                        <div className="flex items-center justify-between gap-3 p-3 border border-l-4 border-l-orange-500 bg-orange-50/20 dark:bg-orange-950/5 rounded-lg text-orange-950 dark:text-orange-300">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <AlertTriangle className="size-4 text-orange-500 shrink-0" />
                            <span className="text-xs truncate font-medium">
                              {t('dashboard.renewingSoon', { count: financeStats.upcomingRenewalsCount })}
                            </span>
                          </div>
                          <Link href="/dashboard/finance" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 text-[11px] font-bold py-1 px-3 shrink-0")}>{t('dashboard.review')}</Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 border border-l-4 border-l-[#1D61E7] bg-[#1D61E7]/5 rounded-lg text-[#1D61E7]">
                          <CheckCircle2 className="size-4 text-[#1D61E7] shrink-0" />
                          <span className="text-xs font-medium">{t('dashboard.allAccountsPaid')}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10 text-xs text-muted-foreground italic">
                      {t('dashboard.noFinancialMetrics')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            // TEAM LEADER / MEMBER DETAILS VIEW
            <div className="w-full">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="size-4 text-rose-500" /> {t('dashboard.actionablePriorities')}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{t('dashboard.actionablePrioritiesDesc')}</CardDescription>
                  </div>
                  <Link href="/dashboard/tasks" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-semibold gap-1 text-[#1D61E7] hover:text-[#1553c7]")}>
                    {t('tasks.title')} <ArrowRight className="size-3.5" />
                  </Link>
                </CardHeader>
                
                <CardContent className="pt-5">
                  {recentTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')).length > 0 ? (
                    <div className="tasks-grid">
                      {recentTasks
                        .filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'))
                        .slice(0, 3)
                        .map(task => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            onTaskUpdated={loadDashboardTasks}
                            onTaskDeleted={loadDashboardTasks}
                          />
                        ))
                      }
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-muted-foreground italic">
                      {t('dashboard.noUrgentTasks')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
      {/* MY ASSIGNED TASKS (For Admins/TLs/Management who have tasks assigned to them) */}
      {showTasks && !loading && isTaskAdmin && myActiveTasks.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#1D61E7] animate-pulse" />
              {locale === 'ar' ? 'مهامي النشطة المسندة إلي' : 'My Active Assigned Tasks'}
              <Badge variant="secondary" className="text-xs bg-[#1D61E7]/10 text-[#1D61E7] dark:bg-[#1D61E7]/20 dark:text-[#1D61E7]">
                {myActiveTasks.length}
              </Badge>
            </h2>
          </div>
          <div className="tasks-grid">
            {myActiveTasks.slice(0, 6).map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onTaskUpdated={loadDashboardTasks}
                onTaskDeleted={loadDashboardTasks}
              />
            ))}
          </div>
        </div>
      )}

      {/* RECENT TASKS GRID */}
      {showTasks && !loading && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-base font-bold text-foreground">
              {isTaskAdmin ? t('dashboard.recentTeamActivity') : t('dashboard.myRecentTasks')}
            </h2>
            <Link href="/dashboard/tasks" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs font-semibold")}>
              {t('dashboard.viewAllTasks')} {locale === 'ar' ? '←' : '→'}
            </Link>
          </div>

          {recentTasks.length > 0 ? (
            <div className="tasks-grid">
              {recentTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onTaskUpdated={loadDashboardTasks}
                  onTaskDeleted={loadDashboardTasks}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed py-12 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <ClipboardList className="size-6" />
              </div>
              <h3 className="font-semibold text-base mb-1">{t('dashboard.noTasksAssigned')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                {isTaskAdmin ? t('dashboard.adminNoTasksDescLong') : t('dashboard.memberNoTasksDescLong')}
              </p>
              {isTaskAdmin && (
                <Link href="/dashboard/tasks/create" className={buttonVariants({ variant: "default", size: "sm" })}>{t('dashboard.createFirst')}</Link>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

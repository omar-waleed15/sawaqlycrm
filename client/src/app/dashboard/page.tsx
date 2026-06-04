'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { tasksApi, clientsApi, contractsApi } from '@/lib/api';
import { DashboardStats, Task, Client, FinanceStats } from '@/types';
import TaskCard from '@/components/TaskCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

const PIPELINE_STAGES: {
  key: Client['pipeline_stage'];
  label: string;
  colorClass: string;
  dotColor: string;
}[] = [
  { key: 'new_lead',          label: 'New Lead',       colorClass: 'bg-slate-400', dotColor: '#94a3b8' },
  { key: 'contacted',         label: 'Contacted',      colorClass: 'bg-blue-500', dotColor: '#3b82f6' },
  { key: 'meeting_scheduled', label: 'Meeting Set',    colorClass: 'bg-indigo-500', dotColor: '#6366f1' },
  { key: 'proposal_sent',     label: 'Proposal Sent',  colorClass: 'bg-purple-500', dotColor: '#a855f7' },
  { key: 'negotiation',       label: 'Negotiation',    colorClass: 'bg-amber-500', dotColor: '#f59e0b' },
  { key: 'won',               label: 'Won',            colorClass: 'bg-green-500', dotColor: '#10b981' },
  { key: 'lost',              label: 'Lost',           colorClass: 'bg-rose-500', dotColor: '#f43f5e' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  
  const isOwner = user?.role === 'owner';
  const isTeamLeader = user?.role === 'team_leader';
  const isSales = user?.role === 'sales';
  const isMember = user?.role === 'member';

  const showFinanceAndClients = isOwner || isSales;
  const showTasks = isOwner || isTeamLeader || isMember;
  const isTaskAdmin = isOwner || isTeamLeader;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Load task data
  useEffect(() => {
    if (!showTasks) { setLoading(false); return; }
    Promise.all([
      tasksApi.stats(),
      tasksApi.list(),
    ]).then(([statsData, tasksData]) => {
      setStats(statsData.stats);
      setRecentTasks(tasksData.tasks.slice(0, 6));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [showTasks]);

  // Load owner/sales analytics data
  useEffect(() => {
    if (!showFinanceAndClients) { setAnalyticsLoading(false); return; }
    Promise.all([
      clientsApi.list(),
      contractsApi.stats(),
    ]).then(([clientsData, financeData]) => {
      setClients(clientsData.clients);
      setFinanceStats(financeData.stats);
    }).catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [showFinanceAndClients]);

  // Pipeline calculations
  const totalClients = clients.length;
  const wonCount = clients.filter(c => c.pipeline_stage === 'won').length;
  const conversionRate = totalClients > 0 ? Math.round((wonCount / totalClients) * 100) : 0;

  const pipelineBreakdown = PIPELINE_STAGES.map(stage => {
    const count = clients.filter(c => c.pipeline_stage === stage.key).length;
    const percentage = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
    return { ...stage, count, percentage };
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="page-container fade-in pb-12">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="page-header-left">
          <h1 className="page-header-title">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-header-subtitle">{today}</p>
        </div>
        {isTaskAdmin && (
          <Link href="/dashboard/tasks/create" className={cn(buttonVariants({ variant: "default" }), "gap-1 shrink-0")}>
            <Plus className="size-4" /> New Task
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tasks */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">Total Tasks</span>
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                    <ClipboardList className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{stats.total}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                    All assigned objectives
                  </p>
                </CardContent>
              </Card>

              {/* In Progress */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">In Progress</span>
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                    <Zap className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{stats.inProgress}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                    Active work currently active
                  </p>
                </CardContent>
              </Card>

              {/* Completed */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">Completed</span>
                  <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-green-600">{stats.completed}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                    Tasks successfully delivered
                  </p>
                </CardContent>
              </Card>

              {/* Overdue */}
              <Card className={`hover:shadow-md transition-all duration-200 ${
                stats.overdue > 0 ? 'border-rose-200 bg-rose-50/20 dark:bg-rose-950/5' : ''
              }`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">Overdue Tasks</span>
                  <div className={`p-1.5 rounded-lg ${
                    stats.overdue > 0
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <AlertTriangle className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-extrabold ${stats.overdue > 0 ? 'text-rose-600' : ''}`}>
                    {stats.overdue}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                    Incomplete past deadline
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* DETAILS SECTION */}
          {showFinanceAndClients ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Column 1: Client Analytics */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="size-4 text-indigo-500" /> Client Pipeline
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Conversion funnel from leads to clients</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] font-bold py-0.5 px-2">
                      {totalClients} Total
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-bold py-0.5 px-2 text-green-600 bg-green-50 dark:bg-green-950/25 border-green-200">
                      {wonCount} Won
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-5">
                  <div className="flex flex-col gap-2.5 mb-6">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Lead Conversion Rate</span>
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="size-3.5" /> {conversionRate}%
                      </span>
                    </div>
                    <div className="w-full bg-muted border rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000"
                        style={{ width: `${conversionRate}%` }}
                      />
                    </div>
                  </div>
                  
                  {totalClients > 0 ? (
                    <div className="flex flex-col gap-3">
                      {pipelineBreakdown.map(stage => (
                        <div key={stage.key} className="relative flex flex-col gap-1.5 p-2 rounded-lg border bg-muted/20">
                          {/* Inner percentage fill indicator */}
                          <div 
                            className={`absolute left-0 top-0 bottom-0 opacity-[0.08] rounded-l-md ${stage.colorClass}`}
                            style={{ width: `${stage.percentage}%` }}
                          />
                          <div className="flex items-center justify-between text-xs font-medium z-10">
                            <div className="flex items-center gap-2">
                              <span 
                                className="size-2 rounded-full shrink-0" 
                                style={{ backgroundColor: stage.dotColor }}
                              />
                              <span className="font-bold text-foreground">{stage.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground text-[11px] font-bold">
                              <span>{stage.count} account{stage.count !== 1 ? 's' : ''}</span>
                              <Badge variant="outline" className="text-[9px] py-0 h-4">
                                {stage.percentage}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-muted-foreground italic">
                      No client relationships registered. Get started in the CRM panel.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 2: Finance Analytics */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="size-4 text-green-500" /> Revenue & Billing
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Recurring billing and active project stats</CardDescription>
                  </div>
                  <Link href="/dashboard/finance" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-semibold gap-1 text-indigo-600 hover:text-indigo-700")}>
                    View all <ArrowRight className="size-3.5" />
                  </Link>
                </CardHeader>

                <CardContent className="pt-5 flex flex-col gap-6">
                  {financeStats ? (
                    <>
                      {/* MRR Hero */}
                      <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.06] text-[120px] select-none pointer-events-none">💰</div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Monthly Recurring Revenue</span>
                        <div className="text-3xl font-extrabold tracking-tight mt-1">
                          {formatCurrency(financeStats.monthlyRevenue)}
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
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Projects</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3.5 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            financeStats.upcomingRenewalsCount > 0
                              ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400'
                              : 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400'
                          }`}>
                            {financeStats.upcomingRenewalsCount > 0 ? <Clock className="size-4 animate-spin-slow" /> : <CheckCircle2 className="size-4" />}
                          </div>
                          <div>
                            <div className="text-lg font-extrabold">{financeStats.upcomingRenewalsCount}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Renewals (30d)</div>
                          </div>
                        </div>
                      </div>

                      {/* Renewal details status */}
                      {financeStats.upcomingRenewalsCount > 0 ? (
                        <div className="flex items-center justify-between gap-3 p-3 border border-l-4 border-l-orange-500 bg-orange-50/20 dark:bg-orange-950/5 rounded-lg text-orange-950 dark:text-orange-300">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <AlertTriangle className="size-4 text-orange-500 shrink-0" />
                            <span className="text-xs truncate font-medium">
                              <strong>{financeStats.upcomingRenewalsCount} active account{financeStats.upcomingRenewalsCount > 1 ? 's' : ''}</strong> renewing soon.
                            </span>
                          </div>
                          <Link href="/dashboard/finance" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 text-[11px] font-bold py-1 px-3 shrink-0")}>Review</Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 border border-l-4 border-l-green-500 bg-green-50/10 dark:bg-green-950/5 rounded-lg text-green-900 dark:text-green-300">
                          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                          <span className="text-xs font-medium">All accounts are fully paid and in good standing.</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10 text-xs text-muted-foreground italic">
                      No financial metrics recorded yet.
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
                      <AlertTriangle className="size-4 text-rose-500" /> Actionable Priorities
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">High importance issues needing immediate action</CardDescription>
                  </div>
                  <Link href="/dashboard/tasks" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-semibold gap-1 text-indigo-600 hover:text-indigo-700")}>
                    All Tasks <ArrowRight className="size-3.5" />
                  </Link>
                </CardHeader>
                
                <CardContent className="pt-5">
                  {recentTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {recentTasks
                        .filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'))
                        .slice(0, 3)
                        .map(task => <TaskCard key={task.id} task={task} />)
                      }
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-muted-foreground italic">
                      🎉 You have no urgent or high-priority tasks pending. Nice work!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* RECENT TASKS GRID */}
      {showTasks && !loading && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-base font-bold text-foreground">
              {isTaskAdmin ? 'Recent Team Activity' : 'My Recent Tasks'}
            </h2>
            <Link href="/dashboard/tasks" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs font-semibold")}>
              View all tasks →
            </Link>
          </div>

          {recentTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recentTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          ) : (
            <Card className="border-dashed py-12 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-3">📋</div>
              <h3 className="font-semibold text-base mb-1">No tasks assigned</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                {isTaskAdmin ? 'Create your first task assignment to begin tracking work.' : 'There are currently no tasks allocated to your account.'}
              </p>
              {isTaskAdmin && (
                <Link href="/dashboard/tasks/create" className={buttonVariants({ variant: "default", size: "sm" })}>Create First Task</Link>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

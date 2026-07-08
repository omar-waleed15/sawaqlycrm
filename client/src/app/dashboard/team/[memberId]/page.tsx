'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi } from '@/lib/api';
import { Task, TaskAssignee, TaskStatus, User } from '@/types';
import TaskCard from '@/components/TaskCard';
import SalesDashboard from '@/components/SalesDashboard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function isOverdue(dateStr?: string, status?: string): boolean {
  if (!dateStr || status === 'completed') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function getMemberAssignment(task: Task, memberId: string): TaskAssignee | undefined {
  return task.task_assignees?.find(a => a.user_id === memberId);
}

function getMemberStatus(task: Task, memberId: string): TaskStatus {
  return (getMemberAssignment(task, memberId)?.status || 'todo') as TaskStatus;
}

const STATUS_CONFIG: Record<string, { labelKey: string; icon: string; accentClass: string; bgClass: string; textClass: string }> = {
  todo:        { labelKey: 'status.todo', icon: '📝', accentClass: 'bg-slate-400', bgClass: 'bg-slate-50 border-slate-100', textClass: 'text-slate-700' },
  in_progress: { labelKey: 'status.in_progress', icon: '⚡', accentClass: 'bg-blue-500', bgClass: 'bg-blue-50/50 border-blue-100', textClass: 'text-blue-700' },
  submitted:   { labelKey: 'status.submitted', icon: '📤', accentClass: 'bg-green-500', bgClass: 'bg-green-50/50 border-green-100', textClass: 'text-green-700' },
  revision:    { labelKey: 'status.revision', icon: '🔄', accentClass: 'bg-orange-500', bgClass: 'bg-orange-50/50 border-orange-100', textClass: 'text-orange-700' },
  completed:   { labelKey: 'status.completed', icon: '✅', accentClass: 'bg-purple-500', bgClass: 'bg-purple-50/50 border-purple-100', textClass: 'text-purple-700' },
};

const PRIORITY_WEIGHTS: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};


export default function MemberTasksPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [member, setMember] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');


  // Task Target States
  const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [targetTasks, setTargetTasks] = useState<number | ''>('');
  const [completedTasks, setCompletedTasks] = useState<number>(0);
  const [fetchingTarget, setFetchingTarget] = useState<boolean>(false);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);
  const [targetMessage, setTargetMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadTargetAndProgress = async (monthStr: string) => {
    setFetchingTarget(true);
    setTargetMessage(null);
    try {
      const [targetData, progressData] = await Promise.all([
        tasksApi.getTarget(memberId, monthStr),
        tasksApi.getProgress(memberId, monthStr)
      ]);
      setTargetTasks(targetData.target ? targetData.target.target_tasks : '');
      setCompletedTasks(progressData.completedTasks || 0);
    } catch (err) {
      console.error('Failed to load task target:', err);
    } finally {
      setFetchingTarget(false);
    }
  };

  const handleSaveTarget = async () => {
    setSavingTarget(true);
    setTargetMessage(null);
    try {
      await tasksApi.setTarget(memberId, targetMonth, targetTasks === '' ? 0 : Number(targetTasks));
      setTargetMessage({ text: t('taskTarget.updated') || 'Target updated successfully!', type: 'success' });
      // Reload progress
      const progressData = await tasksApi.getProgress(memberId, targetMonth);
      setCompletedTasks(progressData.completedTasks || 0);
    } catch (err: any) {
      setTargetMessage({ text: err.message || 'Failed to update target', type: 'error' });
    } finally {
      setSavingTarget(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'owner') {
      router.replace('/dashboard');
      return;
    }
    const load = async () => {
      try {
        const [usersData, tasksData] = await Promise.all([
          usersApi.list(),
          tasksApi.list({ assignee_id: memberId }),
        ]);
        const found = usersData.users.find(u => u.id === memberId);
        if (!found || found.role === 'client') {
          router.replace('/dashboard/team');
          return;
        }
        setMember(found);
        setTasks(tasksData.tasks);
      } catch {
        router.replace('/dashboard/team');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId, user, router]);

  useEffect(() => {
    if (member && member.role !== 'sales') {
      loadTargetAndProgress(targetMonth);
    }
  }, [targetMonth, memberId, member]);

  if (user?.role !== 'owner') return null;

  const targetVal = targetTasks === '' ? 0 : Number(targetTasks);
  const achievementRate = targetVal > 0 ? Math.round((completedTasks / targetVal) * 100) : 0;

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => getMemberStatus(t, memberId) === 'todo').length,
    inProgress: tasks.filter(t => getMemberStatus(t, memberId) === 'in_progress').length,
    submitted: tasks.filter(t => getMemberStatus(t, memberId) === 'submitted').length,
    revision: tasks.filter(t => getMemberStatus(t, memberId) === 'revision').length,
    completed: tasks.filter(t => getMemberStatus(t, memberId) === 'completed').length,
    overdue: tasks.filter(t => isOverdue(t.due_date, getMemberStatus(t, memberId))).length,
  };

  const getProcessedTasks = (taskList: Task[]) => {
    return taskList
      .filter(t => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'dueDate') {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        } else if (sortBy === 'priority') {
          comparison = (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
        } else if (sortBy === 'title') {
          comparison = a.title.localeCompare(b.title);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  };

  const filteredTasks = activeStatus === 'all'
    ? getProcessedTasks(tasks)
    : getProcessedTasks(tasks.filter(t => getMemberStatus(t, memberId) === activeStatus));

  const filterTabs = [
    { key: 'all', label: t('memberDetail.allTasks'), count: tasks.length },
    { key: 'todo', label: t('memberDetail.toDo'), count: stats.todo },
    { key: 'in_progress', label: t('memberDetail.inProgress'), count: stats.inProgress },
    { key: 'submitted', label: t('memberDetail.submitted'), count: stats.submitted },
    { key: 'revision', label: t('memberDetail.revision'), count: stats.revision },
    { key: 'completed', label: t('memberDetail.done'), count: stats.completed },
  ];

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">{t('memberDetail.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="page-container fade-in pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground font-medium">
        <Link href="/dashboard/team" className="hover:text-primary transition-colors flex items-center gap-1.5">
          <ArrowLeft className="size-3" /> {t('memberDetail.teamManagement')}
        </Link>
        <span>/</span>
        <span className="text-foreground font-semibold">{member.name}</span>
      </div>

      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="size-14 ring-4 ring-[#1D61E7]/10 shadow-lg shrink-0">
          <AvatarFallback className="bg-[#1D61E7] text-white font-extrabold text-lg">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">{member.name}</h1>
            <Badge variant="outline" className="text-[10px] py-0.5 px-2">
              {member.role === 'owner' ? t('role.owner') : member.role === 'sales' ? t('role.sales') : t('role.teamMember')}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t('memberDetail.email')} {member.email}</p>
        </div>
      </div>

      {/* Sales Dashboard for Admin viewing representative stats & finance */}
      {member.role === 'sales' && (
        <div className="mb-8 space-y-4">
          <div className="border-t border-dashed pt-6 mt-6" />
          <h2 className="text-base font-bold text-foreground tracking-tight">{t('memberDetail.repIntelligence')}</h2>
          <SalesDashboard salesRepId={memberId} />
        </div>
      )}

      {/* Task Target Setup Card for non-sales employee */}
      {member.role !== 'sales' && (
        <Card className="mb-6 border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div>
              <h3 className="text-sm font-bold tracking-tight">{t('taskTarget.title')}</h3>
              <p className="text-[11px] text-muted-foreground">{t('taskTarget.subtitle')}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-5 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 max-w-4xl">
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('taskTarget.targetMonth')}</label>
                <Input
                  type="month"
                  value={targetMonth}
                  onChange={e => setTargetMonth(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('taskTarget.targetTasks')}</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={targetTasks}
                  onChange={e => setTargetTasks(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="shrink-0 w-full sm:w-auto">
                <Button
                  onClick={handleSaveTarget}
                  disabled={savingTarget || fetchingTarget}
                  className="w-full sm:w-auto h-9 text-xs bg-[#1D61E7] hover:bg-[#1553c7] text-white font-semibold"
                >
                  {savingTarget ? t('common.loading') : t('taskTarget.updateTarget')}
                </Button>
              </div>

              {/* Progress Display Card / Section */}
              <div className="flex-1 min-w-[200px] border rounded-lg p-3 bg-muted/20 flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>{t('taskTarget.progress')}</span>
                  <span>{achievementRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-1.5">
                  <div 
                    className="h-full rounded-full bg-[#1D61E7] transition-all duration-300" 
                    style={{ width: `${Math.min(achievementRate, 100)}%` }} 
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold">
                  {completedTasks} / {targetVal > 0 ? targetVal : '0'} {t('common.tasks')}
                </p>
              </div>
            </div>

            {fetchingTarget && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 animate-pulse">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#1D61E7]" />
                {t('common.loading')}
              </div>
            )}

            {targetMessage && (
              <div className={`mt-3 text-xs p-2.5 rounded-lg border ${
                targetMessage.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400' 
                  : 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
              }`}>
                {targetMessage.text}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search, Filter & Switch View Panel */}
      <Card className="mb-6 shadow-sm border-border/80">
        <CardContent className="p-6 flex flex-col gap-6">
          {/* Top Panel Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('memberDetail.searchTasks')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>

            {/* Sort Controls & View Switcher */}
            <div className="flex items-center gap-3 flex-wrap justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium shrink-0">{t('memberDetail.sortByLabel')}</span>
                <Select value={sortBy} onValueChange={(v: string | null) => setSortBy(v as any || 'dueDate')}>
                  <SelectTrigger className="w-28 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">{t('memberDetail.dueDateSort')}</SelectItem>
                    <SelectItem value="priority">{t('memberDetail.prioritySort')}</SelectItem>
                    <SelectItem value="title">{t('memberDetail.titleSort')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="h-9 w-9 text-muted-foreground"
                >
                  <ArrowUpDown className="size-3.5" />
                </Button>
              </div>

              {/* View Switcher */}
              <div className="flex bg-muted p-1 border rounded-lg h-9">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 text-xs font-semibold px-3 gap-1"
                >
                  <List className="size-3.5" /> {t('memberDetail.list')}
                </Button>
                <Button
                  variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('board')}
                  className="h-7 text-xs font-semibold px-3 gap-1"
                >
                  <LayoutGrid className="size-3.5" /> {t('memberDetail.board')}
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom tabs for list filtering */}
          {viewMode === 'list' && (
            <div className="flex gap-2 flex-wrap pt-1">
              {filterTabs.map(tab => {
                const isActive = activeStatus === tab.key;
                return (
                  <Button
                    key={tab.key}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveStatus(tab.key)}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    {STATUS_CONFIG[tab.key]?.icon && <span>{STATUS_CONFIG[tab.key].icon}</span>}
                    {tab.label}
                    <Badge
                      variant={isActive ? 'secondary' : 'outline'}
                      className="ml-0.5 text-[9px] px-1.5 h-4 flex items-center justify-center font-bold"
                    >
                      {tab.count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          )}

          <Separator className="my-1 opacity-60" />

          {/* Tasks Content List/Board */}
          <div>
            {filteredTasks.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl py-12 flex flex-col items-center justify-center text-center bg-muted/10">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-3">📋</div>
                <h3 className="font-semibold text-base mb-1">{t('memberDetail.noTasks')}</h3>
                <p className="text-xs text-muted-foreground max-w-sm px-4">
                  {searchQuery
                    ? t('memberDetail.noTasksSearch')
                    : activeStatus !== 'all'
                    ? t('memberDetail.noTasksStatus', { name: member.name, status: t('status.' + activeStatus) })
                    : t('memberDetail.noTasksAssigned', { name: member.name })}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              /* LIST VIEW */
              <div className="tasks-grid">
                {filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTaskUpdated={(updatedTask) => {
                      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                    }}
                    onTaskDeleted={(deletedTaskId) => {
                      setTasks(prev => prev.filter(t => t.id !== deletedTaskId));
                    }}
                  />
                ))}
              </div>
            ) : (
              /* KANBAN BOARD VIEW */
              <div className="flex gap-4 overflow-x-auto pb-4 items-start scrollbar-thin select-none">
                {['todo', 'in_progress', 'submitted', 'revision', 'completed'].map(statusKey => {
                  const columnConfig = STATUS_CONFIG[statusKey];
                  const columnTasks = filteredTasks.filter(t => getMemberStatus(t, memberId) === statusKey);

                  return (
                    <div
                      key={statusKey}
                      className="flex-[0_0_290px] bg-muted/30 border border-border/80 rounded-xl p-3 flex flex-col max-h-[70vh] min-h-[350px] shadow-sm"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between border-b pb-2.5 mb-3 px-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{columnConfig.icon}</span>
                          <span className="text-xs font-bold text-foreground">
                            {t(columnConfig.labelKey)}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-extrabold px-2 h-5">
                          {columnTasks.length}
                        </Badge>
                      </div>

                      {/* Column Cards Container */}
                      <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                        {columnTasks.length === 0 ? (
                          <div className="text-center py-10 text-[11px] text-muted-foreground/60 border border-dashed rounded-lg bg-card/50">
                            {t('memberDetail.noTasksColumn')}
                          </div>
                        ) : (
                          columnTasks.map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onTaskUpdated={(updatedTask) => {
                                setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                              }}
                              onTaskDeleted={(deletedTaskId) => {
                                setTasks(prev => prev.filter(t => t.id !== deletedTaskId));
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

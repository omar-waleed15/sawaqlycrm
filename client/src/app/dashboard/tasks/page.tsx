'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi } from '@/lib/api';
import { Task, User } from '@/types';
import { sortActiveTasks } from '@/lib/taskSortUtils';
import TaskCard from '@/components/TaskCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, X } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [teamMemberFilter, setTeamMemberFilter] = useState('all');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const isInternUser = user?.role === 'content_creator_intern';
  const [activeTab, setActiveTab] = useState<'all_tasks' | 'active' | 'pending_review' | 'my_tasks' | 'intern_tasks' | 'completed' | 'archived'>(
    user?.role === 'content_creator_intern' ? 'intern_tasks' : 'active'
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Time filter state for 'all_tasks' tab
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'>('all');
  const [timeDateType, setTimeDateType] = useState<'due_date' | 'created_at'>('due_date');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';
  const canSeeAllTasksTab = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'account_manager';
  const canCreate = isOwner || user?.role === 'content_creator';

  useEffect(() => {
    if (isOwner) {
      usersApi.list()
        .then(data => {
          const members = (data.users || []).filter((u: User) => u.role !== 'client');
          members.sort((a: User, b: User) => a.name.localeCompare(b.name));
          setTeamMembers(members);
        })
        .catch(console.error);
    }
  }, [isOwner]);

  useEffect(() => {
    if (user?.role === 'content_creator_intern' && activeTab !== 'intern_tasks' && activeTab !== 'pending_review' && activeTab !== 'completed') {
      setActiveTab('intern_tasks');
      return;
    }
    if (activeTab === 'archived' && user?.role === 'moderation') {
      setActiveTab('active');
      return;
    }
    if (activeTab === 'all_tasks' && !canSeeAllTasksTab) {
      setActiveTab('active');
      return;
    }
    loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab === 'archived', activeTab === 'all_tasks', user]);

  // Guard against unauthorized access to all_tasks
  useEffect(() => {
    if (activeTab === 'all_tasks' && !canSeeAllTasksTab) {
      setActiveTab('active');
    }
  }, [activeTab, canSeeAllTasksTab]);

  // Live Task Event Listeners & Focus Refetch
  useEffect(() => {
    const handleTaskCreated = (e: any) => {
      if (e.detail) {
        setTasks(prev => [e.detail, ...prev.filter(t => t.id !== e.detail.id)]);
      }
      loadTasks(false);
    };

    const handleTaskUpdated = (e: any) => {
      if (e.detail) {
        setTasks(prev => prev.map(t => t.id === e.detail.id ? e.detail : t));
      }
      loadTasks(false);
    };

    const handleTaskDeleted = (e: any) => {
      if (e.detail?.id) {
        setTasks(prev => prev.filter(t => t.id !== e.detail.id));
      }
      loadTasks(false);
    };

    const handleFocus = () => {
      loadTasks(false);
    };

    window.addEventListener('app-task-created', handleTaskCreated);
    window.addEventListener('app-task-updated', handleTaskUpdated);
    window.addEventListener('app-task-deleted', handleTaskDeleted);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('app-task-created', handleTaskCreated);
      window.removeEventListener('app-task-updated', handleTaskUpdated);
      window.removeEventListener('app-task-deleted', handleTaskDeleted);
      window.removeEventListener('focus', handleFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  const loadTasks = (showLoading = true) => {
    if (showLoading) setLoading(true);
    const params: Record<string, string> = {};
    if (activeTab === 'archived') {
      params.archived = 'true';
    } else if (activeTab === 'all_tasks') {
      params.archived = 'all';
    }
    tasksApi.list(params)
      .then(data => {
        setTasks(data.tasks || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const isInternTask = (t: Task) =>
    (t.task_assignees || []).some(a => a.user?.role === 'content_creator_intern' || (user?.role === 'content_creator_intern' && a.user_id === user?.id)) ||
    t.creator?.role === 'content_creator_intern' ||
    (t.creator_id === user?.id && user?.role === 'content_creator');

  const hasRegularAssignees = (t: Task) =>
    (t.task_assignees || []).some(a => a.user?.role && a.user.role !== 'content_creator_intern');

  const isPureInternTask = (t: Task) =>
    isInternTask(t) && Boolean(t.task_assignees && t.task_assignees.length > 0) && !hasRegularAssignees(t);

  const hasSubmittedAssignee = (t: Task) =>
    (t.task_assignees || []).some(a => a.status === 'submitted');

  const isPendingReview = (t: Task) =>
    t.status === 'submitted' || hasSubmittedAssignee(t);

  // Accurate badge counters derived from the full task dataset
  const allTasksCount = useMemo(() =>
    tasks.length,
    [tasks]
  );

  const completedCount = useMemo(() =>
    tasks.filter(t => !t.is_archived && t.status === 'completed' && (isInternUser ? isInternTask(t) : true)).length,
    [tasks, isInternUser]
  );

  const myTasksCount = useMemo(() =>
    tasks.filter(t => !t.is_archived && t.status !== 'completed' && t.task_assignees?.some(a => a.user_id === user?.id)).length,
    [tasks, user?.id]
  );

  const internTasksCount = useMemo(() =>
    tasks.filter(t => !t.is_archived && t.status !== 'completed' && !isPendingReview(t) && isInternTask(t)).length,
    [tasks]
  );

  const pendingReviewCount = useMemo(() =>
    tasks.filter(t => !t.is_archived && isPendingReview(t) && (isInternUser ? isInternTask(t) : true)).length,
    [tasks, isInternUser]
  );

  // Time boundaries for Egypt/Cairo timezone
  const timeFilterBounds = useMemo(() => {
    const now = new Date();
    const todayCairoStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const [y, m, day] = todayCairoStr.split('-').map(Number);
    const cairoMidnight = new Date(Date.UTC(y, m - 1, day));
    const dayOfWeek = cairoMidnight.getUTCDay(); // 0 is Sunday, 6 is Saturday

    // Yesterday
    const yesterdayDate = new Date(cairoMidnight);
    yesterdayDate.setUTCDate(cairoMidnight.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().substring(0, 10);

    // This Week (Sunday - Saturday)
    const thisWeekStart = new Date(cairoMidnight);
    thisWeekStart.setUTCDate(cairoMidnight.getUTCDate() - dayOfWeek);
    const thisWeekEnd = new Date(cairoMidnight);
    thisWeekEnd.setUTCDate(cairoMidnight.getUTCDate() + (6 - dayOfWeek));
    const thisWeekStartStr = thisWeekStart.toISOString().substring(0, 10);
    const thisWeekEndStr = thisWeekEnd.toISOString().substring(0, 10);

    // Last Week
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setUTCDate(thisWeekEnd.getUTCDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().substring(0, 10);
    const lastWeekEndStr = lastWeekEnd.toISOString().substring(0, 10);

    // This Month (YYYY-MM)
    const thisMonthPrefix = todayCairoStr.substring(0, 7);

    // Last Month (YYYY-MM)
    const lastMonthDate = new Date(Date.UTC(y, m - 2, 1));
    const lastMonthPrefix = lastMonthDate.toISOString().substring(0, 7);

    return {
      todayStr: todayCairoStr,
      yesterdayStr,
      thisWeekStartStr,
      thisWeekEndStr,
      lastWeekStartStr,
      lastWeekEndStr,
      thisMonthPrefix,
      lastMonthPrefix,
    };
  }, []);

  const matchesTimeFilter = (task: Task): boolean => {
    if (timeFilter === 'all') return true;

    let dateStr: string | null = null;
    if (timeDateType === 'due_date') {
      if (!task.due_date) return false;
      dateStr = String(task.due_date).split('T')[0];
    } else {
      if (!task.created_at) return false;
      try {
        dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(task.created_at));
      } catch {
        dateStr = String(task.created_at).split('T')[0];
      }
    }

    if (!dateStr) return false;

    switch (timeFilter) {
      case 'today':
        return dateStr === timeFilterBounds.todayStr;
      case 'yesterday':
        return dateStr === timeFilterBounds.yesterdayStr;
      case 'this_week':
        return dateStr >= timeFilterBounds.thisWeekStartStr && dateStr <= timeFilterBounds.thisWeekEndStr;
      case 'last_week':
        return dateStr >= timeFilterBounds.lastWeekStartStr && dateStr <= timeFilterBounds.lastWeekEndStr;
      case 'this_month':
        return dateStr.startsWith(timeFilterBounds.thisMonthPrefix);
      case 'last_month':
        return dateStr.startsWith(timeFilterBounds.lastMonthPrefix);
      case 'custom':
        if (customStartDate && dateStr < customStartDate) return false;
        if (customEndDate && dateStr > customEndDate) return false;
        return true;
      default:
        return true;
    }
  };

  // Tab Filtering & Smart Priority Sorting
  const tabFilteredTasks = useMemo(() => {
    switch (activeTab) {
      case 'all_tasks':
        return tasks
          .filter(t => {
            if (statusFilter !== 'all') {
              if (statusFilter === 'archived') return Boolean(t.is_archived);
              if (statusFilter === 'submitted') return isPendingReview(t);
              return t.status === statusFilter;
            }
            return true;
          })
          .filter(matchesTimeFilter)
          .sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeB - timeA;
          });

      case 'active':
        return sortActiveTasks(
          tasks.filter(t => {
            if (t.is_archived) return false;
            if (statusFilter !== 'all') {
              if (statusFilter === 'submitted') return isPendingReview(t);
              return t.status === statusFilter;
            }
            const isFullySubmitted = t.status === 'submitted';
            return t.status !== 'completed' && !isFullySubmitted && (!isPureInternTask(t) || (teamMemberFilter !== 'all'));
          }),
          user?.id
        );

      case 'pending_review':
        return sortActiveTasks(
          tasks.filter(t => !t.is_archived && isPendingReview(t) && (isInternUser ? isInternTask(t) : true)),
          user?.id
        );

      case 'completed':
        return tasks.filter(t => !t.is_archived && t.status === 'completed' && (isInternUser ? isInternTask(t) : true));

      case 'my_tasks':
        return sortActiveTasks(
          tasks.filter(t => {
            if (t.is_archived) return false;
            if (statusFilter !== 'all') {
              if (statusFilter === 'submitted') return isPendingReview(t) && t.task_assignees?.some(a => a.user_id === user?.id);
              return t.status === statusFilter && t.task_assignees?.some(a => a.user_id === user?.id);
            }
            return t.status !== 'completed' && t.task_assignees?.some(a => a.user_id === user?.id);
          }),
          user?.id
        );

      case 'intern_tasks':
        return sortActiveTasks(
          tasks.filter(t => {
            if (t.is_archived) return false;
            if (statusFilter !== 'all') {
              if (statusFilter === 'submitted') return isPendingReview(t) && isInternTask(t);
              return t.status === statusFilter && isInternTask(t);
            }
            return t.status !== 'completed' && !isPendingReview(t) && isInternTask(t);
          }),
          user?.id
        );

      case 'archived':
        return tasks.filter(t => t.is_archived);

      default:
        return tasks;
    }
  }, [activeTab, tasks, statusFilter, teamMemberFilter, isInternUser, user?.id, timeFilter, timeDateType, customStartDate, customEndDate, timeFilterBounds]);

  // Secondary Filters (Member, Priority & Search Query)
  const filteredDisplayed = useMemo(() => {
    return tabFilteredTasks.filter(t => {
      if (teamMemberFilter !== 'all') {
        const isAssigned = t.task_assignees?.some(a => a.user_id === teamMemberFilter) || t.assignee_id === teamMemberFilter;
        if (!isAssigned) return false;
      }

      if (priorityFilter !== 'all') {
        if (t.priority !== priorityFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = t.title?.toLowerCase().includes(q);
        const clientMatch = t.client?.name?.toLowerCase().includes(q) || t.client?.company?.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        const assigneeMatch = (t.task_assignees || []).some(a => a.user?.name?.toLowerCase().includes(q));
        if (!titleMatch && !clientMatch && !descMatch && !assigneeMatch) return false;
      }

      return true;
    });
  }, [tabFilteredTasks, teamMemberFilter, priorityFilter, searchQuery]);

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{isOwner ? t('tasks.title') : t('tasks.myTasks')}</h1>
          <p className="page-header-subtitle">
            {isOwner ? t('tasks.subtitle') : t('tasks.mySubtitle')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="size-4" />
            {t('tasks.createTask')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-3 flex-wrap">
        {isInternUser ? (
          <>
            <button
              onClick={() => { setActiveTab('intern_tasks'); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'intern_tasks'
                  ? 'border-[#1D61E7] text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              🎓 {t('tasks.internTasksTab')}
              {internTasksCount > 0 && (
                <Badge className="text-[11px] h-5 px-1.5 bg-[#1D61E7] hover:bg-[#1D61E7] text-white">{internTasksCount}</Badge>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('pending_review'); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'pending_review'
                  ? 'border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              📤 {t('tasks.pendingReviewTab')}
              {pendingReviewCount > 0 && (
                <Badge className="text-[11px] h-5 px-1.5 bg-violet-600 hover:bg-violet-600 text-white font-bold">{pendingReviewCount}</Badge>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('completed'); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-[#1D61E7] text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              ✅ {t('tasks.completedTasks')}
              {completedCount > 0 && (
                <Badge variant="outline" className="text-[11px] h-5 px-1.5">{completedCount}</Badge>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setActiveTab('active'); setStatusFilter('all'); }}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'active'
                  ? 'border-[#1D61E7] text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              📋 {t('tasks.activeTasks')}
            </button>

            {canSeeAllTasksTab && (
              <button
                onClick={() => { setActiveTab('all_tasks'); setStatusFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'all_tasks'
                    ? 'border-[#1D61E7] text-[#1D61E7]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                🌐 {t('tasks.allTasksTab')}
                {allTasksCount > 0 && (
                  <Badge variant="outline" className="text-[11px] h-5 px-1.5">{allTasksCount}</Badge>
                )}
              </button>
            )}

            <button
              onClick={() => { setActiveTab('pending_review'); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'pending_review'
                  ? 'border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              📤 {t('tasks.pendingReviewTab')}
              {pendingReviewCount > 0 && (
                <Badge className="text-[11px] h-5 px-1.5 bg-violet-600 hover:bg-violet-600 text-white font-bold">{pendingReviewCount}</Badge>
              )}
            </button>

            {isOwner && (
              <button
                onClick={() => { setActiveTab('my_tasks'); setStatusFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'my_tasks'
                    ? 'border-[#1D61E7] text-[#1D61E7]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                👤 {t('tasks.myTasksTab')}
                {myTasksCount > 0 && (
                  <Badge className="text-[11px] h-5 px-1.5 bg-[#1D61E7] hover:bg-[#1D61E7] text-white">{myTasksCount}</Badge>
                )}
              </button>
            )}

            {(isOwner || user?.role === 'content_creator') && (
              <button
                onClick={() => { setActiveTab('intern_tasks'); setStatusFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'intern_tasks'
                    ? 'border-[#1D61E7] text-[#1D61E7]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                🎓 {t('tasks.internTasksTab')}
                {internTasksCount > 0 && (
                  <Badge className="text-[11px] h-5 px-1.5 bg-[#1D61E7] hover:bg-[#1D61E7] text-white">{internTasksCount}</Badge>
                )}
              </button>
            )}

            <button
              onClick={() => { setActiveTab('completed'); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-[#1D61E7] text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              ✅ {t('tasks.completedTasks')}
              {completedCount > 0 && (
                <Badge variant="outline" className="text-[11px] h-5 px-1.5">{completedCount}</Badge>
              )}
            </button>

            {isOwner && user?.role !== 'moderation' && (
              <button
                onClick={() => { setActiveTab('archived'); setStatusFilter('all'); }}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'archived'
                    ? 'border-[#1D61E7] text-[#1D61E7]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                📂 {t('tasks.archivedTasks')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">

        {/* Live Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={t('tasks.searchPlaceholder') || 'Search tasks by title, client, member...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 pl-9 rtl:pl-3 rtl:pr-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Team Member Filter (Owners / Admins) */}
        {isOwner && (
          <Select value={teamMemberFilter} onValueChange={(val) => setTeamMemberFilter(val || 'all')}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder={t('tasks.allTeamMembers')}>
                {teamMemberFilter !== 'all'
                  ? `👤 ${teamMembers.find(m => m.id === teamMemberFilter)?.name || ''}`
                  : `👤 ${t('tasks.allTeamMembers')}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">👤 {t('tasks.allTeamMembers')}</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter */}
        {activeTab !== 'completed' && activeTab !== 'pending_review' && (
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder={t('tasks.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{(activeTab === 'active' || activeTab === 'my_tasks' || activeTab === 'intern_tasks') ? t('tasks.allActiveStatuses') : t('tasks.allStatuses')}</SelectItem>
              <SelectItem value="todo">📝 {t('status.todo')}</SelectItem>
              <SelectItem value="in_progress">⚡ {t('status.in_progress')}</SelectItem>
              <SelectItem value="submitted">📤 {t('status.submitted')}</SelectItem>
              <SelectItem value="revision">🔄 {t('status.revision')}</SelectItem>
              {activeTab !== 'active' && activeTab !== 'my_tasks' && activeTab !== 'intern_tasks' && (
                <SelectItem value="completed">✅ {t('status.completed')}</SelectItem>
              )}
              {activeTab === 'all_tasks' && (
                <SelectItem value="archived">📂 {t('taskDetail.archivedBadge')}</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val || 'all')}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder={t('tasks.allPriorities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks.allPriorities')}</SelectItem>
            <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
            <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
            <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
            <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Time Period Filter (All Tasks Tab) */}
        {activeTab === 'all_tasks' && (
          <>
            <Select value={timeFilter} onValueChange={(val: any) => setTimeFilter(val || 'all')}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder={t('tasks.timeFilter')}>
                  {timeFilter === 'all' && `⏱️ ${t('tasks.allTime')}`}
                  {timeFilter === 'today' && `📅 ${t('tasks.today')}`}
                  {timeFilter === 'yesterday' && `⏮️ ${t('tasks.yesterday')}`}
                  {timeFilter === 'this_week' && `🗓️ ${t('tasks.thisWeek')}`}
                  {timeFilter === 'last_week' && `⏮️ ${t('tasks.lastWeek')}`}
                  {timeFilter === 'this_month' && `📆 ${t('tasks.thisMonth')}`}
                  {timeFilter === 'last_month' && `⏮️ ${t('tasks.lastMonth')}`}
                  {timeFilter === 'custom' && `🎯 ${t('tasks.customRange')}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">⏱️ {t('tasks.allTime')}</SelectItem>
                <SelectItem value="today">📅 {t('tasks.today')}</SelectItem>
                <SelectItem value="yesterday">⏮️ {t('tasks.yesterday')}</SelectItem>
                <SelectItem value="this_week">🗓️ {t('tasks.thisWeek')}</SelectItem>
                <SelectItem value="last_week">⏮️ {t('tasks.lastWeek')}</SelectItem>
                <SelectItem value="this_month">📆 {t('tasks.thisMonth')}</SelectItem>
                <SelectItem value="last_month">⏮️ {t('tasks.lastMonth')}</SelectItem>
                <SelectItem value="custom">🎯 {t('tasks.customRange')}</SelectItem>
              </SelectContent>
            </Select>

            {timeFilter !== 'all' && (
              <Select value={timeDateType} onValueChange={(val: any) => setTimeDateType(val || 'due_date')}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder={t('tasks.dateType')}>
                    {timeDateType === 'due_date' ? `📌 ${t('tasks.filterByDueDate')}` : `✨ ${t('tasks.filterByCreatedAt')}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">📌 {t('tasks.filterByDueDate')}</SelectItem>
                  <SelectItem value="created_at">✨ {t('tasks.filterByCreatedAt')}</SelectItem>
                </SelectContent>
              </Select>
            )}

            {timeFilter === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="h-9 w-36 text-xs px-2"
                  title={t('tasks.fromDate')}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="h-9 w-36 text-xs px-2"
                  title={t('tasks.toDate')}
                />
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title="Clear date range"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <span className="text-xs font-semibold text-muted-foreground ml-auto rtl:ml-0 rtl:mr-auto">
          {t('tasks.count', { count: filteredDisplayed.length })}
        </span>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="tasks-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="task-card">
              <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : filteredDisplayed.length > 0 ? (
        <div className="tasks-grid">
          {filteredDisplayed.map(task => (
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
        <div className="empty-state">
          <div className="empty-state-icon">
            {searchQuery ? '🔍' : activeTab === 'all_tasks' ? '🌐' : activeTab === 'archived' ? '🗄️' : activeTab === 'completed' ? '✅' : activeTab === 'pending_review' ? '📤' : activeTab === 'my_tasks' ? '👤' : activeTab === 'intern_tasks' ? '🎓' : '📋'}
          </div>
          <div className="empty-state-title">
            {searchQuery
              ? t('tasks.noTasksSearch') || t('tasks.noTasks')
              : activeTab === 'all_tasks'
                ? t('tasks.allTasksTab')
                : activeTab === 'archived'
                  ? t('tasks.noArchivedTasks')
                  : activeTab === 'completed'
                    ? t('tasks.noCompletedTasks')
                    : activeTab === 'pending_review'
                      ? t('tasks.noPendingReviewTasks')
                      : activeTab === 'my_tasks'
                        ? t('tasks.noMyTasks')
                        : activeTab === 'intern_tasks'
                          ? t('tasks.noInternTasks')
                          : t('tasks.noTasks')}
          </div>
          <div className="empty-state-desc">
            {searchQuery || (statusFilter !== 'all') || (priorityFilter !== 'all') || (teamMemberFilter !== 'all') || (activeTab === 'all_tasks' && timeFilter !== 'all')
              ? t('tasks.adjustFilters')
              : activeTab === 'all_tasks'
                ? t('tasks.noAllTasksDesc')
                : activeTab === 'completed'
                  ? t('tasks.noCompletedDesc')
                  : activeTab === 'pending_review'
                    ? t('tasks.noPendingReviewDesc')
                    : activeTab === 'my_tasks'
                      ? t('tasks.noMyTasksDesc')
                      : activeTab === 'intern_tasks'
                        ? t('tasks.noInternTasksDesc')
                        : isOwner
                          ? activeTab === 'archived'
                            ? t('tasks.noArchivedTasks')
                            : t('tasks.noActiveOwner')
                          : t('tasks.noActiveMember')}
          </div>
          {canCreate && !searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (activeTab === 'active' || activeTab === 'intern_tasks' || activeTab === 'all_tasks') && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="size-4" /> {t('tasks.createTask')}
            </Button>
          )}
        </div>
      )}

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(newTask) => {
          setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
          loadTasks(false);
        }}
      />
    </div>
  );
}

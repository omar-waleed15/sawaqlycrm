'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi } from '@/lib/api';
import { Task } from '@/types';
import TaskCard from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2 } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'my_tasks' | 'completed' | 'archived'>('active');

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';

  useEffect(() => {
    if (activeTab === 'archived' && user?.role === 'moderation') {
      setActiveTab('active');
      return;
    }
    loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, activeTab, user]);

  const loadTasks = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (activeTab === 'archived') {
      params.archived = 'true';
    }
    if (activeTab === 'completed' && !statusFilter) {
      params.status = 'completed';
    }
    if (activeTab === 'my_tasks' && user?.id) {
      params.assignee_id = user.id;
    }
    tasksApi.list(params)
      .then(data => setTasks(data.tasks))
      .catch(console.error)
      .finally(() => setLoading(false));
  };



  const displayedTasks = activeTab === 'active'
    ? tasks.filter(t => t.status !== 'completed')
    : activeTab === 'completed'
      ? tasks.filter(t => t.status === 'completed')
      : activeTab === 'my_tasks'
        ? tasks.filter(t => t.status !== 'completed' && t.task_assignees?.some(a => a.user_id === user?.id))
        : tasks;

  const filteredDisplayed = displayedTasks;

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const myTasksCount = tasks.filter(t => t.status !== 'completed' && t.task_assignees?.some(a => a.user_id === user?.id)).length;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{isOwner ? t('tasks.title') : t('tasks.myTasks')}</h1>
          <p className="page-header-subtitle">
            {isOwner ? t('tasks.subtitle') : t('tasks.mySubtitle')}
          </p>
        </div>
        {isOwner && (
          <Link href="/dashboard/tasks/create">
            <Button>
              <Plus className="size-4" />
              {t('tasks.createTask')}
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-3">
        <button
          onClick={() => { setActiveTab('active'); setStatusFilter(''); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-[#1D61E7] text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📋 {t('tasks.activeTasks')}
        </button>
        {isOwner && (
          <button
            onClick={() => { setActiveTab('my_tasks'); setStatusFilter(''); }}
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
        <button
          onClick={() => { setActiveTab('completed'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-[#1D61E7] text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ✅ {t('tasks.completedTasks')}
        </button>

        {isOwner && user?.role !== 'moderation' && (
          <button
            onClick={() => { setActiveTab('archived'); setStatusFilter(''); }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-[#1D61E7] text-[#1D61E7]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            📂 {t('tasks.archivedTasks')}
          </button>
        )}
      </div>



      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {activeTab !== 'completed' && (
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || '')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('tasks.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{(activeTab === 'active' || activeTab === 'my_tasks') ? t('tasks.allActiveStatuses') : t('tasks.allStatuses')}</SelectItem>
              <SelectItem value="todo">📝 {t('status.todo')}</SelectItem>
              <SelectItem value="in_progress">⚡ {t('status.in_progress')}</SelectItem>
              <SelectItem value="submitted">📤 {t('status.submitted')}</SelectItem>
              <SelectItem value="revision">🔄 {t('status.revision')}</SelectItem>
              {activeTab !== 'active' && activeTab !== 'my_tasks' && (
                <SelectItem value="completed">✅ {t('status.completed')}</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}

        <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val || '')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('tasks.allPriorities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('tasks.allPriorities')}</SelectItem>
            <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
            <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
            <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
            <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
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
          <div className="empty-state-icon">{activeTab === 'archived' ? '🗄️' : activeTab === 'completed' ? '✅' : activeTab === 'my_tasks' ? '👤' : '🔍'}</div>
          <div className="empty-state-title">{activeTab === 'archived' ? t('tasks.noArchivedTasks') : activeTab === 'completed' ? t('tasks.noCompletedTasks') : activeTab === 'my_tasks' ? t('tasks.noMyTasks') : t('tasks.noTasks')}</div>
          <div className="empty-state-desc">
            {statusFilter || priorityFilter
              ? t('tasks.adjustFilters')
              : activeTab === 'completed'
                ? t('tasks.noCompletedDesc')
                : activeTab === 'my_tasks'
                  ? t('tasks.noMyTasksDesc')
                  : isOwner
                    ? activeTab === 'archived'
                      ? t('tasks.noArchivedTasks')
                      : t('tasks.noActiveOwner')
                    : t('tasks.noActiveMember')}
          </div>
          {isOwner && !statusFilter && !priorityFilter && activeTab === 'active' && (
            <Link href="/dashboard/tasks/create">
              <Button><Plus className="size-4" /> {t('tasks.createTask')}</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

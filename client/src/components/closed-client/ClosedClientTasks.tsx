'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { tasksApi } from '@/lib/api';
import { sortActiveTasks } from '@/lib/taskSortUtils';
import TaskCard from '@/components/TaskCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Loader2,
  ListTodo,
  Search,
  X,
} from 'lucide-react';

interface ClosedClientTasksProps {
  clientId: string;
  client: Client;
}

export default function ClosedClientTasks({ clientId, client }: ClosedClientTasksProps) {
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const loadTasks = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await tasksApi.list({ client_id: clientId });
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load client tasks', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Live Task Event Listeners
  useEffect(() => {
    const handleTaskCreated = (e: any) => {
      if (e.detail?.client_id === clientId) {
        setTasks(prev => [e.detail, ...prev.filter(t => t.id !== e.detail.id)]);
      }
      loadTasks(false);
    };

    const handleTaskUpdated = (e: any) => {
      if (e.detail?.client_id === clientId) {
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
  }, [clientId, loadTasks]);

  // Filter tasks on frontend with smart sorting
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'todo' && task.status === 'todo') ||
        (statusFilter === 'in_progress' && task.status === 'in_progress') ||
        (statusFilter === 'submitted' && (task.status === 'submitted' || (task.task_assignees || []).some(a => a.status === 'submitted'))) ||
        (statusFilter === 'revision' && task.status === 'revision') ||
        (statusFilter === 'completed' && task.status === 'completed');

      const priorityMatch = priorityFilter === 'all' || task.priority === priorityFilter;

      if (!statusMatch || !priorityMatch) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = task.title?.toLowerCase().includes(q);
        const descMatch = task.description?.toLowerCase().includes(q);
        const assigneeMatch = (task.task_assignees || []).some(a => a.user?.name?.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !assigneeMatch) return false;
      }

      return true;
    });

    return sortActiveTasks(filtered);
  }, [tasks, statusFilter, priorityFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* Tasks Tab Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.tab.tasks')}</h3>
          <p className="text-sm text-muted-foreground">{t('tasks.manageClientTasks')}</p>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => setIsTaskModalOpen(true)}>
          <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('tasks.createTask')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={t('tasks.searchClientTasks') || t('tasks.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 pl-9 rtl:pl-3 rtl:pr-9 text-xs bg-card"
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

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={val => setStatusFilter(val || 'all')}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs bg-card">
            <SelectValue placeholder={t('tasks.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="todo">📝 {t('status.todo')}</SelectItem>
            <SelectItem value="in_progress">⚡ {t('status.in_progress')}</SelectItem>
            <SelectItem value="submitted">📤 {t('status.submitted')}</SelectItem>
            <SelectItem value="revision">🔄 {t('status.revision')}</SelectItem>
            <SelectItem value="completed">✅ {t('status.completed')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={val => setPriorityFilter(val || 'all')}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs bg-card">
            <SelectValue placeholder={t('tasks.allPriorities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
            <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
            <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
            <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs font-semibold text-muted-foreground ml-auto rtl:ml-0 rtl:mr-auto">
          {t('tasks.count', { count: filteredTasks.length })}
        </span>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListTodo className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">{t('tasks.noClientTasks')}</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t('tasks.noClientTasksDesc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTaskUpdated={() => loadTasks(false)}
              onTaskDeleted={() => loadTasks(false)}
            />
          ))}
        </div>
      )}

      {/* Unified Create Task Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        defaultClientId={clientId}
        onSuccess={() => loadTasks(false)}
      />
    </div>
  );
}

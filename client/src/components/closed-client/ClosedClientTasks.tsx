'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Task, Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { tasksApi } from '@/lib/api';
import TaskCard from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

interface ClosedClientTasksProps {
  clientId: string;
  client: Client;
}

export default function ClosedClientTasks({ clientId, client }: ClosedClientTasksProps) {
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tasksApi.list({ client_id: clientId });
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load client tasks', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter tasks on frontend for responsive rendering
  const filteredTasks = tasks.filter((task) => {
    const statusMatch =
      statusFilter === 'all' ||
      (statusFilter === 'todo' && task.status === 'todo') ||
      (statusFilter === 'in_progress' && task.status === 'in_progress') ||
      (statusFilter === 'submitted' && task.status === 'submitted') ||
      (statusFilter === 'revision' && task.status === 'revision') ||
      (statusFilter === 'completed' && task.status === 'completed');

    const priorityMatch = priorityFilter === 'all' || task.priority === priorityFilter;

    return statusMatch && priorityMatch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Tasks Tab Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.tab.tasks')}</h3>
          <p className="text-sm text-muted-foreground">Manage and track tasks assigned to this client</p>
        </div>
        <Link href={`/dashboard/tasks/create?client_id=${clientId}`}>
          <Button size="sm" className="w-full sm:w-auto">
            <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('tasks.createTask')}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={val => setStatusFilter(val || 'all')}>
          <SelectTrigger className="w-[160px] h-9 bg-card">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="revision">Revision</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={val => setPriorityFilter(val || 'all')}>
          <SelectTrigger className="w-[160px] h-9 bg-card">
            <SelectValue placeholder="Filter by Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
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
            <p className="text-sm font-semibold text-foreground mb-1">No tasks found</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              There are no tasks matching the selected filters. Click "Create Task" to assign one to this client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTaskUpdated={loadTasks}
              onTaskDeleted={loadTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

function formatDateLabel(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function TasksPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'archived'>('active');

  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
    tasksApi.list(params)
      .then(data => setTasks(data.tasks))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const openScheduleModal = (task: Task) => {
    setSchedulingTask(task);
    setSelectedDate(task.publish_date ? task.publish_date.split('T')[0] : '');
    setSelectedNotes(task.publish_notes || '');
  };

  const closeScheduleModal = () => {
    setSchedulingTask(null);
    setSelectedDate('');
    setSelectedNotes('');
  };

  const handleSaveSchedule = async () => {
    if (!schedulingTask) return;
    setSaving(true);
    const newDate = selectedDate || null;
    const newNotes = selectedNotes.trim() || null;
    setTasks(prev => prev.map(t =>
      t.id === schedulingTask.id
        ? { ...t, publish_date: newDate || undefined, publish_notes: newNotes || undefined }
        : t
    ));
    try {
      await tasksApi.update(schedulingTask.id, { publish_date: newDate, publish_notes: newNotes } as unknown as Partial<Task>);
      closeScheduleModal();
    } catch {
      alert(t('tasks.failedSaveSchedule'));
      loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!schedulingTask) return;
    setSaving(true);
    setTasks(prev => prev.map(t =>
      t.id === schedulingTask.id ? { ...t, publish_date: undefined, publish_notes: undefined } : t
    ));
    try {
      await tasksApi.update(schedulingTask.id, { publish_date: null, publish_notes: null } as unknown as Partial<Task>);
      closeScheduleModal();
    } catch {
      alert(t('tasks.failedClearSchedule'));
      loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const displayedTasks = activeTab === 'active'
    ? tasks.filter(t => t.status !== 'completed')
    : tasks;

  const filteredDisplayed = statusFilter && activeTab === 'scheduled'
    ? displayedTasks.filter(t => t.status === statusFilter)
    : displayedTasks;

  const scheduledCount = tasks.filter(t => !!t.publish_date).length;

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
      <div className="flex gap-0 border-b border-border mb-5">
        <button
          onClick={() => { setActiveTab('active'); setStatusFilter(''); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📋 {t('tasks.activeTasks')}
        </button>
        <button
          onClick={() => { setActiveTab('scheduled'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'scheduled'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📅 {t('tasks.scheduledTasks')}
          {scheduledCount > 0 && (
            <Badge className="text-[11px] h-5 px-1.5 bg-indigo-600 hover:bg-indigo-600">{scheduledCount}</Badge>
          )}
        </button>
        {isOwner && user?.role !== 'moderation' && (
          <button
            onClick={() => { setActiveTab('archived'); setStatusFilter(''); }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🗄️ {t('tasks.archivedTasks')}
          </button>
        )}
      </div>

      {/* Scheduled info banner */}
      {activeTab === 'scheduled' && (
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg px-4 py-3 mb-5 text-sm text-violet-800 font-medium flex items-center gap-2">
          <span className="text-base">💡</span>
          {t('tasks.scheduledInfoBanner')}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || '')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('tasks.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{activeTab === 'active' ? t('tasks.allActiveStatuses') : t('tasks.allStatuses')}</SelectItem>
            <SelectItem value="todo">📝 {t('status.todo')}</SelectItem>
            <SelectItem value="in_progress">⚡ {t('status.in_progress')}</SelectItem>
            <SelectItem value="submitted">📤 {t('status.submitted')}</SelectItem>
            <SelectItem value="revision">🔄 {t('status.revision')}</SelectItem>
            {activeTab === 'scheduled' && <SelectItem value="completed">✅ {t('status.completed')}</SelectItem>}
          </SelectContent>
        </Select>

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
          {activeTab === 'scheduled' && scheduledCount > 0 && (
            <span className="ml-2 text-green-700 font-semibold">{t('tasks.scheduledCount', { count: scheduledCount })}</span>
          )}
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
              onScheduleClick={activeTab === 'scheduled' ? openScheduleModal : undefined}
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
          <div className="empty-state-icon">{activeTab === 'scheduled' ? '📅' : activeTab === 'archived' ? '🗄️' : '🔍'}</div>
          <div className="empty-state-title">{activeTab === 'archived' ? t('tasks.noArchivedTasks') : t('tasks.noTasks')}</div>
          <div className="empty-state-desc">
            {statusFilter || priorityFilter
              ? t('tasks.adjustFilters')
              : isOwner
                ? activeTab === 'scheduled'
                  ? t('tasks.noScheduledOwner')
                  : activeTab === 'archived'
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

      {/* Schedule Modal */}
      <Dialog open={!!schedulingTask} onOpenChange={open => { if (!open) closeScheduleModal(); }}>
        <DialogContent className="max-w-[460px] p-6">
          {schedulingTask && (
            <>
              <DialogHeader className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{t('tasks.schedulePublish')}</p>
                <DialogTitle className="text-lg font-bold text-foreground m-0">{schedulingTask.title}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {schedulingTask.task_assignees && schedulingTask.task_assignees.length > 0 ? (
                    <span>👥 {schedulingTask.task_assignees.map(a => a.user?.name).filter(Boolean).join(', ')}</span>
                  ) : (
                    <span>👤 {t('common.unassigned')}</span>
                  )}
                  {schedulingTask.content_type && <span>🎬 {schedulingTask.content_type}</span>}
                </div>

                {schedulingTask.publish_date ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-700 font-semibold flex items-center gap-2">
                    📢 {t('tasks.currentlyScheduled', { date: formatDateLabel(schedulingTask.publish_date.split('T')[0], locale) })}
                  </div>
                ) : (
                  <div className="bg-muted border border-dashed border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
                    🗓️ {t('tasks.noPublishDateSet')}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sched-date">{t('tasks.publishDate')}</Label>
                  <Input
                    id="sched-date"
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sched-notes">{t('tasks.publishNotes')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span></Label>
                  <Textarea
                    id="sched-notes"
                    rows={3}
                    placeholder={t('tasks.publishNotesPlaceholder')}
                    value={selectedNotes}
                    onChange={e => setSelectedNotes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('tasks.calendarEventNote')}</p>
                </div>
              </div>

              <DialogFooter className="-mx-6 -mb-6 mt-6 px-6 py-4 border-t flex gap-2 justify-end">
                {schedulingTask.publish_date && (
                  <Button variant="outline" onClick={handleClearSchedule} disabled={saving} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                    <Trash2 className="size-3.5" /> {t('tasks.clearDate')}
                  </Button>
                )}
                <Button variant="outline" onClick={closeScheduleModal} disabled={saving}>{t('common.cancel')}</Button>
                <Button onClick={handleSaveSchedule} disabled={saving || !selectedDate}>
                  {saving ? <><Loader2 className="size-4 animate-spin" /> {t('common.loading')}</> : `📅 ${t('tasks.scheduleSubmit')}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

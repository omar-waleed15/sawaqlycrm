'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled'>('active');

  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader';

  useEffect(() => {
    loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter]);

  const loadTasks = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
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
      alert('Failed to save publish schedule');
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
      alert('Failed to clear publish schedule');
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
          <h1 className="page-header-title">{isOwner ? 'All Tasks' : 'My Tasks'}</h1>
          <p className="page-header-subtitle">
            {isOwner ? 'Manage and track all team tasks' : 'Tasks assigned to you'}
          </p>
        </div>
        {isOwner && (
          <Link href="/dashboard/tasks/create">
            <Button>
              <Plus className="size-4" />
              New Task
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
          📋 Active Tasks
        </button>
        <button
          onClick={() => { setActiveTab('scheduled'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'scheduled'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📅 Scheduled Tasks
          {scheduledCount > 0 && (
            <Badge className="text-[11px] h-5 px-1.5 bg-indigo-600 hover:bg-indigo-600">{scheduledCount}</Badge>
          )}
        </button>
      </div>

      {/* Scheduled info banner */}
      {activeTab === 'scheduled' && (
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg px-4 py-3 mb-5 text-sm text-violet-800 font-medium flex items-center gap-2">
          <span className="text-base">💡</span>
          Click any task card to set or update its publish date. Scheduled tasks appear on the calendar as 📢 publication events.
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || '')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All {activeTab === 'active' ? 'Active ' : ''}Statuses</SelectItem>
            <SelectItem value="todo">📝 To Do</SelectItem>
            <SelectItem value="in_progress">⚡ In Progress</SelectItem>
            <SelectItem value="submitted">📤 Submitted</SelectItem>
            <SelectItem value="revision">🔄 Needs Revision</SelectItem>
            {activeTab === 'scheduled' && <SelectItem value="completed">✅ Completed</SelectItem>}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val || '')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            <SelectItem value="urgent">🔴 Urgent</SelectItem>
            <SelectItem value="high">🟠 High</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filteredDisplayed.length} task{filteredDisplayed.length !== 1 ? 's' : ''}
          {activeTab === 'scheduled' && scheduledCount > 0 && (
            <span className="ml-2 text-green-700 font-semibold">· {scheduledCount} scheduled</span>
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
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">{activeTab === 'scheduled' ? '📅' : '🔍'}</div>
          <div className="empty-state-title">No tasks found</div>
          <div className="empty-state-desc">
            {statusFilter || priorityFilter
              ? 'Try adjusting your filters to see more tasks.'
              : isOwner
                ? activeTab === 'scheduled'
                  ? 'No tasks yet. Create tasks and schedule publish dates to build your content plan.'
                  : 'Create your first task to get started.'
                : 'No tasks assigned yet.'}
          </div>
          {isOwner && !statusFilter && !priorityFilter && activeTab !== 'scheduled' && (
            <Link href="/dashboard/tasks/create">
              <Button><Plus className="size-4" /> Create Task</Button>
            </Link>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      <Dialog open={!!schedulingTask} onOpenChange={open => { if (!open) closeScheduleModal(); }}>
        <DialogContent className="max-w-[460px] p-0 overflow-hidden">
          {schedulingTask && (
            <>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-1">Schedule Publication</p>
                <DialogTitle className="text-lg font-bold text-white m-0">{schedulingTask.title}</DialogTitle>
              </div>

              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {schedulingTask.task_assignees && schedulingTask.task_assignees.length > 0 ? (
                    <span>👥 {schedulingTask.task_assignees.map(a => a.user?.name).filter(Boolean).join(', ')}</span>
                  ) : (
                    <span>👤 Unassigned</span>
                  )}
                  {schedulingTask.content_type && <span>🎬 {schedulingTask.content_type}</span>}
                </div>

                {schedulingTask.publish_date ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-700 font-semibold flex items-center gap-2">
                    📢 Currently scheduled: {formatDateLabel(schedulingTask.publish_date.split('T')[0])}
                  </div>
                ) : (
                  <div className="bg-muted border border-dashed border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
                    🗓️ No publish date set — pick a date to add to the content plan.
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sched-date">Publish Date</Label>
                  <Input
                    id="sched-date"
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sched-notes">Publish Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="sched-notes"
                    rows={3}
                    placeholder="e.g. Post on Instagram & TikTok at 6 PM…"
                    value={selectedNotes}
                    onChange={e => setSelectedNotes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">The selected date will appear on the Calendar as a 📢 publication event.</p>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t flex gap-2 justify-end">
                {schedulingTask.publish_date && (
                  <Button variant="outline" onClick={handleClearSchedule} disabled={saving} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                    <Trash2 className="size-3.5" /> Clear Date
                  </Button>
                )}
                <Button variant="outline" onClick={closeScheduleModal} disabled={saving}>Cancel</Button>
                <Button onClick={handleSaveSchedule} disabled={saving || !selectedDate}>
                  {saving ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : '📅 Save Schedule'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

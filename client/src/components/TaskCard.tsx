'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Task, TaskAssignee, User, Client } from '@/types';
import { PriorityBadge } from './Badges';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi, clientsApi } from '@/lib/api';
import { formatCairoDate, formatCairoDateTime, isDateOverdue } from '@/lib/dateUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreVertical, Pencil, Trash2, Loader2, Save, X, ArrowRight, MessageSquare, Paperclip } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onScheduleClick?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

function formatDate(dateStr?: string, locale: string = 'en'): string {
  return formatCairoDate(dateStr, locale);
}

function isOverdue(dateStr?: string, assignees?: TaskAssignee[]): boolean {
  if (!dateStr) return false;
  const allCompleted = assignees?.every(a => a.status === 'completed');
  if (allCompleted) return false;
  return isDateOverdue(dateStr);
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TaskCard({ task, onScheduleClick, onTaskUpdated, onTaskDeleted }: TaskCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const assignees = task.task_assignees || [];
  const overdue = isOverdue(task.due_date, assignees);
  const myAssignment = task.task_assignees?.find(a => a.user_id === user?.id);

  // canAdminister checks: admin/owner OR leader/manager who is NOT assigned as a worker to the task
  const isOwner = user?.role === 'owner' || (
    (user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager') &&
    !myAssignment
  );

  // Determine logged time text
  let loggedTimeText = '';
  const totalLoggedSeconds = task.task_assignees?.reduce((sum, a) => sum + (a.total_time_spent || 0), 0) || 0;
  if (isOwner) {
    if (totalLoggedSeconds > 0) {
      loggedTimeText = `${formatDuration(totalLoggedSeconds)} (${locale === 'ar' ? 'الإجمالي' : 'total'})`;
    }
  } else if (myAssignment) {
    const mySeconds = myAssignment.total_time_spent || 0;
    if (mySeconds > 0 || myAssignment.timer_started_at) {
      loggedTimeText = formatDuration(mySeconds);
      if (myAssignment.timer_started_at) {
        loggedTimeText += ` (${locale === 'ar' ? 'نشط' : 'active'})`;
      }
    }
  }

  // moderation roles cannot archive/restore tasks
  const canArchive = isOwner && user?.role !== 'moderation';

  const submittedCount = assignees.filter(a => a.status === 'submitted').length;
  const totalAssignees = assignees.length;

  // Edit Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
    drive_link: task.drive_link || '',
    content_type: task.content_type || '',
    content_description: task.content_description || '',
    client_id: task.client_id || '',
    is_deliverable: task.is_deliverable || false,
    deliverable_type: task.deliverable_type || 'post',
    deliverable_month: task.deliverable_month ? task.deliverable_month.substring(0, 7) : (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })(),
  });

  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    (task.task_assignees || []).map(a => a.user_id)
  );

  // Sync state with props when modal opens
  useEffect(() => {
    if (isEditDialogOpen) {
      setForm({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        drive_link: task.drive_link || '',
        content_type: task.content_type || '',
        content_description: task.content_description || '',
        client_id: task.client_id || '',
        is_deliverable: task.is_deliverable || false,
        deliverable_type: task.deliverable_type || 'post',
        deliverable_month: task.deliverable_month ? task.deliverable_month.substring(0, 7) : (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        })(),
      });
      setAssigneeIds((task.task_assignees || []).map(a => a.user_id));
      setError('');
    }
  }, [task, isEditDialogOpen]);

  // Lazy load members and clients lists
  useEffect(() => {
    if (!isEditDialogOpen) return;
    setLoadingLists(true);
    Promise.all([
      usersApi.list(),
      clientsApi.list(),
    ]).then(([usersData, clientsData]) => {
      setMembers(usersData.users);
      setClients(clientsData.clients);
    }).catch(err => {
      console.error(err);
      setError('Failed to load members or clients');
    }).finally(() => setLoadingLists(false));
  }, [isEditDialogOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const removeAssignee = (uid: string) => {
    setAssigneeIds(prev => prev.filter(i => i !== uid));
  };

  const unassignedMembers = members.filter(m => !assigneeIds.includes(m.id));

  const handleClick = () => {
    if (onScheduleClick) {
      onScheduleClick(task);
    } else {
      router.push(`/dashboard/tasks/${task.id}`);
    }
  };

  const handleToggleArchive = async () => {
    const archiveState = !task.is_archived;
    const confirmMsg = archiveState ? t('taskDetail.archiveConfirm') : t('taskDetail.unarchiveConfirm');
    if (!confirm(confirmMsg)) return;

    try {
      const data = await tasksApi.update(task.id, { is_archived: archiveState } as any);
      alert(archiveState ? t('tasks.archiveSuccess') : t('tasks.unarchiveSuccess'));
      if (onTaskUpdated) {
        onTaskUpdated(data.task);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update task archive status');
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('taskDetail.deleteConfirm'))) return;

    try {
      await tasksApi.delete(task.id);
      if (onTaskDeleted) {
        onTaskDeleted(task.id);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete task');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const data = await tasksApi.update(task.id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: form.due_date || undefined,
        drive_link: form.drive_link || undefined,
        content_type: form.content_type || undefined,
        content_description: form.content_description || undefined,
        client_id: form.client_id || undefined,
        is_deliverable: form.is_deliverable,
        deliverable_type: form.is_deliverable ? form.deliverable_type : undefined,
        deliverable_month: form.is_deliverable ? `${form.deliverable_month}-01` : undefined,
        assignee_ids: assigneeIds,
      });
      setIsEditDialogOpen(false);
      if (onTaskUpdated) {
        onTaskUpdated(data.task);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 slide-up h-full flex flex-col"
        onClick={handleClick}
      >
        <CardContent className="p-4 flex flex-col gap-3 flex-1">
          {/* Header: Type, Priority & Actions */}
          <div className="flex items-start justify-between gap-4">
            {/* Top Left: content type & priority badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.is_archived && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-semibold py-0 px-1.5 h-5 flex items-center justify-center">
                  🗄️ {t('taskDetail.archivedBadge')}
                </Badge>
              )}
              {task.content_type && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-wide font-medium py-0 px-1.5 h-5 flex items-center justify-center">
                  📦 {t(`contentType.${task.content_type}`)}
                </Badge>
              )}
              <PriorityBadge priority={task.priority} />
              {overdue && (
                <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-bold py-0 px-1.5 h-5 flex items-center justify-center uppercase tracking-wide">
                  ⚠️ {t('common.overdue')}
                </Badge>
              )}
            </div>

            {/* Top Right: options menu */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 p-0 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-full shrink-0 -mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditDialogOpen(true); }}>
                    <Pencil className="size-3.5 mr-2" />
                    {t('common.edit')}
                  </DropdownMenuItem>
                  {canArchive && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleArchive(); }}>
                      <span className="mr-2 select-none">🗄️</span>
                      {task.is_archived ? t('taskDetail.unarchiveTask') : t('taskDetail.archiveTask')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Body Section: Title & Description */}
          <div className="flex flex-col text-start">
            {task.client && (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 block">
                💼 {task.client.name}
              </span>
            )}
            <h3 className="text-sm font-semibold text-foreground leading-snug break-words">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1.5 break-words">
                {task.description}
              </p>
            )}
          </div>

          {/* Secondary Widgets Section */}
          {(isOwner && submittedCount > 0) || task.publish_date || loggedTimeText ? (
            <div className="flex flex-col gap-2 mt-1">
              {/* Submission progress for admin */}
              {isOwner && submittedCount > 0 && (
                <div className="bg-violet-50 dark:bg-violet-950/20 border-s-2 border-violet-400 rounded px-2.5 py-1 text-[11px] text-violet-800 dark:text-violet-300 font-semibold text-start">
                  📤 {t('tasks.submissionsPending', { count: submittedCount })}
                </div>
              )}

              {/* Publish Date Badge */}
              {task.publish_date && (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded px-1.5 py-0.5 w-fit">
                    📢 {t('tasks.publish')} {formatDate(task.publish_date, locale)}
                  </span>
                  {task.publish_notes && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-1 leading-relaxed ps-1 text-start">
                      📝 {task.publish_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Logged Time */}
              {loggedTimeText && (
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 select-none text-start">
                  <span>⏱️</span>
                  <span>{loggedTimeText}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Bottom section (pinned to bottom) */}
          <div className="mt-auto flex flex-col gap-2">
            {/* Line separator */}
            <div className="h-px bg-border my-1" />

            {/* Row 1: Dates (Created at & Due date) */}
            <div className="flex items-center text-[10px] text-muted-foreground select-none gap-2 flex-wrap text-start px-0.5">
              <span className="inline-flex items-center gap-1 shrink-0 font-medium">
                <span>📅</span>
                <span className="text-muted-foreground/80">{t('taskDetail.created') || 'Created'}:</span>
                <span className="font-semibold text-foreground">{formatCairoDateTime(task.created_at, locale)}</span>
              </span>
              {task.due_date && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="inline-flex items-center gap-1 shrink-0 font-medium">
                    <span>🏁</span>
                    <span className="text-muted-foreground/80">{t('taskDetail.dueDate') || 'Due'}:</span>
                    <span className="font-semibold text-foreground">{formatCairoDateTime(task.due_date, locale)}</span>
                  </span>
                </>
              )}
            </div>

            {/* Row 2: Creator, Assignees, Metrics & Open Button */}
            <div className="flex items-center justify-between text-muted-foreground text-xs pt-0.5 select-none gap-3 flex-wrap">
              {/* Left side: Creator & Assignees */}
              <div className="flex items-center gap-2">
                {/* Creator Profile */}
                <div className="flex items-center" title={`${t('tasks.from')}: ${task.creator?.name || 'Unknown'}`}>
                  {task.creator?.avatar_url ? (
                    <img
                      src={task.creator.avatar_url}
                      alt={task.creator.name}
                      className="size-8 rounded-full object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0 border border-border uppercase">
                      {task.creator ? getInitials(task.creator.name) : '?'}
                    </div>
                  )}
                </div>

                <span className="text-muted-foreground/50 text-xs font-semibold mr-0.5 select-none">:</span>

                {/* Assignees stacked avatar group */}
                <div className="flex items-center shrink-0">
                  {totalAssignees > 0 ? (
                    <div className="flex items-center">
                      <div className="flex -space-x-2">
                        {assignees.slice(0, 3).map(a => (
                          a.user?.avatar_url ? (
                            <img
                              key={a.id}
                              src={a.user.avatar_url}
                              alt={a.user.name}
                              className="size-8 rounded-full object-cover shrink-0 border-2 border-white dark:border-slate-900"
                              title={a.user.name}
                            />
                          ) : (
                            <div
                              key={a.id}
                              className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0 border-2 border-white dark:border-slate-900 uppercase"
                              title={a.user?.name || 'Assigned Member'}
                            >
                              {a.user ? getInitials(a.user.name) : '?'}
                            </div>
                          )
                        ))}
                      </div>
                      {totalAssignees > 3 && (
                        <span className="text-[10px] text-muted-foreground font-semibold ml-1">
                          +{totalAssignees - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('common.unassigned')}</span>
                  )}
                </div>
              </div>

              {/* Right side: Attachments, Comments & Open Arrow Button */}
              <div className="flex items-center gap-3.5 flex-wrap">
                {/* Attachments count */}
                <div className="flex items-center gap-1" title={t('taskDetail.attachments')}>
                  <Paperclip className="size-3.5 text-muted-foreground/75" />
                  <span className="text-[11px] font-semibold">
                    {task.attachments?.length || 0}
                  </span>
                </div>

                {/* Comments count */}
                <div className="flex items-center gap-1" title={t('taskDetail.comments')}>
                  <MessageSquare className="size-3.5 text-muted-foreground/75" />
                  <span className="text-[11px] font-semibold">
                    {task.comments?.length || 0}
                  </span>
                </div>

                {/* Arrow button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  className="size-7 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center justify-center transition-all shrink-0"
                  title={t('common.open') || 'Open'}
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Schedule Action Button */}
          {onScheduleClick && isOwner && !task.publish_date && (
            <div className="mt-2 pt-2 border-t border-dashed border-border">
              <span className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-md py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors">
                🗓️ {t('tasks.clickToSchedule')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Task Modal */}
      {isEditDialogOpen && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent 
            className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                {t('editTask.title')}
              </DialogTitle>
            </DialogHeader>

            {loadingLists ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="size-6 animate-spin text-indigo-600" />
                <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-md">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-title">{t('createTask.taskTitle')} *</Label>
                  <Input 
                    id="edit-title" 
                    name="title" 
                    value={form.title} 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-description">{t('createTask.description')}</Label>
                  <Textarea 
                    id="edit-description" 
                    name="description" 
                    value={form.description} 
                    onChange={handleChange} 
                    rows={4} 
                  />
                </div>

                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-bold mb-2.5">🎥 {t('createTask.contentAssets')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>{t('createTask.contentType')}</Label>
                      <Select 
                        value={form.content_type} 
                        onValueChange={v => handleSelectChange('content_type', v || '')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('createTask.selectContentType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          <SelectItem value="post">{t('contentType.post')}</SelectItem>
                          <SelectItem value="story">{t('contentType.story')}</SelectItem>
                          <SelectItem value="reel">{t('contentType.reel')}</SelectItem>
                          <SelectItem value="photos">{t('contentType.photos')}</SelectItem>
                          <SelectItem value="other">{t('contentType.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="edit-drive_link">{t('createTask.driveLink')}</Label>
                      <Input
                        id="edit-drive_link"
                        name="drive_link"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={form.drive_link}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2.5">
                    <Label htmlFor="edit-content_description">{t('createTask.contentDetails')}</Label>
                    <Textarea
                      id="edit-content_description"
                      name="content_description"
                      placeholder={t('createTask.contentDetailsPlaceholder')}
                      value={form.content_description}
                      onChange={handleChange}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('createTask.priority')}</Label>
                    <Select 
                      value={form.priority} 
                      onValueChange={v => handleSelectChange('priority', v || '')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
                        <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
                        <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
                        <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-due_date">{t('createTask.dueDate')}</Label>
                    <Input 
                      id="edit-due_date" 
                      name="due_date" 
                      type="date" 
                      value={form.due_date} 
                      onChange={handleChange} 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-client_id">{t('tasks.client')} *</Label>
                  <Select 
                    value={form.client_id || 'none'} 
                    onValueChange={v => handleSelectChange('client_id', v === 'none' || !v ? '' : v)}
                  >
                    <SelectTrigger id="edit-client_id">
                      <SelectValue placeholder={t('tasks.selectClient')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Monthly Deliverables Config */}
                {form.client_id && form.client_id !== 'none' && (
                  <div className="border border-indigo-100 bg-indigo-50/20 dark:border-indigo-950/40 dark:bg-indigo-950/5 rounded-lg p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        id="edit-is_deliverable"
                        name="is_deliverable"
                        type="checkbox"
                        checked={form.is_deliverable}
                        onChange={e => setForm(prev => ({ ...prev, is_deliverable: e.target.checked }))}
                        className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-start">
                        <Label htmlFor="edit-is_deliverable" className="font-bold text-sm cursor-pointer">
                          🎯 {t('tasks.isDeliverable')}
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {t('tasks.isDeliverableDesc')}
                        </p>
                      </div>
                    </div>

                    {form.is_deliverable && (
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="edit-deliverable_type">{t('tasks.deliverableType')}</Label>
                          <Select
                            value={form.deliverable_type}
                            onValueChange={v => handleSelectChange('deliverable_type', v || 'post')}
                          >
                            <SelectTrigger id="edit-deliverable_type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="post">📝 {t('closedClients.plan.post')}</SelectItem>
                              <SelectItem value="reel">🎬 {t('closedClients.plan.reel')}</SelectItem>
                              <SelectItem value="story">📸 {t('closedClients.plan.story')}</SelectItem>
                              <SelectItem value="photo">🖼️ {t('closedClients.plan.photo')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="edit-deliverable_month">{t('tasks.deliverableMonth')}</Label>
                          <Input
                            id="edit-deliverable_month"
                            name="deliverable_month"
                            type="month"
                            value={form.deliverable_month}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-Assignee Picker */}
                <div className="border-t border-border pt-3">
                  <Label className="mb-2 block">👥 {t('createTask.assignTo')}</Label>

                  {assigneeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {assigneeIds.map(uid => {
                        const m = members.find(u => u.id === uid);
                        if (!m) return null;
                        return (
                          <Badge
                            key={uid}
                            variant="secondary"
                            className="flex items-center gap-1 py-0.5 px-2 text-xs font-semibold"
                          >
                            <div className="size-4.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[7px] font-bold text-white shrink-0 uppercase">
                              {getInitials(m.name)}
                            </div>
                            <span className="truncate max-w-[100px]">{m.name}</span>
                            <button
                              type="button"
                              onClick={() => removeAssignee(uid)}
                              className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={val => {
                        if (val && val !== 'none' && !assigneeIds.includes(val)) {
                          setAssigneeIds(prev => [...prev, val]);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('createTask.selectMember')} />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({t('role.' + m.role) || m.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="flex gap-2 justify-end pt-2.5 border-t border-border mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={saving}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <><Loader2 className="size-4 animate-spin mr-1.5" /> {t('editTask.saving')}</>
                    ) : (
                      <><Save className="size-4 mr-1.5" /> {t('editTask.saveChanges')}</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


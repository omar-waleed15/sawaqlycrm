'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, commentsApi } from '@/lib/api';
import { Task, TaskAssignee, Comment, User } from '@/types';
import { formatCairoDate, formatCairoDateTime, isDateOverdue } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, Pencil, Trash2, Loader2, Send, CheckCircle2, RotateCcw, Clock, ChevronDown, MoreVertical, Download, ExternalLink } from 'lucide-react';

function formatDate(dateStr?: string, t?: any, locale?: string): string {
  if (!dateStr) return t ? t('taskDetail.noDueDate') : 'No due date';
  return formatCairoDate(dateStr, locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDetailDateTime(dateStr?: string, t?: any, locale?: string): string {
  if (!dateStr) return t ? t('taskDetail.noDueDate') : 'No due date';
  return formatCairoDateTime(dateStr, locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr: string, locale: string): string {
  return formatCairoDateTime(dateStr, locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeUntilExpiry(createdAt: string, t: any): string {
  const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) return t('taskDetail.expiring');
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return t('taskDetail.timeLeft', { hours, mins });
  return t('taskDetail.minsLeft', { mins });
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Member submission state
  const [submissionLink, setSubmissionLink] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [completionNote, setCompletionNote] = useState('');

  // Admin review state
  const [revisionFeedback, setRevisionFeedback] = useState<Record<string, string>>({});
  const [submittingReview, setSubmittingReview] = useState<Record<string, boolean>>({});
  const [activeRevisionUserId, setActiveRevisionUserId] = useState<string | null>(null);
  const [activeApprovalUserId, setActiveApprovalUserId] = useState<string | null>(null);
  const [approvalRating, setApprovalRating] = useState<Record<string, number>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [timerLoading, setTimerLoading] = useState(false);

  // Ticking clock for active timers
  useEffect(() => {
    const hasActiveTimers = task?.task_assignees?.some(a => !!a.timer_started_at);
    if (!hasActiveTimers) return;

    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [task?.task_assignees]);

  const getAssigneeTime = (a: TaskAssignee): number => {
    let elapsed = a.total_time_spent || 0;
    if (a.timer_started_at) {
      const started = new Date(a.timer_started_at).getTime();
      const diffSeconds = Math.max(0, Math.floor((nowTime - started) / 1000));
      elapsed += diffSeconds;
    }
    return elapsed;
  };

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';

  // Find the current user's assignment (for members)
  const myAssignment = task?.task_assignees?.find(a => a.user_id === user?.id);

  const canAdminister = user?.role === 'owner' || (
    (user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager') &&
    !myAssignment
  );

  const loadTask = async () => {
    try {
      const [taskData, commentsData] = await Promise.all([
        tasksApi.get(id),
        commentsApi.list(id),
      ]);
      setTask(taskData.task);
      setComments(commentsData.comments);

      // Load member's submission data
      const myA = taskData.task.task_assignees?.find(a => a.user_id === user?.id);
      if (myA) {
        setSubmissionLink(myA.submission_link || '');
        setCompletionNote(myA.completion_note || '');
      }

    } catch {
      router.replace('/dashboard/tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Comments
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const data = await commentsApi.create(id, commentText.trim());
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    } catch (err) { console.error(err); }
    finally { setSubmittingComment(false); }
  };

  // Member: submit work
  const handleSubmitWork = async () => {
    if (!submissionLink.trim()) return;
    setSubmittingLink(true);
    try {
      const data = await tasksApi.update(id, {
        submission_link: submissionLink,
        status: 'submitted' as any,
        completion_note: completionNote || undefined,
      });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setSubmittingLink(false); }
  };

  // Member: start task
  const handleStartTask = async () => {
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: 'in_progress' as any });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  // Member: resume work after revision
  const handleResumeWork = async () => {
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: 'in_progress' as any });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  // Timer: start timer
  const handleStartTimer = async () => {
    setTimerLoading(true);
    try {
      const data = await tasksApi.startTimer(id);
      setTask(data.task);
    } catch (err) {
      console.error(err);
    } finally {
      setTimerLoading(false);
    }
  };

  // Timer: stop/pause timer
  const handleStopTimer = async () => {
    setTimerLoading(true);
    try {
      const data = await tasksApi.stopTimer(id);
      setTask(data.task);
    } catch (err) {
      console.error(err);
    } finally {
      setTimerLoading(false);
    }
  };

  // Admin: review actions
  const handleApprove = async (userId: string) => {
    setSubmittingReview(prev => ({ ...prev, [userId]: true }));
    try {
      const rating = approvalRating[userId] || 10;
      const feedback = approvalFeedback[userId]?.trim() || undefined;
      const data = await tasksApi.updateAssignee(id, userId, {
        status: 'completed',
        rating,
        feedback,
      });
      setTask(data.task);
      setActiveApprovalUserId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRequestRevision = async (userId: string) => {
    const feedback = revisionFeedback[userId] || '';
    if (!feedback.trim()) return;
    setSubmittingReview(prev => ({ ...prev, [userId]: true }));
    try {
      const data = await tasksApi.updateAssignee(id, userId, {
        status: 'revision',
        feedback: feedback.trim(),
      });
      setTask(data.task);
      setActiveRevisionUserId(null);
      setRevisionFeedback(prev => ({ ...prev, [userId]: '' }));
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Admin: delete task
  const handleDelete = async () => {
    if (!confirm(t('taskDetail.deleteConfirm'))) return;
    try {
      await tasksApi.delete(id);
      router.push('/dashboard/tasks');
    } catch (err) { console.error(err); }
  };

  // Admin: archive/unarchive task
  const handleToggleArchive = async (archiveState: boolean) => {
    const confirmMsg = archiveState ? t('taskDetail.archiveConfirm') : t('taskDetail.unarchiveConfirm');
    if (!confirm(confirmMsg)) return;
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { is_archived: archiveState } as any);
      setTask(data.task);
      alert(archiveState ? t('tasks.archiveSuccess') : t('tasks.unarchiveSuccess'));
    } catch (err) {
      console.error(err);
      alert('Failed to update task archive status');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  if (!task) return null;

  const assignees = task.task_assignees || [];
  const isOverdue = task.due_date && isDateOverdue(task.due_date) && assignees.some(a => a.status !== 'completed');

  // Compute summary
  const totalAssignees = assignees.length;
  const completedCount = assignees.filter(a => a.status === 'completed').length;
  const submittedCount = assignees.filter(a => a.status === 'submitted').length;

  return (
    <div className="page-container fade-in">
      {/* Redesigned Header: Back button & Action dropdown */}
      <div className="flex items-center justify-between border-b pb-4 mb-6 flex-wrap gap-4">
        <Button variant="outline" size="sm" className="gap-1.5 font-bold" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> {t('common.back') || 'Back'}
        </Button>

        {/* Action dropdown for Admin tasks */}
        {canAdminister && (
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="font-bold text-xs gap-1">
                    ⚙️ {t('common.actions') || 'Actions'} <ChevronDown className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {user?.role !== 'moderation' && (
                  <DropdownMenuItem onClick={() => handleToggleArchive(!task.is_archived)} disabled={statusUpdating}>
                    🗄️ {task.is_archived ? t('taskDetail.unarchiveTask') : t('taskDetail.archiveTask')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push(`/dashboard/tasks/${id}/edit`)}>
                  <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-955/20"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3 width on desktop): Main Workspace */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Archived Banner Notification */}
          {task.is_archived && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm font-semibold flex items-center gap-2 text-start">
              🗄️ {t('taskDetail.archivedBadge')}
            </div>
          )}

          {/* Task Title, Labels & Description Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-6 flex flex-col gap-5 text-start">
              
              {/* Title */}
              <h1 className="text-xl md:text-2xl font-black text-foreground leading-snug">
                {task.title}
              </h1>

              <Separator />

              {/* Description */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('taskDetail.description') || 'Description'}</h3>
                {task.description ? (
                  <p className="text-foreground leading-relaxed text-sm whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">{t('taskDetail.noDescription')}</p>
                )}
              </div>

              {(task.drive_link || task.content_description || (task.attachments && task.attachments.length > 0)) && (
                <div className="border-t pt-4 mt-1 flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    🎬 {t('taskDetail.contentDetailsAssets') || 'Content Details & Assets'}
                  </h3>

                  {/* Google Drive Link */}
                  {task.drive_link && (
                    <div className="flex flex-col gap-1.5 text-xs text-start">
                      <span className="font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.googleDriveAttachments') || 'Google Drive Link'}</span>
                      <div className="flex items-center gap-3 bg-muted/40 dark:bg-indigo-955/10 border border-border/60 p-3 rounded-lg flex-wrap min-w-0">
                        <a
                          href={task.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold break-all text-xs flex-1 min-w-0 text-start"
                        >
                          {task.drive_link}
                        </a>
                        <a href={task.drive_link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button size="sm" className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 rounded">
                            {t('common.open') || 'Open'} ↗
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Uploaded Attachments */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5 text-xs text-start">
                      <span className="font-bold text-muted-foreground uppercase tracking-wide">
                        📎 {t('taskDetail.attachments') || 'Attachments'} ({task.attachments.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {task.attachments.map(att => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/30 p-2 hover:bg-muted/75 transition-colors group min-w-0"
                          >
                            <div
                              onClick={() => att.public_url && window.open(att.public_url, '_blank')}
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            >
                              {att.mimetype?.startsWith('image/') ? (
                                <div className="size-9 rounded-md overflow-hidden bg-muted border border-border shrink-0">
                                  {att.public_url && (
                                    <img
                                      src={att.public_url}
                                      alt={att.filename || 'Attachment'}
                                      className="size-full object-cover"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="size-9 rounded-md bg-rose-50 border border-rose-200/50 flex items-center justify-center shrink-0">
                                  <span className="text-sm">📄</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0 text-start">
                                <div className="text-xs font-bold truncate group-hover:text-indigo-600 transition-colors leading-tight">{att.filename}</div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                  {att.size < 1024 ? att.size + ' B' : att.size < 1024 * 1024 ? (att.size / 1024).toFixed(1) + ' KB' : (att.size / (1024 * 1024)).toFixed(1) + ' MB'}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button variant="ghost" size="icon" className="size-7 rounded-md hover:bg-muted-foreground/10 shrink-0">
                                      <MoreVertical className="size-3.5 text-muted-foreground" />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => att.public_url && window.open(att.public_url, '_blank')}>
                                    <ExternalLink className="size-3 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                                    {t('common.open') || 'Open'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    if (!att.public_url) return;
                                    const link = document.createElement('a');
                                    link.href = att.public_url;
                                    link.setAttribute('download', att.filename || 'file');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}>
                                    <Download className="size-3 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                                    {t('common.download') || 'Download'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guidelines */}
                  {task.content_description && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{t('taskDetail.contentGuidelines')}</span>
                      <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/60 p-3.5 rounded-lg border leading-relaxed font-mono">
                        {task.content_description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ========================================== */}
          {/* ACTION HUB (MEMBER TIMER & SUBMISSION OR ADMIN PROGRESS REVIEW) */}
          {/* ========================================== */}

          {/* 4a. MEMBER ASSIGNMENT WORKSPACE */}
          {myAssignment && (
            <div className="flex flex-col gap-4">
              {/* Revision feedback from admin */}
              {myAssignment.feedback && myAssignment.status === 'revision' && (
                <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-955/10 dark:border-l-amber-600">
                  <CardContent className="p-4 flex flex-col gap-1.5 text-start">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                      🔄 {t('taskDetail.revisionFeedbackAdmin') || 'Revision Feedback from Admin'}
                    </span>
                    <p className="text-xs text-amber-900 dark:text-amber-300 whitespace-pre-wrap bg-background/80 border rounded-lg p-2.5 mt-1 leading-relaxed">
                      {myAssignment.feedback}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Timer & Work Submission Card */}
              <Card className="border-indigo-100 dark:border-indigo-900/30 overflow-hidden shadow-xs">
                <div className="bg-indigo-50/30 dark:bg-indigo-955/20 px-5 py-3 border-b flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    ⚡ {t('taskDetail.actionHub') || 'Task Actions & Workspace'}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/60 border rounded-full px-2.5 py-0.5 select-none">
                    Status: {t('status.' + myAssignment.status)}
                  </span>
                </div>
                <CardContent className="p-5 flex flex-col gap-5 text-start">
                  
                  {/* Timer Section (Only shown if task is in progress) */}
                  {myAssignment.status === 'in_progress' && (
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex flex-col text-center sm:text-start">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('taskDetail.totalLoggedTime')}</span>
                        <span className="text-3xl font-black font-mono tracking-tight text-foreground select-all mt-1">
                          {formatDuration(getAssigneeTime(myAssignment))}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {myAssignment.timer_started_at ? (
                          <>
                            <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider select-none animate-pulse shrink-0">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                              {t('taskDetail.timerRunning')}
                            </span>
                            <Button
                              onClick={handleStopTimer}
                              disabled={timerLoading}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 size-9 sm:w-auto sm:px-4 rounded-lg shadow-xs"
                            >
                              ⏸️ <span className="hidden sm:inline">{t('taskDetail.pauseTimer')}</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={handleStartTimer}
                            disabled={timerLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 w-full sm:w-auto sm:px-4 rounded-lg shadow-xs"
                          >
                            ▶️ {t('taskDetail.startTimer')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Todo Status CTA */}
                  {myAssignment.status === 'todo' && (
                    <div className="flex flex-col gap-3 py-1">
                      <p className="text-xs text-muted-foreground leading-normal">
                        {t('taskDetail.todoStartDesc') || 'You are assigned to this task. Click start to begin work and log your time.'}
                      </p>
                      <Button onClick={handleStartTask} disabled={statusUpdating} className="w-fit bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-xs">
                        {statusUpdating ? <Loader2 className="size-4 animate-spin" /> : '⚡'} {t('taskDetail.startWorking')}
                      </Button>
                    </div>
                  )}

                  {/* Revision Status CTA */}
                  {myAssignment.status === 'revision' && (
                    <div className="flex flex-col gap-3 py-1">
                      <p className="text-xs text-muted-foreground leading-normal">
                        {t('taskDetail.revisionResumeDesc') || 'This task requires revisions. Click resume to start logging time again.'}
                      </p>
                      <Button onClick={handleResumeWork} disabled={statusUpdating} className="w-fit bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-xs">
                        <RotateCcw className="size-4" /> {t('taskDetail.resumeWorking')}
                      </Button>
                    </div>
                  )}

                  {/* Submit Form (In Progress) */}
                  {myAssignment.status === 'in_progress' && (
                    <div className="border-t pt-4 flex flex-col gap-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📤 {t('taskDetail.submitWork')}</h4>
                      
                      {myAssignment.submission_link && (
                        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-lg font-semibold w-fit">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          <span>{t('taskDetail.previouslySubmitted')}</span>
                          <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-900 ml-1">
                            {t('taskDetail.viewLink')} ↗
                          </a>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-bold text-foreground/80">{myAssignment.submission_link ? t('taskDetail.updateSubmissionLink') : t('taskDetail.pasteSubmissionLink')}</Label>
                        <Input
                          type="url"
                          placeholder="https://drive.google.com/... or https://notion.so/..."
                          value={submissionLink}
                          onChange={e => setSubmissionLink(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="completion_note" className="text-xs font-bold text-foreground/80">💭 {t('taskDetail.finalThoughtsOptional')}</Label>
                        <Textarea
                          id="completion_note"
                          placeholder={t('taskDetail.completionNotePlaceholder')}
                          value={completionNote}
                          onChange={e => setCompletionNote(e.target.value)}
                          rows={3}
                          className="text-xs"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleSubmitWork} disabled={submittingLink || !submissionLink.trim()} className="text-xs font-bold px-4 h-9">
                          {submittingLink ? <Loader2 className="size-4 animate-spin" /> : myAssignment.submission_link ? t('taskDetail.updateResubmit') : t('taskDetail.submitWork')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Submitted Pending Status */}
                  {myAssignment.status === 'submitted' && (
                    <div className="flex flex-col gap-3 py-1">
                      <p className="text-xs text-violet-800 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-955/10 border border-violet-100 dark:border-violet-900/30 rounded-lg p-3 leading-relaxed">
                        {t('taskDetail.submittedPendingDesc') || 'Your work has been submitted. Admins will review it soon.'}
                      </p>
                      <div className="flex gap-2 flex-wrap items-center">
                        <div className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1">
                          ⏱️ {t('taskDetail.loggedTime')}: {formatDuration(myAssignment.total_time_spent || 0)}
                        </div>
                        {myAssignment.submission_link && (
                          <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline font-semibold flex items-center gap-1">
                            📎 {t('taskDetail.yourSubmission') || 'View Submission Link'} ↗
                          </a>
                        )}
                      </div>
                      {myAssignment.completion_note && (
                        <div className="mt-2 border-t pt-3">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">💭 {t('taskDetail.yourFinalThoughts')}</span>
                          <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border leading-relaxed whitespace-pre-wrap">{myAssignment.completion_note}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed Approved Status */}
                  {myAssignment.status === 'completed' && (
                    <div className="flex flex-col gap-3 py-1">
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-955/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-3 leading-relaxed">
                        ✅ {t('taskDetail.approvedDesc') || 'This task has been approved and completed.'}
                      </p>
                      <div className="flex gap-2 flex-wrap items-center">
                        {myAssignment.rating !== undefined && myAssignment.rating !== null && (
                          <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                            ⭐ {t('taskDetail.rating')}: {myAssignment.rating}/10
                          </div>
                        )}
                        <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1">
                          ⏱️ {t('taskDetail.loggedTime')}: {formatDuration(myAssignment.total_time_spent || 0)}
                        </div>
                      </div>
                      {myAssignment.completion_note && (
                        <div className="mt-2 border-t pt-3">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">💭 {t('taskDetail.finalThoughts')}</span>
                          <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border leading-relaxed whitespace-pre-wrap">{myAssignment.completion_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4b. ADMIN REVIEW SUBMISSIONS PANEL */}
          {assignees.length > 0 && canAdminister && (
            <Card className="overflow-hidden shadow-xs">
              <div className="bg-muted/30 px-5 py-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  📥 {t('taskDetail.submissionsProgress') || 'Assignee Submissions & Reviews'}
                </CardTitle>
              </div>
              <CardContent className="p-5 flex flex-col gap-4 text-start">
                <div className="flex flex-col gap-4 divide-y divide-border/60">
                  {assignees.map((a, index) => {
                    const hasSubmitted = a.submission_link || a.completion_note;
                    const isSubmitting = submittingReview[a.user_id];
                    const isWritingFeedback = activeRevisionUserId === a.user_id;
                    const isApproving = activeApprovalUserId === a.user_id;

                    return (
                      <div key={a.id} className={cn("flex flex-col gap-3", index > 0 && "pt-4")}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                                {a.user ? getInitials(a.user.name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-xs font-bold flex items-center gap-1.5">
                                {a.user?.name}
                                {a.timer_started_at && (
                                  <span className="flex items-center gap-0.5 text-[8px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1 rounded-full animate-pulse select-none">
                                    <span className="size-1 rounded-full bg-emerald-500 shrink-0" />
                                    {t('taskDetail.timerRunning')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 uppercase mt-0.5">
                                <span>{a.user?.role}</span>
                                <span>·</span>
                                <span className="text-indigo-600 dark:text-indigo-400">⏱️ {formatDuration(getAssigneeTime(a))}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={a.status} />
                          </div>
                        </div>

                        {/* Submission details */}
                        {hasSubmitted ? (
                          <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-2.5 ml-10">
                            {a.submission_link && (
                              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="text-muted-foreground font-bold">{t('taskDetail.submissionLinkLabel') || 'Link:'}</span>
                                <a
                                  href={a.submission_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 underline font-medium truncate max-w-[280px] hover:text-indigo-700"
                                >
                                  {a.submission_link} ↗
                                </a>
                              </div>
                            )}
                            {a.completion_note && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{t('taskDetail.notesThoughts') || 'Assignee Notes:'}</span>
                                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{a.completion_note}</p>
                              </div>
                            )}

                            {a.rating !== undefined && a.rating !== null && (
                              <div className="text-[10px] font-extrabold text-green-700 bg-green-50 border border-green-200/50 rounded-full px-2 py-0.5 w-fit flex items-center gap-1">
                                ⭐ {t('taskDetail.rating')}: {a.rating}/10
                              </div>
                            )}
                            
                            {a.feedback && (
                              <div className={cn(
                                "text-xs p-2.5 rounded-lg border mt-1",
                                a.status === 'completed'
                                  ? 'bg-green-50/30 border-green-100 text-green-800'
                                  : 'bg-orange-50/30 border-orange-100 text-orange-800'
                              )}>
                                <span className="font-bold block mb-0.5 text-[10px] uppercase tracking-wide">
                                  {a.status === 'completed' ? t('taskDetail.approvalFeedback') : t('taskDetail.revisionFeedbackLabel')}
                                </span>
                                {a.feedback}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic ml-10">
                            {t('taskDetail.noSubmissionYet')} <span className="font-semibold capitalize text-foreground/80">{t('status.' + a.status)}</span>
                          </div>
                        )}

                        {/* Admin Action Forms */}
                        {a.status === 'submitted' && a.user_id !== user?.id && (
                          <div className="flex gap-2 justify-end ml-10 mt-1">
                            {!isWritingFeedback && !isApproving ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                  onClick={() => {
                                    setActiveRevisionUserId(a.user_id);
                                    setActiveApprovalUserId(null);
                                  }}
                                  disabled={isSubmitting}
                                >
                                  <RotateCcw className="size-3.5" /> {t('taskDetail.requestRevision')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold gap-1"
                                  onClick={() => {
                                    setActiveApprovalUserId(a.user_id);
                                    setActiveRevisionUserId(null);
                                    setApprovalRating(prev => ({ ...prev, [a.user_id]: 10 }));
                                  }}
                                  disabled={isSubmitting}
                                >
                                  <CheckCircle2 className="size-3.5" /> {t('taskDetail.approveWork')}
                                </Button>
                              </>
                            ) : isWritingFeedback ? (
                              <div className="flex flex-col gap-2.5 w-full mt-1 bg-orange-50/30 dark:bg-orange-955/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-3.5 ml-0">
                                <Label htmlFor={`feedback-${a.user_id}`} className="text-xs font-bold text-orange-700">
                                  🔄 {t('taskDetail.revisionInstructions')}
                                </Label>
                                <Textarea
                                  id={`feedback-${a.user_id}`}
                                  placeholder={t('taskDetail.specifyRevision')}
                                  value={revisionFeedback[a.user_id] || ''}
                                  onChange={e => setRevisionFeedback(prev => ({ ...prev, [a.user_id]: e.target.value }))}
                                  rows={2}
                                  className="text-xs"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => {
                                      setActiveRevisionUserId(null);
                                      setRevisionFeedback(prev => ({ ...prev, [a.user_id]: '' }));
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    {t('common.cancel')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-8"
                                    onClick={() => handleRequestRevision(a.user_id)}
                                    disabled={isSubmitting || !(revisionFeedback[a.user_id] || '').trim()}
                                  >
                                    {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : null} {t('taskDetail.submitRequest')}
                                  </Button>
                                </div>
                              </div>
                            ) : isApproving ? (
                              <div className="flex flex-col gap-3.5 w-full mt-1 bg-green-50/30 dark:bg-green-955/10 border border-green-100 dark:border-green-900/30 rounded-xl p-3.5 ml-0">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="flex flex-col gap-1.5">
                                    <Label htmlFor={`rating-${a.user_id}`} className="text-xs font-bold text-green-700">
                                      ⭐ {t('taskDetail.chooseRating')}
                                    </Label>
                                    <select
                                      id={`rating-${a.user_id}`}
                                      className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                      value={approvalRating[a.user_id] || 10}
                                      onChange={e => setApprovalRating(prev => ({ ...prev, [a.user_id]: Number(e.target.value) }))}
                                    >
                                      {[...Array(10)].map((_, i) => (
                                        <option key={10 - i} value={10 - i}>{10 - i} / 10</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                                    <Label htmlFor={`approval-feedback-${a.user_id}`} className="text-xs font-bold text-green-700">
                                      💭 {t('taskDetail.approvalFeedbackLabel') || 'Feedback (Optional)'}
                                    </Label>
                                    <Input
                                      id={`approval-feedback-${a.user_id}`}
                                      placeholder={t('taskDetail.approvalFeedbackPlaceholder')}
                                      value={approvalFeedback[a.user_id] || ''}
                                      onChange={e => setApprovalFeedback(prev => ({ ...prev, [a.user_id]: e.target.value }))}
                                      className="h-9 text-xs"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => {
                                      setActiveApprovalUserId(null);
                                      setApprovalFeedback(prev => ({ ...prev, [a.user_id]: '' }));
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    {t('common.cancel')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-8 gap-1"
                                    onClick={() => handleApprove(a.user_id)}
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle2 className="size-3.5" />} {t('taskDetail.confirmApproval')}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ========================================== */}
          {/* SHARED DISCUSSION (CHAT) */}
          {/* ========================================== */}
          <Card className="shadow-xs">
            <div className="bg-muted/30 px-5 py-3 border-b flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                💬 {t('taskDetail.chatDiscussion', { count: comments.length })}
              </CardTitle>
              <div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-extrabold bg-amber-50 border border-amber-200/50 rounded-full px-2.5 py-0.5 select-none shrink-0">
                <Clock className="size-3" />
                {t('taskDetail.messagesExpire')}
              </div>
            </div>
            <CardContent className="p-5 flex flex-col gap-4 text-start">
              <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-xs italic py-4 text-center">{t('taskDetail.noMessages') || 'No messages in this task yet.'}</p>
                )}
                {comments.map((comment: Comment) => {
                  const isMe = comment.user?.id === user?.id;
                  return (
                    <div key={comment.id} className={cn("flex gap-2.5 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "mr-auto")}>
                      <Avatar className="size-7 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[9px] font-bold">
                          {comment.user ? getInitials(comment.user.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className={cn("flex items-baseline gap-1.5 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                          <span className="font-bold text-foreground/80">{comment.user?.name || t('common.unknown')}</span>
                          <span>{formatDateTime(comment.created_at, locale)}</span>
                          <span className="text-[8px] text-amber-500 font-bold font-mono">({timeUntilExpiry(comment.created_at, t)})</span>
                        </div>
                        <div className={cn(
                          "text-xs px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap shadow-2xs border",
                          isMe
                            ? "bg-indigo-600 text-white border-indigo-700/50 rounded-tr-none"
                            : "bg-muted text-foreground border-border/60 rounded-tl-none"
                        )}>
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-1" />

              <form onSubmit={handlePostComment} className="flex gap-2.5 items-start">
                <Avatar className="size-8 shrink-0 mt-1">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                    {user?.name ? getInitials(user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex flex-col gap-2">
                  <Textarea
                    placeholder={t('taskDetail.addComment')}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (commentText.trim()) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()} className="text-xs font-bold h-8 px-4 gap-1">
                      {submittingComment ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                      {t('taskDetail.sendMessage')}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3 width on desktop): Metadata Sidebar */}
        <div className="flex flex-col gap-6">
          
          {/* Consolidated Task Details & Assignments Card */}
          <Card className="shadow-xs">
            <div className="bg-muted/30 px-4 py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                ⚙️ {t('taskDetail.taskDetails') || 'Task Details'}
              </CardTitle>
            </div>
            <CardContent className="p-4 flex flex-col gap-4 text-start text-xs">
              {/* Due Date */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.dueDate')}</span>
                <span className={cn(
                  "font-semibold flex items-center gap-1.5 text-sm flex-wrap",
                  isOverdue ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-foreground'
                )}>
                  📅 {formatDetailDateTime(task.due_date, t, locale)}
                  {isOverdue && <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-200/50 rounded-full px-1.5 py-0.5 animate-pulse uppercase font-extrabold">OVERDUE</span>}
                </span>
              </div>

              {/* Created Date (Task creation date under due date) */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.created') || 'Created Date'}</span>
                <span className="text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
                  📅 {formatDetailDateTime(task.created_at, t, locale)}
                </span>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.priority')}</span>
                <PriorityBadge priority={task.priority} />
              </div>

              {/* Task Type */}
              {task.content_type && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.contentType') || 'Task Type'}</span>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 uppercase text-[9px] font-bold w-fit">
                    📦 {t('contentType.' + task.content_type.toLowerCase()) || task.content_type}
                  </Badge>
                </div>
              )}

              {/* Creator ("Created By") & Assigned Members */}
              <div className="flex flex-col gap-3.5 border-t pt-3.5">
                {/* Created By */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('taskDetail.createdBy') || 'Created By'}</span>
                  {task.creator && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[8px] font-black">
                          {getInitials(task.creator.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-xs text-foreground/80">{task.creator.name}</span>
                    </div>
                  )}
                </div>

                {/* Assigned Members (Under "created by") */}
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    👥 {t('taskDetail.assignedToCount', { count: totalAssignees }) || 'Assigned Members'}
                  </span>
                  {assignees.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {assignees.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="size-6 shrink-0">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[8px] font-bold">
                                {a.user ? getInitials(a.user.name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate text-foreground/90">{a.user?.name}</span>
                              {a.total_time_spent > 0 || a.timer_started_at ? (
                                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 mt-0.5">
                                  ⏱️ {formatDuration(getAssigneeTime(a))}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="shrink-0 scale-90 origin-right">
                            <StatusBadge status={a.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic py-1 block">{t('common.unassigned')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attached Files List */}

        </div>
      </div>
    </div>
  );
}

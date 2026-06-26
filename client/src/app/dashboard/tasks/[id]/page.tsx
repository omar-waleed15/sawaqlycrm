'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, commentsApi } from '@/lib/api';
import { Task, TaskAssignee, Comment, User } from '@/types';
import { formatCairoDate, formatCairoDateTime, isDateOverdue } from '@/lib/dateUtils';
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
import { ArrowLeft, Pencil, Trash2, Loader2, Send, CheckCircle2, RotateCcw, Clock } from 'lucide-react';

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Button>
        <div className="flex-1" />
        {canAdminister && (
          <>
            {user?.role !== 'moderation' && (
              <Button variant="outline" size="sm" onClick={() => handleToggleArchive(!task.is_archived)} disabled={statusUpdating}>
                🗄️ {task.is_archived ? t('taskDetail.unarchiveTask') : t('taskDetail.archiveTask')}
              </Button>
            )}
            <Link href={`/dashboard/tasks/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> {t('common.edit')}
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="size-4" /> {t('common.delete')}
            </Button>
          </>
        )}
      </div>

      <div className="task-detail-layout">
        {/* Main Content */}
        <div className="task-detail-main flex flex-col gap-4">
          {task.is_archived && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm font-semibold flex items-center gap-2">
              🗄️ {t('taskDetail.archivedBadge')}
            </div>
          )}
          {/* Title & Badges */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-4">
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={task.priority} />
                {task.is_archived && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">🗄️ {t('taskDetail.archivedBadge')}</Badge>
                )}

                {isOverdue && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">⚠ {t('common.overdue')}</Badge>
                )}
                {totalAssignees > 0 && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    👥 {t('taskDetail.completedCount', { completedCount, totalAssignees })}
                  </Badge>
                )}
                {submittedCount > 0 && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                    📤 {t('taskDetail.submittedCount', { submittedCount })}
                  </Badge>
                )}
              </div>
              {(task.drive_link || task.content_description) && (
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" size="sm" className="shrink-0 gap-1.5 font-medium text-xs">
                        🎥 {t('taskDetail.contentDetails')}
                      </Button>
                    }
                  />
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                        🎥 {t('taskDetail.contentDetailsAssets')}
                      </DialogTitle>
                      <DialogDescription>
                        {t('taskDetail.guidelinesAttached')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                      {task.drive_link && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-semibold text-muted-foreground font-medium">{t('taskDetail.googleDriveAttachments')}</span>
                          <a href={task.drive_link} target="_blank" rel="noopener noreferrer">
                            <Button className="w-full justify-center gap-1.5">
                              📁 {t('taskDetail.openDrive')} ↗
                            </Button>
                          </a>
                        </div>
                      )}
                      {task.content_description && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-semibold text-muted-foreground font-medium">{t('taskDetail.contentGuidelines')}</span>
                          <p className="text-sm text-foreground whitespace-pre-wrap bg-muted px-3 py-2.5 rounded-md border border-border leading-relaxed">
                            {task.content_description}
                          </p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <h1 className="text-2xl font-extrabold tracking-tight mb-3">{task.title}</h1>
              {task.description ? (
                <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-muted-foreground italic text-sm">{t('taskDetail.noDescription')}</p>
              )}
            </CardContent>
          </Card>

          {/* ============================================================ */}
          {/* MEMBER VIEW: Own Assignment Panel */}
          {/* ============================================================ */}
          {myAssignment && (
            <>
              {/* Feedback from admin */}
              {myAssignment.feedback && myAssignment.status === 'revision' && (
                <Card className="border-l-4 border-l-orange-500 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700">🔄 {t('taskDetail.revisionFeedbackAdmin')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-orange-900 whitespace-pre-wrap">{myAssignment.feedback}</p>
                  </CardContent>
                </Card>
              )}

              {/* Task Timer Card */}
              {myAssignment.status === 'in_progress' && (
                <Card className="border border-indigo-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-indigo-50/10">
                  {myAssignment.timer_started_at && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 animate-pulse" />
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">⏱️ {t('taskDetail.timer')}</span>
                      {myAssignment.timer_started_at ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider select-none animate-pulse">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          {t('taskDetail.timerRunning')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
                          {t('taskDetail.timerPaused')}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">{t('taskDetail.totalLoggedTime')}</span>
                        <span className="text-3xl font-bold font-mono tracking-tight text-foreground mt-0.5 select-all">
                          {formatDuration(getAssigneeTime(myAssignment))}
                        </span>
                      </div>
                      
                      {myAssignment.timer_started_at ? (
                        <Button 
                          onClick={handleStopTimer} 
                          disabled={timerLoading}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 gap-1.5 shadow-sm transition-all"
                        >
                          {timerLoading ? <Loader2 className="size-4 animate-spin" /> : <span>⏸️</span>}
                          {t('taskDetail.pauseTimer')}
                        </Button>
                      ) : (
                        <Button 
                          onClick={handleStartTimer} 
                          disabled={timerLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 gap-1.5 shadow-sm transition-all"
                        >
                          {timerLoading ? <Loader2 className="size-4 animate-spin" /> : <span>▶️</span>}
                          {t('taskDetail.startTimer')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'todo' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ {t('taskDetail.resumeWorking')}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('taskDetail.todoStartDesc')}
                    </p>
                    <Button onClick={handleStartTask} disabled={statusUpdating}>
                      {statusUpdating ? <Loader2 className="size-4 animate-spin" /> : '⚡'} {t('taskDetail.startWorking')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'revision' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ {t('taskDetail.resumeWorking')}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('taskDetail.revisionResumeDesc')}
                    </p>
                    <Button onClick={handleResumeWork} disabled={statusUpdating}>
                      <RotateCcw className="size-4" /> {t('taskDetail.resumeWorking')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'in_progress' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📤 {t('taskDetail.submitWork')}</CardTitle></CardHeader>
                  <CardContent>
                    {myAssignment.submission_link && (
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="size-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">{t('taskDetail.previouslySubmitted')}</span>
                        <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">{t('taskDetail.viewLink')} ↗</a>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label>{myAssignment.submission_link ? t('taskDetail.updateSubmissionLink') : t('taskDetail.pasteSubmissionLink')}</Label>
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/... or https://notion.so/..."
                        value={submissionLink}
                        onChange={e => setSubmissionLink(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-3">
                      <Label htmlFor="completion_note">💭 {t('taskDetail.finalThoughtsOptional')}</Label>
                      <Textarea
                        id="completion_note"
                        placeholder={t('taskDetail.completionNotePlaceholder')}
                        value={completionNote}
                        onChange={e => setCompletionNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button onClick={handleSubmitWork} disabled={submittingLink || !submissionLink.trim()}>
                        {submittingLink ? <Loader2 className="size-4 animate-spin" /> : myAssignment.submission_link ? t('taskDetail.updateResubmit') : t('taskDetail.submitWork')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'submitted' && (
                <Card className="border-l-4 border-l-violet-500 bg-violet-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-violet-700">📤 {t('taskDetail.submittedPending')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-violet-800 mb-2">
                      {t('taskDetail.submittedPendingDesc')}
                    </p>
                    <div className="text-xs font-bold text-violet-700 bg-white/60 border border-violet-200 rounded px-2.5 py-1 w-fit mb-3 flex items-center gap-1.5">
                      ⏱️ {t('taskDetail.loggedTime')}: {formatDuration(myAssignment.total_time_spent || 0)}
                    </div>
                    {myAssignment.submission_link && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">{t('taskDetail.yourSubmission')}</span>
                        <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{myAssignment.submission_link} ↗</a>
                      </div>
                    )}
                    {myAssignment.completion_note && (
                      <div className="mt-3 border-t border-violet-200 pt-3">
                        <span className="text-sm font-semibold text-violet-700 block mb-1">💭 {t('taskDetail.yourFinalThoughts')}</span>
                        <p className="text-sm text-violet-900 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{myAssignment.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'completed' && (
                <Card className="border-l-4 border-l-green-500 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-700">✅ {t('taskDetail.completedApproved')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-800">{t('taskDetail.approvedDesc')}</p>
                    <div className="flex gap-2 flex-wrap items-center mt-2 mb-1">
                      {myAssignment.rating !== undefined && myAssignment.rating !== null && (
                        <div className="text-xs font-bold text-green-700 bg-white/60 border border-green-200 rounded px-2.5 py-1 w-fit flex items-center gap-1">
                          ⭐ {t('taskDetail.rating')}: {myAssignment.rating}/10
                        </div>
                      )}
                      <div className="text-xs font-bold text-green-700 bg-white/60 border border-green-200 rounded px-2.5 py-1 w-fit flex items-center gap-1.5">
                        ⏱️ {t('taskDetail.loggedTime')}: {formatDuration(myAssignment.total_time_spent || 0)}
                      </div>
                    </div>
                    {myAssignment.completion_note && (
                      <div className="mt-3 border-t border-green-200 pt-3">
                        <span className="text-sm font-semibold text-green-700 block mb-1">💭 {t('taskDetail.finalThoughts')}</span>
                        <p className="text-sm text-green-955 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{myAssignment.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Submissions & Reviews Card (Shown for everyone if task has assignees) */}
          {assignees.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📥 {t('taskDetail.submissionsProgress')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 divide-y divide-border">
                  {assignees.map((a, index) => {
                    const hasSubmitted = a.submission_link || a.completion_note;
                    const isSubmitting = submittingReview[a.user_id];
                    const isWritingFeedback = activeRevisionUserId === a.user_id;

                    return (
                      <div key={a.id} className={`flex flex-col gap-3 ${index > 0 ? 'pt-4' : ''}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                                {a.user ? getInitials(a.user.name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                {a.user?.name}
                                {a.timer_started_at && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full select-none animate-pulse">
                                    <span className="size-1 rounded-full bg-emerald-500 shrink-0" />
                                    {t('taskDetail.timerRunning')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                                <span className="uppercase">{a.user?.role}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                  ⏱️ {formatDuration(getAssigneeTime(a))}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={a.status} />
                          </div>
                        </div>

                        {/* Submission details */}
                        {hasSubmitted ? (
                          <div className="bg-muted/50 rounded-lg p-3 border border-border flex flex-col gap-2.5 ml-10">
                            {a.submission_link && (
                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                <span className="text-muted-foreground font-semibold font-medium">{t('taskDetail.submissionLinkLabel')}</span>
                                <a
                                  href={a.submission_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 underline font-medium truncate max-w-[300px] hover:text-indigo-700"
                                >
                                  {a.submission_link} ↗
                                </a>
                              </div>
                            )}
                            {a.completion_note && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground font-medium">{t('taskDetail.notesThoughts')}</span>
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{a.completion_note}</p>
                              </div>
                            )}

                            {a.rating !== undefined && a.rating !== null && (
                              <div className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2.5 py-1 w-fit mt-1 flex items-center gap-1">
                                ⭐ {t('taskDetail.rating')}: {a.rating}/10
                              </div>
                            )}
                            
                            {/* Feedback if exists */}
                            {a.feedback && (
                              <div className={`text-xs p-2.5 rounded border mt-1 ${
                                a.status === 'completed' 
                                  ? 'bg-green-50/50 border-green-100 text-green-800 dark:bg-green-950/20' 
                                  : 'bg-orange-50/50 border-orange-100 text-orange-800 dark:bg-orange-950/20'
                              }`}>
                                <span className="font-bold block mb-0.5">
                                  {a.status === 'completed' ? t('taskDetail.approvalFeedback') : t('taskDetail.revisionFeedbackLabel')}
                                </span>
                                {a.feedback}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic ml-10">
                            {t('taskDetail.noSubmissionYet')} <span className="font-semibold capitalize">{t('status.' + a.status)}</span>
                          </div>
                        )}

                        {/* Admin Action Buttons */}
                        {canAdminister && a.status === 'submitted' && a.user_id !== user?.id && (
                          <div className="flex gap-2 justify-end ml-10 mt-1">
                            {!isWritingFeedback && !activeApprovalUserId ? (
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
                                  className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
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
                              <div className="flex flex-col gap-2 w-full mt-2">
                                <Label htmlFor={`feedback-${a.user_id}`} className="text-xs font-bold text-orange-700">
                                  {t('taskDetail.revisionInstructions')}
                                </Label>
                                <Textarea
                                  id={`feedback-${a.user_id}`}
                                  placeholder={t('taskDetail.specifyRevision')}
                                  value={revisionFeedback[a.user_id] || ''}
                                  onChange={e => setRevisionFeedback(prev => ({ ...prev, [a.user_id]: e.target.value }))}
                                  rows={2}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
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
                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                                    onClick={() => handleRequestRevision(a.user_id)}
                                    disabled={isSubmitting || !(revisionFeedback[a.user_id] || '').trim()}
                                  >
                                    {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : null} {t('taskDetail.submitRequest')}
                                  </Button>
                                </div>
                              </div>
                            ) : activeApprovalUserId === a.user_id ? (
                              <div className="flex flex-col gap-2 w-full mt-2">
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex flex-col gap-1">
                                    <Label htmlFor={`rating-${a.user_id}`} className="text-xs font-bold text-green-700">
                                      {t('taskDetail.chooseRating')}
                                    </Label>
                                    <select
                                      id={`rating-${a.user_id}`}
                                      className="h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                      value={approvalRating[a.user_id] || 10}
                                      onChange={e => setApprovalRating(prev => ({ ...prev, [a.user_id]: Number(e.target.value) }))}
                                    >
                                      {[...Array(10)].map((_, i) => (
                                        <option key={10 - i} value={10 - i}>{10 - i}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
                                    <Label htmlFor={`approval-feedback-${a.user_id}`} className="text-xs font-bold text-green-700">
                                      {t('taskDetail.approvalFeedbackLabel')}
                                    </Label>
                                    <Input
                                      id={`approval-feedback-${a.user_id}`}
                                      placeholder={t('taskDetail.approvalFeedbackPlaceholder')}
                                      value={approvalFeedback[a.user_id] || ''}
                                      onChange={e => setApprovalFeedback(prev => ({ ...prev, [a.user_id]: e.target.value }))}
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end mt-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
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
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                                    onClick={() => handleApprove(a.user_id)}
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} {t('taskDetail.confirmApproval')}
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

          {/* ============================================================ */}
          {/* SHARED CHAT */}
          {/* ============================================================ */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('taskDetail.chatDiscussion', { count: comments.length })}</CardTitle>
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  <Clock className="size-3" />
                  {t('taskDetail.messagesExpire')}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-sm">{t('taskDetail.noMessages')}</p>
                )}
                {comments.map((comment: Comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                        {comment.user ? getInitials(comment.user.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold">{comment.user?.name || t('common.unknown')}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.created_at, locale)}</span>
                        <span className="text-[9px] text-amber-500 font-medium ml-auto">{timeUntilExpiry(comment.created_at, t)}</span>
                      </div>
                      <div className="text-sm bg-muted rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{comment.content}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <form onSubmit={handlePostComment} className="flex gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                    {user?.name ? getInitials(user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex flex-col gap-2">
                  <Textarea
                    placeholder={t('taskDetail.addComment')}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()}>
                      {submittingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {t('taskDetail.sendMessage')}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="task-detail-sidebar">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('taskDetail.taskDetails')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('taskDetail.priority')}</span>
                <PriorityBadge priority={task.priority} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('taskDetail.dueDate')}</span>
                <span className={`text-sm font-medium ${isOverdue ? 'text-rose-600' : 'text-foreground'}`}>
                  {formatDetailDateTime(task.due_date, t, locale)}
                </span>
              </div>
              {task.content_type && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('taskDetail.contentType')}</span>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 uppercase text-[10px] tracking-wide font-medium w-fit">
                    📦 {t('contentType.' + task.content_type.toLowerCase()) || task.content_type}
                  </Badge>
                </div>
              )}

              <Separator />

              {/* Assignees list */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('taskDetail.assignedToCount', { count: totalAssignees })}
                </span>
                {assignees.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {assignees.map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                            {a.user ? getInitials(a.user.name) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{a.user?.name}</div>
                          {a.total_time_spent > 0 || a.timer_started_at ? (
                            <div className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
                              ⏱️ {formatDuration(getAssigneeTime(a))}
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('common.unassigned')}</span>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('taskDetail.createdBy')}</span>
                {task.creator && (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                        {getInitials(task.creator.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{task.creator.name}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('taskDetail.created')}</span>
                <span className="text-sm text-muted-foreground">{formatDetailDateTime(task.created_at, t, locale)}</span>
              </div>

              {/* Attachments */}
              {task.attachments && task.attachments.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      📎 {t('taskDetail.attachments')} ({task.attachments.length})
                    </span>
                    <div className="flex flex-col gap-2">
                      {task.attachments.map(att => (
                        <a
                          key={att.id}
                          href={att.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2 hover:bg-muted/80 transition-colors group"
                        >
                          {att.mimetype?.startsWith('image/') ? (
                            <div className="size-10 rounded-md overflow-hidden bg-muted border border-border shrink-0">
                              <img
                                src={att.public_url}
                                alt={att.filename}
                                className="size-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="size-10 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                              <span className="text-base">📄</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate group-hover:text-indigo-600 transition-colors">{att.filename}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {att.size < 1024 ? att.size + ' B' : att.size < 1024 * 1024 ? (att.size / 1024).toFixed(1) + ' KB' : (att.size / (1024 * 1024)).toFixed(1) + ' MB'}
                            </div>
                          </div>
                          <span className="text-[10px] text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">{t('taskDetail.openFile')} ↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

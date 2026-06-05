'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { tasksApi, commentsApi } from '@/lib/api';
import { Task, Comment } from '@/types';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Pencil, Trash2, Loader2, Send, CheckCircle2, RotateCcw } from 'lucide-react';

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submissionLink, setSubmissionLink] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [updatingProgressNote, setUpdatingProgressNote] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader';

  const loadTask = async () => {
    try {
      const [taskData, commentsData] = await Promise.all([
        tasksApi.get(id),
        commentsApi.list(id),
      ]);
      setTask(taskData.task);
      setSubmissionLink(taskData.task.submission_link || '');
      setProgressNote(taskData.task.progress_note || '');
      setFeedbackText(taskData.task.feedback || '');
      setCompletionNote(taskData.task.completion_note || '');
      setComments(commentsData.comments);
    } catch {
      router.replace('/dashboard/tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTask(); }, [id]);

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

  const handleSubmitLink = async () => {
    if (!submissionLink.trim()) return;
    setSubmittingLink(true);
    try {
      const data = await tasksApi.update(id, {
        submission_link: submissionLink,
        status: 'submitted',
        completion_note: completionNote || undefined,
      });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setSubmittingLink(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: newStatus as Task['status'] });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  const handleUpdateProgressNote = async () => {
    setUpdatingProgressNote(true);
    try {
      const data = await tasksApi.update(id, { progress_note: progressNote });
      setTask(data.task);
      alert('Progress update saved successfully.');
    } catch (err) { console.error(err); }
    finally { setUpdatingProgressNote(false); }
  };

  const handleRequestRevision = async () => {
    if (!feedbackText.trim()) return;
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: 'revision', feedback: feedbackText.trim() });
      setTask(data.task);
      setShowRevisionForm(false);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  const handleApproveComplete = async () => {
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: 'completed' });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  const handleResumeWork = async () => {
    setStatusUpdating(true);
    try {
      const data = await tasksApi.update(id, { status: 'in_progress' });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setStatusUpdating(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await tasksApi.delete(id);
      router.push('/dashboard/tasks');
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  if (!task) return null;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex-1" />
        {isOwner && (
          <>
            <Link href={`/dashboard/tasks/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </>
        )}
      </div>

      <div className="task-detail-layout">
        {/* Main Content */}
        <div className="task-detail-main flex flex-col gap-4">
          {/* Title & Badges */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                {isOverdue && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">⚠ Overdue</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <h1 className="text-2xl font-extrabold tracking-tight mb-3">{task.title}</h1>
              {task.description ? (
                <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-muted-foreground italic text-sm">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {/* Content Assets */}
          {(task.content_type || task.drive_link || task.content_description) && (
            <Card className="border-l-4 border-l-indigo-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm text-indigo-700">🎥 Content Details &amp; Assets</CardTitle>
                  {task.content_type && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 uppercase text-[10px] tracking-wide">
                      📦 {task.content_type}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {task.drive_link && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-muted-foreground">Google Drive Attachments:</span>
                    <a href={task.drive_link} target="_blank" rel="noopener noreferrer">
                      <Button size="sm">📁 Open Google Drive ↗</Button>
                    </a>
                  </div>
                )}
                {task.content_description && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground block mb-1">Content Guidelines:</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted px-3 py-2.5 rounded-md border border-border">
                      {task.content_description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Member: Feedback Panel */}
          {!isOwner && task.feedback && (
            <Card className="border-l-4 border-l-orange-500 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-700">🔄 Revision Feedback from Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-900 whitespace-pre-wrap">{task.feedback}</p>
              </CardContent>
            </Card>
          )}

          {/* Member: Actions by Status */}
          {!isOwner && (
            <>
              {task.status === 'todo' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ Start Working</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This task is in your <strong>To Do</strong> list. Click below to update it to <strong>In Progress</strong>.
                    </p>
                    <Button onClick={() => handleStatusChange('in_progress')} disabled={statusUpdating}>
                      {statusUpdating ? <Loader2 className="size-4 animate-spin" /> : '⚡'} Start Task
                    </Button>
                  </CardContent>
                </Card>
              )}

              {task.status === 'revision' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ Resume Working</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This task requires revision. Click below to set status back to <strong>In Progress</strong>.
                    </p>
                    <Button onClick={handleResumeWork} disabled={statusUpdating}>
                      <RotateCcw className="size-4" /> Resume Work
                    </Button>
                  </CardContent>
                </Card>
              )}

              {task.status === 'in_progress' && (
                <>
                  {/* Submission */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">📤 Submit Your Work</CardTitle></CardHeader>
                    <CardContent>
                      {task.submission_link && (
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="size-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-700">Work submitted</span>
                          <a href={task.submission_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">View link ↗</a>
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <Label>{task.submission_link ? 'Update submission link' : 'Paste your submission link'}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="url"
                            className="flex-1"
                            placeholder="https://drive.google.com/... or https://notion.so/..."
                            value={submissionLink}
                            onChange={e => setSubmissionLink(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-3">
                        <Label htmlFor="completion_note">💭 Final Thoughts (optional)</Label>
                        <Textarea
                          id="completion_note"
                          placeholder="Share your final thoughts, notes, or anything the admin should know about this task..."
                          value={completionNote}
                          onChange={e => setCompletionNote(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button onClick={handleSubmitLink} disabled={submittingLink || !submissionLink.trim()}>
                          {submittingLink ? <Loader2 className="size-4 animate-spin" /> : task.submission_link ? 'Update & Resubmit' : 'Submit Work'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {task.status === 'submitted' && (
                <Card className="border-l-4 border-l-violet-500 bg-violet-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-violet-700">📤 Submitted &amp; Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-violet-800 mb-2">
                      You have submitted your work. The admin will review it and either approve or request changes.
                    </p>
                    {task.submission_link && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">Submission link:</span>
                        <a href={task.submission_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{task.submission_link} ↗</a>
                      </div>
                    )}
                    {task.completion_note && (
                      <div className="mt-3 border-t border-violet-200 pt-3">
                        <span className="text-sm font-semibold text-violet-700 block mb-1">💭 Your Final Thoughts:</span>
                        <p className="text-sm text-violet-900 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{task.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {task.status === 'completed' && (
                <Card className="border-l-4 border-l-green-500 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-700">✅ Completed &amp; Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-800">
                      This task has been fully completed and approved. No further action is required.
                    </p>
                    {task.completion_note && (
                      <div className="mt-3 border-t border-green-200 pt-3">
                        <span className="text-sm font-semibold text-green-700 block mb-1">💭 Final Thoughts:</span>
                        <p className="text-sm text-green-900 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{task.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Admin: Progress Note */}
          {isOwner && task.progress_note && (
            <Card className="border-l-4 border-l-blue-500 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700">⚡ Latest Member Progress Update</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-900 italic">&ldquo;{task.progress_note}&rdquo;</p>
              </CardContent>
            </Card>
          )}

          {/* Admin: Member Completion Note */}
          {isOwner && task.completion_note && (
            <Card className="border-l-4 border-l-emerald-500 bg-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-700">💭 Member&apos;s Final Thoughts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-emerald-900 whitespace-pre-wrap italic">&ldquo;{task.completion_note}&rdquo;</p>
              </CardContent>
            </Card>
          )}

          {/* Admin: Review Submission */}
          {isOwner && task.status === 'submitted' && (
            <Card className="border border-violet-200 bg-violet-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-violet-700">📤 Review Task Submission</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  The team member has submitted:{' '}
                  <a href={task.submission_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">
                    {task.submission_link} ↗
                  </a>
                </p>

                {!showRevisionForm ? (
                  <div className="flex gap-3">
                    <Button onClick={handleApproveComplete} disabled={statusUpdating}>
                      <CheckCircle2 className="size-4" /> Approve &amp; Complete
                    </Button>
                    <Button variant="outline" onClick={() => setShowRevisionForm(true)} disabled={statusUpdating}>
                      <RotateCcw className="size-4" /> Request Revision
                    </Button>
                  </div>
                ) : (
                  <div className="border-t border-violet-200 pt-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Revision Notes &amp; Opinion</Label>
                      <Textarea
                        placeholder="Provide detailed feedback on what needs to be changed..."
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowRevisionForm(false)} disabled={statusUpdating}>Cancel</Button>
                      <Button variant="destructive" size="sm" onClick={handleRequestRevision} disabled={statusUpdating || !feedbackText.trim()}>
                        Send Feedback
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Admin: View Submission Link */}
          {isOwner && task.submission_link && task.status !== 'submitted' && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">📤 Submitted Work Link</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Submitted link:</span>
                  <a href={task.submission_link} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Open Submission ↗</Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin: Status Control */}
          {isOwner && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">⚙ Task Status Control</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2 flex-wrap">
                  {(['todo', 'in_progress', 'revision', 'completed'] as const).map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={task.status === s ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusUpdating || task.status === s}
                    >
                      {s === 'todo' ? '📝 To Do' : s === 'in_progress' ? '⚡ In Progress' : s === 'revision' ? '🔄 Needs Revision' : '✅ Completed'}
                    </Button>
                  ))}
                </div>

                {task.status === 'revision' && (
                  <div className="border-t border-border pt-4 flex flex-col gap-2">
                    <Label>Active Revision Feedback</Label>
                    <Textarea
                      placeholder="Update feedback notes..."
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={async () => {
                        setStatusUpdating(true);
                        try { await tasksApi.update(id, { feedback: feedbackText }); alert('Feedback updated.'); }
                        catch(e) { console.error(e); }
                        finally { setStatusUpdating(false); }
                      }} disabled={statusUpdating}>
                        Save Feedback Notes
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">💬 Chat &amp; Discussion ({comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
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
                        <span className="text-xs font-semibold">{comment.user?.name || 'Unknown'}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                      </div>
                      <div className="text-sm bg-muted rounded-lg px-3 py-2 leading-relaxed">{comment.content}</div>
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
                    placeholder="Write a message..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()}>
                      {submittingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Send Message
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
            <CardHeader className="pb-2"><CardTitle className="text-sm">Task Details</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</span>
                <PriorityBadge priority={task.priority} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</span>
                <span className={`text-sm font-medium ${isOverdue ? 'text-rose-600' : 'text-foreground'}`}>
                  {formatDate(task.due_date)}
                </span>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To</span>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                        {getInitials(task.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-xs font-semibold">{task.assignee.name}</div>
                      <div className="text-[11px] text-muted-foreground">{task.assignee.email}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created By</span>
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
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</span>
                <span className="text-sm text-muted-foreground">{formatDate(task.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

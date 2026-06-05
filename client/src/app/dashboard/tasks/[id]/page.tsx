'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { tasksApi, commentsApi, usersApi } from '@/lib/api';
import { Task, TaskAssignee, Comment, User } from '@/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Pencil, Trash2, Loader2, Send, CheckCircle2, RotateCcw, UserPlus, X, Clock } from 'lucide-react';

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

function timeUntilExpiry(createdAt: string): string {
  const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) return 'expiring...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

const STATUS_LABELS: Record<string, string> = {
  todo: '📝 To Do',
  in_progress: '⚡ In Progress',
  submitted: '📤 Submitted',
  revision: '🔄 Needs Revision',
  completed: '✅ Completed',
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
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

  // Admin: add assignee
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState('');

  // Admin: per-assignee actions
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<Record<string, string>>({});
  const [showRevisionFor, setShowRevisionFor] = useState<string | null>(null);

  const [statusUpdating, setStatusUpdating] = useState(false);

  const isOwner = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';

  // Find the current user's assignment (for members)
  const myAssignment = task?.task_assignees?.find(a => a.user_id === user?.id);

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

      // Initialize revision feedback map
      const fbMap: Record<string, string> = {};
      taskData.task.task_assignees?.forEach(a => {
        fbMap[a.user_id] = a.feedback || '';
      });
      setRevisionFeedback(fbMap);
    } catch {
      router.replace('/dashboard/tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
    if (isOwner) {
      usersApi.list().then(data => setAllUsers(data.users)).catch(console.error);
    }
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

  // Admin: approve a specific assignee
  const handleApproveAssignee = async (userId: string) => {
    setUpdatingAssigneeId(userId);
    try {
      const data = await tasksApi.updateAssignee(id, userId, { status: 'completed' });
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setUpdatingAssigneeId(null); }
  };

  // Admin: request revision for a specific assignee
  const handleRequestRevision = async (userId: string) => {
    const fb = revisionFeedback[userId]?.trim();
    if (!fb) return;
    setUpdatingAssigneeId(userId);
    try {
      const data = await tasksApi.updateAssignee(id, userId, { status: 'revision', feedback: fb });
      setTask(data.task);
      setShowRevisionFor(null);
    } catch (err) { console.error(err); }
    finally { setUpdatingAssigneeId(null); }
  };

  // Admin: add assignee
  const handleAddAssignee = async () => {
    if (!newAssigneeId) return;
    setAddingAssignee(true);
    try {
      const data = await tasksApi.addAssignee(id, newAssigneeId);
      setTask(data.task);
      setNewAssigneeId('');
      setShowAddAssignee(false);
    } catch (err) { console.error(err); }
    finally { setAddingAssignee(false); }
  };

  // Admin: remove assignee
  const handleRemoveAssignee = async (userId: string) => {
    if (!confirm('Remove this member from the task?')) return;
    setUpdatingAssigneeId(userId);
    try {
      const data = await tasksApi.removeAssignee(id, userId);
      setTask(data.task);
    } catch (err) { console.error(err); }
    finally { setUpdatingAssigneeId(null); }
  };

  // Admin: delete task
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

  const assignees = task.task_assignees || [];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && assignees.some(a => a.status !== 'completed');
  const assignedUserIds = assignees.map(a => a.user_id);
  const unassignedUsers = allUsers.filter(u => !assignedUserIds.includes(u.id));

  // Compute summary
  const totalAssignees = assignees.length;
  const completedCount = assignees.filter(a => a.status === 'completed').length;
  const submittedCount = assignees.filter(a => a.status === 'submitted').length;

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
                {isOverdue && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">⚠ Overdue</Badge>
                )}
                {totalAssignees > 0 && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    👥 {completedCount}/{totalAssignees} completed
                  </Badge>
                )}
                {submittedCount > 0 && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                    📤 {submittedCount} submitted
                  </Badge>
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

          {/* ============================================================ */}
          {/* MEMBER VIEW: Own Assignment Panel */}
          {/* ============================================================ */}
          {!isOwner && myAssignment && (
            <>
              {/* Feedback from admin */}
              {myAssignment.feedback && myAssignment.status === 'revision' && (
                <Card className="border-l-4 border-l-orange-500 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700">🔄 Revision Feedback from Admin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-orange-900 whitespace-pre-wrap">{myAssignment.feedback}</p>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'todo' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ Start Working</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This task is in your <strong>To Do</strong> list. Click below to start working.
                    </p>
                    <Button onClick={handleStartTask} disabled={statusUpdating}>
                      {statusUpdating ? <Loader2 className="size-4 animate-spin" /> : '⚡'} Start Task
                    </Button>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'revision' && (
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

              {myAssignment.status === 'in_progress' && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📤 Submit Your Work</CardTitle></CardHeader>
                  <CardContent>
                    {myAssignment.submission_link && (
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="size-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">Previously submitted</span>
                        <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">View link ↗</a>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label>{myAssignment.submission_link ? 'Update submission link' : 'Paste your submission link'}</Label>
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/... or https://notion.so/..."
                        value={submissionLink}
                        onChange={e => setSubmissionLink(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-3">
                      <Label htmlFor="completion_note">💭 Final Thoughts (optional)</Label>
                      <Textarea
                        id="completion_note"
                        placeholder="Share your final thoughts, notes, or anything the admin should know..."
                        value={completionNote}
                        onChange={e => setCompletionNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button onClick={handleSubmitWork} disabled={submittingLink || !submissionLink.trim()}>
                        {submittingLink ? <Loader2 className="size-4 animate-spin" /> : myAssignment.submission_link ? 'Update & Resubmit' : 'Submit Work'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'submitted' && (
                <Card className="border-l-4 border-l-violet-500 bg-violet-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-violet-700">📤 Submitted &amp; Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-violet-800 mb-2">
                      You have submitted your work. The admin will review it.
                    </p>
                    {myAssignment.submission_link && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">Your submission:</span>
                        <a href={myAssignment.submission_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{myAssignment.submission_link} ↗</a>
                      </div>
                    )}
                    {myAssignment.completion_note && (
                      <div className="mt-3 border-t border-violet-200 pt-3">
                        <span className="text-sm font-semibold text-violet-700 block mb-1">💭 Your Final Thoughts:</span>
                        <p className="text-sm text-violet-900 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{myAssignment.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {myAssignment.status === 'completed' && (
                <Card className="border-l-4 border-l-green-500 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-700">✅ Completed &amp; Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-800">Your submission has been approved.</p>
                    {myAssignment.completion_note && (
                      <div className="mt-3 border-t border-green-200 pt-3">
                        <span className="text-sm font-semibold text-green-700 block mb-1">💭 Final Thoughts:</span>
                        <p className="text-sm text-green-900 whitespace-pre-wrap bg-white/60 px-3 py-2 rounded-md">{myAssignment.completion_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* ADMIN VIEW: Per-Assignee Submission Panels */}
          {/* ============================================================ */}
          {isOwner && assignees.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">👥 Assignee Submissions ({completedCount}/{totalAssignees} completed)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {assignees.map((assignee) => {
                  const aUser = assignee.user;
                  const isUpdating = updatingAssigneeId === assignee.user_id;

                  return (
                    <div key={assignee.id} className="border rounded-lg p-4 bg-card relative">
                      {/* Header: avatar + name + status + remove button */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                              {aUser ? getInitials(aUser.name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-semibold">{aUser?.name || 'Unknown'}</div>
                            <div className="text-[11px] text-muted-foreground">{aUser?.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={assignee.status} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveAssignee(assignee.user_id)}
                            disabled={isUpdating}
                            title="Remove assignee"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Submission link */}
                      {assignee.submission_link && (
                        <div className="flex items-center gap-2 mb-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                          <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                          <span className="text-xs font-semibold text-green-700">Submitted:</span>
                          <a href={assignee.submission_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline truncate">
                            {assignee.submission_link} ↗
                          </a>
                        </div>
                      )}

                      {/* Completion note */}
                      {assignee.completion_note && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-2">
                          <span className="text-xs font-semibold text-emerald-700 block mb-0.5">💭 Final Thoughts:</span>
                          <p className="text-xs text-emerald-900 whitespace-pre-wrap italic">&ldquo;{assignee.completion_note}&rdquo;</p>
                        </div>
                      )}

                      {/* Feedback shown if in revision */}
                      {assignee.feedback && assignee.status === 'revision' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2 mb-2">
                          <span className="text-xs font-semibold text-orange-700 block mb-0.5">🔄 Your Revision Feedback:</span>
                          <p className="text-xs text-orange-900 whitespace-pre-wrap">{assignee.feedback}</p>
                        </div>
                      )}

                      {/* Admin actions for submitted status */}
                      {assignee.status === 'submitted' && (
                        <div className="border-t border-border pt-3 mt-2">
                          {showRevisionFor !== assignee.user_id ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApproveAssignee(assignee.user_id)} disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                Approve
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setShowRevisionFor(assignee.user_id)} disabled={isUpdating}>
                                <RotateCcw className="size-4" /> Request Revision
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <Label className="text-xs">Revision Feedback</Label>
                              <Textarea
                                placeholder="Provide detailed feedback..."
                                value={revisionFeedback[assignee.user_id] || ''}
                                onChange={e => setRevisionFeedback(prev => ({ ...prev, [assignee.user_id]: e.target.value }))}
                                rows={2}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button variant="outline" size="sm" onClick={() => setShowRevisionFor(null)}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRequestRevision(assignee.user_id)}
                                  disabled={isUpdating || !revisionFeedback[assignee.user_id]?.trim()}
                                >
                                  Send Feedback
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* No submission yet */}
                      {!assignee.submission_link && assignee.status !== 'completed' && assignee.status !== 'submitted' && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          {assignee.status === 'todo' ? 'Not started yet' : assignee.status === 'in_progress' ? 'Working on it...' : 'Awaiting resubmission'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Admin: Add Another Assignee */}
          {isOwner && (
            <Card>
              <CardContent className="pt-5">
                {!showAddAssignee ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowAddAssignee(true)}>
                    <UserPlus className="size-4" /> Assign Another Member
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Label>Select a member to assign</Label>
                    <div className="flex gap-2">
                      <Select value={newAssigneeId} onValueChange={val => setNewAssigneeId(val || '')}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="— Select Member —" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddAssignee} disabled={addingAssignee || !newAssigneeId}>
                        {addingAssignee ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                        Add
                      </Button>
                      <Button variant="outline" onClick={() => { setShowAddAssignee(false); setNewAssigneeId(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ============================================================ */}
          {/* SHARED CHAT */}
          {/* ============================================================ */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">💬 Chat &amp; Discussion ({comments.length})</CardTitle>
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  <Clock className="size-3" />
                  Messages expire in 24h
                </div>
              </div>
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
                        <span className="text-[9px] text-amber-500 font-medium ml-auto">{timeUntilExpiry(comment.created_at)}</span>
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
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</span>
                <span className={`text-sm font-medium ${isOverdue ? 'text-rose-600' : 'text-foreground'}`}>
                  {formatDate(task.due_date)}
                </span>
              </div>

              <Separator />

              {/* Assignees list */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Assigned To ({totalAssignees})
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
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>

              <Separator />

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

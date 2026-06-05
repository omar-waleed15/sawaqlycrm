'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { tasksApi, usersApi } from '@/lib/api';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Save, Plus, X } from 'lucide-react';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    drive_link: '',
    content_type: '',
    content_description: '',
  });

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneePickerId, setAssigneePickerId] = useState('');

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'team_leader' && user?.role !== 'moderation' && user?.role !== 'account_manager') {
      router.replace('/dashboard');
      return;
    }

    Promise.all([
      tasksApi.get(id),
      usersApi.list(),
    ]).then(([taskData, usersData]) => {
      const t = taskData.task;
      setForm({
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        due_date: t.due_date ? t.due_date.split('T')[0] : '',
        drive_link: t.drive_link || '',
        content_type: t.content_type || '',
        content_description: t.content_description || '',
      });
      // Load existing assignees from task_assignees
      const existingIds = (t.task_assignees || []).map(a => a.user_id);
      setAssigneeIds(existingIds);
      setMembers(usersData.users);
    }).catch(() => router.replace('/dashboard/tasks'))
      .finally(() => setLoading(false));
  }, [id, user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const addAssignee = () => {
    if (assigneePickerId && !assigneeIds.includes(assigneePickerId)) {
      setAssigneeIds(prev => [...prev, assigneePickerId]);
      setAssigneePickerId('');
    }
  };

  const removeAssignee = (uid: string) => {
    setAssigneeIds(prev => prev.filter(i => i !== uid));
  };

  const unassignedMembers = members.filter(m => !assigneeIds.includes(m.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await tasksApi.update(id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: form.due_date || undefined,
        drive_link: form.drive_link || undefined,
        content_type: form.content_type || undefined,
        content_description: form.content_description || undefined,
        assignee_ids: assigneeIds,
      });
      router.push(`/dashboard/tasks/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Edit Task</h1>
          <p className="page-header-subtitle">Update task details and assignment</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Task Title *</Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={form.description} onChange={handleChange} rows={5} />
              </div>

              {/* Content Assets */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3">🎥 Content Assets &amp; Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Content Type</Label>
                    <Select value={form.content_type} onValueChange={v => handleSelectChange('content_type', v || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="— Select Content Type —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="photos">Photos</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="drive_link">Google Drive Link</Label>
                    <Input
                      id="drive_link"
                      name="drive_link"
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={form.drive_link}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-3">
                  <Label htmlFor="content_description">Content Details</Label>
                  <Textarea
                    id="content_description"
                    name="content_description"
                    placeholder="Caption, hashtags, sizing, reference guidelines..."
                    value={form.content_description}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => handleSelectChange('priority', v || '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
                </div>
              </div>

              {/* Multi-Assignee Picker */}
              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">👥 Assign To</Label>

                {assigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {assigneeIds.map(uid => {
                      const m = members.find(u => u.id === uid);
                      if (!m) return null;
                      return (
                        <Badge
                          key={uid}
                          variant="secondary"
                          className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold"
                        >
                          <div className="size-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                            {getInitials(m.name)}
                          </div>
                          {m.name}
                          <button
                            type="button"
                            onClick={() => removeAssignee(uid)}
                            className="ml-1 hover:text-destructive transition-colors"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Select value={assigneePickerId} onValueChange={val => setAssigneePickerId(val || '')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="— Select a member to add —" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addAssignee} disabled={!assigneePickerId}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="size-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="size-4" /> Save Changes</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

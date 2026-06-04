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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

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
    status: 'todo',
    due_date: '',
    assignee_id: '',
    drive_link: '',
    content_type: '',
    content_description: '',
  });

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'team_leader') {
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
        status: t.status,
        due_date: t.due_date ? t.due_date.split('T')[0] : '',
        assignee_id: t.assignee_id || '',
        drive_link: t.drive_link || '',
        content_type: t.content_type || '',
        content_description: t.content_description || '',
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await tasksApi.update(id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
        status: form.status as 'todo' | 'in_progress' | 'submitted' | 'revision' | 'completed',
        due_date: form.due_date || undefined,
        assignee_id: form.assignee_id || undefined,
        drive_link: form.drive_link || undefined,
        content_type: form.content_type || undefined,
        content_description: form.content_description || undefined,
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
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => handleSelectChange('status', v || '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="revision">Needs Revision</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Assign To</Label>
                  <Select value={form.assignee_id} onValueChange={v => handleSelectChange('assignee_id', v || '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="— Unassigned —" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

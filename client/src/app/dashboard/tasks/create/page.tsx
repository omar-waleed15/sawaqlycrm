'use client';

import { useEffect, useState } from 'react';
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
import { ArrowLeft, Loader2, Plus } from 'lucide-react';

export default function CreateTaskPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
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
    usersApi.list().then(data => setMembers(data.users)).catch(console.error);
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await tasksApi.create({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: form.due_date || undefined,
        assignee_id: form.assignee_id || undefined,
        drive_link: form.drive_link || undefined,
        content_type: form.content_type || undefined,
        content_description: form.content_description || undefined,
      });
      router.push(`/dashboard/tasks/${data.task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Create Task</h1>
          <p className="page-header-subtitle">Add a new task and assign it to a team member</p>
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
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Design social media graphics for Q3 campaign"
                  value={form.title}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Provide detailed task instructions, requirements, and any relevant context..."
                  value={form.description}
                  onChange={handleChange}
                  rows={5}
                />
              </div>

              {/* Content Assets */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3">🎥 Content Assets &amp; Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="content_type">Content Type</Label>
                    <Select value={form.content_type} onValueChange={v => handleSelectChange('content_type', v || '')}>
                      <SelectTrigger id="content_type">
                        <SelectValue placeholder="— Select Content Type —" />
                      </SelectTrigger>
                      <SelectContent>
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
                    placeholder="Specify caption, hashtags, sizing, or reference guidelines..."
                    value={form.content_description}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={form.priority} onValueChange={v => handleSelectChange('priority', v || '')}>
                    <SelectTrigger id="priority">
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
                  <Input
                    id="due_date"
                    name="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assignee_id">Assign To</Label>
                <Select value={form.assignee_id} onValueChange={v => handleSelectChange('assignee_id', v || '')}>
                  <SelectTrigger id="assignee_id">
                    <SelectValue placeholder="— Unassigned —" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 justify-end pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create Task
                    </>
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

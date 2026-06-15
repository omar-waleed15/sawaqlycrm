'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi, projectsApi } from '@/lib/api';
import { User, Project } from '@/types';
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
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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
    project_id: '',
  });

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'team_leader' && user?.role !== 'moderation' && user?.role !== 'account_manager') {
      router.replace('/dashboard');
      return;
    }

    Promise.all([
      tasksApi.get(id),
      usersApi.list(),
      projectsApi.list(),
    ]).then(([taskData, usersData, projectsData]) => {
      const t = taskData.task;
      const myA = t.task_assignees?.find((a: any) => a.user_id === user?.id);

      const isOwnerRole = user?.role === 'owner';
      const isOtherAdminRole = user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';
      const isAssigned = !!myA;

      if (!isOwnerRole && (!isOtherAdminRole || isAssigned)) {
        router.replace(`/dashboard/tasks/${id}`);
        return;
      }

      setForm({
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        due_date: t.due_date ? t.due_date.split('T')[0] : '',
        drive_link: t.drive_link || '',
        content_type: t.content_type || '',
        content_description: t.content_description || '',
        project_id: t.project_id || '',
      });
      // Load existing assignees from task_assignees
      const existingIds = (t.task_assignees || []).map(a => a.user_id);
      setAssigneeIds(existingIds);
      setMembers(usersData.users);
      setProjects(projectsData.projects);
    }).catch(() => router.replace('/dashboard/tasks'))
      .finally(() => setLoading(false));
  }, [id, user, router]);

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
        project_id: (form.project_id && form.project_id !== 'none') ? form.project_id : undefined,
        assignee_ids: assigneeIds,
      });
      router.push(`/dashboard/tasks/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('editTask.savingFailed') || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('editTask.title')}</h1>
          <p className="page-header-subtitle">{t('editTask.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          {t('common.back')}
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
                <Label htmlFor="title">{t('createTask.taskTitle')} *</Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{t('createTask.description')}</Label>
                <Textarea id="description" name="description" value={form.description} onChange={handleChange} rows={5} />
              </div>

              {/* Content Assets */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3">🎥 {t('createTask.contentAssets')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('createTask.contentType')}</Label>
                    <Select value={form.content_type} onValueChange={v => handleSelectChange('content_type', v || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('createTask.selectContentType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        <SelectItem value="post">{t('contentType.post')}</SelectItem>
                        <SelectItem value="story">{t('contentType.story')}</SelectItem>
                        <SelectItem value="reel">{t('contentType.reel')}</SelectItem>
                        <SelectItem value="photos">{t('contentType.photos')}</SelectItem>
                        <SelectItem value="other">{t('contentType.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="drive_link">{t('createTask.driveLink')}</Label>
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
                  <Label htmlFor="content_description">{t('createTask.contentDetails')}</Label>
                  <Textarea
                    id="content_description"
                    name="content_description"
                    placeholder={t('createTask.contentDetailsPlaceholder')}
                    value={form.content_description}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t('createTask.priority')}</Label>
                  <Select value={form.priority} onValueChange={v => handleSelectChange('priority', v || '')}>
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
                  <Label htmlFor="due_date">{t('createTask.dueDate')}</Label>
                  <Input id="due_date" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project_id">{t('createTask.linkToProject')}</Label>
                <Select value={form.project_id || 'none'} onValueChange={v => handleSelectChange('project_id', v || '')}>
                  <SelectTrigger id="project_id">
                    <SelectValue placeholder={t('createTask.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('createTask.noneProject')}</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.client ? `— ${p.client.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multi-Assignee Picker */}
              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">👥 {t('createTask.assignTo')}</Label>

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
                  <Select
                    value=""
                    onValueChange={val => {
                      if (val && !assigneeIds.includes(val)) {
                        setAssigneeIds(prev => [...prev, val]);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('createTask.selectMember')} />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({t('role.' + m.role) || m.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="size-4 animate-spin" /> {t('editTask.saving')}</>
                  ) : (
                    <><Save className="size-4" /> {t('editTask.saveChanges')}</>
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

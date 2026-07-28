'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi, closedClientsApi, attachmentsApi } from '@/lib/api';
import { User, Client } from '@/types';
import { parseCairoDateTimeToISO, getCairoTodayString, getCairoDateString, getCairoDatetimeLocalString } from '@/lib/dateUtils';
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
import { ArrowLeft, Loader2, Plus, X, Paperclip, FileImage, FileText, Trash2 } from 'lucide-react';

import { useFormDraft } from '@/lib/useFormDraft';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const INITIAL_TASK_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  drive_link: '',
  content_type: '',
  content_description: '',
  client_id: '',
  is_deliverable: false,
  deliverable_type: 'post' as 'post' | 'reel' | 'story' | 'photo',
  deliverable_month: (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })(),
  estimated_hours: '',
  estimated_minutes: '',
};

export default function CreateTaskPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClientId = searchParams ? searchParams.get('client_id') : null;

  const [members, setMembers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  const { formState: form, setFormState: setForm, clearDraft, resetForm, hasDraft } = useFormDraft('task_create', INITIAL_TASK_FORM);

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [linkInputs, setLinkInputs] = useState<string[]>(['']);

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'team_leader' && user?.role !== 'moderation' && user?.role !== 'account_manager') {
      router.replace('/dashboard');
      return;
    }
    usersApi.list().then(data => setMembers((data.users || []).filter((u: any) => u.role !== 'client'))).catch(console.error);
    closedClientsApi.list().then(data => setClients(data.clients)).catch(console.error);
  }, [user, router]);

  useEffect(() => {
    if (queryClientId) {
      setForm(prev => ({ ...prev, client_id: queryClientId }));
    }
  }, [queryClientId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const removeAssignee = (uid: string) => {
    setAssigneeIds(prev => prev.filter(id => id !== uid));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter(f => {
      if (f.size > 20 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds 20MB limit`);
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = ''; // reset input so same file can be re-selected
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const unassignedMembers = members.filter(m => !assigneeIds.includes(m.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.due_date) {
      const todayStr = getCairoTodayString();
      const dueDateStr = getCairoDateString(form.due_date);
      if (dueDateStr < todayStr) {
        setError(locale === 'ar' ? 'تاريخ التسليم لا يمكن أن يكون قبل تاريخ الإنشاء' : 'Due date cannot be earlier than task creation date');
        return;
      }
    }

    setLoading(true);

    try {
      const totalEstMins = (Number(form.estimated_hours || 0) * 60) + Number(form.estimated_minutes || 0);
      const validLinks = linkInputs.map(l => l.trim()).filter(l => l.length > 0);

      const data = await tasksApi.create({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: form.due_date ? parseCairoDateTimeToISO(form.due_date) : undefined,
        estimated_time_minutes: totalEstMins > 0 ? totalEstMins : undefined,
        drive_link: validLinks.length > 0 ? validLinks.join('\n') : undefined,
        client_id: form.client_id || undefined,
        is_deliverable: form.is_deliverable,
        deliverable_type: form.is_deliverable ? form.deliverable_type : undefined,
        deliverable_month: form.is_deliverable ? `${form.deliverable_month}-01` : undefined,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      });

      // Upload pending files after task creation
      if (pendingFiles.length > 0) {
        setUploadProgress(t('createTask.uploadingFiles'));
        for (const file of pendingFiles) {
          try {
            await attachmentsApi.upload(data.task.id, file);
          } catch (uploadErr) {
            console.error('Failed to upload file:', file.name, uploadErr);
          }
        }
      }

      clearDraft();
      router.push(`/dashboard/tasks/${data.task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('createTask.title')}</h1>
          <p className="page-header-subtitle">{t('createTask.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Button>
      </div>

      {hasDraft && (form.title || form.description) && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs">
          <span>✏️ {locale === 'ar' ? 'تم استرجاع المسودة غير المحفوظة تلقائياً' : 'Restored unsaved draft automatically from your previous session'}</span>
          <button type="button" onClick={() => resetForm()} className="font-bold underline hover:text-indigo-900 dark:hover:text-indigo-100 shrink-0">
            {locale === 'ar' ? 'مسح المسودة' : 'Clear Draft'}
          </button>
        </div>
      )}

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
                <Input
                  id="title"
                  name="title"
                  placeholder={t('createTask.taskTitlePlaceholder')}
                  value={form.title}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{t('createTask.description')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('createTask.descriptionPlaceholder')}
                  value={form.description}
                  onChange={handleChange}
                  rows={5}
                />
              </div>

              {/* Resource & Drive Links (Multi-Link) */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    🔗 {t('createTask.driveLink') || 'Resource & Drive Links'}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200"
                    onClick={() => setLinkInputs(prev => [...prev, ''])}
                  >
                    <Plus className="size-3.5" /> {locale === 'ar' ? 'إضافة رابط آخر' : 'Add Another Link'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {linkInputs.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={link}
                        onChange={e => {
                          const val = e.target.value;
                          setLinkInputs(prev => prev.map((l, i) => i === idx ? val : l));
                        }}
                        className="text-xs h-9 flex-1"
                      />
                      {linkInputs.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0"
                          onClick={() => setLinkInputs(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* File Attachments */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3">📎 {t('createTask.attachFiles')}</h4>
                <p className="text-xs text-muted-foreground mb-3">{t('createTask.attachFilesDesc')}</p>
                
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-[#1D61E7] hover:bg-[#1D61E7]/5 transition-all cursor-pointer px-4 py-6"
                >
                  <Paperclip className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{t('createTask.browseFiles')}</span>
                  <span className="text-[10px] text-muted-foreground">PNG, JPG, PDF — max 20MB</span>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>

                {pendingFiles.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3">
                    <span className="text-xs font-semibold text-muted-foreground">{t('createTask.selectedFiles')}</span>
                    {pendingFiles.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 border border-border">
                        {file.type.startsWith('image/') ? (
                          <FileImage className="size-4 text-[#1D61E7] shrink-0" />
                        ) : (
                          <FileText className="size-4 text-rose-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</div>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="priority">{t('createTask.priority')}</Label>
                  <Select value={form.priority} onValueChange={v => handleSelectChange('priority', v || '')}>
                    <SelectTrigger id="priority">
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
                  <Input
                    id="due_date"
                    name="due_date"
                    type="datetime-local"
                    min={getCairoDatetimeLocalString()}
                    value={form.due_date}
                    onChange={handleChange}
                    className="w-full text-xs h-10 px-3"
                  />
                </div>
              </div>

              {/* Time Limit Section */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/30">
                <Label className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  ⏱️ {t('createTask.estimatedTime')}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      id="estimated_hours"
                      name="estimated_hours"
                      type="number"
                      min="0"
                      max="500"
                      placeholder="0"
                      value={form.estimated_hours}
                      onChange={handleChange}
                      className="bg-background"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t('createTask.estimatedHours')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="estimated_minutes"
                      name="estimated_minutes"
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={form.estimated_minutes}
                      onChange={handleChange}
                      className="bg-background"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t('createTask.estimatedMinutes')}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client_id">{t('tasks.client')} *</Label>
                <Select value={form.client_id} onValueChange={v => handleSelectChange('client_id', v || '')}>
                  <SelectTrigger id="client_id">
                    <SelectValue placeholder={t('tasks.selectClient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>



              {/* Multi-Assignee Picker */}
              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">👥 {t('createTask.assignTo')}</Label>

                {/* Selected assignees as chips */}
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
                          <div className="size-5 rounded-full bg-[#1D61E7] flex items-center justify-center text-[8px] font-bold text-white shrink-0">
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

                {/* Add assignee picker */}
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
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({t('role.' + m.role) || m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {assigneeIds.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">{t('createTask.noAssignees')}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {uploadProgress || t('createTask.creating')}
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      {t('createTask.createTask')}
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

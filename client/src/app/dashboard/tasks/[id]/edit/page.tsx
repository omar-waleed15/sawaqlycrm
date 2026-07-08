'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { tasksApi, usersApi, clientsApi, attachmentsApi } from '@/lib/api';
import { User, Client, Attachment } from '@/types';
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
import { ArrowLeft, Loader2, Save, Plus, X, Paperclip, FileImage, FileText, Trash2 } from 'lucide-react';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [members, setMembers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  const [form, setForm] = useState({
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
      clientsApi.list(),
    ]).then(([taskData, usersData, clientsData]) => {
      const tData = taskData.task;
      const myA = tData.task_assignees?.find((a: any) => a.user_id === user?.id);

      const isOwnerRole = user?.role === 'owner';
      const isOtherAdminRole = user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';
      const isAssigned = !!myA;

      if (!isOwnerRole && (!isOtherAdminRole || isAssigned)) {
        router.replace(`/dashboard/tasks/${id}`);
        return;
      }

      setForm({
        title: tData.title,
        description: tData.description || '',
        priority: tData.priority,
        due_date: tData.due_date ? tData.due_date.split('T')[0] : '',
        drive_link: tData.drive_link || '',
        content_type: tData.content_type || '',
        content_description: tData.content_description || '',
        client_id: tData.client_id || '',
        is_deliverable: tData.is_deliverable || false,
        deliverable_type: tData.deliverable_type || 'post',
        deliverable_month: tData.deliverable_month ? tData.deliverable_month.substring(0, 7) : (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        })(),
      });
      // Load existing assignees from task_assignees
      const existingIds = (tData.task_assignees || []).map(a => a.user_id);
      setAssigneeIds(existingIds);
      setMembers((usersData.users || []).filter((u: any) => u.role !== 'client'));
      setClients(clientsData.clients);
      setExistingAttachments(tData.attachments || []);
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
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm(t('taskDetail.deleteAttachmentConfirm'))) return;
    try {
      await attachmentsApi.delete(id, attachmentId);
      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

      // Upload pending files
      if (pendingFiles.length > 0) {
        setUploadProgress(t('createTask.uploadingFiles'));
        for (const file of pendingFiles) {
          try {
            await attachmentsApi.upload(id, file);
          } catch (uploadErr) {
            console.error('Failed to upload file:', file.name, uploadErr);
          }
        }
      }

      router.push(`/dashboard/tasks/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('editTask.savingFailed') || 'Failed to save task');
    } finally {
      setSaving(false);
      setUploadProgress('');
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

              {/* Monthly Deliverables Config */}
              {form.client_id && (
                <div className="border border-[#1D61E7]/15 bg-[#1D61E7]/5 rounded-lg p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      id="is_deliverable"
                      name="is_deliverable"
                      type="checkbox"
                      checked={form.is_deliverable}
                      onChange={e => setForm(prev => ({ ...prev, is_deliverable: e.target.checked }))}
                      className="size-4 rounded border-gray-300 text-[#1D61E7] focus:ring-[#1D61E7]"
                    />
                    <div className="text-start">
                      <Label htmlFor="is_deliverable" className="font-bold text-sm cursor-pointer">
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
                        <Label htmlFor="deliverable_type">{t('tasks.deliverableType')}</Label>
                        <Select
                          value={form.deliverable_type}
                          onValueChange={v => handleSelectChange('deliverable_type', v || 'post')}
                        >
                          <SelectTrigger id="deliverable_type">
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
                        <Label htmlFor="deliverable_month">{t('tasks.deliverableMonth')}</Label>
                        <Input
                          id="deliverable_month"
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

              {/* File Attachments */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3">📎 {t('createTask.attachFiles')}</h4>
                <p className="text-xs text-muted-foreground mb-3">{t('createTask.attachFilesDesc')}</p>

                {/* Existing Attachments */}
                {existingAttachments.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    <span className="text-xs font-semibold text-muted-foreground">{t('taskDetail.existingAttachments')}</span>
                    {existingAttachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 border border-border">
                        {att.mimetype?.startsWith('image/') ? (
                          <FileImage className="size-4 text-[#1D61E7] shrink-0" />
                        ) : (
                          <FileText className="size-4 text-rose-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{att.filename}</div>
                          <div className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</div>
                        </div>
                        {att.public_url && (
                          <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1D61E7] hover:text-[#1553c7] font-medium shrink-0">
                            {t('taskDetail.openFile')} ↗
                          </a>
                        )}
                        <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New File Upload */}
                <label
                  htmlFor="file-upload-edit"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-[#1D61E7] hover:bg-[#1D61E7]/5 transition-all cursor-pointer px-4 py-6"
                >
                  <Paperclip className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{t('createTask.browseFiles')}</span>
                  <span className="text-[10px] text-muted-foreground">PNG, JPG, PDF — max 20MB</span>
                  <input
                    id="file-upload-edit"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>

                {pendingFiles.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3">
                    <span className="text-xs font-semibold text-muted-foreground">{t('taskDetail.newFiles')}</span>
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

              <div className="flex gap-3 justify-end pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="size-4 animate-spin" /> {uploadProgress || t('editTask.saving')}</>
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

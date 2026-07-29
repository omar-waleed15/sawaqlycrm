'use client';

import { useState, useEffect } from 'react';
import { User, Client, Task } from '@/types';
import { tasksApi, usersApi, closedClientsApi, attachmentsApi } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import Modal from '@/components/Modal';
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
import { parseCairoDateTimeToISO, getCairoTodayString } from '@/lib/dateUtils';
import { Loader2, Plus, X, Paperclip, CheckCircle2, Rocket, Trash2 } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newTask: Task) => void;
}

export default function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [linkInputs, setLinkInputs] = useState<string[]>(['']);
  const [isDeliverable, setIsDeliverable] = useState(false);
  const [deliverableType, setDeliverableType] = useState<'post' | 'reel' | 'story' | 'photo'>('post');
  const [deliverableMonth, setDeliverableMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Assignees & Clients
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setClientId('');
      setLinkInputs(['']);
      setIsDeliverable(false);
      setAssigneeIds([]);
      setPendingFiles([]);
      setUploadProgress('');

      Promise.all([
        usersApi.list().catch(() => ({ users: [] })),
        closedClientsApi.list().catch(() => ({ clients: [] })),
      ]).then(([usersRes, clientsRes]) => {
        setTeamMembers((usersRes.users || []).filter((u: User) => u.role !== 'client'));
        setClients(clientsRes.clients || []);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(locale === 'ar' ? 'عنوان المهمة مطلوب' : 'Task title is required');
      return;
    }

    if (dueDate) {
      const todayStr = getCairoTodayString();
      const dueDateStr = dueDate.split('T')[0];
      if (dueDateStr < todayStr) {
        setError(locale === 'ar' ? 'تاريخ التسليم لا يمكن أن يكون قبل تاريخ اليوم' : 'Due date cannot be earlier than today');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const validLinks = linkInputs.map(l => l.trim()).filter(l => l.length > 0);
      const data = await tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? parseCairoDateTimeToISO(dueDate) : undefined,
        drive_link: validLinks.length > 0 ? validLinks.join('\n') : undefined,
        client_id: clientId || undefined,
        is_deliverable: isDeliverable,
        deliverable_type: isDeliverable ? deliverableType : undefined,
        deliverable_month: isDeliverable ? `${deliverableMonth}-01` : undefined,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      });

      // Upload pending files if any
      if (pendingFiles.length > 0 && data?.task?.id) {
        setUploadProgress(locale === 'ar' ? 'جاري رفع المرفقات...' : 'Uploading attachments...');
        for (const file of pendingFiles) {
          try {
            await attachmentsApi.upload(data.task.id, file);
          } catch (uploadErr) {
            console.error('File upload error:', uploadErr);
          }
        }
      }

      if (onSuccess && data?.task) {
        onSuccess(data.task);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🚀 ${locale === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}`}
      maxWidth={600}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-lg font-medium">
            {error}
          </div>
        )}

        {/* Task Title */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="task-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {locale === 'ar' ? 'عنوان المهمة *' : 'Task Title *'}
          </Label>
          <Input
            id="task-title"
            placeholder={locale === 'ar' ? 'مثال: تصميم بوسط إنستغرام لشركة التميز' : 'e.g. Design Instagram Post for Client'}
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="h-9 text-xs"
          />
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="task-priority" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {locale === 'ar' ? 'الأولوية' : 'Priority'}
            </Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v || 'medium')}>
              <SelectTrigger id="task-priority" className="h-9 text-xs">
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

          <div className="flex flex-col gap-1">
            <Label htmlFor="task-due" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              📅 {locale === 'ar' ? 'موعد التسليم' : 'Due Date'}
            </Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Client & Drive Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="task-client" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              🏢 {locale === 'ar' ? 'العميل / المشروع' : 'Client / Project'}
            </Label>
            <Select value={clientId} onValueChange={v => setClientId(v || '')}>
              <SelectTrigger id="task-client" className="h-9 text-xs">
                <SelectValue placeholder={locale === 'ar' ? 'اختر عميل (اختياري)...' : 'Select client (optional)...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{locale === 'ar' ? 'بدون عميل (عام)' : 'No Client (General)'}</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Multi-Link Inputs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              🔗 {locale === 'ar' ? 'روابط مراجع وملفات (Drive/Figma/Dropbox)' : 'Resource Links (Drive, Figma, Dropbox)'}
            </Label>
            <button
              type="button"
              onClick={() => setLinkInputs(prev => [...prev, ''])}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              + {locale === 'ar' ? 'إضافة رابط آخر' : 'Add Another Link'}
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-0.5">
            {linkInputs.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="url"
                  placeholder={locale === 'ar' ? 'https://drive.google.com/...' : 'https://drive.google.com/file/...'}
                  value={link}
                  onChange={e => {
                    const val = e.target.value;
                    setLinkInputs(prev => prev.map((l, i) => i === idx ? val : l));
                  }}
                  className="h-9 text-xs flex-1"
                />
                {linkInputs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setLinkInputs(prev => prev.filter((_, i) => i !== idx))}
                    title={locale === 'ar' ? 'حذف الرابط' : 'Remove Link'}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Team Members Assignees */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            👥 {locale === 'ar' ? 'تكليف أعضاء الفريق' : 'Assign Team Members'}
          </Label>
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-muted/20 min-h-[38px] max-h-[100px] overflow-y-auto items-center">
            {teamMembers.map(member => {
              const isSelected = assigneeIds.includes(member.id);
              return (
                <Badge
                  key={member.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer text-[11px] py-1 transition-all ${
                    isSelected ? "bg-indigo-600 text-white font-bold shadow-xs" : "hover:bg-muted text-muted-foreground"
                  }`}
                  onClick={() => {
                    setAssigneeIds(prev =>
                      isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                    );
                  }}
                >
                  {isSelected ? "✓ " : "+ "} {member.name}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="task-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            📝 {locale === 'ar' ? 'الوصف والتفاصيل' : 'Description & Instructions'}
          </Label>
          <Textarea
            id="task-desc"
            placeholder={locale === 'ar' ? 'اكتب تفاصيل المهمة والتعليمات...' : 'Task requirements, scope, or comments...'}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="text-xs resize-none"
          />
        </div>

        {/* File Attachments */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-files" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Paperclip className="size-3 text-indigo-500" />
              {locale === 'ar' ? 'مرفقات الملفات' : 'File Attachments'}
            </Label>
            <label htmlFor="task-files" className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700">
              + {locale === 'ar' ? 'إضافة ملفات' : 'Add Files'}
            </label>
            <input
              id="task-files"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 border rounded-lg max-h-[80px] overflow-y-auto">
              {pendingFiles.map((file, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] gap-1 py-0.5 bg-background">
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button type="button" onClick={() => removePendingFile(idx)} className="hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4">
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                {uploadProgress || t('common.loading')}
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5 mr-1.5" />
                {locale === 'ar' ? 'إنشاء المهمة' : 'Create Task'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

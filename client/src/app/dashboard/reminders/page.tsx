'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { remindersApi, usersApi } from '@/lib/api';
import { Reminder, User, ReminderAttachment } from '@/types';
import { useFormDraft } from '@/lib/useFormDraft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  StickyNote,
  Send,
  Loader2,
  Trash2,
  Inbox,
  CheckCircle2,
  BookOpen,
  Calendar,
  AlertCircle,
  Plus,
  ChevronDown,
  Paperclip,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';

const COLORS = [
  'bg-amber-50/90 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-900 dark:text-amber-200',
  'bg-sky-50/90 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900/40 text-sky-900 dark:text-sky-200',
  'bg-emerald-50/90 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200',
  'bg-rose-50/90 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 text-rose-900 dark:text-rose-200',
  'bg-indigo-50/90 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200',
];

export default function RemindersPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox'>('inbox');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New reminder form state with auto-save draft protection
  const INITIAL_REMINDER_FORM = {
    selectedReceiverIds: [] as string[],
    content: '',
    reviewLink: '',
    attachments: [] as ReminderAttachment[],
  };

  const { formState: reminderForm, setFormState: setReminderForm, clearDraft: clearReminderDraft, resetForm: resetReminderForm, hasDraft: hasReminderDraft } = useFormDraft('reminder_create', INITIAL_REMINDER_FORM);
  const { selectedReceiverIds, content, reviewLink, attachments } = reminderForm;

  const setSelectedReceiverIds = (ids: string[]) => setReminderForm(p => ({ ...p, selectedReceiverIds: ids }));
  const setContent = (val: string) => setReminderForm(p => ({ ...p, content: val }));
  const setReviewLink = (val: string) => setReminderForm(p => ({ ...p, reviewLink: val }));
  const setAttachments = (updater: ReminderAttachment[] | ((prev: ReminderAttachment[]) => ReminderAttachment[])) => {
    setReminderForm(p => ({
      ...p,
      attachments: typeof updater === 'function' ? updater(p.attachments) : updater,
    }));
  };

  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await remindersApi.uploadAttachment(formData);
      setAttachments((prev: ReminderAttachment[]) => [...prev, res]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (user) {
      loadData(true);
      const interval = setInterval(() => {
        loadData(false);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [remindersRes, usersRes] = await Promise.all([
        remindersApi.list(),
        usersApi.list(),
      ]);
      setReminders(remindersRes.reminders || []);
      setUsers((usersRes.users || []).filter((u: any) => u.role !== 'client'));
    } catch (err) {
      console.error('Failed to load reminders data', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReceiverIds.length === 0) {
      setErrorMsg(t('reminders.receiverRequired') || 'Please select a recipient');
      return;
    }
    if (!content.trim()) {
      setErrorMsg(t('reminders.contentRequired') || 'Reminder text is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await remindersApi.create({
        receiver_ids: selectedReceiverIds,
        content,
        review_link: reviewLink.trim() || undefined,
        attachments,
      });
      setReminders([...(res.reminders || []), ...reminders]);
      resetReminderForm();
      setCreateModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const res = await remindersApi.markRead(id);
      setReminders(reminders.map(r => r.id === id ? res.reminder : r));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      const res = await remindersApi.markDone(id);
      setReminders(reminders.map(r => r.id === id ? res.reminder : r));
    } catch (err) {
      console.error('Failed to mark done', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('reminders.deleteConfirm') || 'Are you sure you want to delete this reminder?')) return;
    try {
      await remindersApi.delete(id);
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete reminder', err);
    }
  };

  // Filter reminders based on active tab
  const displayedReminders = reminders.filter(r => {
    if (activeTab === 'inbox') {
      return r.receiver_id === user?.id;
    } else {
      return r.sender_id === user?.id;
    }
  });

  const getNoteColorClass = (index: number) => {
    return COLORS[index % COLORS.length];
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            📌 {t('nav.reminders') || 'Reminders'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('reminders.subtitle') || 'Send sticky note reminders and follow-up tasks to team members'}
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
        >
          <Plus className="size-4" />
          {t('reminders.createTitle') || 'New Reminder'}
        </Button>
      </div>

      <div className="w-full flex flex-col gap-4">
        {/* Sticky Notes Board */}
        <div className="flex flex-col gap-4">
          {/* Sub-tabs */}
          <div className="flex border-b border-border gap-4 shrink-0">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'inbox'
                  ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="size-4" />
              {t('reminders.inbox') || 'Inbox (Received)'}
            </button>
            <button
              onClick={() => setActiveTab('outbox')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'outbox'
                  ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Send className="size-4" />
              {t('reminders.outbox') || 'Sent Reminders'}
            </button>
          </div>

          {/* Sticky Notes Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayedReminders.length === 0 ? (
            <Card className="border border-dashed border-border bg-muted/20 py-16 text-center">
              <CardContent className="flex flex-col items-center justify-center">
                <StickyNote className="size-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'inbox'
                    ? t('reminders.emptyInbox') || 'Your Inbox is empty! No reminders yet.'
                    : t('reminders.emptyOutbox') || 'You haven\'t sent any reminders yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedReminders.map((r, idx) => (
                <div
                  key={r.id}
                  className={`border p-5 rounded-2xl shadow-sm flex flex-col gap-4 text-start relative group transition-all hover:-translate-y-1 hover:shadow-md ${getNoteColorClass(
                    idx
                  )}`}
                >
                  {/* Note Header: Sender/Receiver Info & Sent Date */}
                  <div className="flex justify-between items-start gap-2 border-b border-black/5 pb-2">
                    <span className="text-xs font-bold truncate">
                      {activeTab === 'inbox'
                        ? `👤 From: ${r.sender?.name || 'Unknown'}`
                        : `👥 To: ${r.receiver?.name || 'Unknown'}`}
                    </span>
                    <span className="text-[10px] opacity-70 flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>

                  {/* Note Content */}
                  <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap flex-1 min-h-[50px]">
                    {r.content}
                  </div>

                  {/* Review Link Button */}
                  {r.review_link && (
                    <a
                      href={r.review_link.startsWith('http') ? r.review_link : `https://${r.review_link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors w-fit border border-indigo-200 dark:border-indigo-800"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span>{locale === 'ar' ? 'فتح رابط المراجعة ↗' : 'Open Link to Review ↗'}</span>
                    </a>
                  )}

                  {/* Attachments Gallery */}
                  {r.attachments && r.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
                      {r.attachments.map((att, aIdx) => (
                        <a
                          key={aIdx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/5 hover:bg-black/10 text-xs font-semibold text-foreground transition-all group"
                        >
                          {att.type === 'image' ? (
                            <img src={att.url} alt={att.name} className="size-5 rounded object-cover" />
                          ) : (
                            <FileText className="size-3.5 text-indigo-600" />
                          )}
                          <span className="max-w-[120px] truncate group-hover:underline">{att.name}</span>
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Note Footer: Status Trackers & Receiver Action Buttons */}
                  <div className="flex flex-col gap-2 border-t border-black/5 pt-3 mt-auto">
                    {/* Status Info */}
                    <div className="flex flex-col gap-1 text-[10px] opacity-80 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="size-3" />
                        {r.read_at ? (
                          <span>
                            {t('reminders.readAt') || 'Read at'}: {formatDateTime(r.read_at)}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {t('reminders.unread') || 'Unread'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3" />
                        {r.completed_at ? (
                          <span>
                            {t('reminders.doneAt') || 'Done at'}: {formatDateTime(r.completed_at)}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            {t('reminders.pending') || 'Pending'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      {activeTab === 'inbox' ? (
                        <div className="flex gap-1.5 w-full">
                          {!r.read_at && (
                            <Button
                              onClick={() => handleMarkRead(r.id)}
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] py-0 px-2 flex-1 bg-white/50 hover:bg-white/80 border-black/10 text-foreground"
                            >
                              📖 {t('reminders.markRead') || 'Read'}
                            </Button>
                          )}
                          {!r.completed_at && (
                            <Button
                              onClick={() => handleMarkDone(r.id)}
                              size="sm"
                              className="h-7 text-[10px] py-0 px-2 flex-1 bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
                            >
                              ✅ {t('common.done') || 'Done'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleDelete(r.id)}
                          size="icon"
                          variant="ghost"
                          className="size-7 p-0 ml-auto hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 hover:text-rose-700 rounded-md"
                          title={t('common.delete') || 'Delete'}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Reminder Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setErrorMsg('');
        }}
        title={t('reminders.createTitle') || 'New Reminder'}
        maxWidth={520}
      >
        <form onSubmit={handleSendReminder} className="flex flex-col gap-4 text-start">

          <div className="flex flex-col gap-1.5">
            <Label>{t('reminders.recipient') || 'Send To'}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="outline" className="w-full justify-between font-normal text-xs text-muted-foreground bg-background">
                    <span>
                      {selectedReceiverIds.length === 0
                        ? t('reminders.selectRecipient') || 'Select team member(s)'
                        : `${selectedReceiverIds.length} selected`}
                    </span>
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-[300px] max-h-60 overflow-y-auto p-2">
                {users
                  .filter(u => u.id !== user?.id)
                  .map(u => {
                    const isSelected = selectedReceiverIds.includes(u.id);
                    return (
                      <DropdownMenuItem
                        key={u.id}
                        closeOnClick={false}
                        onClick={(e) => {
                          e.preventDefault(); // Keep dropdown open when clicking
                          if (isSelected) {
                            setSelectedReceiverIds(selectedReceiverIds.filter(id => id !== u.id));
                          } else {
                            setSelectedReceiverIds([...selectedReceiverIds, u.id]);
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 size-3.5"
                        />
                        <div className="flex flex-col text-start">
                          <span className="text-xs font-semibold">{u.name}</span>
                          <span className="text-[9px] text-muted-foreground font-normal">
                            {t(`role.${u.role}`)}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('reminders.message') || 'Message'}</Label>
            <Textarea
              placeholder={t('reminders.placeholder') || 'Type your reminder here...'}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Link to Review */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review_link" className="flex items-center gap-1.5 text-xs font-semibold">
              <ExternalLink className="size-3.5 text-indigo-600" />
              {locale === 'ar' ? 'رابط للمراجعة (اختياري)' : 'Link to Review (Optional)'}
            </Label>
            <Input
              id="review_link"
              type="url"
              placeholder="https://docs.google.com/... or Figma link"
              value={reviewLink}
              onChange={e => setReviewLink(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Attach Photos or Files */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Paperclip className="size-3.5 text-indigo-600" />
              {locale === 'ar' ? 'إرفاق صور أو ملفات (اختياري)' : 'Attach Photos or Files (Optional)'}
            </Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="reminder-file-input"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={uploadingFile}
                  onClick={() => document.getElementById('reminder-file-input')?.click()}
                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  {uploadingFile && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  {uploadingFile ? (locale === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (locale === 'ar' ? '+ رفع' : '+ Upload')}
                </Button>
              </div>

              {/* Attachment Chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md border bg-muted/20">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-background border text-xs font-medium text-foreground">
                      {att.type === 'image' ? '🖼️' : '📄'}
                      <span className="max-w-[130px] truncate" title={att.name}>{att.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5">
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Send className="size-4" />
                  {t('reminders.send') || 'Send Reminder'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

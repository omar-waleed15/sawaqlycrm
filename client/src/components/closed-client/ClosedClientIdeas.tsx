'use client';

import { useState, useRef } from 'react';
import { closedClientsApi } from '@/lib/api';
import { ClientIdea } from '@/types';
import { useLanguage } from '@/lib/i18n';
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
  Plus,
  Edit,
  Trash2,
  Lightbulb,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  Upload,
  X,
} from 'lucide-react';

const IDEA_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const STATUS_STYLES: Record<string, string> = {
  idea: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  idea: Lightbulb,
  done: CheckCircle2,
};

interface ClosedClientIdeasProps {
  clientId: string;
  ideas: ClientIdea[];
  onRefresh: () => void;
}

export default function ClosedClientIdeas({ clientId, ideas, onRefresh }: ClosedClientIdeasProps) {
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ClientIdea | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState<{
    title: string;
    description: string;
    color: string;
    status: 'idea' | 'done';
    drive_link: string;
    attachment_url: string;
    attachment_name: string;
  }>({
    title: '',
    description: '',
    color: '#6366f1',
    status: 'idea',
    drive_link: '',
    attachment_url: '',
    attachment_name: '',
  });

  const resetForm = (idea?: ClientIdea) => {
    if (idea) {
      setForm({
        title: idea.title,
        description: idea.description || '',
        color: idea.color || '#6366f1',
        status: idea.status === 'done' ? 'done' : 'idea',
        drive_link: idea.drive_link || '',
        attachment_url: idea.attachment_url || '',
        attachment_name: idea.attachment_name || '',
      });
      setEditingIdea(idea);
    } else {
      setForm({
        title: '',
        description: '',
        color: '#6366f1',
        status: 'idea',
        drive_link: '',
        attachment_url: '',
        attachment_name: '',
      });
      setEditingIdea(null);
    }
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await closedClientsApi.uploadIdeaAttachment(clientId, formData);
      setForm(prev => ({
        ...prev,
        attachment_url: res.public_url,
        attachment_name: res.filename,
      }));
    } catch (err) {
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setForm(prev => ({
      ...prev,
      attachment_url: '',
      attachment_name: '',
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      if (editingIdea) {
        await closedClientsApi.updateIdea(clientId, editingIdea.id, form);
      } else {
        await closedClientsApi.createIdea(clientId, form);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save idea', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (idea: ClientIdea) => {
    if (!confirm(t('closedClients.ideas.deleteConfirm'))) return;
    try {
      await closedClientsApi.deleteIdea(clientId, idea.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete idea', err);
    }
  };

  const handleStatusCycle = async (idea: ClientIdea) => {
    const nextStatus: 'idea' | 'done' = idea.status === 'idea' ? 'done' : 'idea';
    try {
      await closedClientsApi.updateIdea(clientId, idea.id, { status: nextStatus });
      onRefresh();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.ideas.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('closedClients.ideas.subtitle')}</p>
        </div>
        <Button onClick={() => resetForm()} size="sm">
          <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('closedClients.ideas.addIdea')}
        </Button>
      </div>

      {/* Ideas Grid */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('closedClients.ideas.ideasList')} ({ideas.length})
        </h4>
        
        {ideas.length === 0 ? (
          <Card className="border border-dashed border-border bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">{t('closedClients.ideas.noIdeas')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ideas.map(idea => {
              const statusKey = idea.status === 'done' ? 'done' : 'idea';
              const StatusIcon = STATUS_ICONS[statusKey] || Lightbulb;
              return (
                <Card key={idea.id} className="border border-border bg-card hover:shadow-md transition-shadow flex flex-col justify-between">
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div
                        className="size-8 rounded-lg flex items-center justify-center shrink-0 animate-pulse-slow"
                        style={{ backgroundColor: idea.color + '20' }}
                      >
                        <StatusIcon className="size-4" style={{ color: idea.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-sm font-semibold text-foreground truncate">{idea.title}</h5>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => resetForm(idea)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Edit className="size-3.5" />
                            </button>
                            <button onClick={() => handleDelete(idea)} className="p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {idea.description && (
                      <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed whitespace-pre-wrap flex-1">{idea.description}</p>
                    )}

                    {/* Attachments & Links */}
                    {(idea.drive_link || idea.attachment_url) && (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-border mt-auto">
                        {idea.drive_link && (
                          <a
                            href={idea.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline w-fit"
                          >
                            <ExternalLink className="size-3" /> {t('closedClients.ideas.driveLink')}
                          </a>
                        )}
                        {idea.attachment_url && (
                          <a
                            href={idea.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline w-fit"
                          >
                            <Paperclip className="size-3" /> {idea.attachment_name || t('closedClients.ideas.attachment')}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="flex items-center gap-2 pt-2 mt-auto">
                      <button
                        onClick={() => handleStatusCycle(idea)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLES[statusKey]}`}
                        title="Click to cycle status"
                      >
                        {t(`closedClients.ideas.${statusKey}`)}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingIdea ? t('closedClients.ideas.editIdea') : t('closedClients.ideas.addIdea')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>{t('closedClients.ideas.ideaTitle')}</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          
          <div>
            <Label>{t('closedClients.ideas.description')}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('closedClients.plan.status')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'idea' | 'done' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">{t('closedClients.ideas.idea')}</SelectItem>
                  <SelectItem value="done">{t('closedClients.ideas.done')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>{t('closedClients.ideas.color')}</Label>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {IDEA_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`size-6 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>{t('closedClients.ideas.driveLink')}</Label>
            <Input value={form.drive_link} onChange={(e) => setForm({ ...form, drive_link: e.target.value })} placeholder="https://drive.google.com/..." />
          </div>

          <div>
            <Label>{t('closedClients.ideas.attachment')}</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {t('closedClients.ideas.uploadFile')}
              </Button>

              {form.attachment_url && (
                <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md text-xs text-foreground max-w-xs truncate">
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="truncate">{form.attachment_name}</span>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="p-0.5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

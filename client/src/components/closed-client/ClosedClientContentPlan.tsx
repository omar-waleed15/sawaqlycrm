'use client';

import { useState } from 'react';
import { closedClientsApi } from '@/lib/api';
import { ClientContentPlan } from '@/types';
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
  ExternalLink,
  FileText,
  Loader2,
  Filter,
} from 'lucide-react';

const CONTENT_TYPES = ['post', 'reel', 'story', 'photo', 'video', 'carousel'] as const;
const PLAN_STATUSES = ['draft', 'approved', 'published'] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const TYPE_STYLES: Record<string, string> = {
  post: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  reel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  story: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  photo: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  video: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  carousel: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

interface ClosedClientContentPlanProps {
  clientId: string;
  plans: ClientContentPlan[];
  onRefresh: () => void;
}

export default function ClosedClientContentPlan({ clientId, plans, onRefresh }: ClosedClientContentPlanProps) {
  const { t, locale } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClientContentPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [form, setForm] = useState<{
    title: string;
    description: string;
    content_type: string;
    status: 'draft' | 'approved' | 'published';
    scheduled_date: string;
    drive_link: string;
    notes: string;
  }>({
    title: '',
    description: '',
    content_type: '',
    status: 'draft',
    scheduled_date: '',
    drive_link: '',
    notes: '',
  });

  const resetForm = (plan?: ClientContentPlan) => {
    if (plan) {
      setForm({
        title: plan.title,
        description: plan.description || '',
        content_type: plan.content_type || '',
        status: plan.status,
        scheduled_date: plan.scheduled_date || '',
        drive_link: plan.drive_link || '',
        notes: plan.notes || '',
      });
      setEditingPlan(plan);
    } else {
      setForm({ title: '', description: '', content_type: '', status: 'draft', scheduled_date: '', drive_link: '', notes: '' });
      setEditingPlan(null);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      if (editingPlan) {
        await closedClientsApi.updatePlan(clientId, editingPlan.id, form);
      } else {
        await closedClientsApi.createPlan(clientId, form);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save content plan', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: ClientContentPlan) => {
    if (!confirm(t('closedClients.plan.deleteConfirm'))) return;
    try {
      await closedClientsApi.deletePlan(clientId, plan.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete plan', err);
    }
  };

  const handleStatusToggle = async (plan: ClientContentPlan) => {
    const nextStatus = plan.status === 'draft' ? 'approved' : plan.status === 'approved' ? 'published' : 'draft';
    try {
      await closedClientsApi.updatePlan(clientId, plan.id, { status: nextStatus });
      onRefresh();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const filtered = plans.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterType !== 'all' && p.content_type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.plan.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('closedClients.plan.subtitle')}</p>
        </div>
        <Button onClick={() => resetForm()} size="sm">
          <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('closedClients.plan.addContent')}
        </Button>
      </div>

      {/* Filters */}
      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="size-4 text-muted-foreground" />
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('common.all')}
            </button>
            {PLAN_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === s ? STATUS_STYLES[s] : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t(`closedClients.plan.${s}`)}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1.5 flex-wrap">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct}
                onClick={() => setFilterType(filterType === ct ? 'all' : ct)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === ct ? TYPE_STYLES[ct] : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t(`closedClients.plan.${ct}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content List */}
      {filtered.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t('closedClients.plan.noPlans')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(plan => (
            <Card key={plan.id} className="border border-border bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{plan.title}</h4>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => resetForm(plan)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Edit className="size-3.5" />
                    </button>
                    <button onClick={() => handleDelete(plan)} className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {plan.content_type && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_STYLES[plan.content_type] || 'bg-muted text-muted-foreground'}`}>
                      {t(`closedClients.plan.${plan.content_type}`)}
                    </span>
                  )}
                  <button
                    onClick={() => handleStatusToggle(plan)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLES[plan.status]}`}
                    title="Click to cycle status"
                  >
                    {t(`closedClients.plan.${plan.status}`)}
                  </button>
                  {plan.scheduled_date && (
                    <span className="text-[10px] text-muted-foreground">{formatDate(plan.scheduled_date)}</span>
                  )}
                </div>

                {plan.drive_link && (
                  <a
                    href={plan.drive_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <ExternalLink className="size-3" /> {t('closedClients.plan.driveLink')}
                  </a>
                )}

                {plan.notes && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{plan.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingPlan ? t('closedClients.plan.editContent') : t('closedClients.plan.addContent')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>{t('closedClients.plan.contentTitle')}</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <Label>{t('closedClients.plan.description')}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={editingPlan ? "" : "col-span-2"}>
              <Label>{t('closedClients.plan.contentType')}</Label>
              <Select value={form.content_type || 'none'} onValueChange={(v) => setForm({ ...form, content_type: !v || v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {CONTENT_TYPES.map(ct => (
                    <SelectItem key={ct} value={ct}>{t(`closedClients.plan.${ct}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingPlan && (
              <div>
                <Label>{t('closedClients.plan.status')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: (v || 'draft') as 'draft' | 'approved' | 'published' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{t(`closedClients.plan.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label>{t('closedClients.plan.scheduledDate')}</Label>
            <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </div>
          <div>
            <Label>{t('closedClients.plan.driveLink')}</Label>
            <Input value={form.drive_link} onChange={(e) => setForm({ ...form, drive_link: e.target.value })} placeholder="https://drive.google.com/..." />
          </div>
          <div>
            <Label>{t('closedClients.plan.notes')}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { closedClientsApi } from '@/lib/api';
import { ClientReport } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  Plus,
  Edit,
  Trash2,
  BarChart3,
  Loader2,
} from 'lucide-react';

interface ClosedClientReportProps {
  clientId: string;
  reports: ClientReport[];
  onRefresh: () => void;
}

export default function ClosedClientReport({ clientId, reports, onRefresh }: ClosedClientReportProps) {
  const { t, locale } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ClientReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    report_month: '',
    views: '',
    interactions: '',
    messages: '',
    num_posts: '',
    num_reels: '',
    num_stories: '',
    num_photos: '',
    notes: '',
  });

  const resetForm = (report?: ClientReport) => {
    if (report) {
      setForm({
        report_month: report.report_month.substring(0, 7), // YYYY-MM
        views: report.views.toString(),
        interactions: report.interactions.toString(),
        messages: report.messages.toString(),
        num_posts: report.num_posts.toString(),
        num_reels: report.num_reels.toString(),
        num_stories: report.num_stories.toString(),
        num_photos: report.num_photos.toString(),
        notes: report.notes || '',
      });
      setEditingReport(report);
    } else {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setForm({
        report_month: monthStr,
        views: '',
        interactions: '',
        messages: '',
        num_posts: '',
        num_reels: '',
        num_stories: '',
        num_photos: '',
        notes: ''
      });
      setEditingReport(null);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.report_month) return;
    setSubmitting(true);
    try {
      const data = {
        report_month: form.report_month + '-01',
        views: parseInt(form.views) || 0,
        interactions: parseInt(form.interactions) || 0,
        messages: parseInt(form.messages) || 0,
        num_posts: parseInt(form.num_posts) || 0,
        num_reels: parseInt(form.num_reels) || 0,
        num_stories: parseInt(form.num_stories) || 0,
        num_photos: parseInt(form.num_photos) || 0,
        notes: form.notes,
      };
      if (editingReport) {
        await closedClientsApi.updateReport(clientId, editingReport.id, data);
      } else {
        await closedClientsApi.createReport(clientId, data);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save report', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (report: ClientReport) => {
    if (!confirm(t('closedClients.report.deleteConfirm'))) return;
    try {
      await closedClientsApi.deleteReport(clientId, report.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete report', err);
    }
  };

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  };



  // Sorted for trend (oldest first)
  const sortedForTrend = useMemo(() => [...reports].sort((a, b) => a.report_month.localeCompare(b.report_month)), [reports]);

  // Simple bar chart max
  const maxViews = useMemo(() => Math.max(...sortedForTrend.map(r => r.views), 1), [sortedForTrend]);
  const maxInteractions = useMemo(() => Math.max(...sortedForTrend.map(r => r.interactions), 1), [sortedForTrend]);
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.report.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('closedClients.report.subtitle')}</p>
        </div>
        <Button onClick={() => resetForm()} size="sm">
          <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('closedClients.report.addReport')}
        </Button>
      </div>
      {sortedForTrend.length > 1 && (
        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="size-4 text-indigo-500" /> {t('closedClients.report.monthlyTrend')}
            </h4>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-end gap-2 h-40 min-w-[400px] md:min-w-0">
                {sortedForTrend.map(r => {
                  const viewsH = (r.views / maxViews) * 100;
                  const interH = (r.interactions / maxInteractions) * 100;
                  const monthLabel = new Date(r.report_month + 'T00:00:00').toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
                  return (
                    <div key={r.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="flex items-end gap-0.5 w-full justify-center h-32">
                        <div
                          className="w-3 bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t transition-all"
                          style={{ height: `${Math.max(viewsH, 4)}%` }}
                          title={`${t('closedClients.report.views')}: ${r.views}`}
                        />
                        <div
                          className="w-3 bg-gradient-to-t from-violet-500 to-violet-400 rounded-t transition-all"
                          style={{ height: `${Math.max(interH, 4)}%` }}
                          title={`${t('closedClients.report.interactions')}: ${r.interactions}`}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{monthLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-indigo-500" />
                <span className="text-[10px] text-muted-foreground">{t('closedClients.report.views')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-violet-500" />
                <span className="text-[10px] text-muted-foreground">{t('closedClients.report.interactions')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Section - Responsive */}
      {reports.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t('closedClients.report.noReports')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.month')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.views')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.interactions')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.messages')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.posts')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.reels')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.stories')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('closedClients.report.photos')}</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{formatMonth(r.report_month)}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.views.toLocaleString()}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.interactions.toLocaleString()}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.messages.toLocaleString()}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.num_posts}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.num_reels}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.num_stories}</td>
                      <td className="text-center px-3 py-3 text-foreground">{r.num_photos}</td>
                      <td className="text-center px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => resetForm(r)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={t('common.edit')}>
                            <Edit className="size-3.5" />
                          </button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors" title={t('common.delete')}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card List View */}
          <div className="flex flex-col gap-4 md:hidden">
            {reports.map(r => (
              <Card key={r.id} className="border border-border bg-card shadow-xs">
                <CardContent className="p-4 flex flex-col gap-4 text-start">
                  {/* Card Header: Month name & action buttons */}
                  <div className="flex items-center justify-between border-b pb-2 border-border/60">
                    <h5 className="font-bold text-sm text-foreground">{formatMonth(r.report_month)}</h5>
                    <div className="flex items-center gap-1">
                      <button onClick={() => resetForm(r)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={t('common.edit')}>
                        <Edit className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors" title={t('common.delete')}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.views')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.views.toLocaleString()}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.interactions')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.interactions.toLocaleString()}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.messages')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.messages.toLocaleString()}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.posts')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.num_posts}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.reels')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.num_reels}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.stories')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.num_stories}</span>
                    </div>
                    <div className="bg-muted/20 rounded-md p-2.5 flex flex-col gap-0.5 col-span-2">
                      <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('closedClients.report.photos')}</span>
                      <span className="font-bold text-foreground text-xs mt-0.5">{r.num_photos}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {r.notes && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 border border-border p-2.5 rounded-lg text-xs leading-relaxed">
                      <div className="font-semibold text-muted-foreground mb-1">{t('closedClients.report.notes') || 'Notes'}</div>
                      <p className="text-foreground italic whitespace-pre-wrap">{r.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingReport ? t('closedClients.report.editReport') : t('closedClients.report.addReport')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>{t('closedClients.report.month')}</Label>
            <Input type="month" value={form.report_month} onChange={(e) => setForm({ ...form, report_month: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{t('closedClients.report.views')}</Label>
              <Input type="number" min={0} value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.interactions')}</Label>
              <Input type="number" min={0} value={form.interactions} onChange={(e) => setForm({ ...form, interactions: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.messages')}</Label>
              <Input type="number" min={0} value={form.messages} onChange={(e) => setForm({ ...form, messages: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.posts')}</Label>
              <Input type="number" min={0} value={form.num_posts} onChange={(e) => setForm({ ...form, num_posts: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.reels')}</Label>
              <Input type="number" min={0} value={form.num_reels} onChange={(e) => setForm({ ...form, num_reels: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.stories')}</Label>
              <Input type="number" min={0} value={form.num_stories} onChange={(e) => setForm({ ...form, num_stories: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('closedClients.report.photos')}</Label>
              <Input type="number" min={0} value={form.num_photos} onChange={(e) => setForm({ ...form, num_photos: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t('closedClients.report.notes')}</Label>
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

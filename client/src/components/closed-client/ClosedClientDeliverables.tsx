'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { clientsApi } from '@/lib/api';
import { Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  FileText,
  Calendar,
  Loader2,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ClosedClientDeliverablesProps {
  client: Client;
  onRefresh: () => void;
}

export default function ClosedClientDeliverables({ client, onRefresh }: ClosedClientDeliverablesProps) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  const isAdmin = user && ['owner', 'team_leader', 'account_manager', 'content_creator'].includes(user.role);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [form, setForm] = useState({
    content_plan_link: '',
    num_posts: 0,
    num_reels: 0,
    num_stories: 0,
    num_photos: 0,
    other_deliverables: '',
    deliverables_schedule: {
      posts: [] as string[],
      reels: [] as string[],
      stories: [] as string[],
      photos: [] as string[],
    },
  });

  // Sync state with client prop
  useEffect(() => {
    if (client) {
      setForm({
        content_plan_link: client.content_plan_link || '',
        num_posts: client.num_posts || 0,
        num_reels: client.num_reels || 0,
        num_stories: client.num_stories || 0,
        num_photos: client.num_photos || 0,
        other_deliverables: client.other_deliverables || '',
        deliverables_schedule: {
          posts: client.deliverables_schedule?.posts || [],
          reels: client.deliverables_schedule?.reels || [],
          stories: client.deliverables_schedule?.stories || [],
          photos: client.deliverables_schedule?.photos || [],
        },
      });
    }
  }, [client]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await clientsApi.update(client.id, form);
      setSuccessMsg(locale === 'ar' ? 'تم حفظ التغييرات بنجاح!' : 'Changes saved successfully!');
      onRefresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || (locale === 'ar' ? 'فشل حفظ التغييرات' : 'Failed to save changes'));
    } finally {
      setSubmitting(false);
    }
  };

  const getDayNumber = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '' : String(d.getDate());
    } catch {
      return '';
    }
  };

  if (!client) return null;

  return (
    <div className="flex flex-col gap-6 text-start fade-in">
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs p-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Deliverables Panel */}
      <div className="flex flex-col gap-6">
        {isAdmin ? (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <h3 className="text-sm font-bold text-foreground">
                ⚙️ {t('clients.monthlyDeliverablesSetup') || 'Onboarding Package Details'}
              </h3>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                {/* Google Content Plan Link */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="content_plan_link" className="font-semibold text-xs flex items-center justify-between">
                    <span>{t('clients.contentPlanLink')}</span>
                    {form.content_plan_link && (
                      <a
                        href={form.content_plan_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 font-bold hover:underline"
                      >
                        {locale === 'ar' ? 'فتح الرابط ↗' : 'Open Link ↗'}
                      </a>
                    )}
                  </Label>
                  <Input
                    id="content_plan_link"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={form.content_plan_link}
                    onChange={(e) => setForm({ ...form, content_plan_link: e.target.value })}
                  />
                </div>

                {/* Numerical Limits */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      🎬 {t('clients.deliverables') || 'Monthly Targets'}
                    </Label>
                    {(form.num_posts > 0 || form.num_reels > 0 || form.num_stories > 0 || form.num_photos > 0) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScheduleModalOpen(true)}
                        className="h-7 text-xs flex items-center gap-1 font-semibold"
                      >
                        <Calendar className="size-3" />
                        {t('clients.configureSchedule') || 'Configure Schedule Outline'}
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="num_posts" className="text-xs">{t('clients.numPosts')}</Label>
                      <Input
                        id="num_posts"
                        type="number"
                        min="0"
                        value={form.num_posts}
                        onChange={(e) => setForm({ ...form, num_posts: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="num_reels" className="text-xs">{t('clients.numReels')}</Label>
                      <Input
                        id="num_reels"
                        type="number"
                        min="0"
                        value={form.num_reels}
                        onChange={(e) => setForm({ ...form, num_reels: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="num_stories" className="text-xs">{t('clients.numStories')}</Label>
                      <Input
                        id="num_stories"
                        type="number"
                        min="0"
                        value={form.num_stories}
                        onChange={(e) => setForm({ ...form, num_stories: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="num_photos" className="text-xs">{t('clients.numPhotos')}</Label>
                      <Input
                        id="num_photos"
                        type="number"
                        min="0"
                        value={form.num_photos}
                        onChange={(e) => setForm({ ...form, num_photos: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                {/* Other Deliverables */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="other_deliverables" className="font-semibold text-xs">
                    {t('clients.otherDeliverables')}
                  </Label>
                  <Input
                    id="other_deliverables"
                    placeholder="e.g. Brochures, Brand Book, Social Graphics..."
                    value={form.other_deliverables}
                    onChange={(e) => setForm({ ...form, other_deliverables: e.target.value })}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end pt-2 border-t mt-2">
                  <Button type="submit" disabled={submitting} className="gap-1.5 font-bold">
                    {submitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    {submitting ? t('common.loading') : t('common.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-foreground">
                🎯 {t('clients.monthlyDeliverablesSetup') || 'Monthly Onboarding Package'}
              </h3>
              {client.content_plan_link && (
                <a
                  href={client.content_plan_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 font-bold hover:underline"
                >
                  📄 {locale === 'ar' ? 'خطة المحتوى ↗' : 'Content Plan Link ↗'}
                </a>
              )}
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-6">
              {/* Visual Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: t('clients.numPosts'), val: client.num_posts || 0, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
                  { label: t('clients.numReels'), val: client.num_reels || 0, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20' },
                  { label: t('clients.numStories'), val: client.num_stories || 0, color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/20' },
                  { label: t('clients.numPhotos'), val: client.num_photos || 0, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/20' },
                ].map((s, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${s.color}`}>
                    <span className="text-2xl font-black">{s.val}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground mt-1">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Other Custom Deliverables */}
              {client.other_deliverables && (
                <div className="p-4 rounded-xl border bg-muted/20 text-start">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t('clients.otherDeliverables')}
                  </Label>
                  <p className="text-sm font-semibold mt-1 text-foreground">
                    {client.other_deliverables}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Schedule Configuration Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={t('clients.configureScheduleTitle') || 'Configure Deliverables Schedule'}
        maxWidth={600}
      >
        <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto px-1 py-2 text-start">
          <p className="text-xs text-muted-foreground">
            {t('clients.scheduleExplanation') || 'Pick calendar dates for each deliverable item. The system will use these day numbers to auto-schedule outline tasks for the upcoming months.'}
          </p>

          {(['posts', 'reels', 'stories', 'photos'] as const).map(typeKey => {
            const count = form[
              typeKey === 'posts' ? 'num_posts' :
              typeKey === 'reels' ? 'num_reels' :
              typeKey === 'stories' ? 'num_stories' : 'num_photos'
            ] || 0;

            if (count === 0) return null;

            const labelMap = {
              posts: t('clients.posts') || 'Posts',
              reels: t('clients.reels') || 'Reels',
              stories: t('clients.stories') || 'Stories',
              photos: t('clients.photos') || 'Photos',
            };

            const singularLabelMap = {
              posts: t('closedClients.plan.post') || 'Post',
              reels: t('closedClients.plan.reel') || 'Reel',
              stories: t('closedClients.plan.story') || 'Story',
              photos: t('closedClients.plan.photo') || 'Photo',
            };

            return (
              <div key={typeKey} className="border-t border-border pt-4 first:border-0 first:pt-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex justify-between items-center">
                  <span>{labelMap[typeKey]} ({count})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: count }).map((_, idx) => {
                    const value = form.deliverables_schedule?.[typeKey]?.[idx] || '';
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">
                          {singularLabelMap[typeKey]} {idx + 1} {value ? `(Day: ${getDayNumber(value)})` : ''}
                        </Label>
                        <Input
                          type="date"
                          value={value}
                          onChange={(e) => {
                            const currentList = [...(form.deliverables_schedule?.[typeKey] || [])];
                            currentList[idx] = e.target.value;
                            setForm({
                              ...form,
                              deliverables_schedule: {
                                ...form.deliverables_schedule,
                                [typeKey]: currentList,
                              },
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button type="button" onClick={() => setScheduleModalOpen(false)} className="font-bold">
              {t('common.done') || 'Done'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

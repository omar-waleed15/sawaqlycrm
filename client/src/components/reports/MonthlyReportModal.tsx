'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { reportsApi } from '@/lib/api';
import { ClientReport } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  FileText,
  Film,
  Loader2,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  month: string; // YYYY-MM
  existingReport: ClientReport | null;
  autoCounts?: { num_posts: number; num_reels: number; num_stories: number; num_photos: number };
  onSaved: () => void;
}

export default function MonthlyReportModal({
  isOpen,
  onClose,
  client,
  month,
  existingReport,
  autoCounts,
  onSaved,
}: MonthlyReportModalProps) {
  const { t, locale } = useLanguage();

  const [posts, setPosts] = useState<string>('0');
  const [reels, setReels] = useState<string>('0');
  const [stories, setStories] = useState<string>('0');
  const [adSpend, setAdSpend] = useState<string>('0');
  const [roas, setRoas] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  // Meta Insights file & preview
  const [metaFile, setMetaFile] = useState<File | null>(null);
  const [metaPreview, setMetaPreview] = useState<string | null>(null);
  const metaInputRef = useRef<HTMLInputElement>(null);

  // Ads screenshot file & preview
  const [adsFile, setAdsFile] = useState<File | null>(null);
  const [adsPreview, setAdsPreview] = useState<string | null>(null);
  const adsInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (existingReport) {
        setPosts(String(existingReport.num_posts || autoCounts?.num_posts || 0));
        setReels(String(existingReport.num_reels || autoCounts?.num_reels || 0));
        setStories(String(existingReport.num_stories || autoCounts?.num_stories || 0));
        setAdSpend(String(existingReport.ad_spend || 0));
        setRoas(String(existingReport.roas || 0));
        setNotes(existingReport.notes || '');
        setMetaPreview(existingReport.meta_insights_image_url || null);
        setAdsPreview(existingReport.ads_screenshot_url || null);
      } else {
        setPosts(String(autoCounts?.num_posts || 0));
        setReels(String(autoCounts?.num_reels || 0));
        setStories(String(autoCounts?.num_stories || 0));
        setAdSpend('0');
        setRoas('0');
        setNotes('');
        setMetaPreview(null);
        setAdsPreview(null);
      }
      setMetaFile(null);
      setAdsFile(null);
    }
  }, [isOpen, existingReport, autoCounts]);

  if (!isOpen || !client) return null;

  const handleMetaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMetaFile(file);
      setMetaPreview(URL.createObjectURL(file));
    }
  };

  const handleAdsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAdsFile(file);
      setAdsPreview(URL.createObjectURL(file));
    }
  };

  const handleAutoSync = () => {
    if (autoCounts) {
      setPosts(String(autoCounts.num_posts || 0));
      setReels(String(autoCounts.num_reels || 0));
      setStories(String(autoCounts.num_stories || 0));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('client_id', client.id);
      fd.append('report_month', month);
      fd.append('num_posts', posts || '0');
      fd.append('num_reels', reels || '0');
      fd.append('num_stories', stories || '0');
      fd.append('ad_spend', adSpend || '0');
      fd.append('roas', roas || '0');
      fd.append('notes', notes || '');

      if (metaFile) {
        fd.append('meta_insights_file', metaFile);
      } else if (metaPreview && !metaFile) {
        fd.append('meta_insights_image_url', metaPreview);
      }

      if (adsFile) {
        fd.append('ads_screenshot_file', adsFile);
      } else if (adsPreview && !adsFile) {
        fd.append('ads_screenshot_url', adsPreview);
      }

      await reportsApi.saveMonthlyReport(fd);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save monthly report:', err);
      setErrorMsg(err.message || 'Failed to save monthly report');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = `${existingReport ? t('reports.editMonthlyReport') : t('reports.createMonthlyReport')} - ${client.name} (${month})`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth={680}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSubmit}
            className="bg-[#1D61E7] hover:bg-blue-700 text-white font-semibold gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                {t('common.save')}
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-start">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 text-rose-600 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* ── 1. Published Content Deliverables Counters ── */}
        <div className="flex flex-col gap-2.5 p-3.5 rounded-lg bg-muted/20 border border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Film className="size-3.5 text-indigo-500" />
              {t('reports.deliverablesPublished')}
            </Label>
            {autoCounts && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-indigo-600 hover:text-indigo-700 gap-1 font-semibold"
                onClick={handleAutoSync}
              >
                <Sparkles className="size-3" />
                {t('reports.autoSync')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rep_posts" className="text-xs text-muted-foreground">{t('clients.posts')}</Label>
              <Input
                id="rep_posts"
                type="number"
                min="0"
                value={posts}
                onChange={(e) => setPosts(e.target.value)}
                className="h-9 text-xs font-bold bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rep_reels" className="text-xs text-muted-foreground">{t('clients.reels')}</Label>
              <Input
                id="rep_reels"
                type="number"
                min="0"
                value={reels}
                onChange={(e) => setReels(e.target.value)}
                className="h-9 text-xs font-bold bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rep_stories" className="text-xs text-muted-foreground">{t('clients.stories')}</Label>
              <Input
                id="rep_stories"
                type="number"
                min="0"
                value={stories}
                onChange={(e) => setStories(e.target.value)}
                className="h-9 text-xs font-bold bg-background"
              />
            </div>
          </div>
        </div>

        {/* ── 2. Meta Insights Screenshot Upload ── */}
        <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-muted/20 border border-border/50">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ImageIcon className="size-3.5 text-indigo-500" />
            {t('reports.metaInsights')}
          </Label>

          <input
            type="file"
            ref={metaInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleMetaFileChange}
          />

          {metaPreview ? (
            <div className="relative group rounded-lg overflow-hidden border border-border bg-black/5 max-h-48 flex items-center justify-center">
              <img
                src={metaPreview}
                alt="Meta Insights Preview"
                className="max-h-48 w-auto object-contain"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7"
                  onClick={() => metaInputRef.current?.click()}
                >
                  {t('reports.replacePhoto')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="text-xs h-7"
                  onClick={() => {
                    setMetaFile(null);
                    setMetaPreview(null);
                  }}
                >
                  {t('reports.removePhoto')}
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => metaInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-5 border border-dashed border-border hover:border-indigo-400 rounded-lg cursor-pointer bg-card hover:bg-muted/30 transition-all text-center gap-1.5"
            >
              <UploadCloud className="size-6 text-muted-foreground/70" />
              <span className="text-xs font-semibold text-foreground">
                {t('reports.uploadPhoto')}
              </span>
              <span className="text-[10px] text-muted-foreground">PNG, JPG, WebP</span>
            </div>
          )}
        </div>

        {/* ── 3. Ads Performance & Screenshot ── */}
        <div className="flex flex-col gap-2.5 p-3.5 rounded-lg bg-muted/20 border border-border/50">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-purple-500" />
            {t('reports.adsPerformance')}
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rep_ad_spend" className="text-xs text-muted-foreground">{t('reports.adSpend')}</Label>
              <Input
                id="rep_ad_spend"
                type="number"
                step="any"
                min="0"
                placeholder={t('reports.adSpendPlaceholder')}
                value={adSpend}
                onChange={(e) => setAdSpend(e.target.value)}
                className="h-9 text-xs font-bold bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rep_roas" className="text-xs text-muted-foreground">{t('reports.roas')}</Label>
              <Input
                id="rep_roas"
                type="number"
                step="any"
                min="0"
                placeholder={t('reports.roasPlaceholder')}
                value={roas}
                onChange={(e) => setRoas(e.target.value)}
                className="h-9 text-xs font-bold bg-background"
              />
            </div>
          </div>

          {/* Screenshot */}
          <input
            type="file"
            ref={adsInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAdsFileChange}
          />

          {adsPreview ? (
            <div className="relative group rounded-lg overflow-hidden border border-border bg-black/5 max-h-48 flex items-center justify-center mt-1">
              <img
                src={adsPreview}
                alt="Ads Manager Screenshot"
                className="max-h-48 w-auto object-contain"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7"
                  onClick={() => adsInputRef.current?.click()}
                >
                  {t('reports.replacePhoto')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="text-xs h-7"
                  onClick={() => {
                    setAdsFile(null);
                    setAdsPreview(null);
                  }}
                >
                  {t('reports.removePhoto')}
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => adsInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-purple-400 rounded-lg cursor-pointer bg-card hover:bg-muted/30 transition-all text-center gap-1 mt-1"
            >
              <UploadCloud className="size-5 text-muted-foreground/70" />
              <span className="text-xs font-semibold text-foreground">
                {t('reports.adsScreenshot')}
              </span>
              <span className="text-[10px] text-muted-foreground">Ads Manager Screenshot</span>
            </div>
          )}
        </div>

        {/* ── 4. Executive Notes ── */}
        <div className="flex flex-col gap-1.5 p-3.5 rounded-lg bg-muted/20 border border-border/50">
          <Label htmlFor="rep_notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="size-3.5 text-amber-500" />
            {t('reports.executiveNotes')}
          </Label>
          <Textarea
            id="rep_notes"
            rows={3}
            placeholder={t('reports.executiveNotesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs bg-background"
          />
        </div>
      </form>
    </Modal>
  );
}

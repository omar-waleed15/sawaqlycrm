'use client';

import { useState, useEffect } from 'react';
import { campaignsApi } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  Megaphone,
  Plus,
  Trash2,
  Play,
  Pause,
  Upload,
  Loader2,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';

interface CampaignStats {
  pending_count: number;
  success_count: number;
  failed_count: number;
}

interface Campaign {
  id: string;
  wapilot_campaign_id: number;
  name: string;
  status: 'pending' | 'sending' | 'paused' | 'completed';
  recipient_count: number;
  created_at: string;
  csv_file_url?: string | null;
  stats?: CampaignStats;
}

export default function CampaignsPage() {
  const { locale, t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  // Navigation Guard: only owner
  useEffect(() => {
    if (user && user.role !== 'owner') {
      router.replace('/dashboard');
    }
  }, [user, router]);
  
  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewNumberCount, setPreviewNumberCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch Campaigns list
  const loadCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const data = await campaignsApi.list();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    const hasActive = campaigns.some(c => c.status === 'sending');
    if (!hasActive) return;

    const interval = setInterval(() => {
      loadCampaigns(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [campaigns]);

  // Handle client-side file reading to preview parsed numbers count
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setPreviewNumberCount(null);
    setError('');

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        let count = 0;
        
        let skipHeader = false;
        if (lines.length > 0 && (lines[0].toLowerCase().includes('phone') || lines[0].toLowerCase().includes('number') || lines[0].toLowerCase().includes('mobile'))) {
          skipHeader = true;
        }

        for (let i = skipHeader ? 1 : 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const cols = line.split(/[,;\t]/);
          for (const col of cols) {
            const cleaned = col.trim().replace(/[+\s-()'"\\]/g, '');
            if (/^\d{8,15}$/.test(cleaned)) {
              count++;
              break;
            }
          }
        }
        setPreviewNumberCount(count);
      };
      reader.readAsText(file);
    }
  };

  // Submit new campaign
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(locale === 'ar' ? 'اسم الحملة مطلوب' : 'Campaign name is required');
      return;
    }
    if (!messageTemplate.trim()) {
      setError(locale === 'ar' ? 'نص الرسالة مطلوب' : 'Message template is required');
      return;
    }
    if (!selectedFile) {
      setError(locale === 'ar' ? 'الرجاء اختيار ملف أرقام العملاء' : 'Please select a recipient numbers list file');
      return;
    }
    if (previewNumberCount === 0) {
      setError(locale === 'ar' ? 'الملف المختار لا يحتوي على أي أرقام هواتف صالحة' : 'The selected file contains no valid phone numbers.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await campaignsApi.create(name.trim(), messageTemplate.trim(), selectedFile);
      setIsCreateOpen(false);
      setName('');
      setMessageTemplate('');
      setSelectedFile(null);
      setPreviewNumberCount(null);
      loadCampaigns();
    } catch (err: any) {
      console.error(err);
      setError(err.message || (locale === 'ar' ? 'فشل إنشاء الحملة' : 'Failed to create campaign'));
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Start / Pause Campaign Actions
  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause') => {
    try {
      setRefreshing(true);
      await campaignsApi.triggerAction(campaignId, action);
      loadCampaigns(true);
    } catch (err) {
      console.error(`Failed to trigger campaign action ${action}`, err);
    } finally {
      setRefreshing(false);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه الحملة نهائياً من النظام؟' : 'Are you sure you want to permanently delete this campaign?')) return;
    try {
      setLoading(true);
      await campaignsApi.delete(campaignId);
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (err) {
      console.error('Failed to delete campaign', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container fade-in flex flex-col gap-6 w-full min-h-[70vh] text-start font-sans pb-12">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="size-5 text-indigo-500" />
            <span>{locale === 'ar' ? 'حملات الواتساب الجماعية' : 'WhatsApp Broadcast Campaigns'}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'أنشئ حملات إرسال جماعي، ارفع قوائم العملاء، وتابع سير الرسائل لحظة بلحظة.' 
              : 'Create broadcast campaigns, upload phone number files, and track message delivery status in real-time.'}
          </p>
        </div>

        {/* Action Button */}
        <Button onClick={() => setIsCreateOpen(true)} size="sm" className="text-xs gap-1.5 py-4 cursor-pointer">
          <Plus className="size-4" />
          <span>{locale === 'ar' ? 'إنشاء حملة جديدة' : 'Create Campaign'}</span>
        </Button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed rounded-2xl bg-card/10">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold">{locale === 'ar' ? 'جاري تحميل الحملات...' : 'Loading campaigns...'}</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-28 text-muted-foreground border border-dashed rounded-2xl bg-card/20 flex flex-col items-center justify-center gap-2">
          <Megaphone className="size-12 stroke-[1.2] text-muted-foreground/50 mb-2" />
          <h3 className="text-sm font-bold text-foreground">{locale === 'ar' ? 'لا توجد حملات' : 'No Campaigns Created'}</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'ar' 
              ? 'لم تقم بإنشاء أي حملة بعد. اضغط على الزر أعلاه للبدء بالبث الجماعي.' 
              : 'No broadcast campaigns have been created yet. Click the button above to start your first campaign.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(c => {
            const successCount = c.stats?.success_count || 0;
            const failedCount = c.stats?.failed_count || 0;
            const pendingCount = c.stats?.pending_count || 0;
            const totalRecipients = c.recipient_count;
            const progress = totalRecipients > 0 ? Math.round(((successCount + failedCount) / totalRecipients) * 100) : 0;
            
            // Auto complete indicator
            const isCompleted = c.status === 'completed' || (totalRecipients > 0 && successCount + failedCount >= totalRecipients);

            return (
              <Card key={c.id} className="hover:shadow-md transition-all duration-200 border border-border bg-card flex flex-col justify-between overflow-hidden">
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* Campaign Card Header */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-bold text-sm text-foreground truncate">{c.name}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {c.wapilot_campaign_id}</span>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase shrink-0 font-sans ${
                      isCompleted
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200/50'
                        : c.status === 'sending'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 flex items-center gap-1'
                        : c.status === 'paused'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200/50'
                    }`}>
                      {c.status === 'sending' && <Loader2 className="size-2.5 animate-spin" />}
                      {isCompleted 
                        ? (locale === 'ar' ? 'مكتملة' : 'Completed')
                        : c.status === 'sending'
                        ? (locale === 'ar' ? 'جاري الإرسال' : 'Sending')
                        : c.status === 'paused'
                        ? (locale === 'ar' ? 'متوقفة مؤقتاً' : 'Paused')
                        : (locale === 'ar' ? 'في الانتظار' : 'Pending')}
                    </span>
                  </div>

                  {/* Campaign Stats Bars & Percentages */}
                  <div className="flex flex-col gap-2 bg-muted/20 p-3.5 border border-border/40 rounded-xl font-mono text-[10px] font-bold text-muted-foreground">
                    <div className="flex justify-between items-center mb-1">
                      <span>{locale === 'ar' ? 'نسبة التقدم' : 'PROGRESS'}</span>
                      <span className="text-foreground">{progress}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-muted/65 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${totalRecipients > 0 ? (successCount / totalRecipients) * 100 : 0}%` }} />
                      <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${totalRecipients > 0 ? (failedCount / totalRecipients) * 100 : 0}%` }} />
                    </div>
                    
                    {/* Counter Metrics */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/30 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-foreground font-extrabold">{totalRecipients}</span>
                        <span className="text-[8px] font-sans text-muted-foreground font-semibold mt-0.5">{locale === 'ar' ? 'الإجمالي' : 'Total'}</span>
                      </div>
                      <div className="flex flex-col items-center border-x border-border/30">
                        <span className="text-[11px] text-emerald-600 font-extrabold">{successCount}</span>
                        <span className="text-[8px] font-sans text-emerald-600/80 font-semibold mt-0.5">{locale === 'ar' ? 'نجاح' : 'Success'}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-rose-600 font-extrabold">{failedCount}</span>
                        <span className="text-[8px] font-sans text-rose-600/80 font-semibold mt-0.5">{locale === 'ar' ? 'فشل' : 'Failed'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Campaign Card Footer Info / Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-1">
                    <span className="text-[9px] font-semibold text-muted-foreground flex items-center gap-1 font-mono">
                      <Calendar className="size-3 text-muted-foreground/75" />
                      {new Date(c.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                    </span>

                    {/* Controls Actions */}
                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        c.status === 'sending' ? (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                            onClick={() => handleCampaignAction(c.id, 'pause')}
                            disabled={refreshing}
                            title={locale === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                          >
                            <Pause className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="icon"
                            className="size-8 text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                            onClick={() => handleCampaignAction(c.id, 'start')}
                            disabled={refreshing}
                            title={locale === 'ar' ? 'بدء البث' : 'Start'}
                          >
                            <Play className="size-3.5 fill-white" />
                          </Button>
                        )
                      )}

                      {c.csv_file_url && (
                        <a
                          href={c.csv_file_url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-indigo-600 hover:bg-indigo-55 dark:hover:bg-indigo-950/20 transition-all cursor-pointer"
                          title={locale === 'ar' ? 'تحميل قائمة الأرقام' : 'Download Recipient List'}
                        >
                          <Download className="size-4" />
                        </a>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        onClick={() => handleDeleteCampaign(c.id)}
                        disabled={refreshing}
                        title={locale === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE CAMPAIGN DIALOG MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setError('');
          setName('');
          setMessageTemplate('');
          setSelectedFile(null);
          setPreviewNumberCount(null);
        }}
        title={locale === 'ar' ? 'إنشاء حملة إعلانية جماعية' : 'Create Broadcast Campaign'}
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 text-start font-sans">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-md font-semibold">
              {error}
            </div>
          )}

          {/* Campaign Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="camp-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'اسم الحملة' : 'Campaign Name'}</label>
            <input
              id="camp-name"
              type="text"
              className="w-full bg-card py-2 px-3 text-xs font-semibold rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
              placeholder={locale === 'ar' ? 'مثال: عروض الصيف 2026' : 'e.g. Summer Promo 2026'}
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* Message Text Template */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="camp-template" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'نص الرسالة' : 'Message Content'}</label>
            <textarea
              id="camp-template"
              className="w-full min-h-[100px] bg-card text-xs p-3 rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-sans leading-relaxed resize-y"
              placeholder={locale === 'ar' ? 'اكتب الرسالة الإعلانية التي سيتم إرسالها للعملاء...' : 'Type the text template that will be sent to all recipient phone numbers...'}
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* File Upload picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'قائمة أرقام الهواتف (CSV / TXT)' : 'Recipient Phone List (CSV / TXT)'}</label>
            
            <div className="relative border-2 border-dashed border-border/80 hover:border-indigo-400 dark:hover:border-indigo-800 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/20 flex flex-col items-center justify-center gap-1.5 group">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={submitting}
              />
              <Upload className="size-8 stroke-[1.2] text-muted-foreground group-hover:text-indigo-500 transition-colors" />
              
              <span className="text-xs font-bold text-foreground mt-1">
                {selectedFile ? selectedFile.name : (locale === 'ar' ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag & drop your file here, or click to browse')}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {locale === 'ar' ? 'يدعم ملفات CSV أو ملفات النص TXT (رقم واحد بالسطر)' : 'Supports CSV files or raw text TXT files (one phone number per line)'}
              </span>
            </div>

            {/* Parsing preview alert */}
            {previewNumberCount !== null && (
              <div className="flex items-center gap-2 mt-2 px-3.5 py-2.5 rounded-lg border bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/50 dark:text-indigo-400 text-xs font-bold font-sans">
                <Sparkles className="size-4 shrink-0 text-indigo-500" />
                <span>
                  {locale === 'ar' 
                    ? `نجاح: تم رصد عدد ${previewNumberCount} رقم عميل جاهز للإرسال.` 
                    : `Success: Found ${previewNumberCount} valid customer phone numbers in list.`}
                </span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex gap-3 justify-end pt-3 border-t mt-2 shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsCreateOpen(false);
                setError('');
                setName('');
                setMessageTemplate('');
                setSelectedFile(null);
                setPreviewNumberCount(null);
              }}
              disabled={submitting}
              className="cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || previewNumberCount === 0} className="cursor-pointer">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  <span>{locale === 'ar' ? 'جاري التحميل والإنشاء...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{locale === 'ar' ? 'إنشاء وتجهيز الحملة' : 'Create Campaign'}</span>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/lib/i18n';
import { reportsApi } from '@/lib/api';
import { ClientReport } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  Maximize2,
  FileText,
  Phone,
  Loader2,
  Image as ImageIcon,
  Archive,
  BarChart2,
} from 'lucide-react';
import MonthlyReportModal from './MonthlyReportModal';
import ImageLightboxModal from './ImageLightboxModal';

interface ClientWithReport {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  pipeline_stage?: string;
  num_posts?: number;
  num_reels?: number;
  num_stories?: number;
  num_photos?: number;
  logo_url?: string | null;
  report: ClientReport | null;
  auto_counts?: { num_posts: number; num_reels: number; num_stories: number; num_photos: number };
}

function getInitials(name: string): string {
  if (!name) return 'C';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function MonthlyReportsView() {
  const { t, locale } = useLanguage();

  // Current selected month: YYYY-MM
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const [clients, setClients] = useState<ClientWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'pending'>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<ClientWithReport | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  const fetchMonthlyReports = async (month: string) => {
    setLoading(true);
    try {
      const res = await reportsApi.getMonthlyReports(month);
      setClients(res.clients || []);
    } catch (err) {
      console.error('Failed to load monthly reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReports(selectedMonth);
  }, [selectedMonth]);

  // Month navigation helpers
  const isThisMonth = selectedMonth === currentMonthStr;

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleSetThisMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

  const handleSetLastMonth = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthTitle = (ym: string) => {
    try {
      const [year, month] = ym.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return ym;
    }
  };

  const handleOpenModal = (client: ClientWithReport) => {
    setActiveClient(client);
    setModalOpen(true);
  };

  const handleOpenLightbox = (url: string, title: string) => {
    setLightboxUrl(url);
    setLightboxTitle(title);
    setLightboxOpen(true);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm(t('reports.deleteReportConfirm') || 'Delete this report?')) return;
    try {
      await reportsApi.deleteMonthlyReport(reportId);
      fetchMonthlyReports(selectedMonth);
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  // Filtering
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Mobile client selector
      if (selectedClientId && selectedClientId !== 'all' && c.id !== selectedClientId) {
        return false;
      }

      const matchesSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === 'ready') return !!c.report;
      if (filterStatus === 'pending') return !c.report;
      return true;
    });
  }, [clients, searchQuery, selectedClientId, filterStatus]);

  const totalClients = clients.length;
  const completedReportsCount = clients.filter((c) => !!c.report).length;
  const pendingReportsCount = totalClients - completedReportsCount;

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. Top Bar: Search on desktop, Client Selector on mobile, Month Selector on right ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Desktop Search Input */}
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 rtl:left-auto rtl:right-3" />
          <Input
            type="text"
            placeholder={t('closedClients.searchPlaceholder') || 'Search clients...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rtl:pl-3 rtl:pr-9 bg-card border-border"
          />
        </div>

        {/* Mobile Client Selector */}
        <div className="w-full block sm:hidden">
          <Select value={selectedClientId} onValueChange={(val) => setSelectedClientId(val || 'all')}>
            <SelectTrigger className="w-full h-9 bg-card border-border text-xs">
              <SelectValue placeholder={t('reports.allClients') || 'All Clients'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('reports.allClients') || 'All Clients'} ({clients.length})
              </SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Selector matching DailyReportsView date controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-foreground"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              size="sm"
              variant={isThisMonth ? 'default' : 'ghost'}
              className={cn(
                "h-8 text-xs font-semibold px-2.5",
                isThisMonth && "bg-[#1D61E7] hover:bg-blue-700 text-white"
              )}
              onClick={handleSetThisMonth}
            >
              {t('reports.thisMonth')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs font-medium px-2.5 text-muted-foreground"
              onClick={handleSetLastMonth}
            >
              {t('reports.lastMonth')}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-foreground"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border text-foreground shadow-xs focus:outline-none"
          />

          <span className="text-xs text-muted-foreground font-medium hidden md:inline">
            {formatMonthTitle(selectedMonth)}
          </span>
        </div>
      </div>

      {/* ── 2. Reports Completed Filter Pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
            filterStatus === 'all'
              ? "bg-[#1D61E7] text-white shadow-xs"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {t('common.all')}
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
            filterStatus === 'all' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}>
            {totalClients}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ready')}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
            filterStatus === 'ready'
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
          {t('reports.reportReady')}
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
            filterStatus === 'ready' ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}>
            {completedReportsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('pending')}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
            filterStatus === 'pending'
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
          {t('reports.reportPending')}
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
            filterStatus === 'pending' ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          )}>
            {pendingReportsCount}
          </span>
        </button>
      </div>

      {/* ── 3. Client Cards Grid matching CRM design system ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-[#1D61E7]" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Archive className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? `No results for "${searchQuery}"` : (t('closedClients.noClients') || 'No clients found')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {filteredClients.map((client) => {
            const report = client.report;
            const hasReport = !!report;

            return (
              <Card
                key={client.id}
                className="transition-all duration-200 hover:shadow-md h-full flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden text-start"
              >
                <CardContent className="p-5 flex flex-col gap-4 flex-1">
                  {/* ── Header Row: Avatar, Name, Company, Phone & Status / Actions ── */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo / Initials Avatar */}
                      {client.logo_url ? (
                        <img
                          src={client.logo_url}
                          alt={client.name}
                          className="size-11 rounded-xl object-cover border border-border/80 shrink-0"
                        />
                      ) : (
                        <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                          {getInitials(client.name)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground leading-snug truncate" title={client.name}>
                          {client.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate" title={client.company || ''}>
                          {client.company || t('clients.privateClient') || 'Closed Client'}
                        </p>

                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Phone className="size-3.5 shrink-0 text-indigo-500/80" />
                            <a
                              href={`tel:${client.phone}`}
                              className="hover:text-foreground font-mono transition-colors truncate"
                              dir="ltr"
                            >
                              {client.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tracking-wide",
                          hasReport
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50"
                        )}
                      >
                        {hasReport ? t('reports.reportReady') : t('reports.reportPending')}
                      </span>

                      {/* Header Actions */}
                      {hasReport ? (
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                            onClick={() => handleOpenModal(client)}
                            title={t('reports.editMonthlyReport')}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-rose-600 rounded-lg"
                            onClick={() => handleDeleteReport(report.id)}
                            title={t('common.delete')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs font-semibold px-3 gap-1 bg-[#1D61E7] hover:bg-blue-700 text-white rounded-lg shadow-xs"
                          onClick={() => handleOpenModal(client)}
                        >
                          <Plus className="size-3.5" />
                          {t('reports.createMonthlyReport')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Deliverables Tracker matching ClientCard & closed-clients ── */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-start">
                        🎬 {t('reports.deliverablesPublished')}
                      </h4>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-0.5 text-start">
                      {[
                        {
                          label: t('clients.posts') || 'Posts',
                          done: report ? report.num_posts : 0,
                          total: client.num_posts ?? 0,
                          color: 'bg-indigo-500',
                        },
                        {
                          label: t('clients.reels') || 'Reels',
                          done: report ? report.num_reels : 0,
                          total: client.num_reels ?? 0,
                          color: 'bg-purple-500',
                        },
                        {
                          label: t('clients.stories') || 'Stories',
                          done: report ? report.num_stories : 0,
                          total: client.num_stories ?? 0,
                          color: 'bg-pink-500',
                        },
                      ].map((item) => {
                        const pct =
                          item.total > 0
                            ? Math.round((item.done / item.total) * 100)
                            : item.done > 0
                            ? 100
                            : 0;
                        const isComplete = item.total > 0 && item.done >= item.total;

                        return (
                          <div
                            key={item.label}
                            className="flex flex-col gap-1 p-2.5 rounded-lg bg-muted/20 border border-border/40"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80">
                              <span className="truncate">{item.label}</span>
                              <span
                                className={cn(
                                  "tabular-nums",
                                  isComplete
                                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                                    : "font-semibold text-foreground"
                                )}
                              >
                                {item.total > 0 ? `${item.done}/${item.total}` : item.done}
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                              <div
                                className={cn("h-full rounded-full transition-all duration-500", item.color)}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Performance Visuals (Meta Insights & Ads Performance) ── */}
                  {hasReport ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                      {/* Meta Insights Box */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/20 border border-border/40 text-start">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <ImageIcon className="size-3.5 text-indigo-500" />
                            {t('reports.metaInsights')}
                          </span>
                          {report.meta_insights_image_url && (
                            <span className="text-[9px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                              Attached
                            </span>
                          )}
                        </div>

                        {report.meta_insights_image_url ? (
                          <div
                            onClick={() =>
                              handleOpenLightbox(
                                report.meta_insights_image_url!,
                                `${client.name} - Meta Insights (${selectedMonth})`
                              )
                            }
                            className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-black/5 aspect-[16/10] flex items-center justify-center transition-all hover:shadow-xs"
                          >
                            <img
                              src={report.meta_insights_image_url}
                              alt="Meta Insights"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold backdrop-blur-[2px]">
                              <Maximize2 className="size-3.5" />
                              {t('reports.viewFullSize')}
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[16/10] rounded-lg border border-dashed border-border/70 flex flex-col items-center justify-center text-muted-foreground/60 text-xs gap-1.5 bg-muted/10">
                            <ImageIcon className="size-5 opacity-40" />
                            <span className="text-[11px] font-medium">No photo attached</span>
                          </div>
                        )}
                      </div>

                      {/* Ads Performance Box */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/20 border border-border/40 text-start">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <TrendingUp className="size-3.5 text-purple-500" />
                            {t('reports.adsPerformance')}
                          </span>
                          {report.ads_screenshot_url && (
                            <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                              Attached
                            </span>
                          )}
                        </div>

                        {/* Spend & ROAS stat strip */}
                        <div className="grid grid-cols-2 gap-2 bg-background border border-border/60 rounded-lg p-2 text-center text-xs shadow-2xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                              {t('reports.adSpend')}
                            </span>
                            <span className="font-extrabold text-foreground text-sm tabular-nums">
                              {report.ad_spend ? `${Number(report.ad_spend).toLocaleString()}` : '0'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                              {t('reports.roas')}
                            </span>
                            <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm tabular-nums">
                              {report.roas ? `${report.roas}x` : '0x'}
                            </span>
                          </div>
                        </div>

                        {report.ads_screenshot_url ? (
                          <div
                            onClick={() =>
                              handleOpenLightbox(
                                report.ads_screenshot_url!,
                                `${client.name} - Ads Performance (${selectedMonth})`
                              )
                            }
                            className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-black/5 aspect-[16/10] flex items-center justify-center transition-all hover:shadow-xs"
                          >
                            <img
                              src={report.ads_screenshot_url}
                              alt="Ads Manager"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold backdrop-blur-[2px]">
                              <Maximize2 className="size-3.5" />
                              {t('reports.viewFullSize')}
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[16/10] rounded-lg border border-dashed border-border/70 flex flex-col items-center justify-center text-muted-foreground/60 text-xs gap-1.5 bg-muted/10">
                            <TrendingUp className="size-5 opacity-40" />
                            <span className="text-[11px] font-medium">No screenshot attached</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-center gap-1 border border-dashed border-border/60 rounded-xl bg-muted/10">
                      <BarChart2 className="size-5 text-muted-foreground/50 mb-1" />
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('reports.noMonthlyReports')}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {formatMonthTitle(selectedMonth)}
                      </p>
                    </div>
                  )}

                  {/* ── Executive Notes ── */}
                  {report?.notes && (
                    <div className="bg-muted/20 border border-border/40 rounded-lg p-3 text-xs flex flex-col gap-1.5 text-start">
                      <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="size-3 text-amber-500" />
                        {t('reports.executiveNotes')}
                      </span>
                      <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {report.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal for creating/editing monthly report */}
      {activeClient && (
        <MonthlyReportModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          client={activeClient}
          month={selectedMonth}
          existingReport={activeClient.report}
          autoCounts={activeClient.auto_counts}
          onSaved={() => fetchMonthlyReports(selectedMonth)}
        />
      )}

      {/* Full screen Lightbox for image preview */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxUrl}
        title={lightboxTitle}
      />
    </div>
  );
}

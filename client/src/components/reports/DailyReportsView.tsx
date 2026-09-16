'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { reportsApi } from '@/lib/api';
import { ClientDailyLog } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Send,
  Trash2,
  Clock,
  Phone,
  Film,
  Building2,
  Loader2,
  Archive,
  Plus,
} from 'lucide-react';
import { formatCairoDate } from '@/lib/dateUtils';

interface ClosedClientItem {
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
  done_posts?: number;
  done_reels?: number;
  done_stories?: number;
  done_photos?: number;
  logo_url?: string | null;
  logs: ClientDailyLog[];
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

export default function DailyReportsView() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();

  // Selected date defaults to today (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });

  const [clients, setClients] = useState<ClosedClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // Simple text input per client: { [clientId]: { text: string, saving: boolean } }
  const [clientInput, setClientInput] = useState<Record<string, { text: string; saving: boolean }>>({});

  const fetchDailyReports = async (date: string) => {
    setLoading(true);
    try {
      const res = await reportsApi.getDailyLogs(date);
      setClients(res.clients || []);
    } catch (err) {
      console.error('Failed to load closed clients daily reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyReports(selectedDate);
  }, [selectedDate]);

  // Date Navigation Helpers
  const isToday = selectedDate === new Date().toISOString().substring(0, 10);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().substring(0, 10));
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  // Format date and time
  const formatLogDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const timeStr = d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const dateStr = d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
      return { timeStr, dateStr };
    } catch {
      return { timeStr: '', dateStr: '' };
    }
  };

  // Filter clients by search query or mobile selector
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (selectedClientId && selectedClientId !== 'all' && c.id !== selectedClientId) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    });
  }, [clients, searchQuery, selectedClientId]);

  // Simple Add Log Handler
  const handleAddLog = async (clientId: string) => {
    const state = clientInput[clientId];
    const text = state?.text?.trim();
    if (!text) return;

    setClientInput((prev) => ({
      ...prev,
      [clientId]: { ...prev[clientId], saving: true },
    }));

    try {
      const res = await reportsApi.addDailyLog({
        client_id: clientId,
        content: text,
        log_date: selectedDate,
      });

      // Append locally
      setClients((prev) =>
        prev.map((c) => {
          if (c.id === clientId) {
            return {
              ...c,
              logs: [...(c.logs || []), res.log],
            };
          }
          return c;
        })
      );

      // Clear input
      setClientInput((prev) => ({
        ...prev,
        [clientId]: { text: '', saving: false },
      }));
    } catch (err) {
      console.error('Failed to save log:', err);
      setClientInput((prev) => ({
        ...prev,
        [clientId]: { ...prev[clientId], saving: false },
      }));
    }
  };

  // Delete log handler
  const handleDeleteLog = async (clientId: string, logId: string) => {
    if (!confirm(t('reports.deleteLogConfirm') || 'Delete this log?')) return;

    try {
      await reportsApi.deleteDailyLog(logId);
      setClients((prev) =>
        prev.map((c) => {
          if (c.id === clientId) {
            return {
              ...c,
              logs: c.logs.filter((l) => l.id !== logId),
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filter Bar matching CRM Search & Date controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Desktop Search */}
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

        {/* Date Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-foreground"
              onClick={handlePrevDay}
              title="Previous Day"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              size="sm"
              variant={isToday ? 'default' : 'ghost'}
              className="h-8 text-xs font-semibold px-2.5"
              onClick={handleSetToday}
            >
              {t('reports.today')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs font-medium px-2.5 text-muted-foreground"
              onClick={handleSetYesterday}
            >
              {t('reports.yesterday')}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-foreground"
              onClick={handleNextDay}
              title="Next Day"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border text-foreground shadow-xs focus:outline-none"
          />

          <span className="text-xs text-muted-foreground font-medium hidden md:inline">
            {formatCairoDate(selectedDate, locale, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ── Client Cards Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Archive className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? `No results for "${searchQuery}"` : (t('closedClients.noClients') || 'No closed clients found')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-5 items-start">
          {filteredClients.map((client) => {
            const logs = client.logs || [];
            const inputState = clientInput[client.id] || { text: '', saving: false };

            return (
              <Card
                key={client.id}
                className="border border-border bg-card hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden text-start flex flex-col"
              >
                <CardContent className="p-5 flex flex-col gap-4 flex-1">
                  {/* ── 1. Header Row: Logo, Name, Company, Phone & Logs Count ── */}
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

                      {/* Name, Company & Correctly Placed Phone */}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground leading-snug truncate" title={client.name}>
                          {client.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate" title={client.company || ''}>
                          {client.company || t('clients.privateClient') || 'Closed Client'}
                        </p>

                        {/* Phone Number placed right under company */}
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

                    {/* Today's Logs Badge */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-2 py-0.5 font-bold shrink-0",
                        logs.length > 0 && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200/50"
                      )}
                    >
                      {logs.length} {logs.length === 1 ? 'Log' : 'Logs'}
                    </Badge>
                  </div>

                  {/* ── Logs Section Underneath Each Client ── */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/60 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        📋 {t('reports.title') || 'Logs'}
                      </span>
                    </div>

                    {/* Scrollable logs */}
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] min-h-[100px] pr-1">
                      {logs.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground/60 italic rounded-lg border border-dashed border-border/50 bg-muted/10 gap-1">
                          <Clock className="size-4 opacity-40" />
                          <span>{t('reports.noLogsToday') || 'No logs recorded for this date'}</span>
                        </div>
                      ) : (
                        logs.map((log) => {
                          const { timeStr, dateStr } = formatLogDateTime(log.created_at);
                          const canDelete =
                            ['owner', 'team_leader'].includes(user?.role || '') ||
                            user?.id === log.author_id;

                          return (
                            <div
                              key={log.id}
                              className="group relative bg-muted/20 hover:bg-muted/40 border border-border/40 rounded-lg p-2.5 text-xs transition-all flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="size-3 text-indigo-500" />
                                  {timeStr} &bull; {dateStr}
                                </span>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLog(client.id, log.id)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600 transition-opacity p-0.5"
                                    title="Delete Log"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                                {log.content}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* ── 4. Simple Text Field to Insert Log ── */}
                    <div className="pt-2 border-t border-border/40 flex flex-col gap-2 mt-auto">
                      <Textarea
                        placeholder={t('reports.addLogPlaceholder') || 'Write what happened with this client today...'}
                        rows={2}
                        value={inputState.text}
                        onChange={(e) =>
                          setClientInput((prev) => ({
                            ...prev,
                            [client.id]: { ...inputState, text: e.target.value },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddLog(client.id);
                          }
                        }}
                        className="text-xs min-h-[48px] bg-background border-border rounded-lg resize-none shadow-xs"
                      />

                      <Button
                        size="sm"
                        disabled={!inputState.text.trim() || inputState.saving}
                        onClick={() => handleAddLog(client.id)}
                        className="h-8 text-xs font-semibold bg-[#1D61E7] hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-xs"
                      >
                        {inputState.saving ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <>
                            <Send className="size-3 rtl:rotate-180" />
                            {t('reports.addLog') || 'Add Log'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

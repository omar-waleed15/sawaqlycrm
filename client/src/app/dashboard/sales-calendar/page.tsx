'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { salesApi } from '@/lib/api';
import { Client, SalesCallLog, Contract, User } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { formatCairoDate, formatCairoTime, getCairoDateString } from '@/lib/dateUtils';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Phone,
  Building2,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Users,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Filter,
} from 'lucide-react';

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const OUTCOME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  interested: { label: 'Interested', bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300' },
  meeting_scheduled: { label: 'Meeting Scheduled', bg: 'bg-indigo-100 dark:bg-indigo-950/50', text: 'text-indigo-700 dark:text-indigo-300' },
  negotiation: { label: 'Negotiation', bg: 'bg-purple-100 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-300' },
  won: { label: 'Deal Won', bg: 'bg-green-100 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-300' },
  lost: { label: 'Deal Lost', bg: 'bg-rose-100 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-300' },
  no_answer: { label: 'No Answer', bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300' },
  contacted: { label: 'Contacted', bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-300' },
};

export default function SalesCalendarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  const isOwnerOrTL = user?.role === 'owner' || user?.role === 'team_leader';

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [meetings, setMeetings] = useState<Client[]>([]);
  const [callLogs, setCallLogs] = useState<SalesCallLog[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [salesReps, setSalesReps] = useState<User[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & View Mode
  const [showMeetings, setShowMeetings] = useState(true);
  const [showCallLogs, setShowCallLogs] = useState(true);
  const [showRenewals, setShowRenewals] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');

  // Lead Detail Modal State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<Client | null>(null);
  const [leadLogs, setLeadLogs] = useState<SalesCallLog[]>([]);
  const [loadingLead, setLoadingLead] = useState(false);
  const [submittingCall, setSubmittingCall] = useState(false);
  const [newCallOutcome, setNewCallOutcome] = useState('meeting_scheduled');
  const [newCallDate, setNewCallDate] = useState('');
  const [newCallNotes, setNewCallNotes] = useState('');

  // Load Sales Calendar Data
  const loadCalendarData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const res = await salesApi.getCalendarEvents({
        userId: isOwnerOrTL && selectedRepId !== 'all' ? selectedRepId : undefined,
      });
      setMeetings(res.meetings || []);
      setCallLogs(res.callLogs || []);
      setContracts(res.contracts || []);
      setSalesReps(res.salesReps || []);
    } catch (err: any) {
      console.error('Failed to load sales calendar events:', err);
      setError(err.message || 'Failed to load sales calendar data');
    } finally {
      setLoading(false);
    }
  }, [user, isOwnerOrTL, selectedRepId]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Load Lead details when clicking on an event
  const handleViewLead = async (leadId: string) => {
    setSelectedLeadId(leadId);
    setLoadingLead(true);
    try {
      const res = await salesApi.getLead(leadId);
      setLeadDetail(res.lead);
      setLeadLogs(res.callLogs || []);
    } catch (err) {
      console.error('Failed to fetch lead details:', err);
      const fallbackMeeting = meetings.find(m => m.id === leadId);
      if (fallbackMeeting) {
        setLeadDetail(fallbackMeeting);
        setLeadLogs([]);
      }
    } finally {
      setLoadingLead(false);
    }
  };

  // Log new call or update meeting date
  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    try {
      setSubmittingCall(true);
      await salesApi.logCall(selectedLeadId, {
        outcome: newCallOutcome,
        notes: newCallNotes || undefined,
        meeting_date: newCallOutcome === 'meeting_scheduled' && newCallDate ? newCallDate : undefined,
      });
      setNewCallNotes('');
      setNewCallDate('');
      // Reload lead details and calendar events
      const res = await salesApi.getLead(selectedLeadId);
      setLeadDetail(res.lead);
      setLeadLogs(res.callLogs || []);
      loadCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to log call outcome');
    } finally {
      setSubmittingCall(false);
    }
  };

  // Calendar Grid Computations
  const monthStart = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const monthEnd = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59), [currentMonth]);

  const calendarCells = useMemo(() => {
    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];
    const firstDayIndex = monthStart.getDay();
    const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, prevMonthDays - i);
      cells.push({ date: d, isCurrentMonth: false, key: `prev-${d.getDate()}` });
    }

    const totalDays = monthEnd.getDate();
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      cells.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }

    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
      cells.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return cells;
  }, [currentMonth, monthStart, monthEnd]);

  // Group events by YYYY-MM-DD date string
  const eventsByDay = useMemo(() => {
    const map: Record<string, { meetings: Client[]; callLogs: SalesCallLog[]; contracts: Contract[] }> = {};

    calendarCells.forEach(cell => {
      const dateStr = getLocalDateString(cell.date);
      map[dateStr] = { meetings: [], callLogs: [], contracts: [] };
    });

    if (showMeetings) {
      meetings.forEach(m => {
        if (m.meeting_date) {
          const dateStr = getCairoDateString(m.meeting_date);
          if (map[dateStr]) map[dateStr].meetings.push(m);
        }
      });
    }

    if (showCallLogs) {
      callLogs.forEach(c => {
        if (c.call_date) {
          const dateStr = getCairoDateString(c.call_date);
          if (map[dateStr]) map[dateStr].callLogs.push(c);
        }
      });
    }

    // Only include contract renewals if caller is Owner/TL
    if (isOwnerOrTL && showRenewals) {
      contracts.forEach(contract => {
        if (contract.renewal_date) {
          const dateStr = contract.renewal_date;
          if (map[dateStr]) map[dateStr].contracts.push(contract);
        } else if (contract.start_date) {
          const dateStr = contract.start_date;
          if (map[dateStr]) map[dateStr].contracts.push(contract);
        }
      });
    }

    return map;
  }, [calendarCells, meetings, callLogs, contracts, showMeetings, showCallLogs, showRenewals, isOwnerOrTL]);

  const monthName = formatCairoDate(currentMonth, locale, { month: 'long', year: 'numeric' });

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6 text-start">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="size-7 text-primary" />
            {t('salesCalendar.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('salesCalendar.subtitle')}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sales Rep Filter Dropdown (Owner/TL only) */}
          {isOwnerOrTL && salesReps.length > 0 && (
            <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border text-xs font-semibold">
              <Filter className="size-3.5 text-muted-foreground ml-2" />
              <select
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer py-1 pr-2"
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
              >
                <option value="all">{t('salesCalendar.allReps')}</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.name} ({rep.role})</option>
                ))}
              </select>
            </div>
          )}

          {/* Month Navigation */}
          <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border shadow-xs">
            <button
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-foreground"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="px-3 py-1 text-xs font-extrabold hover:bg-muted rounded-lg transition-colors text-foreground min-w-32 text-center"
              onClick={() => setCurrentMonth(new Date())}
            >
              {monthName}
            </button>
            <button
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-foreground"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Toggles & Summary Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Meetings */}
          <button
            type="button"
            onClick={() => setShowMeetings(!showMeetings)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${showMeetings ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200' : 'bg-muted/40 text-muted-foreground border-transparent opacity-60'}`}
          >
            🤝 {t('salesCalendar.meetings')} ({meetings.length})
          </button>

          {/* Toggle Call Logs */}
          <button
            type="button"
            onClick={() => setShowCallLogs(!showCallLogs)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${showCallLogs ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-muted/40 text-muted-foreground border-transparent opacity-60'}`}
          >
            📞 {t('salesCalendar.callLogs')} ({callLogs.length})
          </button>

          {/* Toggle Renewals (Owner only) */}
          {isOwnerOrTL && (
            <button
              type="button"
              onClick={() => setShowRenewals(!showRenewals)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${showRenewals ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200' : 'bg-muted/40 text-muted-foreground border-transparent opacity-60'}`}
            >
              📑 {t('salesCalendar.renewals')} ({contracts.length})
            </button>
          )}
        </div>

        {/* View Mode */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'calendar' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Month Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('agenda')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'agenda' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Agenda List
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-medium border border-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{t('clients.savingProgress')}</span>
        </div>
      ) : viewMode === 'calendar' ? (
        /* Calendar Grid View */
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-bold text-muted-foreground py-3">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60">
            {calendarCells.map(cell => {
              const dateStr = getLocalDateString(cell.date);
              const dayEvents = eventsByDay[dateStr] || { meetings: [], callLogs: [], contracts: [] };
              const isToday = getLocalDateString(new Date()) === dateStr;

              return (
                <div
                  key={cell.key}
                  className={`min-h-28 p-1.5 flex flex-col space-y-1 transition-colors ${!cell.isCurrentMonth ? 'bg-muted/10 opacity-40' : isToday ? 'bg-primary/5 dark:bg-primary/10' : 'bg-card'}`}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-xs font-bold rounded-full size-5 flex items-center justify-center ${isToday ? 'bg-primary text-primary-foreground font-black' : 'text-muted-foreground'}`}>
                      {cell.date.getDate()}
                    </span>
                  </div>

                  {/* Events Container */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-36 pr-0.5">
                    {/* Meetings */}
                    {dayEvents.meetings.map(m => (
                      <div
                        key={`m-${m.id}`}
                        onClick={() => handleViewLead(m.id)}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/50 text-[11px] font-semibold text-indigo-950 dark:text-indigo-200 cursor-pointer hover:shadow-xs transition-shadow flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold truncate">🤝 {m.name}</span>
                          <span className="text-[9px] font-mono text-indigo-600 shrink-0">
                            {formatCairoTime(m.meeting_date)}
                          </span>
                        </div>
                        {m.company && <span className="text-[9px] text-muted-foreground truncate">{m.company}</span>}
                      </div>
                    ))}

                    {/* Call Logs */}
                    {dayEvents.callLogs.map(c => {
                      const cfg = OUTCOME_CONFIG[c.outcome] || { label: c.outcome, bg: 'bg-slate-100', text: 'text-slate-700' };
                      return (
                        <div
                          key={`c-${c.id}`}
                          onClick={() => handleViewLead(c.client_id)}
                          className={`p-1.5 rounded-lg ${cfg.bg} border border-border/60 text-[11px] font-semibold ${cfg.text} cursor-pointer hover:shadow-xs transition-shadow flex flex-col gap-0.5`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold truncate">📞 {c.client?.name || 'Lead Call'}</span>
                            <span className="text-[9px] font-mono shrink-0">
                              {formatCairoTime(c.call_date)}
                            </span>
                          </div>
                          {c.notes && <span className="text-[9px] text-muted-foreground truncate italic">{c.notes}</span>}
                        </div>
                      );
                    })}

                    {/* Contract Renewals (Owner only) */}
                    {isOwnerOrTL && dayEvents.contracts.map(cnt => (
                      <div
                        key={`cnt-${cnt.id}`}
                        className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/50 text-[11px] font-semibold text-purple-950 dark:text-purple-200 flex items-center justify-between gap-1"
                      >
                        <span className="truncate">📑 {cnt.name}</span>
                        <span className="font-bold text-[10px] text-purple-700 shrink-0">{formatCurrency(cnt.amount, locale)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda List View */
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-lg text-foreground">Sales Agenda - {monthName}</h3>

          <div className="space-y-4">
            {calendarCells
              .filter(cell => cell.isCurrentMonth)
              .map(cell => {
                const dateStr = getLocalDateString(cell.date);
                const dayEvents = eventsByDay[dateStr] || { meetings: [], callLogs: [], contracts: [] };
                const hasEvents = dayEvents.meetings.length > 0 || dayEvents.callLogs.length > 0 || dayEvents.contracts.length > 0;
                if (!hasEvents) return null;

                return (
                  <div key={dateStr} className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-3">
                    <div className="font-bold text-sm text-foreground border-b border-border/60 pb-2 flex items-center gap-2">
                      <CalendarIcon className="size-4 text-primary" />
                      {formatDate(getLocalDateString(cell.date), locale)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Meetings */}
                      {dayEvents.meetings.map(m => (
                        <div
                          key={m.id}
                          onClick={() => handleViewLead(m.id)}
                          className="p-3 rounded-xl bg-card border border-indigo-200 dark:border-indigo-900/50 shadow-xs cursor-pointer hover:border-indigo-400 transition-colors space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-sm text-indigo-950 dark:text-indigo-200">
                            <span>🤝 {m.name}</span>
                            <span className="text-xs font-mono text-indigo-600">{formatCairoTime(m.meeting_date)}</span>
                          </div>
                          {m.company && <p className="text-xs text-muted-foreground">{m.company}</p>}
                          {m.phone && <p className="text-xs text-muted-foreground font-mono">📞 {m.phone}</p>}
                        </div>
                      ))}

                      {/* Call Logs */}
                      {dayEvents.callLogs.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleViewLead(c.client_id)}
                          className="p-3 rounded-xl bg-card border border-border shadow-xs cursor-pointer hover:border-primary transition-colors space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-sm text-foreground">
                            <span>📞 {c.client?.name || 'Lead Call'}</span>
                            <span className="text-xs font-mono text-muted-foreground">{formatCairoTime(c.call_date)}</span>
                          </div>
                          {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground">
                            {c.outcome}
                          </span>
                        </div>
                      ))}

                      {/* Contract Renewals (Owner only) */}
                      {isOwnerOrTL && dayEvents.contracts.map(cnt => (
                        <div
                          key={cnt.id}
                          className="p-3 rounded-xl bg-card border border-purple-200 dark:border-purple-900/50 shadow-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-sm text-purple-950 dark:text-purple-200">
                            <span>📑 {cnt.name}</span>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(cnt.amount, locale)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Renewal Date: {cnt.renewal_date || cnt.start_date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Lead Detail & Actions Modal */}
      {selectedLeadId && (
        <Modal
          isOpen={Boolean(selectedLeadId)}
          onClose={() => setSelectedLeadId(null)}
          title={`Sales Lead - ${leadDetail?.name || ''}`}
        >
          {loadingLead ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading lead details...</span>
            </div>
          ) : leadDetail ? (
            <div className="space-y-5 text-start">
              {/* Info Header */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-foreground">{leadDetail.name}</h3>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase">
                    {leadDetail.pipeline_stage}
                  </span>
                </div>
                {leadDetail.company && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="size-3.5" /> {leadDetail.company}</p>}
                {leadDetail.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="size-3.5" /> <a href={`tel:${leadDetail.phone}`} className="hover:underline font-mono">{leadDetail.phone}</a></p>}
                {leadDetail.meeting_date && (
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Meeting Scheduled: {formatCairoDate(leadDetail.meeting_date, locale)} at {formatCairoTime(leadDetail.meeting_date)}
                  </p>
                )}
              </div>

              {/* Log Call & Update Stage Form */}
              <form onSubmit={handleLogCall} className="space-y-3 border-t border-border pt-4">
                <h4 className="font-bold text-sm text-foreground">Log Call Outcome / Update Stage</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Outcome / New Stage</label>
                    <select
                      className="form-select text-xs w-full"
                      value={newCallOutcome}
                      onChange={(e) => setNewCallOutcome(e.target.value)}
                    >
                      <option value="interested">Interested</option>
                      <option value="meeting_scheduled">Meeting Scheduled</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="won">Deal Won</option>
                      <option value="lost">Deal Lost</option>
                      <option value="no_answer">No Answer</option>
                      <option value="contacted">Contacted</option>
                    </select>
                  </div>

                  {newCallOutcome === 'meeting_scheduled' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Meeting Date & Time</label>
                      <input
                        type="datetime-local"
                        className="form-input text-xs w-full"
                        value={newCallDate}
                        onChange={(e) => setNewCallDate(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Call Notes & Comments</label>
                  <input
                    type="text"
                    className="form-input text-xs w-full"
                    placeholder="e.g. Client requested a proposal for social media management"
                    value={newCallNotes}
                    onChange={(e) => setNewCallNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedLeadId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingCall}
                  >
                    {submittingCall ? 'Saving...' : 'Save Call & Update Stage'}
                  </Button>
                </div>
              </form>

              {/* Call History */}
              {leadLogs.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Previous Call Logs</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {leadLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded-lg border border-border/80 bg-muted/20 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="font-bold text-foreground">{log.outcome}</span>
                          <span className="text-[10px] text-muted-foreground">{formatCairoDate(log.call_date, locale)}</span>
                        </div>
                        {log.notes && <p className="text-muted-foreground italic">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Lead not found.</div>
          )}
        </Modal>
      )}
    </div>
  );
}

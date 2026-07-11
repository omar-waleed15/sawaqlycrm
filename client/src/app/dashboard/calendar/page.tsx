'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { tasksApi, contractsApi, clientsApi, salesApi, contentsApi } from '@/lib/api';
import { Task, Contract, Client, SalesCallLog, ContentItem } from '@/types';
import Modal from '@/components/Modal';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { formatCairoDate, formatCairoTime, formatCairoDateTime, getCairoTodayString, getCairoDateString } from '@/lib/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  DollarSign,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Calendar,
  Megaphone,
  Loader2,
  Phone,
  Mail,
  Building2,
  Clock,
  X,
  FileText,
  HelpCircle,
  Video,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getLocalMonthString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

function formatCurrency(amount: number, locale?: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}


function formatDate(date: Date, locale?: string): string {
  return formatCairoDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const PIPELINE_STAGE_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  new_lead:          { labelKey: 'sales.newLead',       color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
  contacted:         { labelKey: 'sales.contacted',      color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  meeting_scheduled: { labelKey: 'sales.meetingScheduled', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-200' },
  meeting_done:      { labelKey: 'sales.meetingDone',    color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
  won:               { labelKey: 'sales.won',            color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
  lost:              { labelKey: 'sales.lost',           color: 'text-rose-700', bg: 'bg-rose-100 border-rose-200' },
};

export default function CalendarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('agenda');
    }
  }, []);

  // Lead Details Modal state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<Client | null>(null);
  const [leadLogs, setLeadLogs] = useState<SalesCallLog[]>([]);
  const [loadingLead, setLoadingLead] = useState(false);

  const handleViewLead = async (leadId: string) => {
    setIsModalOpen(false);
    setSelectedLeadId(leadId);
    setLoadingLead(true);
    try {
      const res = await salesApi.getLead(leadId);
      setLeadDetail(res.lead);
      setLeadLogs(res.callLogs);
    } catch (err) {
      console.error('Failed to fetch lead details:', err);
      const fallbackClient = clients.find(c => c.id === leadId);
      if (fallbackClient) {
        setLeadDetail(fallbackClient);
        setLeadLogs([]);
      } else {
        setError('Failed to fetch lead details.');
      }
    } finally {
      setLoadingLead(false);
    }
  };

  const isOwner = user?.role === 'owner' || user?.role === 'sales';
  const isTaskAdmin = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';

  const isTaskCompleted = (tTask: Task) => {
    const assignees = tTask.task_assignees || [];
    if (assignees.length === 0) return false;
    if (!isTaskAdmin) {
      const myAssignee = assignees.find(a => a.user_id === user?.id);
      return myAssignee ? myAssignee.status === 'completed' : false;
    }
    return assignees.every(a => a.status === 'completed');
  };

  const getCycleLabel = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return t('finance.monthly');
      case 'quarterly': return t('finance.quarterly');
      case 'yearly': return t('finance.yearly');
      default: return t('finance.oneTime');
    }
  };

  // Load data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchTasks = tasksApi.list();
    const fetchContracts = (user.role === 'owner' || user.role === 'sales')
      ? contractsApi.list() 
      : Promise.resolve({ contracts: [] as Contract[] });
    const fetchClients = (user.role === 'owner' || user.role === 'sales' || user.role === 'team_leader' || user.role === 'account_manager')
      ? clientsApi.list()
      : Promise.resolve({ clients: [] as Client[] });
    const fetchContents = contentsApi.list();

    Promise.all([fetchTasks, fetchContracts, fetchClients, fetchContents])
      .then(([tasksData, contractsData, clientsData, contentsData]) => {
        setTasks(tasksData.tasks);
        setContracts(contractsData.contracts);
        setClients(clientsData.clients || []);
        setContents(contentsData.contents || []);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load calendar data:', err);
        setError('Failed to fetch tasks, contracts, clients, or content.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Navigate month
  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const setToday = () => {
    setCurrentMonth(new Date());
  };

  // Compute month limits
  const monthStart = useMemo(() => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  }, [currentMonth]);

  // End of month
  const monthEnd = useMemo(() => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
  }, [currentMonth]);

  // Generate calendar grid days
  const calendarCells = useMemo(() => {
    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];
    
    // Start of the calendar grid (fill leading days from previous month)
    const firstDayIndex = monthStart.getDay(); 
    const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
    
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, prevMonthDays - i);
      cells.push({ date: d, isCurrentMonth: false, key: `prev-${d.getDate()}` });
    }

    // Days in current month
    const totalDays = monthEnd.getDate();
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      cells.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }

    // Trailing days from next month to fill grid
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
      cells.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return cells;
  }, [currentMonth, monthStart, monthEnd]);

  // Function to project payment schedule dates from a contract
  const getContractPaymentDates = (contract: Contract, mStart: Date, mEnd: Date): Date[] => {
    if (!contract.start_date) return [];
    const dates: Date[] = [];
    
    const [sYear, sMonth, sDay] = contract.start_date.split('-').map(Number);
    const startDate = new Date(sYear, sMonth - 1, sDay);
    
    if (startDate > mEnd) return [];
    
    const renewalDate = contract.renewal_date ? (() => {
      const [rYear, rMonth, rDay] = contract.renewal_date.split('-').map(Number);
      return new Date(rYear, rMonth - 1, rDay);
    })() : null;

    if ((contract.status === 'cancelled' || contract.status === 'expired') && renewalDate && renewalDate < mStart) {
      return [];
    }
    
    if (!contract.is_recurring || contract.billing_cycle === 'one_time') {
      if (startDate >= mStart && startDate <= mEnd) {
        dates.push(startDate);
      }
      return dates;
    }
    
    let current = new Date(startDate);
    
    let safetyCounter = 0;
    while (current <= mEnd && safetyCounter < 120) {
      safetyCounter++;
      if ((contract.status === 'cancelled' || contract.status === 'expired') && renewalDate && current > renewalDate) {
        break;
      }
      
      if (current >= mStart && current <= mEnd) {
        dates.push(new Date(current));
      }
      
      if (contract.billing_cycle === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      } else if (contract.billing_cycle === 'quarterly') {
        current.setMonth(current.getMonth() + 3);
      } else if (contract.billing_cycle === 'yearly') {
        current.setFullYear(current.getFullYear() + 1);
      } else {
        break;
      }
    }
    
    return dates;
  };

  const eventsByDay = useMemo(() => {
    const map: Record<string, { tasks: Task[]; payments: { contract: Contract; amount: number }[]; meetings: Client[]; targetSlots: any[]; contents: ContentItem[] }> = {};
    
    calendarCells.forEach(cell => {
      const dateStr = getLocalDateString(cell.date);
      map[dateStr] = { tasks: [], payments: [], meetings: [], targetSlots: [], contents: [] };
    });

    tasks.forEach(task => {
      if (task.due_date) {
        const dateStr = task.due_date;
        if (map[dateStr]) {
          map[dateStr].tasks.push(task);
        }
      }
    });

    contents.forEach(item => {
      if (item.scheduled_date) {
        const dateStr = item.scheduled_date.substring(0, 10);
        if (map[dateStr]) {
          map[dateStr].contents.push(item);
        }
      }
    });

    if (isOwner) {
      const gridStart = calendarCells[0].date;
      const gridEnd = calendarCells[calendarCells.length - 1].date;

      contracts.forEach(contract => {
        const paymentDates = getContractPaymentDates(contract, gridStart, gridEnd);
        paymentDates.forEach(pDate => {
          const dateStr = getLocalDateString(pDate);
          if (map[dateStr]) {
            map[dateStr].payments.push({
              contract,
              amount: contract.amount,
            });
          }
        });
      });

      clients.forEach(client => {
        if (client.meeting_date && client.pipeline_stage === 'meeting_scheduled') {
          const dateStr = getCairoDateString(client.meeting_date);
          if (map[dateStr]) {
            map[dateStr].meetings.push(client);
          }
        }
      });
    }

    // Populate target deliverables schedule slots for any loaded clients
    clients.forEach(client => {
      const schedule = client.deliverables_schedule;
      if (schedule) {
        let scheduleObj: any = {};
        if (typeof schedule === 'string') {
          try {
            scheduleObj = JSON.parse(schedule);
          } catch {
            scheduleObj = {};
          }
        } else {
          scheduleObj = schedule;
        }
        
        const types = ['posts', 'reels', 'stories', 'photos'] as const;
        const typeLabelMap: Record<string, string> = {
          posts: 'Post',
          reels: 'Reel',
          stories: 'Story',
          photos: 'Photo',
        };
        
        types.forEach(tKey => {
          const dates = (scheduleObj && scheduleObj[tKey]) || [];
          dates.forEach((dateStr: string, idx: number) => {
            if (!dateStr) return;
            const targetDateStr = dateStr.substring(0, 10);
            if (map[targetDateStr]) {
              const typeKey = tKey === 'posts' ? 'post' : tKey === 'reels' ? 'reel' : tKey === 'stories' ? 'story' : 'photo';
              
              // 1. Check matching tasks
              const matchingTasks = map[targetDateStr].tasks
                .filter(t => 
                  t.client_id === client.id && 
                  t.is_deliverable === true && 
                  t.deliverable_type === typeKey
                )
                .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

              // 2. Check matching scheduled content items
              const matchingContents = map[targetDateStr].contents
                .filter(c =>
                  c.client_id === client.id &&
                  c.content_type === typeKey
                )
                .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

              const contentIdx = idx - matchingTasks.length;

              if (idx < matchingTasks.length) {
                // The slot is filled by an actual task!
                const matchedTask = matchingTasks[idx];
                map[targetDateStr].targetSlots.push({
                  id: matchedTask.id,
                  client_id: client.id,
                  client_name: client.name,
                  title: `🎯 ${matchedTask.title}`,
                  content_type: typeKey,
                  scheduled_date: dateStr,
                  isFilled: true,
                  task: matchedTask,
                });
              } else if (contentIdx >= 0 && contentIdx < matchingContents.length) {
                // The slot is filled by a content item!
                const matchedContent = matchingContents[contentIdx];
                const platformLabel = matchedContent.platform ? ` (${matchedContent.platform.toUpperCase()})` : '';
                map[targetDateStr].targetSlots.push({
                  id: matchedContent.id,
                  client_id: client.id,
                  client_name: client.name,
                  title: `✨ ${matchedContent.title || 'Untitled Content'}${platformLabel}`,
                  content_type: typeKey,
                  scheduled_date: dateStr,
                  isFilled: true,
                  content: matchedContent,
                });
              } else {
                // The slot is empty
                map[targetDateStr].targetSlots.push({
                  id: `target-${client.id}-${tKey}-${idx}`,
                  client_id: client.id,
                  client_name: client.name,
                  title: `🎯 ${client.name} Target ${typeLabelMap[tKey]} ${idx + 1}`,
                  content_type: typeKey,
                  scheduled_date: dateStr,
                  isFilled: false,
                });
              }
            }
          });
        });
      }
    });

    // Filter out matched tasks/contents from general lists so they do not show up twice
    calendarCells.forEach(cell => {
      const dateStr = getLocalDateString(cell.date);
      const dayData = map[dateStr];
      if (dayData) {
        const filledTaskIds = dayData.targetSlots
          .filter(slot => slot.isFilled && slot.task)
          .map(slot => slot.task.id);
          
        if (filledTaskIds.length > 0) {
          dayData.tasks = dayData.tasks.filter(t => !filledTaskIds.includes(t.id));
        }

        const filledContentIds = dayData.targetSlots
          .filter(slot => slot.isFilled && slot.content)
          .map(slot => slot.content.id);

        if (filledContentIds.length > 0) {
          dayData.contents = dayData.contents.filter(c => !filledContentIds.includes(c.id));
        }
      }
    });

    return map;
  }, [calendarCells, tasks, contracts, clients, contents, isOwner]);

  // Compute month statistics
  const monthStats = useMemo(() => {
    let projectedRevenue = 0;
    let totalTasksDue = 0;
    let completedTasks = 0;
    let urgentTasks = 0;

    calendarCells.forEach(cell => {
      if (cell.isCurrentMonth) {
        const dateStr = getLocalDateString(cell.date);
        const dayEvents = eventsByDay[dateStr];
        
        if (dayEvents) {
          totalTasksDue += dayEvents.tasks.length;
          completedTasks += dayEvents.tasks.filter(tTask => isTaskCompleted(tTask)).length;
          urgentTasks += dayEvents.tasks.filter(tTask => tTask.priority === 'urgent' && !isTaskCompleted(tTask)).length;
          
          if (isOwner) {
            dayEvents.payments.forEach(p => {
              if (p.contract.status === 'active') {
                projectedRevenue += Number(p.amount) || 0;
              }
            });
          }
        }
      }
    });

    const completionRate = totalTasksDue > 0 ? Math.round((completedTasks / totalTasksDue) * 100) : 0;

    return {
      projectedRevenue,
      totalTasksDue,
      completedTasks,
      completionRate,
      urgentTasks
    };
  }, [calendarCells, eventsByDay, isOwner, isTaskAdmin, user]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return { tasks: [], payments: [], meetings: [], targetSlots: [], contents: [] };
    const dateStr = getLocalDateString(selectedDate);
    return eventsByDay[dateStr] || { tasks: [], payments: [], meetings: [], targetSlots: [], contents: [] };
  }, [selectedDate, eventsByDay]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const currentMonthLabel = formatCairoDate(currentMonth, locale, { month: 'long', year: 'numeric' });

  return (
    <div className="page-container fade-in text-start">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="page-header-left">
          <h1 className="page-header-title">{isOwner ? t('calendar.title') : t('calendar.myCalendar')}</h1>
          <p className="page-header-subtitle">
            {isOwner ? t('calendar.subtitle') : t('calendar.mySubtitle')}
          </p>
        </div>
        
        {/* Navigation & View Controls */}
        <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto">
          {/* View Switcher Toggle */}
          <div className="flex items-center gap-1 bg-card border p-1 rounded-xl shadow-sm h-10 shrink-0">
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="h-8 text-xs font-semibold px-3 flex items-center gap-1.5"
            >
              <CalendarDays className="size-4" />
              <span>Grid</span>
            </Button>
            <Button
              variant={viewMode === 'agenda' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('agenda')}
              className="h-8 text-xs font-semibold px-3 flex items-center gap-1.5"
            >
              <ClipboardList className="size-4" />
              <span>Agenda</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 bg-card border p-1 rounded-xl shadow-sm shrink-0 flex-1 sm:flex-initial justify-between sm:justify-start h-10">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
            <div className="border-l border-border pl-2 h-6 flex items-center justify-center">
              <input
                type="month"
                className="bg-transparent border-0 text-xs font-bold text-foreground focus:outline-hidden focus:ring-0 p-0 cursor-pointer text-center w-28 md:w-32 font-sans"
                value={getLocalMonthString(currentMonth)}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    const newDate = new Date(Number(year), Number(month) - 1, 1);
                    if (!isNaN(newDate.getTime())) {
                      setCurrentMonth(newDate);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>



      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md mb-5">
          {error}
        </div>
      )}

      {/* Calendar Grid Layout */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t('calendar.loadingSchedule')}</p>
        </Card>
      ) : viewMode === 'calendar' ? (
        <Card className="overflow-hidden border border-border shadow-md">
          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 border-b bg-muted/40 font-semibold text-xs text-muted-foreground select-none text-center py-2.5">
            {[
              t('calendar.sunday'),
              t('calendar.monday'),
              t('calendar.tuesday'),
              t('calendar.wednesday'),
              t('calendar.thursday'),
              t('calendar.friday'),
              t('calendar.saturday')
            ].map((day) => (
              <div key={day} className="truncate px-1">
                {day.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Calendar Grid cells */}
          <div className="grid grid-cols-7 grid-rows-5 bg-border gap-[1px]">
            {calendarCells.map((cell) => {
              const dateStr = getLocalDateString(cell.date);
              const dayEvents = eventsByDay[dateStr] || { tasks: [], payments: [], meetings: [], targetSlots: [], contents: [] };
              const isToday = getCairoTodayString() === dateStr;
              
              const displayTasks = dayEvents.tasks.slice(0, isOwner ? 1 : 2);
              const displayPayments = isOwner ? dayEvents.payments.slice(0, 1) : [];
              const displayMeetings = isOwner ? (dayEvents.meetings || []).slice(0, 1) : [];
              const displayTargetSlots = (dayEvents.targetSlots || []).slice(0, 1);
              const displayContents = (dayEvents.contents || []).slice(0, 1);
              const totalItems = displayTasks.length + displayPayments.length + displayMeetings.length + displayTargetSlots.length + displayContents.length;
              const actualTotal = dayEvents.tasks.length + dayEvents.payments.length + (dayEvents.meetings || []).length + (dayEvents.targetSlots || []).length + (dayEvents.contents || []).length;
              const hasMore = actualTotal > totalItems;
              const extraCount = actualTotal - totalItems;

              return (
                <div
                  key={cell.key}
                  onClick={() => handleDayClick(cell.date)}
                  className={`min-h-[50px] md:min-h-[100px] p-1 md:p-2 flex flex-col bg-card hover:bg-muted/10 cursor-pointer select-none transition-colors relative text-start ${
                    cell.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/45 bg-muted/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 md:mb-1.5">
                    <span className={`text-[10px] md:text-xs font-bold flex items-center justify-center rounded-full size-4 md:size-5 ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : ''
                    }`}>
                      {cell.date.getDate()}
                    </span>
                  </div>
                  
                  {/* Desktop Verbose Event List */}
                  <div className="hidden md:flex flex-col gap-1 overflow-hidden flex-1 pb-1">
                    {/* Payments */}
                    {isOwner && displayPayments.map(({ contract, amount }) => {
                      // Check if any installment for this day is paid
                      const dateStr2 = getLocalDateString(cell.date);
                      const isPaid = contract.installments?.some(
                        inst => inst.due_date?.split('T')[0] === dateStr2 && inst.paid
                      ) || false;
                      return (
                        <div
                          key={`pay-${contract.id}-${amount}`}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                              : 'bg-green-50 border-green-200 text-green-700'
                          }`}
                          title={`Payment ${isPaid ? '(Paid)' : '(Due)'}: $${amount} - ${contract.name}`}
                        >
                          {isPaid ? <CheckCircle2 className="size-2.5 shrink-0" /> : <DollarSign className="size-2 shrink-0" />}
                          <span className={isPaid ? 'line-through opacity-70' : ''}>{formatCurrency(amount, locale)}</span>
                        </div>
                      );
                    })}

                    {/* Meetings */}
                    {isOwner && displayMeetings.map(client => (
                      <div
                        key={`meet-${client.id}`}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 truncate flex items-center gap-0.5"
                        title={`Meeting: ${client.name}`}
                      >
                        <Calendar className="size-2 shrink-0" />
                        <span>🤝 {client.name}</span>
                      </div>
                    ))}



                    {/* Target Slots */}
                    {displayTargetSlots.map(slot => {
                      const isTaskFilled = slot.isFilled && slot.task;
                      const isContentFilled = slot.isFilled && slot.content;
                      const taskCompleted = isTaskFilled ? isTaskCompleted(slot.task) : false;
                      const contentPublished = isContentFilled ? slot.content.status === 'published' : false;
                      const isUrgent = isTaskFilled ? slot.task.priority === 'urgent' : false;
                      const isHigh = isTaskFilled ? slot.task.priority === 'high' : false;

                      let badgeClasses = 'bg-indigo-50/70 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300';
                      if (isTaskFilled) {
                        badgeClasses = taskCompleted
                           ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                           : isUrgent
                           ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                           : isHigh
                           ? 'bg-orange-50 border-orange-200 text-orange-700'
                           : 'bg-sky-50 border-sky-200 text-sky-700';
                      } else if (isContentFilled) {
                        badgeClasses = contentPublished
                           ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                           : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300';
                      }

                      return (
                        <div
                          key={slot.id}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${badgeClasses}`}
                          title={slot.title}
                        >
                          <span className="shrink-0">{isContentFilled ? '✨' : '🎯'}</span>
                          <span>{slot.title}</span>
                        </div>
                      );
                    })}

                    {/* Contents */}
                    {displayContents.map(item => {
                      const published = item.status === 'published';
                      const platformLabel = item.platform ? ` (${item.platform.toUpperCase()})` : '';
                      return (
                        <div
                          key={`content-${item.id}`}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            published
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300'
                          }`}
                          title={`Content: ${item.title || 'Untitled'}${platformLabel}`}
                        >
                          <span className="shrink-0">✨</span>
                          <span className={published ? 'line-through opacity-70' : ''}>
                            {item.title || 'Untitled Content'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Tasks */}
                    {displayTasks.map(tTask => {
                      const isUrgent = tTask.priority === 'urgent';
                      const isHigh = tTask.priority === 'high';
                      const completed = isTaskCompleted(tTask);
                      return (
                        <div
                          key={`task-${tTask.id}`}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            completed
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                              : isUrgent
                              ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              : isHigh
                              ? 'bg-orange-50 border-orange-200 text-orange-700'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}
                          title={`Task${completed ? ' (Done)' : ''}: ${tTask.title}`}
                        >
                          {completed ? <CheckCircle2 className="size-2.5 shrink-0" /> : <span>☐</span>}
                          <span className={completed ? 'line-through opacity-70' : ''}>{tTask.title}</span>
                        </div>
                      );
                    })}

                    {/* More indicator */}
                    {hasMore && (
                      <div className="text-[8px] font-extrabold text-muted-foreground text-center mt-auto bg-muted/40 py-0.5 rounded border border-dashed border-border/80">
                        {t('calendar.moreEvents').replace('{count}', extraCount.toString())}
                      </div>
                    )}
                  </div>

                  {/* Mobile Compact Dot Indicators */}
                  <div className="flex md:hidden flex-row flex-wrap gap-0.5 justify-center mt-auto pb-0.5">
                    {dayEvents.payments.length > 0 && (
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    {dayEvents.meetings && dayEvents.meetings.length > 0 && (
                      <span className="size-1.5 rounded-full bg-indigo-500 shrink-0" />
                    )}
                    {dayEvents.tasks.length > 0 && (
                      <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                    {((dayEvents.targetSlots && dayEvents.targetSlots.length > 0) || (dayEvents.contents && dayEvents.contents.length > 0)) && (
                      <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {(() => {
            // Group and filter calendar cells that are in current month and have at least one event
            const activeMonthCellsWithEvents = calendarCells.filter(cell => {
              if (!cell.isCurrentMonth) return false;
              const dateStr = getLocalDateString(cell.date);
              const dayEvents = eventsByDay[dateStr];
              if (!dayEvents) return false;
              
              const totalItems = dayEvents.tasks.length + 
                (isOwner ? dayEvents.payments.length : 0) + 
                (isOwner ? (dayEvents.meetings || []).length : 0) + 
                (dayEvents.targetSlots || []).length + 
                (dayEvents.contents || []).length;
              return totalItems > 0;
            });

            if (activeMonthCellsWithEvents.length === 0) {
              return (
                <Card className="p-8 text-center text-muted-foreground bg-card border border-border">
                  <p className="text-sm font-semibold">{t('calendar.noEvents') || 'No scheduled events for this month.'}</p>
                </Card>
              );
            }

            return activeMonthCellsWithEvents.map(cell => {
              const dateStr = getLocalDateString(cell.date);
              const dayEvents = eventsByDay[dateStr];
              const isToday = getCairoTodayString() === dateStr;
              const formattedDate = formatCairoDate(cell.date, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

              return (
                <div key={cell.key} className="p-4 rounded-xl border border-border bg-card shadow-xs text-start flex flex-col gap-3">
                  {/* Date Header */}
                  <div className="flex justify-between items-center border-b pb-2 border-border/40">
                    <span className={`text-sm font-bold text-foreground px-2 py-0.5 rounded-lg ${isToday ? 'bg-indigo-100 text-indigo-700' : ''}`}>
                      {formattedDate}
                    </span>
                    {isToday && <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Today</span>}
                  </div>

                  {/* Events List */}
                  <div className="flex flex-col gap-2.5">
                    {/* 1. Payments */}
                    {isOwner && dayEvents.payments.map(({ contract, amount }) => {
                      const isPaid = contract.installments?.some(
                        inst => inst.due_date?.split('T')[0] === dateStr && inst.paid
                      ) || false;
                      return (
                        <div
                          key={`pay-${contract.id}-${amount}`}
                          className={`p-3 border rounded-lg flex items-center justify-between text-xs transition-all cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400'
                              : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100/40'
                          }`}
                          onClick={() => handleDayClick(cell.date)}
                        >
                          <div className="flex items-center gap-2">
                            {isPaid ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <DollarSign className="size-4 shrink-0 text-green-600" />}
                            <div>
                              <span className={`font-bold block ${isPaid ? 'line-through opacity-70' : ''}`}>Payment: {formatCurrency(amount, locale)}</span>
                              <span className="text-[10px] text-muted-foreground block">{contract.name}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-green-100 text-green-700'}`}>
                            {isPaid ? t('finance.paid') : t('finance.unpaid')}
                          </span>
                        </div>
                      );
                    })}

                    {/* 2. Meetings */}
                    {isOwner && dayEvents.meetings?.map(client => (
                      <div
                        key={`meet-${client.id}`}
                        className="p-3 border border-indigo-100 rounded-lg bg-indigo-50/30 text-indigo-900 flex items-center gap-2 text-xs cursor-pointer hover:bg-indigo-50/60"
                        onClick={() => handleDayClick(cell.date)}
                      >
                        <Calendar className="size-4 shrink-0 text-indigo-500" />
                        <div>
                          <span className="font-bold block">Meeting with Client</span>
                          <span className="text-[10px] text-indigo-700 block">{client.name} {client.company ? `(${client.company})` : ''}</span>
                        </div>
                      </div>
                    ))}

                    {/* 3. Target Slots */}
                    {dayEvents.targetSlots?.map(slot => {
                      const isTaskFilled = slot.isFilled && slot.task;
                      const isContentFilled = slot.isFilled && slot.content;
                      const taskCompleted = isTaskFilled ? isTaskCompleted(slot.task) : false;
                      const contentPublished = isContentFilled ? slot.content.status === 'published' : false;

                      let badgeBg = 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/40';
                      if (isTaskFilled) {
                        badgeBg = taskCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/40' : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100/40';
                      } else if (isContentFilled) {
                        badgeBg = contentPublished ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/40' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/40';
                      }

                      return (
                        <div
                          key={slot.id}
                          className={`p-3 border rounded-lg flex items-center gap-2 text-xs cursor-pointer ${badgeBg}`}
                          onClick={() => handleDayClick(cell.date)}
                        >
                          <span className="text-base shrink-0">{isContentFilled ? '✨' : '🎯'}</span>
                          <div>
                            <span className="font-bold block">{slot.title}</span>
                            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">{slot.content_type} outline</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* 4. Contents */}
                    {dayEvents.contents?.map(item => {
                      const published = item.status === 'published';
                      return (
                        <div
                          key={`content-${item.id}`}
                          className={`p-3 border rounded-lg flex items-center justify-between text-xs transition-all cursor-pointer ${
                            published ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/40' : 'bg-amber-50/30 border-amber-200 text-amber-800 hover:bg-amber-100/40'
                          }`}
                          onClick={() => handleDayClick(cell.date)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base shrink-0">✨</span>
                            <div>
                              <span className={`font-bold block ${published ? 'line-through opacity-70' : ''}`}>Content: {item.title || 'Untitled'}</span>
                              <span className="text-[10px] text-muted-foreground block text-capitalize">{item.platform ? `${item.platform.toUpperCase()} - ${item.content_type}` : item.content_type}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      );
                    })}

                    {/* 5. Tasks */}
                    {dayEvents.tasks.map(tTask => {
                      const isUrgent = tTask.priority === 'urgent';
                      const isHigh = tTask.priority === 'high';
                      const completed = isTaskCompleted(tTask);
                      return (
                        <div
                          key={`task-${tTask.id}`}
                          className={`p-3 border rounded-lg flex items-center justify-between text-xs transition-all cursor-pointer ${
                            completed
                              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/40'
                              : isUrgent
                              ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold hover:bg-rose-100/40'
                              : isHigh
                              ? 'bg-orange-50 border-orange-200 text-orange-800 font-semibold hover:bg-orange-100/40'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100/40'
                          }`}
                          onClick={() => handleDayClick(cell.date)}
                        >
                          <div className="flex items-center gap-2">
                            {completed ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <ClipboardList className="size-4 shrink-0 text-slate-500" />}
                            <div>
                              <span className={`font-bold block ${completed ? 'line-through opacity-70' : ''}`}>Task: {tTask.title}</span>
                              {tTask.task_assignees && tTask.task_assignees.length > 0 && (
                                <span className="text-[10px] text-muted-foreground block">
                                  Assignees: {tTask.task_assignees.map(a => a.user?.name).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            completed ? 'bg-emerald-100 text-emerald-700' : isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {completed ? 'Completed' : tTask.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedDate ? formatDate(selectedDate, locale) : t('calendar.dayDetails')}
      >
        {selectedDate && (
          <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1 text-start">
            {/* Payments Section (Owners only) */}
            {isOwner && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <DollarSign className="size-3.5 text-green-500" /> {t('calendar.paymentsScheduled')} ({selectedDayEvents.payments.length})
                </h3>
                
                {selectedDayEvents.payments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDayEvents.payments.map(({ contract, amount }) => {
                      const dateStr3 = selectedDate ? getLocalDateString(selectedDate) : '';
                      const isPaid = contract.installments?.some(
                        inst => inst.due_date?.split('T')[0] === dateStr3 && inst.paid
                      ) || false;
                      return (
                        <div key={contract.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border bg-card ${
                          isPaid ? 'border-l-4 border-l-emerald-500' : ''
                        }`}>
                          <div className="overflow-hidden flex-1 text-start">
                            <div className="flex items-center gap-2">
                              {isPaid && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                              <h4 className={`font-bold text-xs truncate ${isPaid ? 'line-through text-muted-foreground' : ''}`}>{contract.name}</h4>
                              {isPaid && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0">{t('finance.paid')}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                              <span className="font-semibold text-green-600">{formatCurrency(amount, locale)}</span>
                              <span>•</span>
                              <span className="truncate">{t('taskDetail.client')}: {contract.client?.name || 'N/A'}</span>
                              <span>•</span>
                              <span className="capitalize">{getCycleLabel(contract.billing_cycle)}</span>
                            </div>
                          </div>
                          {user?.role === 'owner' && (
                            <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push('/dashboard/finance'); }} className="h-7 text-xs font-semibold shrink-0">
                              {t('common.manage')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic py-2 pl-1 rtl:pr-1 rtl:pl-0 text-start">{t('calendar.noPayments')}</p>
                )}
              </div>
            )}

            {/* Meetings Section (Owners / Sales) */}
            {isOwner && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <Calendar className="size-3.5 text-indigo-500" /> {t('calendar.meetingsScheduled')} ({selectedDayEvents.meetings?.length || 0})
                </h3>
                
                {selectedDayEvents.meetings && selectedDayEvents.meetings.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDayEvents.meetings.map(client => (
                      <div key={client.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="overflow-hidden flex-1 text-start">
                          <h4 className="font-bold text-xs">{t('calendar.meetingWith').replace('{name}', client.name)}</h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            {client.company && (
                              <>
                                <span>{t('calendar.companyLabel')} {client.company}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{t('calendar.phoneLabel')} {client.phone}</span>
                            {client.meeting_date && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {t('calendar.timeLabel')} {formatCairoTime(client.meeting_date, locale)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewLead(client.id)} 
                          className="h-7 text-xs font-semibold shrink-0"
                        >
                          {t('calendar.viewLead')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic py-2 pl-1 rtl:pr-1 rtl:pl-0 text-start">{t('calendar.noMeetings')}</p>
                )}
              </div>
            )}

            {/* Target Slots Section */}
            {selectedDayEvents.targetSlots && selectedDayEvents.targetSlots.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <span className="shrink-0">🎯</span> {t('calendar.deliverablesScheduled') || 'Deliverables Targets'} ({selectedDayEvents.targetSlots.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.targetSlots.map(slot => (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-lg border border-l-4 bg-card flex items-start justify-between gap-3 ${
                        slot.isFilled ? 'border-l-emerald-500' : 'border-l-indigo-500'
                      }`}
                    >
                      <div className="flex-1 overflow-hidden text-start">
                        <h4 className="font-bold text-xs">{slot.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                          <span>{t('taskDetail.client') || 'Client'}: {slot.client_name}</span>
                          <span>•</span>
                          <span className="capitalize">{slot.content_type}</span>
                          {slot.isFilled && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 font-semibold text-[10px]">Filled</span>
                            </>
                          )}
                        </div>
                      </div>
                      {slot.isFilled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsModalOpen(false);
                            if (slot.content) {
                              router.push('/dashboard/content');
                            } else {
                              router.push(`/dashboard/tasks/${slot.id}`);
                            }
                          }}
                          className="h-7 text-xs font-semibold shrink-0"
                        >
                          {t('common.view') || 'View'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Hub Items Section */}
            {selectedDayEvents.contents && selectedDayEvents.contents.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <Sparkles className="size-3.5 text-amber-500" /> {t('contentHub.title') || 'Content Hub'} ({selectedDayEvents.contents.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.contents.map(item => {
                    const published = item.status === 'published';
                    return (
                      <div key={item.id} className={`p-3 rounded-lg border bg-card flex items-start justify-between gap-3 ${
                        published ? 'border-l-4 border-l-emerald-500' : ''
                      }`}>
                        <div className="flex-1 overflow-hidden text-start">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <h4 className="font-bold text-xs truncate max-w-[200px]">{item.title || 'Untitled Content'}</h4>
                            <Badge className={published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'}>
                              {published ? t('contentHub.status.published') : t('contentHub.status.draft')}
                            </Badge>
                            {item.platform && (
                              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 font-semibold uppercase">
                                {item.platform}
                              </Badge>
                            )}
                          </div>
                          {item.caption && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.caption}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground">
                            <span>🎬 {item.content_type}</span>
                            {item.client && (
                              <>
                                <span>•</span>
                                <span>👥 {t('taskDetail.client') || 'Client'}: {item.client.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push('/dashboard/content'); }} className="h-7 text-xs font-semibold shrink-0">
                          {t('common.open') || 'Open'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}



            {/* Tasks Due Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                <ClipboardList className="size-3.5 text-indigo-500" /> {t('calendar.tasksDeadlines')} ({selectedDayEvents.tasks.length})
              </h3>
              {selectedDayEvents.tasks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.tasks.map(tTask => {
                    const taskDone = isTaskCompleted(tTask);
                    return (
                      <div key={tTask.id} className={`p-3 rounded-lg border bg-card flex items-start justify-between gap-3 ${
                        taskDone ? 'border-l-4 border-l-emerald-500' : ''
                      }`}>
                        <div className="flex-1 overflow-hidden text-start">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {taskDone && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                            <h4 className={`font-bold text-xs truncate max-w-[200px] ${taskDone ? 'line-through text-muted-foreground' : ''}`}>{tTask.title}</h4>
                            {taskDone && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0">{t('status.completed')}</Badge>}
                            {!taskDone && <PriorityBadge priority={tTask.priority} />}
                            {!taskDone && (
                              isTaskAdmin ? (
                                tTask.task_assignees && tTask.task_assignees.length > 0 ? (
                                  <Badge variant="outline" className="text-[10px] shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {tTask.task_assignees.filter(a => a.status === 'completed').length}/{tTask.task_assignees.length} {t('calendar.doneLabel')}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] shrink-0">{t('common.unassigned')}</Badge>
                                )
                              ) : (
                                <StatusBadge status={tTask.task_assignees?.find(a => a.user_id === user?.id)?.status || 'todo'} />
                              )
                            )}
                          </div>
                          {tTask.description && !taskDone && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {tTask.description}
                            </p>
                          )}
                          {!taskDone && (
                            <div className="flex flex-col gap-1.5 mt-2">
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground flex-wrap">
                                {tTask.content_type && (
                                  <>
                                    <span>🎬 {t('contentType.' + tTask.content_type)}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>👥 {t('calendar.assigneesLabel')}</span>
                              </div>
                              {tTask.task_assignees && tTask.task_assignees.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {tTask.task_assignees.map(a => (
                                    <div key={a.id} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-[10px]">
                                      <span className="font-semibold text-foreground">{a.user?.name || 'Unknown'}</span>
                                      <StatusBadge status={a.status} className="scale-90 origin-left" />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">{t('calendar.noMembersAssigned')}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push(`/dashboard/tasks/${tTask.id}`); }} className="h-7 text-xs font-semibold shrink-0">
                          {t('common.open')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-2 pl-1 rtl:pr-1 rtl:pl-0 text-start">{t('calendar.noTaskDeadlines')}</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t mt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Lead Detail Modal */}
      <Modal
        isOpen={selectedLeadId !== null}
        onClose={() => {
          setSelectedLeadId(null);
          setLeadDetail(null);
          setLeadLogs([]);
        }}
        title={`📋 ${t('sales.prospectDetails')}`}
        maxWidth={500}
      >
        {loadingLead ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          </div>
        ) : leadDetail ? (
          <div className="flex flex-col gap-4 text-start">
            {/* Lead Status / Stage */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs py-0.5 px-2 font-bold uppercase ${
                    (PIPELINE_STAGE_CONFIG[leadDetail.pipeline_stage] || PIPELINE_STAGE_CONFIG.new_lead).bg
                  } ${
                    (PIPELINE_STAGE_CONFIG[leadDetail.pipeline_stage] || PIPELINE_STAGE_CONFIG.new_lead).color
                  }`}
                >
                  {t((PIPELINE_STAGE_CONFIG[leadDetail.pipeline_stage] || PIPELINE_STAGE_CONFIG.new_lead).labelKey)}
                </Badge>
                {leadDetail.company && (
                  <span className="text-xs font-semibold text-muted-foreground bg-muted border px-2 py-0.5 rounded flex items-center gap-1">
                    <Building2 className="size-3" /> {leadDetail.company}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {locale === 'ar' ? 'الاسم: ' : 'Name: '} <span className="font-bold text-foreground">{leadDetail.name}</span>
              </span>
            </div>

            {/* Contact Details Card */}
            <div className="bg-muted/30 border rounded-xl p-3.5 flex flex-col gap-3">
              {leadDetail.phone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="size-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                    <Phone className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'الهاتف' : 'Phone'}</div>
                    <a href={`tel:${leadDetail.phone}`} className="text-xs font-semibold text-foreground hover:underline">
                      {leadDetail.phone}
                    </a>
                  </div>
                </div>
              )}
              {leadDetail.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="size-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                    <Mail className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('sales.emailLabel')}</div>
                    <span className="text-xs font-semibold text-foreground">{leadDetail.email}</span>
                  </div>
                </div>
              )}
              {leadDetail.meeting_date && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="size-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                    <Calendar className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'تاريخ الاجتماع' : 'Meeting Date'}</div>
                    <span className="text-xs font-semibold text-foreground">
                      {formatCairoDateTime(leadDetail.meeting_date, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Call Logs timeline */}
            <div className="space-y-3.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1">
                <Clock className="size-3" /> {t('sales.callLogs')}
              </h4>
              {leadLogs.length > 0 ? (
                <div className="relative border-l-2 border-border pl-4 ml-2 space-y-4 max-h-[180px] overflow-y-auto pr-1">
                  {leadLogs.map(log => {
                    const outcomeCfg = PIPELINE_STAGE_CONFIG[log.outcome] || PIPELINE_STAGE_CONFIG.new_lead;
                    return (
                      <div key={log.id} className="relative text-xs">
                        <div className="absolute left-[-22px] top-1 size-2 rounded-full border-2 border-white dark:border-background bg-indigo-500 shadow-sm" />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between font-bold text-muted-foreground flex-wrap gap-1 text-[10px]">
                            <span className={`capitalize ${outcomeCfg.color}`}>{t(outcomeCfg.labelKey)}</span>
                            <span>
                              {formatCairoDateTime(log.call_date, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-foreground mt-0.5 whitespace-pre-wrap leading-relaxed">
                            {log.notes || <span className="italic text-muted-foreground/50">{t('sales.noComments')}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic py-2">
                  {t('sales.noCallLogs')}
                </p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedLeadId(null);
                  setLeadDetail(null);
                  setLeadLogs([]);
                  router.push('/dashboard');
                }}
                className="text-xs font-semibold"
              >
                {locale === 'ar' ? 'الذهاب للوحة التحكم' : 'Go to Dashboard'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setSelectedLeadId(null);
                  setLeadDetail(null);
                  setLeadLogs([]);
                }}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-muted-foreground">
            {locale === 'ar' ? 'لم يتم العثور على بيانات العميل المحتمل' : 'No lead details found.'}
          </div>
        )}
      </Modal>
    </div>
  );
}

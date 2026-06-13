'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { tasksApi, contractsApi, clientsApi } from '@/lib/api';
import { Task, Contract, Client } from '@/types';
import Modal from '@/components/Modal';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
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
} from 'lucide-react';

function formatCurrency(amount: number, locale?: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}


function formatDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const fetchClients = (user.role === 'owner' || user.role === 'sales')
      ? clientsApi.list()
      : Promise.resolve({ clients: [] as Client[] });

    Promise.all([fetchTasks, fetchContracts, fetchClients])
      .then(([tasksData, contractsData, clientsData]) => {
        setTasks(tasksData.tasks);
        setContracts(contractsData.contracts);
        setClients(clientsData.clients || []);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load calendar data:', err);
        setError('Failed to fetch tasks, contracts, or clients.');
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

  // Compile all calendar events for the active month view
  const eventsByDay = useMemo(() => {
    const map: Record<string, { tasks: Task[]; payments: { contract: Contract; amount: number }[]; publications: Task[]; meetings: Client[] }> = {};
    
    calendarCells.forEach(cell => {
      const dateStr = getLocalDateString(cell.date);
      map[dateStr] = { tasks: [], payments: [], publications: [], meetings: [] };
    });

    tasks.forEach(task => {
      if (task.due_date) {
        const dateStr = task.due_date;
        if (map[dateStr]) {
          map[dateStr].tasks.push(task);
        }
      }
      if (task.publish_date) {
        const dateStr = task.publish_date.split('T')[0];
        if (map[dateStr]) {
          map[dateStr].publications.push(task);
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
          const dateStr = client.meeting_date.split('T')[0];
          if (map[dateStr]) {
            map[dateStr].meetings.push(client);
          }
        }
      });
    }

    return map;
  }, [calendarCells, tasks, contracts, clients, isOwner]);

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
    if (!selectedDate) return { tasks: [], payments: [], publications: [], meetings: [] };
    const dateStr = getLocalDateString(selectedDate);
    return eventsByDay[dateStr] || { tasks: [], payments: [], publications: [], meetings: [] };
  }, [selectedDate, eventsByDay]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const currentMonthLabel = currentMonth.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

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
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2 bg-card border p-1 rounded-xl shadow-sm shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="secondary" size="sm" onClick={setToday} className="h-8 text-xs font-semibold px-3">
            {t('common.today')}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
          <span className="text-xs font-bold text-foreground px-3 select-none">{currentMonthLabel}</span>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="size-10 rounded bg-muted mb-3" />
                <div className="h-6 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {isOwner ? (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">{t('calendar.projectedRevenue')}</span>
                <DollarSign className="size-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-green-600">{formatCurrency(monthStats.projectedRevenue, locale)}</div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  {t('calendar.dueIn').replace('{month}', currentMonth.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' }))}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">{t('calendar.urgentActions')}</span>
                <AlertTriangle className="size-4 text-rose-500 animate-bounce" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-rose-600">{monthStats.urgentTasks}</div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{t('calendar.urgentTasksPending')}</p>
              </CardContent>
            </Card>
          )}
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('calendar.monthlyDeadlines')}</span>
              <ClipboardList className="size-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{monthStats.totalTasksDue}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                {isOwner ? t('calendar.tasksEndingMonth') : t('calendar.tasksAssigned')}
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('calendar.completionRate')}</span>
              <CheckCircle2 className="size-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-purple-600">{monthStats.completionRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                {t('calendar.completedOf').replace('{completed}', monthStats.completedTasks.toString()).replace('{total}', monthStats.totalTasksDue.toString())}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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
      ) : (
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
              const dayEvents = eventsByDay[dateStr] || { tasks: [], payments: [], publications: [] };
              const isToday = getLocalDateString(new Date()) === dateStr;
              
              const displayTasks = dayEvents.tasks.slice(0, isOwner ? 2 : 3);
              const displayPayments = isOwner ? dayEvents.payments.slice(0, 1) : [];
              const displayPublications = (dayEvents.publications || []).slice(0, 2);
              const displayMeetings = isOwner ? (dayEvents.meetings || []).slice(0, 1) : [];
              const totalItems = displayTasks.length + displayPayments.length + displayPublications.length + displayMeetings.length;
              const actualTotal = dayEvents.tasks.length + dayEvents.payments.length + (dayEvents.publications || []).length + (dayEvents.meetings || []).length;
              const hasMore = actualTotal > totalItems;
              const extraCount = actualTotal - totalItems;

              return (
                <div
                  key={cell.key}
                  onClick={() => handleDayClick(cell.date)}
                  className={`min-h-[100px] p-2 flex flex-col bg-card hover:bg-muted/10 cursor-pointer select-none transition-colors relative text-start ${
                    cell.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/45 bg-muted/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold flex items-center justify-center rounded-full size-5 ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : ''
                    }`}>
                      {cell.date.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 overflow-hidden flex-1 pb-1">
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

                    {/* Publications */}
                    {displayPublications.map(tTask => {
                      const pubCompleted = isTaskCompleted(tTask);
                      return (
                        <div
                          key={`pub-${tTask.id}`}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            pubCompleted
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                              : 'bg-sky-50 border-sky-200 text-sky-700'
                          }`}
                          title={`Publish${pubCompleted ? ' (Done)' : ''}: ${tTask.title}`}
                        >
                          {pubCompleted ? <CheckCircle2 className="size-2.5 shrink-0" /> : <Megaphone className="size-2 shrink-0" />}
                          <span className={pubCompleted ? 'line-through opacity-70' : ''}>{tTask.title}</span>
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
                </div>
              );
            })}
          </div>
        </Card>
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
                                  {t('calendar.timeLabel')} {new Date(client.meeting_date).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => { setIsModalOpen(false); router.push('/dashboard'); }} 
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

            {/* Publications Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                <Megaphone className="size-3.5 text-sky-500" /> {t('calendar.publicationsScheduled')} ({selectedDayEvents.publications.length})
              </h3>
              {selectedDayEvents.publications.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.publications.map(tTask => {
                    const pubDone = isTaskCompleted(tTask);
                    return (
                      <div key={tTask.id} className={`p-3 rounded-lg border border-l-4 bg-card flex items-start justify-between gap-3 ${
                        pubDone ? 'border-l-emerald-500' : 'border-l-sky-500'
                      }`}>
                        <div className="flex-1 overflow-hidden text-start">
                          <div className="flex items-center gap-2">
                            {pubDone && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                            <h4 className={`font-bold text-xs ${pubDone ? 'line-through text-muted-foreground' : ''}`}>{tTask.title}</h4>
                            {pubDone && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0">{t('calendar.doneLabel')}</Badge>}
                          </div>
                          {tTask.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                              {tTask.description}
                            </p>
                          )}
                          {tTask.publish_notes && (
                            <div className="bg-sky-50/50 border border-sky-100 rounded-md p-2 text-[10px] text-sky-800 italic mt-2">
                              📝 {tTask.publish_notes}
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push(`/dashboard/tasks/${tTask.id}`); }} className="h-7 text-xs font-semibold shrink-0">
                          {t('common.view')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-2 pl-1 rtl:pr-1 rtl:pl-0 text-start">{t('calendar.noPublications')}</p>
              )}
            </div>

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
    </div>
  );
}

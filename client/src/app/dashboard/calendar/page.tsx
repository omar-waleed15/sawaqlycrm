'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { tasksApi, contractsApi } from '@/lib/api';
import { Task, Contract } from '@/types';
import Modal from '@/components/Modal';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-Time',
};

export default function CalendarPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isOwner = user?.role === 'owner' || user?.role === 'sales';

  // Load data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchTasks = tasksApi.list();
    const fetchContracts = (user.role === 'owner' || user.role === 'sales')
      ? contractsApi.list() 
      : Promise.resolve({ contracts: [] as Contract[] });

    Promise.all([fetchTasks, fetchContracts])
      .then(([tasksData, contractsData]) => {
        setTasks(tasksData.tasks);
        setContracts(contractsData.contracts);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load calendar data:', err);
        setError('Failed to fetch tasks or contracts.');
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
    const map: Record<string, { tasks: Task[]; payments: { contract: Contract; amount: number }[]; publications: Task[] }> = {};
    
    calendarCells.forEach(cell => {
      const dateStr = getLocalDateString(cell.date);
      map[dateStr] = { tasks: [], payments: [], publications: [] };
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
    }

    return map;
  }, [calendarCells, tasks, contracts, isOwner]);

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
          completedTasks += dayEvents.tasks.filter(t => t.status === 'completed').length;
          urgentTasks += dayEvents.tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
          
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
  }, [calendarCells, eventsByDay, isOwner]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return { tasks: [], payments: [], publications: [] };
    const dateStr = getLocalDateString(selectedDate);
    return eventsByDay[dateStr] || { tasks: [], payments: [], publications: [] };
  }, [selectedDate, eventsByDay]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const currentMonthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="page-header-left">
          <h1 className="page-header-title">{isOwner ? 'Calendar Overview' : 'My Work Calendar'}</h1>
          <p className="page-header-subtitle">
            {isOwner ? 'Track agency payment schedules, content publications, and project deadlines' : 'Track your assigned tasks and due dates'}
          </p>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2 bg-card border p-1 rounded-xl shadow-sm shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={setToday} className="h-8 text-xs font-semibold px-3">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="size-4" />
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
                <span className="text-sm font-medium text-muted-foreground">Projected Revenue</span>
                <DollarSign className="size-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-green-600">{formatCurrency(monthStats.projectedRevenue)}</div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  Due in {currentMonth.toLocaleString('en-US', { month: 'short' })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Urgent Actions</span>
                <AlertTriangle className="size-4 text-rose-500 animate-bounce" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-rose-600">{monthStats.urgentTasks}</div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Urgent tasks pending</p>
              </CardContent>
            </Card>
          )}
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">Monthly Deadlines</span>
              <ClipboardList className="size-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{monthStats.totalTasksDue}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                {isOwner ? 'Tasks ending this month' : 'Tasks assigned to you'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">Completion Rate</span>
              <CheckCircle2 className="size-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-purple-600">{monthStats.completionRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                Completed: {monthStats.completedTasks} / {monthStats.totalTasksDue} tasks
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
          <p className="text-sm text-muted-foreground">Loading calendar schedule...</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-border shadow-md">
          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 border-b bg-muted/40 font-semibold text-xs text-muted-foreground select-none text-center py-2.5">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
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
              const totalItems = displayTasks.length + displayPayments.length + displayPublications.length;
              const actualTotal = dayEvents.tasks.length + dayEvents.payments.length + (dayEvents.publications || []).length;
              const hasMore = actualTotal > totalItems;
              const extraCount = actualTotal - totalItems;

              return (
                <div
                  key={cell.key}
                  onClick={() => handleDayClick(cell.date)}
                  className={`min-h-[100px] p-2 flex flex-col bg-card hover:bg-muted/10 cursor-pointer select-none transition-colors relative ${
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
                    {isOwner && displayPayments.map(({ contract, amount }) => (
                      <div
                        key={`pay-${contract.id}-${amount}`}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 truncate flex items-center gap-0.5"
                        title={`Payment due: $${amount} - ${contract.name}`}
                      >
                        <DollarSign className="size-2 shrink-0" />
                        <span>{formatCurrency(amount)}</span>
                      </div>
                    ))}

                    {/* Publications */}
                    {displayPublications.map(task => (
                      <div
                        key={`pub-${task.id}`}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 truncate flex items-center gap-0.5"
                        title={`Publish: ${task.title}`}
                      >
                        <Megaphone className="size-2 shrink-0" />
                        <span>{task.title}</span>
                      </div>
                    ))}

                    {/* Tasks */}
                    {displayTasks.map(task => {
                      const isUrgent = task.priority === 'urgent';
                      const isHigh = task.priority === 'high';
                      return (
                        <div
                          key={`task-${task.id}`}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            task.status === 'completed'
                              ? 'bg-purple-50 border-purple-200 text-purple-700 line-through opacity-70'
                              : isUrgent
                              ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              : isHigh
                              ? 'bg-orange-50 border-orange-200 text-orange-700'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}
                          title={`Task: ${task.title}`}
                        >
                          <span>☑ {task.title}</span>
                        </div>
                      );
                    })}

                    {/* More indicator */}
                    {hasMore && (
                      <div className="text-[8px] font-extrabold text-muted-foreground text-center mt-auto bg-muted/40 py-0.5 rounded border border-dashed border-border/80">
                        +{extraCount} more events
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
        title={selectedDate ? formatDate(selectedDate) : 'Day Details'}
      >
        {selectedDate && (
          <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Payments Section (Owners only) */}
            {isOwner && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <DollarSign className="size-3.5 text-green-500" /> Payments Scheduled ({selectedDayEvents.payments.length})
                </h3>
                
                {selectedDayEvents.payments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDayEvents.payments.map(({ contract, amount }) => (
                      <div key={contract.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-xs truncate">{contract.name}</h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            <span className="font-semibold text-green-600">{formatCurrency(amount)}</span>
                            <span>•</span>
                            <span className="truncate">Client: {contract.client?.name || 'N/A'}</span>
                            <span>•</span>
                            <span className="capitalize">{CYCLE_LABELS[contract.billing_cycle] || contract.billing_cycle}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push('/dashboard/finance'); }} className="h-7 text-xs font-semibold shrink-0">
                          Manage
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic py-2 pl-1">No payments scheduled on this date.</p>
                )}
              </div>
            )}

            {/* Publications Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                <Megaphone className="size-3.5 text-sky-500" /> Publications Scheduled ({selectedDayEvents.publications.length})
              </h3>
              
              {selectedDayEvents.publications.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.publications.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border border-l-4 border-l-sky-500 bg-card flex items-start justify-between gap-3">
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-xs">{task.title}</h4>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        {task.publish_notes && (
                          <div className="bg-sky-50/50 border border-sky-100 rounded-md p-2 text-[10px] text-sky-800 italic mt-2">
                            📝 {task.publish_notes}
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push(`/dashboard/tasks/${task.id}`); }} className="h-7 text-xs font-semibold shrink-0">
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-2 pl-1">No publications scheduled on this date.</p>
              )}
            </div>

            {/* Tasks Due Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                <ClipboardList className="size-3.5 text-indigo-500" /> Tasks Deadlines ({selectedDayEvents.tasks.length})
              </h3>
              
              {selectedDayEvents.tasks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.tasks.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3">
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <h4 className="font-bold text-xs truncate max-w-[200px]">{task.title}</h4>
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-2">
                          {task.assignee ? (
                            <span>👤 Assigned to: {task.assignee.name}</span>
                          ) : (
                            <span>👤 Unassigned</span>
                          )}
                          {task.content_type && (
                            <>
                              <span>•</span>
                              <span>🎬 {task.content_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { setIsModalOpen(false); router.push(`/dashboard/tasks/${task.id}`); }} className="h-7 text-xs font-semibold shrink-0">
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-2 pl-1">No task deadlines due on this date.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t mt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

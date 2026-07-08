'use client';

import { useState, useMemo } from 'react';
import { ClientContentPlan } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  ExternalLink,
  CheckCircle2,
  Megaphone,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  target_outline: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
};

const TYPE_STYLES: Record<string, string> = {
  post: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  reel: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300',
  story: 'bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300',
  photo: 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300',
  video: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  carousel: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
};

const DOT_COLORS: Record<string, string> = {
  post: '#3b82f6',
  reel: '#a855f7',
  story: '#ec4899',
  photo: '#14b8a6',
  video: '#ef4444',
  carousel: '#6366f1',
};

interface ClosedClientCalendarProps {
  clientId: string;
  plans: ClientContentPlan[];
  client: any;
}

export default function ClosedClientCalendar({ clientId, plans, client }: ClosedClientCalendarProps) {
  const { t, locale } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Convert deliverables schedule dates into virtual slots
  const virtualSlots = useMemo(() => {
    const slots: any[] = [];
    if (!client || !client.deliverables_schedule) return slots;

    const schedule = client.deliverables_schedule;
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
    const typeKeyMap: Record<string, string> = {
      posts: 'post',
      reels: 'reel',
      stories: 'story',
      photos: 'photo',
    };

    types.forEach(tKey => {
      const dates = (scheduleObj && scheduleObj[tKey]) || [];
      dates.forEach((dateStr: string, idx: number) => {
        if (!dateStr) return;
        
        // Find matching content plan items for this type on this day
        const typeKey = typeKeyMap[tKey];
        const targetDateStr = dateStr.substring(0, 10);
        const matchingPlans = plans
          .filter(p => 
            p.scheduled_date && 
            p.scheduled_date.substring(0, 10) === targetDateStr && 
            p.content_type === typeKey
          )
          .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

        if (idx < matchingPlans.length) {
          const matchedPlan = matchingPlans[idx];
          slots.push({
            id: matchedPlan.id,
            title: `🎯 ${matchedPlan.title}`,
            content_type: typeKey,
            status: matchedPlan.status, // Use actual status (draft, approved, published)
            scheduled_date: dateStr,
            isTargetSlot: true,
            isFilled: true,
            plan: matchedPlan,
          });
        } else {
          slots.push({
            id: `target-${tKey}-${idx}`,
            title: `🎯 Target ${typeLabelMap[tKey]} ${idx + 1}`,
            content_type: typeKey,
            status: 'target_outline', // Custom status for styling
            scheduled_date: dateStr,
            isTargetSlot: true,
            isFilled: false,
          });
        }
      });
    });

    return slots;
  }, [client, plans]);

  const allCalendarItems = useMemo(() => {
    // Filter out content plans that filled a target slot so they are not rendered twice
    const filledPlanIds = virtualSlots
      .filter(slot => slot.isFilled && slot.plan)
      .map(slot => slot.plan.id);

    const unfilledPlans = plans.filter(p => !filledPlanIds.includes(p.id));
    return [...unfilledPlans, ...virtualSlots];
  }, [plans, virtualSlots]);

  // Filter plans that are scheduled
  const scheduledPlans = useMemo(() => {
    return allCalendarItems.filter(p => !!p.scheduled_date);
  }, [allCalendarItems]);

  // Index scheduled plans by date for O(1) cell lookup
  const plansByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    scheduledPlans.forEach(plan => {
      if (plan.scheduled_date) {
        const key = plan.scheduled_date.substring(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(plan);
      }
    });
    return map;
  }, [scheduledPlans]);

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }, [calendarMonth]);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString(
    locale === 'ar' ? 'ar-EG' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d =>
    locale === 'ar'
      ? new Date(2024, 0, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d) + 7).toLocaleDateString('ar-EG', { weekday: 'short' })
      : d
  );

  // Selected date details
  const selectedDatePlans = selectedDate ? plansByDate.get(selectedDate) || [] : [];

  const handlePrevMonth = () => {
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const formatFullDateStr = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground">{t('closedClients.calendar.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('closedClients.calendar.subtitle')}</p>
      </div>

      {/* Calendar Card - 100% Width */}
      <Card className="border border-border bg-card w-full shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-5" />
            </button>
            <h4 className="text-base font-bold text-foreground">{monthLabel}</h4>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`pad-${idx}`} className="bg-muted/10 rounded-md" />;
              
              const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPlans = plansByDate.get(dateStr) || [];
              const isSelected = selectedDate === dateStr;
              const today = new Date();
              const isToday = today.getFullYear() === calendarMonth.year && today.getMonth() === calendarMonth.month && today.getDate() === day;

              const displayPlans = dayPlans.slice(0, 2);
              const totalItems = displayPlans.length;
              const hasMore = dayPlans.length > totalItems;
              const extraCount = dayPlans.length - totalItems;

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setIsModalOpen(true);
                  }}
                  className={`min-h-[100px] p-2 flex flex-col bg-card hover:bg-muted/10 cursor-pointer select-none transition-colors border text-start ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 ring-1 ring-indigo-500'
                      : isToday
                      ? 'border-indigo-200 bg-indigo-50/10 dark:border-indigo-800/40 dark:bg-indigo-950/5'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-bold flex items-center justify-center rounded-full size-5 ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-foreground'
                    }`}>
                      {day}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 overflow-hidden flex-1 pb-1">
                    {displayPlans.map(plan => {
                      const isTarget = plan.status === 'target_outline';
                      return (
                        <div
                          key={plan.id}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                            isTarget
                              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300'
                              : 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/20 dark:border-sky-900/40 dark:text-sky-300'
                          }`}
                          title={plan.title}
                        >
                          <span className="shrink-0">{isTarget ? '🎯' : '📝'}</span>
                          <span>{plan.title}</span>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <div className="text-[8px] font-extrabold text-muted-foreground text-center mt-auto bg-muted/40 py-0.5 rounded border border-dashed border-border/80">
                        +{extraCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedDate ? formatFullDateStr(selectedDate) : t('closedClients.calendar.title')}
      >
        {selectedDate && (
          <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1 text-start">
            {/* Target Slots Section */}
            {selectedDatePlans.filter(p => p.isTargetSlot).length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <span className="shrink-0">🎯</span> {t('calendar.deliverablesScheduled') || 'Deliverables Targets'} ({selectedDatePlans.filter(p => p.isTargetSlot).length})
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedDatePlans
                    .filter(p => p.isTargetSlot)
                    .map(slot => (
                      <div
                        key={slot.id}
                        className={`p-3 rounded-lg border border-l-4 bg-card flex items-start justify-between gap-3 ${
                          slot.isFilled ? 'border-l-emerald-500' : 'border-l-indigo-500'
                        }`}
                      >
                        <div className="flex-1 overflow-hidden text-start">
                          <h4 className="font-bold text-xs">{slot.title}</h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            <span>{t('taskDetail.client') || 'Client'}: {client?.name || ''}</span>
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
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Content Plan Items Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                <Megaphone className="size-3.5 text-sky-500" /> {t('closedClients.plan.title')} ({selectedDatePlans.filter(p => !p.isTargetSlot).length})
              </h3>
              {selectedDatePlans.filter(p => !p.isTargetSlot).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedDatePlans
                    .filter(p => !p.isTargetSlot)
                    .map(plan => (
                      <Card key={plan.id} className="border border-border bg-card">
                        <CardContent className="p-4 flex flex-col gap-2">
                          <h5 className="text-sm font-semibold text-foreground">{plan.title}</h5>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {plan.content_type && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_STYLES[plan.content_type] || 'bg-muted text-muted-foreground'}`}>
                                {t(`closedClients.plan.${plan.content_type}`) || plan.content_type}
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[plan.status]}`}>
                              {t(`closedClients.plan.${plan.status}`) || plan.status}
                            </span>
                          </div>

                          {plan.drive_link && (
                            <a
                              href={plan.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 w-fit"
                            >
                              <ExternalLink className="size-3" /> {t('closedClients.plan.driveLink')}
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-2 pl-1 rtl:pr-1 rtl:pl-0 text-start">
                  {t('closedClients.calendar.noScheduled')}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

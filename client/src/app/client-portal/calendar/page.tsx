'use client';

import { useEffect, useState, useMemo } from 'react';
import { request } from '@/lib/api';
import { Client, ClientContentPlan } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, Calendar as CalendarIcon, Megaphone, X } from 'lucide-react';

interface PortalData {
  client: Client;
  contentPlans: ClientContentPlan[];
}

const TYPE_STYLES: Record<string, string> = {
  post: 'bg-[#0c2411] border-[#1b3d22] text-[#4ade80]',
  reel: 'bg-[#082430] border-[#153e4f] text-[#22d3ee]',
  story: 'bg-[#200a35] border-[#3b1c55] text-[#c084fc]',
  photo: 'bg-[#321e06] border-[#58390c] text-[#fbbf24]',
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-[#0c2411] border-[#1b3d22] text-[#4ade80]',
  approved: 'bg-[#1D61E7]/10 border-[#1D61E7]/30 text-[#60a5fa]',
};

export default function ClientPortalCalendarPage() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [calendarMonth, setCalendarMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => setData(res))
      .catch((err: any) => setError(err.message || 'Failed to load calendar schedule'))
      .finally(() => setLoading(false));
  }, []);

  const client = data?.client;
  const plans = useMemo(() => data?.contentPlans || [], [data]);

  const mockPlans: ClientContentPlan[] = [
    {
      id: 'mock-c-1',
      client_id: '1',
      title: 'How Sawaqly Optimizes Your Ads Campaign',
      content_type: 'post',
      status: 'published',
      scheduled_date: '2026-07-06',
      notes: 'Explaining our dynamic ads scaling and high CTR layouts.',
      drive_link: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z'
    },
    {
      id: 'mock-c-2',
      client_id: '1',
      title: '3 Growth Hacking Secrets for E-Commerce Brands',
      content_type: 'reel',
      status: 'approved',
      scheduled_date: '2026-07-10',
      notes: 'Quick hooks and transitions for TikTok and IG Reels.',
      drive_link: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z'
    },
    {
      id: 'mock-c-3',
      client_id: '1',
      title: 'Interactive Q&A Session - Join Us Live!',
      content_type: 'story',
      status: 'approved',
      scheduled_date: '2026-07-15',
      notes: 'Interactive stickers and QA box template.',
      drive_link: '',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z'
    },
    {
      id: 'mock-c-4',
      client_id: '1',
      title: 'Brand Aesthetics Showcase Design Portfolio',
      content_type: 'photo',
      status: 'published',
      scheduled_date: '2026-07-20',
      notes: 'Visual showcase of curated graphics and color palettes.',
      drive_link: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z'
    }
  ];

  const mockSchedule = {
    posts: ['2026-07-06T00:00:00.000Z', '2026-07-20T00:00:00.000Z'],
    reels: ['2026-07-10T00:00:00.000Z'],
    stories: ['2026-07-15T00:00:00.000Z'],
    photos: []
  };

  const clientToUse = client ? {
    ...client,
    deliverables_schedule: client.deliverables_schedule || JSON.stringify(mockSchedule)
  } : {
    id: 1,
    name: 'Mock Brand',
    deliverables_schedule: JSON.stringify(mockSchedule)
  } as any;

  const plansToUse = useMemo(() => {
    if (plans && plans.length > 0) return plans;
    return mockPlans;
  }, [plans]);

  const virtualSlots = useMemo(() => {
    const slots: any[] = [];
    if (!clientToUse || !clientToUse.deliverables_schedule) return slots;

    const schedule = clientToUse.deliverables_schedule;
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
      posts: locale === 'ar' ? 'منشور' : 'Post',
      reels: locale === 'ar' ? 'ريل' : 'Reel',
      stories: locale === 'ar' ? 'ستوري' : 'Story',
      photos: locale === 'ar' ? 'صورة' : 'Photo',
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
        
        const typeKey = typeKeyMap[tKey];
        const targetDateStr = dateStr.substring(0, 10);
        const matchingPlans = plansToUse
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
            title: matchedPlan.title,
            content_type: typeKey,
            status: matchedPlan.status,
            scheduled_date: dateStr,
            isTargetSlot: true,
            isFilled: true,
            plan: matchedPlan,
          });
        } else {
          slots.push({
            id: `target-${tKey}-${idx}`,
            title: `Slot • ${typeLabelMap[tKey]}`,
            content_type: typeKey,
            status: 'target_outline',
            scheduled_date: dateStr,
            isTargetSlot: true,
            isFilled: false,
          });
        }
      });
    });

    return slots;
  }, [clientToUse, plansToUse]);

  const allCalendarItems = useMemo(() => {
    const filledPlanIds = virtualSlots
      .filter(slot => slot.isFilled && slot.plan)
      .map(slot => slot.plan.id);

    const unfilledPlans = plansToUse.filter(p => !filledPlanIds.includes(p.id));
    return [...unfilledPlans, ...virtualSlots];
  }, [plansToUse, virtualSlots]);

  const scheduledPlans = useMemo(() => {
    return allCalendarItems.filter(p => !!p.scheduled_date);
  }, [allCalendarItems]);

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

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  }, [calendarMonth]);

  const monthLabel = useMemo(() => {
    return new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarMonth, locale]);

  const dayNames = locale === 'ar'
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedDatePlans = useMemo(() => {
    if (!selectedDate) return [];
    return plansByDate.get(selectedDate) || [];
  }, [selectedDate, plansByDate]);

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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="size-5 animate-spin text-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#1c0e11] border border-[#481c22] text-[#f87171] text-[10px] uppercase font-mono tracking-wider px-4 py-3 rounded-none max-w-md mx-auto">
        {error || 'Failed to load calendar'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-[#0F172A] text-start font-sans" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-6">
        <h1 className="text-xl font-extrabold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.editorialCalendar')}</h1>
        <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold mt-1 text-start">{t('portal.editorialCalendarDesc')}</p>
      </div>

      {/* Calendar Card */}
      <div className="border border-[#E2E8F0] bg-white w-full p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-6" dir="ltr">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-slate-700 hover:text-slate-900 rounded-full transition-colors shadow-xs"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-widest font-mono">{monthLabel}</h4>
          <button
            onClick={handleNextMonth}
            className="p-1.5 border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-slate-700 hover:text-slate-900 rounded-full transition-colors shadow-xs"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[9px] font-bold text-[#64748B] uppercase tracking-widest py-1 font-mono">
              {d}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="grid grid-cols-7 gap-1 bg-[#E2E8F0] p-0.5 border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`pad-${idx}`} className="bg-slate-50 min-h-[95px]" />;
            
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
                className={`min-h-[95px] p-2 flex flex-col bg-white hover:bg-slate-50 cursor-pointer select-none transition-colors border text-start ${
                  isSelected
                    ? 'border-[#1D61E7] ring-1 ring-[#1D61E7]/30'
                    : isToday
                    ? 'border-[#FFD200] bg-yellow-50/10'
                    : 'border-[#F1F5F9]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-bold font-mono flex items-center justify-center size-5 rounded-full ${
                    isToday ? 'bg-[#1D61E7] text-white font-extrabold' : 'text-[#94A3B8]'
                  }`}>
                    {day}
                  </span>
                </div>

                <div className="flex flex-col gap-1 overflow-hidden flex-1 pb-1">
                  {displayPlans.map(plan => {
                    const isUnfilledTarget = plan.status === 'target_outline';
                    return (
                      <div
                        key={plan.id}
                        className={`text-[8px] font-extrabold px-1.5 py-0.5 border uppercase tracking-wider font-mono truncate flex items-center gap-1 rounded-md ${
                          isUnfilledTarget
                            ? 'bg-slate-50 border-dashed border-[#E2E8F0] text-slate-500'
                            : plan.status === 'published'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-[#1D61E7]/10 border-[#1D61E7]/25 text-[#1D61E7]'
                        }`}
                        title={plan.title}
                      >
                        <span className="shrink-0">{isUnfilledTarget ? '○' : '●'}</span>
                        <span>{plan.title}</span>
                      </div>
                    );
                  })}

                  {hasMore && (
                    <div className="text-[7px] font-extrabold text-[#64748B] text-center mt-auto bg-slate-100 py-0.5 border border-dashed border-[#E2E8F0] rounded-md">
                      +{extraCount} {locale === 'ar' ? 'المزيد' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Handcrafted Custom Modal Popup */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-[430px] border border-[#E2E8F0] bg-white p-6 shadow-2xl flex flex-col gap-5 text-[#0F172A] max-h-[85vh] rounded-2xl text-start">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 text-start">
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-widest font-mono">{t('portal.selectedDate')}</span>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">{formatFullDateStr(selectedDate)}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-7 w-7 flex items-center justify-center border border-[#E2E8F0] hover:border-slate-300 text-slate-400 hover:text-slate-700 transition-colors bg-[#F8FAFC] rounded-lg shadow-xs"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex flex-col gap-5 overflow-y-auto pr-1">
              
              {/* Target Outline Slots */}
              {selectedDatePlans.filter(p => p.isTargetSlot).length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 font-mono text-start">
                    {t('portal.contentOutlines')} ({selectedDatePlans.filter(p => p.isTargetSlot).length})
                  </h4>
                  <div className="flex flex-col gap-2">
                    {selectedDatePlans
                       .filter(p => p.isTargetSlot)
                       .map(slot => (
                        <div
                          key={slot.id}
                          className={`p-3 border flex items-center justify-between gap-3 text-start rounded-xl ${
                            slot.isFilled ? 'border-[#E2E8F0] bg-[#F8FAFC]' : 'border-dashed border-[#E2E8F0] bg-transparent'
                          }`}
                        >
                          <div className="flex-1 overflow-hidden space-y-1 text-start">
                            <h5 className="font-bold text-[10px] text-[#0F172A] uppercase tracking-wider font-mono">{slot.title}</h5>
                            <div className="flex items-center gap-2 text-[8px] text-[#64748B] font-bold uppercase font-mono">
                              <span>{slot.content_type}</span>
                              {slot.isFilled && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-600">{t('portal.filled')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {slot.isFilled && slot.plan?.drive_link && (
                            <a
                              href={slot.plan.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 border border-[#E2E8F0] hover:border-[#1D61E7] bg-white text-[9px] font-bold uppercase tracking-widest font-mono text-[#1D61E7] hover:text-[#1553c7] transition-all rounded-lg shadow-xs"
                            >
                              <ExternalLink className="size-3" /> {t('portal.viewAsset')}
                            </a>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Other Scheduled Plans */}
              <div className="flex flex-col gap-2">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 font-mono text-start">
                  <Megaphone className="size-3.5 shrink-0" /> {t('portal.scheduledPubs')} ({selectedDatePlans.filter(p => !p.isTargetSlot).length})
                </h4>
                {selectedDatePlans.filter(p => !p.isTargetSlot).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDatePlans
                      .filter(p => !p.isTargetSlot)
                      .map(plan => (
                        <div key={plan.id} className="border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col gap-3 text-start rounded-xl">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider font-mono">{plan.title}</h5>
                            <span className={`inline-flex items-center px-1.5 py-0.5 border text-[8px] font-mono font-extrabold uppercase tracking-wider rounded-md ${STATUS_STYLES[plan.status]}`}>
                              {plan.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            {plan.content_type && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 border text-[8px] font-mono font-extrabold uppercase tracking-wider rounded-md ${TYPE_STYLES[plan.content_type] || 'border-[#E2E8F0] text-slate-400'}`}>
                                {plan.content_type}
                              </span>
                            )}
                          </div>

                          {plan.drive_link && (
                            <a
                              href={plan.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest font-mono text-[#1D61E7] hover:text-[#1553c7] mt-1 w-fit transition-colors"
                            >
                              <ExternalLink className="size-3" /> {t('portal.viewAsset')}
                            </a>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono py-2 text-start italic">
                    {t('portal.noPubs')}
                  </p>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

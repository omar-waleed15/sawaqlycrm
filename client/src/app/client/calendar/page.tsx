'use client';

import { useEffect, useState, useMemo } from 'react';
import { request } from '@/lib/api';
import { Client, ClientContentPlan, ContentItem } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { getCairoDateString } from '@/lib/dateUtils';
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, Calendar as CalendarIcon, Megaphone, X } from 'lucide-react';

interface PortalData {
  client: Client;
  contentPlans: ClientContentPlan[];
  contents: ContentItem[];
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
  draft: 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
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
  const contents = useMemo(() => data?.contents || [], [data]);

  const clientToUse = client || null;

  const plansToUse = useMemo(() => {
    return [...(contents || []), ...(plans || [])];
  }, [contents, plans]);

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
        const targetDateStr = getCairoDateString(dateStr);
        
        const matchingContents = contents
          .filter(c => 
            c.scheduled_date && 
            getCairoDateString(c.scheduled_date) === targetDateStr && 
            (c.content_type || '').toLowerCase().includes(typeKey)
          )
          .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

        const matchingPlans = plansToUse
          .filter(p => 
            p.scheduled_date && 
            getCairoDateString(p.scheduled_date) === targetDateStr && 
            (p.content_type || '').toLowerCase().includes(typeKey)
          )
          .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

        if (idx < matchingContents.length) {
          const matchedContent = matchingContents[idx];
          slots.push({
            id: matchedContent.id,
            title: matchedContent.title || matchedContent.caption || `Slot • ${typeLabelMap[tKey]}`,
            content_type: typeKey,
            scheduled_date: dateStr,
            isTargetSlot: true,
            isFilled: true,
            content: matchedContent,
          });
        } else if (idx < matchingPlans.length) {
          const matchedPlan = matchingPlans[idx];
          slots.push({
            id: matchedPlan.id,
            title: matchedPlan.title,
            content_type: typeKey,
            status: (matchedPlan as any).status,
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
  }, [clientToUse, plansToUse, contents]);

  const allCalendarItems = useMemo(() => {
    const filledPlanIds = virtualSlots
      .filter(slot => slot.isFilled && (slot.plan || slot.content))
      .map(slot => slot.plan?.id || slot.content?.id);

    const unfilledPlans = plansToUse.filter(p => !filledPlanIds.includes(p.id));
    const combined = [...unfilledPlans, ...virtualSlots];

    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [plansToUse, virtualSlots]);

  const scheduledPlans = useMemo(() => {
    return allCalendarItems.filter(p => !!p.scheduled_date);
  }, [allCalendarItems]);

  const plansByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    scheduledPlans.forEach(plan => {
      if (plan.scheduled_date) {
        const key = getCairoDateString(plan.scheduled_date);
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
                  {displayPlans.map((plan, pIdx) => {
                    const isUnfilledTarget = plan.status === 'target_outline';
                    return (
                      <div
                        key={`${plan.id}-${pIdx}`}
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

                          {slot.isFilled && (slot.content?.drive_link || slot.plan?.drive_link) && (
                            <a
                              href={slot.content?.drive_link || slot.plan?.drive_link}
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
                        <div key={plan.id} className="border border-[#E2E8F0] bg-white p-4 flex flex-col gap-3 text-start rounded-xl shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider font-mono">{plan.title || 'Untitled Content'}</h5>
                            <span className={`inline-flex items-center px-1.5 py-0.5 border text-[8px] font-mono font-extrabold uppercase tracking-wider rounded-md ${STATUS_STYLES[plan.status] || ''}`}>
                              {plan.status}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {plan.content_type && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 border text-[8px] font-mono font-extrabold uppercase tracking-wider rounded-md ${TYPE_STYLES[plan.content_type] || 'border-[#E2E8F0] text-slate-400'}`}>
                                {plan.content_type}
                              </span>
                            )}
                            {plan.platform && (
                              <span className="inline-flex items-center px-1.5 py-0.5 border border-[#1D61E7]/20 bg-[#1D61E7]/5 text-[8px] font-mono font-extrabold uppercase tracking-wider rounded-md text-[#1D61E7]">
                                {plan.platform}
                              </span>
                            )}
                          </div>

                          {plan.caption && (
                            <p className="text-[10px] text-[#64748B] mt-2 leading-relaxed bg-[#F8FAFC] p-2.5 border border-[#E2E8F0] rounded-xl whitespace-pre-wrap">
                              {plan.caption}
                            </p>
                          )}

                          {plan.sound && (
                            <p className="text-[9px] text-[#64748B] font-mono flex items-center gap-1">
                              <span>🎵</span> <span className="truncate">{plan.sound}</span>
                            </p>
                          )}

                          {plan.media_urls && plan.media_urls.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto mt-2 py-1">
                              {plan.media_urls.map((url: string, index: number) => {
                                const isVideo = url.toLowerCase().endsWith('.mp4') || url.includes('/video/');
                                return (
                                  <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="size-12 shrink-0 rounded-lg overflow-hidden border border-[#E2E8F0] bg-slate-900 flex items-center justify-center relative hover:opacity-85 transition-opacity">
                                    {isVideo ? (
                                      <span className="text-[8px] text-white font-mono font-bold">VIDEO</span>
                                    ) : (
                                      <img src={url} alt="" className="size-full object-cover" />
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          )}

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

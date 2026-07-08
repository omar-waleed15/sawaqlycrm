'use client';

import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { ClientContentPlan } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Loader2, ExternalLink, FileText, Calendar } from 'lucide-react';

interface PortalData {
  contentPlans: ClientContentPlan[];
}

export default function ClientContentHistoryPage() {
  const { t, locale } = useLanguage();
  const [plans, setPlans] = useState<ClientContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => setPlans(res.contentPlans))
      .catch((err: any) => setError(err.message || 'Failed to load content schedule'))
      .finally(() => setLoading(false));
  }, []);

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

  const plansToUse = plans && plans.length > 0 ? plans : mockPlans;

  const getContentTypeBadgeColor = (type?: string) => {
    switch (type) {
      case 'post': return 'border-[#1b3d22] text-[#4ade80] bg-[#0c2411]';
      case 'reel': return 'border-[#153e4f] text-[#22d3ee] bg-[#082430]';
      case 'story': return 'border-[#3b1c55] text-[#c084fc] bg-[#200a35]';
      case 'photo': return 'border-[#58390c] text-[#fbbf24] bg-[#321e06]';
      default: return 'border-[#2d2d34] text-[#a1a1b5] bg-[#0c0c0e]';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'published'
      ? 'border-[#1b3d22] text-[#4ade80] bg-[#0c2411]'
      : 'border-[#1D61E7]/40 text-[#60a5fa] bg-[#1D61E7]/10'; // approved with Sawaqly Blue
  };

  const formatPlanDate = (dateStr?: string) => {
    if (!dateStr) return locale === 'ar' ? 'غير مجدول' : 'Not scheduled';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-8 text-[#0F172A] text-start font-sans" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-6">
        <h1 className="text-xl font-extrabold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.monthlyPlan')}</h1>
        <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold mt-1 text-start">{t('portal.monthlyPlanDesc')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-5 animate-spin text-[#1D61E7]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase font-mono tracking-wider px-4 py-3 rounded-lg max-w-md mx-auto">
          {error}
        </div>
      ) : plansToUse.length === 0 ? (
        <div className="border border-dashed border-[#E2E8F0] bg-white py-16 text-center rounded-xl flex flex-col items-center justify-center gap-3 shadow-xs">
          <FileText className="size-8 text-[#94A3B8]" />
          <h3 className="text-[10px] font-bold text-[#0F172A] uppercase tracking-widest font-mono">{t('portal.noContent')}</h3>
          <p className="text-[10px] text-[#64748B] max-w-[320px] leading-relaxed uppercase tracking-wider font-semibold text-center">
            {t('portal.noContentDesc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plansToUse.map(plan => (
            <div key={plan.id} className="border border-[#E2E8F0] bg-white hover:border-[#1D61E7]/50 transition-all p-5 flex flex-col justify-between rounded-xl shadow-xs text-start">
              <div className="flex flex-col gap-4">
                
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {plan.content_type && (
                    <span className={`px-2 py-0.5 text-[8px] font-mono font-bold border uppercase tracking-wider ${getContentTypeBadgeColor(plan.content_type)}`}>
                      {plan.content_type}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[8px] font-mono font-bold border uppercase tracking-wider ${getStatusBadgeColor(plan.status)}`}>
                    {plan.status}
                  </span>
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">{plan.title}</h4>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-semibold uppercase tracking-wider font-mono">
                  <Calendar className="size-3.5 text-[#94A3B8]" />
                  <span>{formatPlanDate(plan.scheduled_date)}</span>
                </div>
              </div>

              {/* Action Button */}
              {plan.drive_link && (
                <div className="border-t border-[#E2E8F0] mt-5 pt-4 flex items-center justify-end">
                  <a
                    href={plan.drive_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest text-[#1D61E7] hover:text-[#1553c7] transition-colors"
                  >
                    <ExternalLink className="size-3" /> {t('portal.viewAsset')}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

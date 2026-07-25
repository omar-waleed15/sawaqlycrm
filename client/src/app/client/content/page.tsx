'use client';

import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { ClientContentPlan, ContentItem } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { ContentTable } from '@/components/content-hub/ContentTable';
import { Loader2, FileText } from 'lucide-react';

interface PortalData {
  client: any;
  contentPlans: ClientContentPlan[];
  contents: ContentItem[];
}

export default function ClientContentHistoryPage() {
  const { t, locale } = useLanguage();
  const [plans, setPlans] = useState<ClientContentPlan[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => {
        setPlans(res.contentPlans || []);
        setContents(res.contents || []);
      })
      .catch((err: any) => setError(err.message || 'Failed to load content schedule'))
      .finally(() => setLoading(false));
  }, []);

  const combined = [...(contents || []), ...(plans || [])];
  const contentsToUse: ContentItem[] = Array.from(
    new Map(combined.map(item => [item.id, { ...item, content_type: (item.content_type || 'post') as any }])).values()
  );

  return (
    <div className="flex flex-col gap-8 text-[#0F172A] text-start font-sans w-full max-w-full overflow-x-hidden" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      
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
      ) : contentsToUse.length === 0 ? (
        <div className="border border-dashed border-[#E2E8F0] bg-white py-16 text-center rounded-xl flex flex-col items-center justify-center gap-3 shadow-xs">
          <FileText className="size-8 text-[#94A3B8]" />
          <h3 className="text-[10px] font-bold text-[#0F172A] uppercase tracking-widest font-mono">{t('portal.noContent')}</h3>
          <p className="text-[10px] text-[#64748B] max-w-[320px] leading-relaxed uppercase tracking-wider font-semibold text-center">
            {t('portal.noContentDesc')}
          </p>
        </div>
      ) : (
        <ContentTable
          items={contentsToUse}
          showClientColumn={false}
          canManage={false}
        />
      )}
    </div>
  );
}

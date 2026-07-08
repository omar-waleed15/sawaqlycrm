'use client';

import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Loader2, Settings, ShieldAlert, Globe } from 'lucide-react';

interface PortalData {
  client: Client;
}

export default function ClientPortalSettingsPage() {
  const { t, locale } = useLanguage();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => setClient(res.client))
      .catch((err: any) => setError(err.message || 'Failed to load brand settings'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="size-5 animate-spin text-[#1D61E7]" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase font-mono tracking-wider px-4 py-3 rounded-lg max-w-md mx-auto">
        {error || t('portal.noContent')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-[#0F172A] text-start font-sans max-w-3xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-6">
        <h1 className="text-xl font-extrabold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.brandSettings')}</h1>
        <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold mt-1 text-start">{t('portal.brandSettingsDesc')}</p>
      </div>

      {/* Brand Profile Details Panel */}
      <div className="border border-[#E2E8F0] bg-white p-6 flex flex-col gap-6 rounded-2xl shadow-xs text-start">
        <div className="border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
          <Settings className="size-4 text-[#1D61E7]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.brandProfile')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'اسم العلامة التجارية' : 'Brand Name'}</span>
            <p className="text-[#0F172A] font-bold text-sm bg-[#F8FAFC] border border-[#E2E8F0] h-10 px-3 flex items-center rounded-lg">{client.name}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'اسم الشركة' : 'Company Name'}</span>
            <p className="text-[#0F172A] font-semibold bg-[#F8FAFC] border border-[#E2E8F0] h-10 px-3 flex items-center rounded-lg">{client.company || t('common.noData')}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'البريد الإلكتروني للاتصال' : 'Contact Email'}</span>
            <p className="text-[#0F172A] font-semibold font-mono bg-[#F8FAFC] border border-[#E2E8F0] h-10 px-3 flex items-center rounded-lg">{client.email || t('common.noData')}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
            <p className="text-[#0F172A] font-semibold font-mono bg-[#F8FAFC] border border-[#E2E8F0] h-10 px-3 flex items-center rounded-lg">{client.phone || t('common.noData')}</p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'عنوان العلامة التجارية' : 'Brand Address'}</span>
            <div className="text-[#0F172A] font-semibold leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] p-3 min-h-[60px] whitespace-pre-line rounded-lg">
              {client.address || t('common.noData')}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'تاريخ بدء العقد' : 'Contract Start Date'}</span>
            <p className="text-[#0F172A] font-semibold font-mono bg-[#F8FAFC] border border-[#E2E8F0] h-10 px-3 flex items-center rounded-lg">
              {client.start_date ? new Date(client.start_date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }) : t('common.noData')}
            </p>
          </div>

          {client.content_plan_link && (
            <div className="space-y-1">
              <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'رابط ملفات العلامة التجارية' : 'Brand Assets Link'}</span>
              <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] h-10 items-center justify-between px-3 rounded-lg">
                <span className="truncate text-[#0F172A] max-w-[200px] font-semibold">{client.content_plan_link}</span>
                <a
                  href={client.content_plan_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono font-bold uppercase text-[#1D61E7] hover:text-[#1553c7] flex items-center gap-1 transition-colors"
                >
                  {locale === 'ar' ? 'فتح' : 'Open'} <Globe className="size-3" />
                </a>
              </div>
            </div>
          )}

          {client.other_deliverables && (
            <div className="space-y-1 md:col-span-2">
              <span className="text-[8px] font-bold text-[#64748B] uppercase tracking-widest font-mono">{locale === 'ar' ? 'مخطط التسليمات المخصصة' : 'Custom Deliverables Outline'}</span>
              <p className="text-[#0F172A] font-semibold leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg">
                {client.other_deliverables}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Alert Box */}
      <div className="border border-[#BFDBFE] bg-[#EFF6FF] p-4 flex gap-3 rounded-2xl text-[#1D61E7] text-[10px] uppercase font-mono tracking-wider font-semibold items-center shadow-xs text-start">
        <ShieldAlert className="size-4 shrink-0 text-[#1D61E7]" />
        <span>{locale === 'ar' ? 'لتحديث أي من تفاصيل هذا الملف أو التسليمات، يرجى التواصل مع مدير حسابك المخصص أو منسق المشروع.' : 'To update any of these profile details or deliverables, please get in touch with your Account Manager or Project Coordinator.'}</span>
      </div>

    </div>
  );
}

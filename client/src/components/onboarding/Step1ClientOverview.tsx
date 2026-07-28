'use client';

import { OnboardingOverview } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CollapsibleSection from './CollapsibleSection';
import { Building2, User, Share2, Globe, MapPin } from 'lucide-react';

interface Step1Props {
  data: OnboardingOverview;
  onChange: (data: OnboardingOverview) => void;
}

const COMPANY_STATUSES = [
  'Lead',
  'Discovery',
  'Onboarding',
  'Active Client',
  'Paused',
  'Former Client',
];

export default function Step1ClientOverview({ data = {}, onChange }: Step1Props) {
  const { t } = useLanguage();

  const updateField = (field: keyof OnboardingOverview, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Business Information */}
      <CollapsibleSection
        title={t('onboarding.s1.businessInfo')}
        subtitle={t('onboarding.s1.businessInfoSub')}
        icon={Building2}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s1.businessName')}</Label>
            <Input
              value={data.business_name || ''}
              onChange={(e) => updateField('business_name', e.target.value)}
              placeholder="e.g. Acume Luxury Perfumes"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.industry')}</Label>
            <Input
              value={data.industry || ''}
              onChange={(e) => updateField('industry', e.target.value)}
              placeholder="e.g. E-Commerce / Beauty / Real Estate"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.website')}</Label>
            <div className="relative">
              <Globe className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
              <Input
                value={data.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://example.com"
                className="pl-9 rtl:pr-9 rtl:pl-3"
              />
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s1.businessDescription')}</Label>
            <Textarea
              value={data.business_description || ''}
              onChange={(e) => updateField('business_description', e.target.value)}
              placeholder="Brief description of what the company does, products offered, etc."
              rows={3}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s1.address')}</Label>
            <Input
              value={data.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Street address or office location"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.googleMaps')}</Label>
            <div className="relative">
              <MapPin className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
              <Input
                value={data.google_maps_url || ''}
                onChange={(e) => updateField('google_maps_url', e.target.value)}
                placeholder="https://maps.google.com/..."
                className="pl-9 rtl:pr-9 rtl:pl-3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.yearFounded')}</Label>
            <Input
              type="number"
              value={data.year_founded || ''}
              onChange={(e) => updateField('year_founded', e.target.value)}
              placeholder="e.g. 2021"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s1.companyStatus')}</Label>
            <Select
              value={data.company_status || 'Active Client'}
              onValueChange={(val) => updateField('company_status', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company status" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Owner Information */}
      <CollapsibleSection
        title={t('onboarding.s1.ownerInfo')}
        subtitle={t('onboarding.s1.ownerInfoSub')}
        icon={User}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.ownerName')}</Label>
            <Input
              value={data.owner_name || ''}
              onChange={(e) => updateField('owner_name', e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.ownerPhone')}</Label>
            <Input
              value={data.owner_phone || ''}
              onChange={(e) => updateField('owner_phone', e.target.value)}
              placeholder="+20 1xx xxx xxxx"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Social Media Links */}
      <CollapsibleSection
        title={t('onboarding.s1.socialLinks')}
        subtitle={t('onboarding.s1.socialLinksSub')}
        icon={Share2}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.instagram')}</Label>
            <Input
              value={data.social_instagram || ''}
              onChange={(e) => updateField('social_instagram', e.target.value)}
              placeholder="https://instagram.com/username"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.tiktok')}</Label>
            <Input
              value={data.social_tiktok || ''}
              onChange={(e) => updateField('social_tiktok', e.target.value)}
              placeholder="https://tiktok.com/@username"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s1.facebook')}</Label>
            <Input
              value={data.social_facebook || ''}
              onChange={(e) => updateField('social_facebook', e.target.value)}
              placeholder="https://facebook.com/pagename"
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

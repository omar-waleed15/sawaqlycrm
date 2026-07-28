'use client';

import { useState } from 'react';
import { OnboardingSocialMediaAudit, OnboardingSocialMediaAuditItem } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CollapsibleSection from './CollapsibleSection';
import RichTextEditor from './RichTextEditor';
import { BarChart2, Share2, Video, Globe } from 'lucide-react';

interface Step6Props {
  data: OnboardingSocialMediaAudit;
  onChange: (data: OnboardingSocialMediaAudit) => void;
}

const PLATFORMS = [
  { name: 'Instagram', icon: Share2, color: 'text-pink-600' },
  { name: 'TikTok', icon: Video, color: 'text-slate-900 dark:text-slate-100' },
  { name: 'Facebook', icon: Globe, color: 'text-blue-600' },
];

export default function Step6SocialMediaAudit({ data = {}, onChange }: Step6Props) {
  const { t } = useLanguage();
  const [activePlatform, setActivePlatform] = useState('Instagram');
  const platforms = data.platforms || [];

  const getPlatformData = (name: string): OnboardingSocialMediaAuditItem => {
    const found = platforms.find((p) => p.platform === name);
    return (
      found || {
        platform: name,
        username: '',
        profile_url: '',
        followers: '',
        posting_frequency: '',
        average_engagement: '',
        best_content: '',
        weakest_content: '',
        notes: '',
      }
    );
  };

  const updatePlatformData = (name: string, field: keyof OnboardingSocialMediaAuditItem, val: string) => {
    const existingIdx = platforms.findIndex((p) => p.platform === name);
    const updatedItem = {
      ...getPlatformData(name),
      [field]: val,
    };

    let updatedList: OnboardingSocialMediaAuditItem[] = [];
    if (existingIdx >= 0) {
      updatedList = platforms.map((p, i) => (i === existingIdx ? updatedItem : p));
    } else {
      updatedList = [...platforms, updatedItem];
    }

    onChange({
      ...data,
      platforms: updatedList,
    });
  };

  const currentPlatformData = getPlatformData(activePlatform);

  return (
    <div className="space-y-6">
      {/* 1. Platform-by-Platform Audit */}
      <CollapsibleSection
        title={t('onboarding.s6.auditTitle')}
        subtitle={t('onboarding.s6.auditSub')}
        icon={BarChart2}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {/* Platform Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActive = activePlatform === p.name;
              const pData = getPlatformData(p.name);
              const hasData = Boolean(pData.username || pData.followers || pData.profile_url);

              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setActivePlatform(p.name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`size-4 ${p.color}`} />
                  <span>{p.name}</span>
                  {hasData && <span className="size-1.5 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </div>

          {/* Active Platform Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">{t('onboarding.s6.profileUrlHandle').replace('{platform}', activePlatform)}</Label>
              <Input
                value={currentPlatformData.profile_url || currentPlatformData.username || ''}
                onChange={(e) => {
                  updatePlatformData(activePlatform, 'profile_url', e.target.value);
                  updatePlatformData(activePlatform, 'username', e.target.value);
                }}
                placeholder={`https://${activePlatform.toLowerCase()}.com/username or @username`}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('onboarding.s6.followers')}</Label>
              <Input
                value={currentPlatformData.followers || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'followers', e.target.value)}
                placeholder="e.g. 15.4k followers"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('onboarding.s6.postingFrequency')}</Label>
              <Input
                value={currentPlatformData.posting_frequency || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'posting_frequency', e.target.value)}
                placeholder="e.g. 3 posts/week or Inactive"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">{t('onboarding.s6.engagementLevel')}</Label>
              <Input
                value={currentPlatformData.average_engagement || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'average_engagement', e.target.value)}
                placeholder="e.g. ~2.5% engagement, ~5k views per reel"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('onboarding.s6.contentTypes')}</Label>
              <Textarea
                value={currentPlatformData.best_content || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'best_content', e.target.value)}
                placeholder="What type of posts got the highest engagement/views?"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('onboarding.s6.visualBrandingQuality')}</Label>
              <Textarea
                value={currentPlatformData.weakest_content || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'weakest_content', e.target.value)}
                placeholder="What content performed poorly?"
                rows={2}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">{t('onboarding.s6.accountImprovementNotes')}</Label>
              <Textarea
                value={currentPlatformData.notes || ''}
                onChange={(e) => updatePlatformData(activePlatform, 'notes', e.target.value)}
                placeholder="Channel specific observations..."
                rows={2}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Overall Social Media Summary */}
      <CollapsibleSection
        title={t('onboarding.s6.overallSummaryTitle')}
        subtitle={t('onboarding.s6.overallSummarySub')}
        icon={BarChart2}
        defaultOpen={true}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('onboarding.s6.overallAuditNotes')}</Label>
          <RichTextEditor
            value={data.overall_notes || ''}
            onChange={(val) => onChange({ ...data, overall_notes: val })}
            placeholder="Summarize overall observations: current strengths, primary weaknesses, immediate 30-day improvements..."
            minHeight="180px"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ClientOnboarding } from '@/types';
import { useLanguage } from '@/lib/i18n';
import Step1ClientOverview from './Step1ClientOverview';
import Step2BrandAssets from './Step2BrandAssets';
import Step4TargetAudience from './Step4TargetAudience';
import Step5CompetitorAnalysis from './Step5CompetitorAnalysis';
import Step6SocialMediaAudit from './Step6SocialMediaAudit';
import Step7ContentStrategy from './Step7ContentStrategy';
import {
  Building2,
  Image as ImageIcon,
  Target,
  Users2,
  BarChart2,
  Lightbulb,
  Sparkles,
} from 'lucide-react';

interface Step2AdvancedDataProps {
  onboarding: ClientOnboarding;
  onChange: (updated: ClientOnboarding) => void;
}

export default function Step2AdvancedData({ onboarding, onChange }: Step2AdvancedDataProps) {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const [activeTab, setActiveTab] = useState<'contact' | 'assets' | 'audience' | 'competitors' | 'audit' | 'strategy'>('contact');

  const tabs = [
    {
      id: 'contact',
      label: isAr ? 'معلومات التواصل والحسابات' : 'Contact & Channels',
      icon: Building2,
    },
    {
      id: 'assets',
      label: isAr ? 'الأصول والملفات البصرية' : 'Brand Assets & Media',
      icon: ImageIcon,
    },
    {
      id: 'audience',
      label: isAr ? 'الجمهور المستهدف بالتفصيل' : 'Audience Persona',
      icon: Target,
    },
    {
      id: 'competitors',
      label: isAr ? 'تحليل المنافسين التفصيلي' : 'Competitors Matrix',
      icon: Users2,
    },
    {
      id: 'audit',
      label: isAr ? 'تدقيق وسائل التواصل' : 'Social Media Audit',
      icon: BarChart2,
    },
    {
      id: 'strategy',
      label: isAr ? 'استراتيجية المحتوى المتقدمة' : 'Content Strategy',
      icon: Lightbulb,
    },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Tabs Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-900/80 rounded-2xl overflow-x-auto no-scrollbar border border-slate-300/60 dark:border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'contact' && (
          <Step1ClientOverview
            data={onboarding.client_overview || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                client_overview: data,
              })
            }
          />
        )}

        {activeTab === 'assets' && (
          <Step2BrandAssets
            clientId={onboarding.client_id}
            data={onboarding.brand_assets || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                brand_assets: data,
              })
            }
          />
        )}

        {activeTab === 'audience' && (
          <Step4TargetAudience
            data={onboarding.target_audience || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                target_audience: data,
              })
            }
          />
        )}

        {activeTab === 'competitors' && (
          <Step5CompetitorAnalysis
            data={onboarding.competitor_analysis || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                competitor_analysis: data,
              })
            }
          />
        )}

        {activeTab === 'audit' && (
          <Step6SocialMediaAudit
            data={onboarding.social_media_audit || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                social_media_audit: data,
              })
            }
          />
        )}

        {activeTab === 'strategy' && (
          <Step7ContentStrategy
            data={onboarding.content_strategy || {}}
            onChange={(data) =>
              onChange({
                ...onboarding,
                content_strategy: data,
              })
            }
          />
        )}
      </div>
    </div>
  );
}

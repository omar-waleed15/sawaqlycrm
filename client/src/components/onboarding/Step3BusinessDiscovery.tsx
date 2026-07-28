'use client';

import { OnboardingBusinessDiscovery } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CollapsibleSection from './CollapsibleSection';
import ChipSelect from './ChipSelect';
import RichTextEditor from './RichTextEditor';
import { Search, Target, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Step3Props {
  data: OnboardingBusinessDiscovery;
  onChange: (data: OnboardingBusinessDiscovery) => void;
}

const DEFAULT_PAIN_POINTS = [
  'Inconsistent posting schedule',
  'Low organic reach & views',
  'Low engagement (likes/comments)',
  'Poor video & Reel content quality',
  'Lack of content strategy',
  'Weak brand identity & aesthetics',
  'Few inbound DM leads & inquiries',
  'No time to create social content',
  'Stagnant follower growth',
  'Outdated profile bio & highlights',
  'Unclear brand messaging',
  'Difficulty creating trending hooks',
  'Low conversion from social traffic',
];

export default function Step3BusinessDiscovery({ data = {}, onChange }: Step3Props) {
  const { t } = useLanguage();

  const updateSubField = (parentKey: 'about' | 'goals' | 'agency_opportunity', field: string, val: any) => {
    onChange({
      ...data,
      [parentKey]: {
        ...(data[parentKey] || {}),
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. About the Business */}
      <CollapsibleSection
        title={t('onboarding.s3.aboutTitle')}
        subtitle={t('onboarding.s3.aboutSub')}
        icon={Search}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.whatBusinessDoes')}</Label>
            <Textarea
              value={data.about?.description || ''}
              onChange={(e) => updateSubField('about', 'description', e.target.value)}
              placeholder="Core elevator pitch and operational summary..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.productsServices')}</Label>
            <Textarea
              value={data.about?.products || data.about?.services || ''}
              onChange={(e) => {
                updateSubField('about', 'products', e.target.value);
                updateSubField('about', 'services', e.target.value);
              }}
              placeholder="List key product lines, services, or packages offered"
              rows={3}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.bestSelling')}</Label>
            <Input
              value={data.about?.best_selling || ''}
              onChange={(e) => updateSubField('about', 'best_selling', e.target.value)}
              placeholder="Which product or service generates the most sales volume?"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.usp')}</Label>
            <Textarea
              value={data.about?.usp || ''}
              onChange={(e) => updateSubField('about', 'usp', e.target.value)}
              placeholder="What makes them different or better than any competitor?"
              rows={2}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Business Goals */}
      <CollapsibleSection
        title={t('onboarding.s3.goalsTitle')}
        subtitle={t('onboarding.s3.goalsSub')}
        icon={Target}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.whyHired')}</Label>
            <Textarea
              value={data.goals?.why_hired || ''}
              onChange={(e) => updateSubField('goals', 'why_hired', e.target.value)}
              placeholder="What specific trigger or pain point made them look for an agency?"
              rows={2}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.mainObjective')}</Label>
            <Input
              value={data.goals?.main_objective || ''}
              onChange={(e) => updateSubField('goals', 'main_objective', e.target.value)}
              placeholder="e.g. Build brand presence & scale DM leads on IG/TikTok"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.shortTermGoals')}</Label>
            <Textarea
              value={data.goals?.short_term_goals || ''}
              onChange={(e) => updateSubField('goals', 'short_term_goals', e.target.value)}
              placeholder="Immediate deliverables & wins"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.longTermGoals')}</Label>
            <Textarea
              value={data.goals?.long_term_goals || ''}
              onChange={(e) => updateSubField('goals', 'long_term_goals', e.target.value)}
              placeholder="Big picture vision & scaling goals"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.successMetrics')}</Label>
            <Input
              value={data.goals?.success_metrics || ''}
              onChange={(e) => updateSubField('goals', 'success_metrics', e.target.value)}
              placeholder="e.g. Reel views, engagement rate, DM leads"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.currentPriorities')}</Label>
            <Input
              value={data.goals?.current_priorities || ''}
              onChange={(e) => updateSubField('goals', 'current_priorities', e.target.value)}
              placeholder="e.g. Short-form Reels, carousels, profile setup"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Marketing Pain Points */}
      <CollapsibleSection
        title={t('onboarding.s3.painPointsTitle')}
        subtitle={t('onboarding.s3.painPointsSub')}
        icon={AlertTriangle}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.selectPainPoints')}</Label>
            <ChipSelect
              options={DEFAULT_PAIN_POINTS}
              selected={data.pain_points || []}
              onChange={(selected) => onChange({ ...data, pain_points: selected })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.painPointsNotes')}</Label>
            <Textarea
              value={data.pain_points_notes || ''}
              onChange={(e) => onChange({ ...data, pain_points_notes: e.target.value })}
              placeholder="Specific marketing struggles..."
              rows={2}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Agency Opportunity Analysis */}
      <CollapsibleSection
        title={t('onboarding.s3.agencyOppTitle')}
        subtitle={t('onboarding.s3.agencyOppSub')}
        icon={ShieldCheck}
        defaultOpen={true}
        badge={
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
            {t('onboarding.s3.internalOnly')}
          </span>
        }
        className="border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.biggestOpportunity')}</Label>
            <Input
              value={data.agency_opportunity?.biggest_opportunity || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'biggest_opportunity', e.target.value)}
              placeholder="e.g. Scaling organic Reel views & IG bio funnel"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.quickWins')}</Label>
            <Input
              value={data.agency_opportunity?.quick_wins || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'quick_wins', e.target.value)}
              placeholder="e.g. Bio optimization & 3 viral Reel hooks"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.longTermOpp')}</Label>
            <Input
              value={data.agency_opportunity?.long_term_opportunities || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'long_term_opportunities', e.target.value)}
              placeholder="e.g. Brand authority & weekly video series"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.contentOpp')}</Label>
            <Input
              value={data.agency_opportunity?.content_opportunities || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'content_opportunities', e.target.value)}
              placeholder="e.g. BTS videos, carousels, trending Reels"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.campaignIdeas')}</Label>
            <Input
              value={data.agency_opportunity?.campaign_ideas || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'campaign_ideas', e.target.value)}
              placeholder="e.g. Viral giveaway, seasonal product launch"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.growthOpp')}</Label>
            <Input
              value={data.agency_opportunity?.growth_opportunities || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'growth_opportunities', e.target.value)}
              placeholder="e.g. Expand to TikTok & UGC creator deals"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.seasonalOpp')}</Label>
            <Input
              value={data.agency_opportunity?.seasonal_opportunities || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'seasonal_opportunities', e.target.value)}
              placeholder="e.g. Ramadan, White Friday, Summer sales"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s3.recommendedServices')}</Label>
            <Input
              value={data.agency_opportunity?.recommended_services || ''}
              onChange={(e) => updateSubField('agency_opportunity', 'recommended_services', e.target.value)}
              placeholder="e.g. 12 Reels/mo + 15 Stories + Moderation"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s3.strategyNotes')}</Label>
            <RichTextEditor
              value={data.agency_opportunity?.strategy_notes || ''}
              onChange={(val) => updateSubField('agency_opportunity', 'strategy_notes', val)}
              placeholder="Notes for creators, video editors, and managers..."
              minHeight="120px"
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

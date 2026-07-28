'use client';

import { OnboardingContentStrategy } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import CollapsibleSection from './CollapsibleSection';
import ChipSelect from './ChipSelect';
import RichTextEditor from './RichTextEditor';
import { Mic, Columns, Sparkles, AlertOctagon, PenTool } from 'lucide-react';

interface Step7Props {
  data: OnboardingContentStrategy;
  onChange: (data: OnboardingContentStrategy) => void;
}

const BRAND_VOICE_OPTIONS = [
  'Professional',
  'Friendly',
  'Luxury',
  'Premium',
  'Funny',
  'Educational',
  'Inspirational',
  'Modern',
  'Bold',
  'Minimal',
  'Energetic',
  'Corporate',
];

const CONTENT_PILLARS_OPTIONS = [
  'Educational',
  'Entertainment',
  'Behind the Scenes',
  'Testimonials',
  'Products',
  'Services',
  'Promotions',
  'Community',
  'Lifestyle',
  'News',
  'Tips',
  'User Generated Content',
];

const CONTENT_STYLE_OPTIONS = [
  'Talking Head',
  'Voiceover',
  'UGC',
  'Cinematic',
  'Documentary',
  'Storytelling',
  'Trend Based',
  'Interview Style',
  'Product Showcase',
  'Before & After',
  'Tutorial',
  'Day in the Life',
];

export default function Step7ContentStrategy({ data = {}, onChange }: Step7Props) {
  const { t } = useLanguage();

  const updateField = (field: keyof OnboardingContentStrategy, val: any) => {
    onChange({
      ...data,
      [field]: val,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Brand Voice */}
      <CollapsibleSection
        title={t('onboarding.s7.voiceTitle')}
        subtitle={t('onboarding.s7.voiceSub')}
        icon={Mic}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t('onboarding.s7.selectVoice')}</Label>
          <ChipSelect
            options={BRAND_VOICE_OPTIONS}
            selected={data.brand_voice || []}
            onChange={(selected) => updateField('brand_voice', selected)}
          />
        </div>
      </CollapsibleSection>

      {/* 2. Content Pillars */}
      <CollapsibleSection
        title={t('onboarding.s7.pillarsTitle')}
        subtitle={t('onboarding.s7.pillarsSub')}
        icon={Columns}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t('onboarding.s7.selectPillars')}</Label>
          <ChipSelect
            options={CONTENT_PILLARS_OPTIONS}
            selected={data.content_pillars || []}
            onChange={(selected) => updateField('content_pillars', selected)}
          />
        </div>
      </CollapsibleSection>

      {/* 3. Content Style & Formats */}
      <CollapsibleSection
        title={t('onboarding.s7.styleTitle')}
        subtitle={t('onboarding.s7.styleSub')}
        icon={Sparkles}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t('onboarding.s7.selectStyles')}</Label>
          <ChipSelect
            options={CONTENT_STYLE_OPTIONS}
            selected={data.content_style || []}
            onChange={(selected) => updateField('content_style', selected)}
          />
        </div>
      </CollapsibleSection>

      {/* 4. Things to Avoid */}
      <CollapsibleSection
        title={t('onboarding.s7.avoidTitle')}
        subtitle={t('onboarding.s7.avoidSub')}
        icon={AlertOctagon}
        defaultOpen={true}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('onboarding.s7.thingsToAvoid')}</Label>
          <RichTextEditor
            value={data.things_to_avoid || ''}
            onChange={(val) => updateField('things_to_avoid', val)}
            placeholder="e.g. Don't use political topics, avoid controversial humor, don't use dancing videos, no dark color grading, avoid excessive emojis..."
            minHeight="120px"
          />
        </div>
      </CollapsibleSection>

      {/* 5. Creative Notes & Strategy Direction */}
      <CollapsibleSection
        title={t('onboarding.s7.creativeMasterTitle')}
        subtitle={t('onboarding.s7.creativeMasterSub')}
        icon={PenTool}
        defaultOpen={true}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('onboarding.s7.creativeNotes')}</Label>
          <RichTextEditor
            value={data.creative_notes || ''}
            onChange={(val) => updateField('creative_notes', val)}
            placeholder="Comprehensive instructions for the creative team regarding music choices, pacing, hook formulas, branding placement..."
            minHeight="180px"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
